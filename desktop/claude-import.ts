// Upload of skills, agents and Moki activities from a .claude folder, a project that contains one, a skills/,
// agents/ or activities/ folder, a single skill, a single agent or activity (.md), or the same inside a .zip. Pure reading and checking: nothing here writes to
// the install folders (the service does, after the user confirms). Everything read is untrusted: names are
// validated, files are limited, symbolic links are not followed and secrets block the item. Blocking
// reasons are codes; the app translates them.

import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzip } from '../scripts/lib/zip.mjs';
import { PATTERNS } from '../scripts/lib/secret-patterns.mjs';
import { parseActivity } from '../scripts/lib/activities.ts';

export const LIMITS = { maxFiles: 1000, maxFileBytes: 5 * 1024 * 1024, maxTotalBytes: 50 * 1024 * 1024 };

export type ImportKind = 'skill' | 'agent' | 'activity';
// Why an item cannot be installed. 'installed' is added by the service (it knows the destination).
export type BlockReason = 'invalid-name' | 'no-skill-md' | 'no-description' | 'secret' | 'moki-name' | 'installed' | 'invalid-activity' | 'duplicate';
export interface Blocked { reason: BlockReason; detail?: string; file?: string } // secret: its kind (detail) and file, never its value
export interface ImportFile { path: string; data: Buffer }
export interface ImportEntry {
  kind: ImportKind; name: string; description: string;
  files: ImportFile[]; // what would be written (agents and activities: one file)
  discarded: string[]; // files left out of a skill (.env*, *.pem, *.key, settings.local.json)
  from?: string; // an agent kept in a subfolder of agents/: that subfolder (the install is always flat)
  blocked?: Blocked;
}
export type IgnoredReason = 'config' | 'symlink' | 'other';
export interface Scan { entries: ImportEntry[]; ignored: { path: string; reason: IgnoredReason }[] }

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PARTS = ['skills', 'agents', 'activities'];
// Settings, hooks, commands and MCP files can run commands or change the AI tool: listed, never imported.
const CONFIG = new Set(['settings.json', 'settings.local.json', 'hooks', 'commands', 'CLAUDE.md', '.mcp.json']);
const SENSITIVE_FILE = /(^|\/)(\.env(\..*)?|settings\.local\.json|[^/]+\.(pem|key))$/i;
const TEXT_SCAN_BYTES = 2 * 1024 * 1024;

type Files = Map<string, Buffer>;
interface Read { files: Files; ignored: Scan['ignored'] }

class Limit { files = 0; bytes = 0 }

// ---------------------------------------------------------------- reading the source

function walk(abs: string, rel: string, out: Read, used: Limit): void {
  for (const name of readdirSync(abs)) {
    const path = join(abs, name);
    const r = rel ? `${rel}/${name}` : name;
    const st = lstatSync(path); // lstat: a symbolic link is listed, not followed
    if (st.isSymbolicLink()) { out.ignored.push({ path: r, reason: 'symlink' }); continue; }
    if (st.isDirectory()) { walk(path, r, out, used); continue; }
    if (!st.isFile()) continue;
    if (++used.files > LIMITS.maxFiles) throw new Error(`The folder has more than ${LIMITS.maxFiles} files.`);
    if (st.size > LIMITS.maxFileBytes) throw new Error(`${r} is larger than ${LIMITS.maxFileBytes / 1048576} MB.`);
    used.bytes += st.size;
    if (used.bytes > LIMITS.maxTotalBytes) throw new Error(`The folder is larger than ${LIMITS.maxTotalBytes / 1048576} MB.`);
    out.files.set(r, readFileSync(path));
  }
}

// Reads only the parts that can hold skills or agents, so a project folder with node_modules is not walked.
export function readFolder(dir: string): Read {
  const out: Read = { files: new Map(), ignored: [] };
  const used = new Limit();
  const kind = (p: string) => { try { return lstatSync(join(dir, p)); } catch { return null; } };
  const has = (p: string) => kind(p) !== null;
  if (kind('.claude')?.isDirectory()) {
    walk(join(dir, '.claude'), '.claude', out, used);
    if (kind('activities')?.isDirectory()) walk(join(dir, 'activities'), 'activities', out, used);
    for (const f of ['CLAUDE.md', '.mcp.json']) if (has(f)) out.ignored.push({ path: f, reason: 'config' });
  } else if (PARTS.some((part) => kind(part)?.isDirectory())) {
    for (const part of PARTS) if (kind(part)?.isDirectory()) walk(join(dir, part), part, out, used);
    for (const f of CONFIG) if (has(f)) out.ignored.push({ path: f, reason: 'config' });
  } else if (has('SKILL.md')) walk(dir, '', out, used);
  else throw new Error('No .claude folder, skills/, agents/, activities/ or SKILL.md found in this folder.');
  return out;
}

// One agent or activity file (.md), dropped or chosen on its own.
export function readMarkdown(name: string, data: Buffer): Read {
  if (data.length > LIMITS.maxFileBytes) throw new Error(`${name} is larger than ${LIMITS.maxFileBytes / 1048576} MB.`);
  return { files: new Map([[name, data]]), ignored: [] };
}

export function readZip(buf: Buffer): Read {
  const skipped: string[] = [];
  let all: Files;
  try { all = unzip(buf, { ...LIMITS, skipped }) as Files; } catch (e) {
    throw new Error(e instanceof RangeError ? `A file in the ZIP is larger than ${LIMITS.maxFileBytes / 1048576} MB.` : `Could not read the ZIP: ${e instanceof Error ? e.message : String(e)}`);
  }
  const files: Files = new Map([...all].filter(([name]) => !name.endsWith('/')));
  // A zip of a folder keeps the folder's name as its only top-level entry.
  const tops = new Set([...files.keys()].map((k) => k.split('/')[0]));
  const [only] = [...tops];
  const wrapped = tops.size === 1 && ![...files.keys()].includes(only) && !['.claude', ...PARTS].includes(only);
  const out: Read = { files: wrapped ? new Map([...files].map(([k, v]) => [k.slice(only.length + 1), v])) : files, ignored: skipped.map((path) => ({ path, reason: 'symlink' as const })) };
  if (![...out.files.keys()].some((k) => /^(\.claude\/|skills\/|agents\/|activities\/|SKILL\.md$|[^/]+\.md$)/.test(k))) throw new Error('No .claude folder, skills/, agents/, activities/ or SKILL.md found in this ZIP.');
  return out;
}

// ---------------------------------------------------------------- recognizing items

function describe(text: string): string {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text.replace(/^﻿/, ''))?.[1];
  if (!block) return '';
  const lines = block.split(/\r?\n/);
  const i = lines.findIndex((l) => /^description:/.test(l));
  if (i < 0) return '';
  const first = lines[i].slice('description:'.length).trim();
  const rest: string[] = [];
  for (const l of lines.slice(i + 1)) { if (/^\s+\S/.test(l)) rest.push(l.trim()); else break; }
  const value = /^[>|][+-]?$/.test(first) || first === '' ? rest.join(' ') : first;
  return value.replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
}

// The first secret-looking line of a text file: its label only, never the value.
function secretIn(files: ImportFile[]): { detail: string; file: string } | undefined {
  for (const f of files) {
    if (f.data.length > TEXT_SCAN_BYTES || f.data.includes(0)) continue;
    const hit = f.data.toString('utf8').split('\n').map((line) => (PATTERNS as [string, RegExp][]).find(([, re]) => re.test(line))).find(Boolean);
    if (hit) return { detail: hit[0] as string, file: f.path };
  }
  return undefined;
}

// `reserved`: names of Moki's own skills and agents, which an upload may not take over.
// An activity has a "label:" in its header; any other .md with a header is taken as an agent.
const isActivity = (text: string): boolean => /^label:/m.test(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text.replace(/^﻿/, ''))?.[1] ?? '');

function activityEntry(file: string, data: Buffer, reserved: Set<string>): ImportEntry {
  const id = file.replace(/\.md$/, '');
  const { activity, errors } = parseActivity(data.toString('utf8'), id, 'library');
  const e: ImportEntry = { kind: 'activity', name: id, description: activity?.label ?? '', files: [{ path: file, data }], discarded: [] };
  if (!activity) return { ...e, blocked: { reason: NAME.test(id) ? 'invalid-activity' : 'invalid-name', detail: errors[0] } };
  return check(e, reserved);
}

export function scan(read: Read, reserved: { skills: Set<string>; agents: Set<string>; activities?: Set<string> }): Scan {
  const hasBase = [...read.files.keys()].some((k) => k.startsWith('.claude/'));
  const ignored = [...read.ignored];
  const listed = new Set<string>();
  const skip = (top: string) => { if (!listed.has(top)) { listed.add(top); ignored.push({ path: top, reason: CONFIG.has(top) ? 'config' : 'other' }); } };

  // rel: the paths seen from inside the .claude (or from the picked skills/agents folder).
  const rel: Files = new Map();
  for (const [k, v] of read.files) {
    if (!hasBase) rel.set(k, v);
    else if (k.startsWith('.claude/')) rel.set(k.slice('.claude/'.length), v);
    else if (k.startsWith('activities/')) rel.set(k, v); // Moki activities kept beside a .claude folder
    else skip(k.split('/')[0]);
  }

  const entries: ImportEntry[] = [];
  const skills = new Map<string, ImportFile[]>();
  const keys = [...rel.keys()];
  const singleSkill = rel.has('SKILL.md') && !keys.some((k) => /^(skills|agents|activities)\//.test(k));
  const activities = reserved.activities ?? new Set<string>();
  if (singleSkill) skills.set('', keys.map((k) => ({ path: k, data: rel.get(k) as Buffer })));
  else {
    // Sorted by path: the same folder always gives the same order (and the same "first" of a repeated name).
    for (const [path, data] of [...rel].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
      const parts = path.split('/');
      if (parts[0] === 'skills' && parts.length >= 3) skills.set(parts[1], [...(skills.get(parts[1]) ?? []), { path: parts.slice(2).join('/'), data }]);
      else if (parts[0] === 'agents' && parts.length >= 2) {
        // Claude Code reads agents at any depth of agents/; a README or a non-.md file is listed by its full path.
        const file = parts[parts.length - 1];
        if (!file.endsWith('.md') || file === 'README.md') { ignored.push({ path, reason: 'other' }); continue; }
        const from = parts.slice(1, -1).join('/');
        entries.push(check({ kind: 'agent', name: file.slice(0, -3), description: describe(data.toString('utf8')), files: [{ path: file, data }], discarded: [], ...(from && { from }) }, reserved.agents));
      } else if (parts[0] === 'activities' && parts.length === 2 && parts[1].endsWith('.md') && parts[1] !== 'README.md') {
        entries.push(activityEntry(parts[1], data, activities));
      } else if (parts.length === 1 && parts[0].endsWith('.md') && rel.size === 1) {
        // A single .md: an activity or an agent, by its header.
        const text = data.toString('utf8');
        entries.push(isActivity(text) ? activityEntry(parts[0], data, activities)
          : check({ kind: 'agent', name: parts[0].slice(0, -3), description: describe(text), files: [{ path: parts[0], data }], discarded: [] }, reserved.agents));
      } else skip(parts[0]);
    }
  }

  for (const [dir, list] of skills) {
    const keep = list.filter((f) => !SENSITIVE_FILE.test(f.path));
    const text = keep.find((f) => f.path === 'SKILL.md')?.data.toString('utf8');
    // A single skill has no folder name: it is named by its frontmatter.
    const name = dir || (/^name:\s*["']?([^"'\r\n]+?)["']?\s*$/m.exec(/^---\r?\n([\s\S]*?)\r?\n---/.exec(text ?? '')?.[1] ?? '')?.[1] ?? '');
    const e: ImportEntry = { kind: 'skill', name, description: text ? describe(text) : '', files: keep, discarded: list.filter((f) => SENSITIVE_FILE.test(f.path)).map((f) => f.path) };
    entries.push(text === undefined ? { ...e, blocked: { reason: 'no-skill-md' } } : check(e, reserved.skills));
  }
  // Agents install flat (agents/<name>.md), so a name kept in two folders is offered once: the first by path.
  const first = new Map<string, ImportEntry>();
  const where = (e: ImportEntry) => `agents/${e.from ? `${e.from}/` : ''}${e.files[0].path}`;
  const marked = entries.map((e) => {
    if (e.kind !== 'agent') return e;
    const other = first.get(e.name);
    if (!other) { first.set(e.name, e); return e; }
    return { ...e, blocked: e.blocked ?? { reason: 'duplicate' as const, detail: where(other) } };
  });
  return { entries: marked, ignored };
}

// The first reason an item cannot be installed, in a fixed order.
function check(e: ImportEntry, reserved: Set<string>): ImportEntry {
  if (!NAME.test(e.name)) return { ...e, blocked: { reason: 'invalid-name' } };
  if (reserved.has(e.name)) return { ...e, blocked: { reason: 'moki-name' } };
  if (!e.description) return { ...e, blocked: { reason: 'no-description' } };
  const secret = secretIn(e.files);
  return secret ? { ...e, blocked: { reason: 'secret', ...secret } } : e;
}
