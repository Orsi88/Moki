// Evolution of agents, skills and activities (Mycroft): what the person taught each item, the changes proposed from
// it, and the versions approved. Lives in the workspace (<workspace>/library/evolution/<kind>/<name>/), never in
// the framework: a built-in item's file never changes - an approved version is used in its place in this workspace
// and survives app updates; the person's own item (a library agent or activity) gets the new text in its own file,
// with every earlier text kept here. Version 0 is the item as it was before its first change ("Restore the original").
// Nothing here applies a version by itself: approve, revert and restore are called by the app on the person's click.
//
// <workspace>/library/evolution/
//   learnings.jsonl                    what the person taught, for the whole workspace (a project keeps its own)
//   <kind>/<name>/history.json         { active, entries[] }: each version, why, from what, who proposed, when approved
//   <kind>/<name>/v<N>/                 the text of version N (a skill: its whole folder, so its links keep working)
//   <kind>/<name>/proposals/<id>.json  changes waiting for the person

import { createHash, randomBytes } from 'node:crypto';
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT, workspaceDir, workspaceLabel } from './repo.mjs';

export type EvolutionKind = 'agent' | 'skill' | 'activity';
export const EVOLUTION_KINDS: EvolutionKind[] = ['agent', 'skill', 'activity'];
export const isEvolutionKind = (v: unknown): v is EvolutionKind => EVOLUTION_KINDS.includes(v as EvolutionKind);
const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const isItemName = (v: unknown): v is string => typeof v === 'string' && NAME.test(v);

// An item as Moki ships it or as the person made it: `file` is its main text (an agent's .md, a skill's SKILL.md,
// an activity's .md), absolute; `builtin`: shipped with Moki (its file is never written).
export interface EvolvedItem { kind: EvolutionKind; name: string; file: string; builtin: boolean }

export interface VersionEntry {
  version: number;
  at: string; // when it became the version in use (approved, reverted to, restored)
  event: 'version' | 'revert' | 'restore';
  reason: string;
  proposedBy: 'mycroft' | 'person';
  learnings: string[]; // the learnings it answers
  base: string; // hash of the original it was made over: a newer original from Moki shows as changed
  from?: number; // revert: the version copied
}
export interface ItemHistory { active: number; entries: VersionEntry[] }

export interface Learning {
  id: string; at: string; kind: EvolutionKind; name: string;
  text: string; // the person's own words
  scope: 'workspace' | 'project'; project?: string;
  source?: string; // where it was said: a conversation, a run
  status: 'open' | 'used' | 'dismissed'; usedIn?: number;
}

export interface Proposal {
  id: string; at: string; kind: EvolutionKind; name: string;
  text: string; // the whole new text of the item's main file
  reason: string; learnings: string[]; proposedBy: 'mycroft' | 'person';
  base: number; // the version in use when it was written: approving it over a newer one is refused
}

const MAX_TEXT = 200_000;
const MAX_WORDS = 4000;

export const evolutionDir = (root = ROOT) => join(workspaceDir(root), 'library', 'evolution');
const itemDir = (kind: EvolutionKind, name: string, root: string) => {
  if (!isEvolutionKind(kind) || !isItemName(name)) throw new Error('Unknown item.');
  return join(evolutionDir(root), kind, name);
};
const mainName = (item: Pick<EvolvedItem, 'kind' | 'name'>) => (item.kind === 'skill' ? 'SKILL.md' : `${item.name}.md`);
const versionDir = (item: EvolvedItem, v: number, root: string) => join(itemDir(item.kind, item.name, root), `v${v}`);
export const textHash = (text: string) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex').slice(0, 16);
const now = () => new Date().toISOString();
const id = () => `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;

function writeJson(file: string, data: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  renameSync(tmp, file);
}
const readJson = <T>(file: string, fallback: T): T => { try { return JSON.parse(readFileSync(file, 'utf8')) as T; } catch { return fallback; } };
const readText = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

export function itemHistory(kind: EvolutionKind, name: string, root = ROOT): ItemHistory {
  const h = readJson<Partial<ItemHistory>>(join(itemDir(kind, name, root), 'history.json'), {});
  return { active: Number.isInteger(h.active) && (h.active ?? 0) >= 0 ? h.active as number : 0, entries: Array.isArray(h.entries) ? h.entries : [] };
}
const saveHistory = (item: EvolvedItem, h: ItemHistory, root: string) => writeJson(join(itemDir(item.kind, item.name, root), 'history.json'), h);

// The file Moki gives the AI for a built-in item with an approved version in use; null: its own file is in use.
export function activeFile(item: Pick<EvolvedItem, 'kind' | 'name' | 'builtin'>, root = ROOT): string | null {
  if (!item.builtin || !isItemName(item.name)) return null;
  const { active } = itemHistory(item.kind, item.name, root);
  if (!active) return null;
  const file = join(itemDir(item.kind, item.name, root), `v${active}`, mainName(item));
  return existsSync(file) ? file : null;
}
// How that file is written in a request: under the workspace's label, as every other workspace path.
export function activeLabel(item: Pick<EvolvedItem, 'kind' | 'name' | 'builtin'>, root = ROOT): string | null {
  const file = activeFile(item, root);
  if (!file) return null;
  const { active } = itemHistory(item.kind, item.name, root);
  return `${workspaceLabel(root)}/library/evolution/${item.kind}/${item.name}/v${active}/${mainName(item)}`;
}
// The skills with a version in use other than Moki's, for the note that tells the AI to read those instead.
export function evolvedSkills(root = ROOT): { name: string; path: string }[] {
  const dir = join(evolutionDir(root), 'skill');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(isItemName).flatMap((name) => {
    const path = activeLabel({ kind: 'skill', name, builtin: true }, root);
    return path ? [{ name, path }] : [];
  });
}

// The text of a version: 0 is the original (as kept before the first change, else the item's file today).
export function versionText(item: EvolvedItem, v: number, root = ROOT): string {
  const kept = join(versionDir(item, v, root), mainName(item));
  if (existsSync(kept)) return readText(kept);
  if (v === 0) return readText(item.file);
  throw new Error('Unknown version.');
}
export function currentText(item: EvolvedItem, root = ROOT): string {
  return readText(activeFile(item, root) ?? item.file);
}

// Moki shipped a newer original of a built-in item the person evolved: their versions are over an older text.
export function originalChanged(item: EvolvedItem, root = ROOT): boolean {
  const h = itemHistory(item.kind, item.name, root);
  const last = h.entries.filter((e) => e.version === h.active).at(-1);
  return item.builtin && h.active > 0 && Boolean(last) && existsSync(item.file) && textHash(readText(item.file)) !== last!.base;
}

// ---------------------------------------------------------------- learnings

const learningsFile = (root: string, projectDir?: string) => (projectDir ? join(projectDir, 'learnings.jsonl') : join(evolutionDir(root), 'learnings.jsonl'));
const readLearnings = (file: string): Learning[] => {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').split('\n').flatMap((line) => { try { return line.trim() ? [JSON.parse(line) as Learning] : []; } catch { return []; } });
};

// What the person taught an item, in their own words: for the whole workspace, or only for one project (kept in it).
export function learn(input: { kind: unknown; name: unknown; text: unknown; scope?: unknown; source?: unknown }, root = ROOT, project?: { id: string; dir: string }): Learning {
  const { kind, name } = input;
  if (!isEvolutionKind(kind) || !isItemName(name)) throw new Error('Name the agent, skill or activity this is about.');
  const text = typeof input.text === 'string' ? input.text.trim().slice(0, MAX_WORDS) : '';
  if (!text) throw new Error('Say what should change, in the person\'s own words.');
  const scope = input.scope === 'project' && project ? 'project' : 'workspace';
  const learning: Learning = {
    id: id(), at: now(), kind, name, text, scope, ...(scope === 'project' ? { project: project!.id } : {}),
    ...(typeof input.source === 'string' && input.source.trim() ? { source: input.source.trim().slice(0, 300) } : {}), status: 'open',
  };
  const file = learningsFile(root, scope === 'project' ? project!.dir : undefined);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(learning)}\n`, 'utf8');
  return learning;
}

// The workspace's learnings and, when a project is given, that project's own (never another project's).
export function listLearnings(root = ROOT, projectDir?: string): Learning[] {
  return [...readLearnings(learningsFile(root)), ...(projectDir ? readLearnings(learningsFile(root, projectDir)) : [])];
}

function updateLearnings(ids: string[], change: (l: Learning) => Learning, root: string, projectDir?: string): void {
  for (const file of [learningsFile(root), ...(projectDir ? [learningsFile(root, projectDir)] : [])]) {
    const list = readLearnings(file);
    if (!list.some((l) => ids.includes(l.id))) continue;
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.${randomBytes(6).toString('hex')}.tmp`;
    writeFileSync(tmp, list.map((l) => JSON.stringify(ids.includes(l.id) ? change(l) : l)).join('\n') + '\n', 'utf8');
    renameSync(tmp, file);
  }
}
export const dismissLearning = (learningId: string, root = ROOT, projectDir?: string) => updateLearnings([learningId], (l) => ({ ...l, status: 'dismissed' }), root, projectDir);

// ---------------------------------------------------------------- proposals

const proposalsDir = (kind: EvolutionKind, name: string, root: string) => join(itemDir(kind, name, root), 'proposals');

// A change waiting for the person: the item's whole new text, why, and from which learnings. `problems`: what the
// caller's check found in the text (the item's own rules); a proposal with problems is refused, never stored.
// A new proposal for the same item replaces the one waiting.
export function propose(item: EvolvedItem, input: { text: unknown; reason: unknown; learnings?: unknown; proposedBy?: unknown }, problems: string[], root = ROOT): Proposal {
  const text = typeof input.text === 'string' ? input.text.replace(/\r\n/g, '\n') : '';
  const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, MAX_WORDS) : '';
  if (!text.trim() || text.length > MAX_TEXT) throw new Error('The proposal needs the whole new text of the item.');
  if (!reason) throw new Error('Say why this change helps the person.');
  if (problems.length) throw new Error(`The proposal breaks the item's rules: ${problems.join('; ')}`);
  if (text === currentText(item, root)) throw new Error('The proposal changes nothing.');
  const learnings = Array.isArray(input.learnings) ? input.learnings.filter((l): l is string => typeof l === 'string').slice(0, 50) : [];
  const proposal: Proposal = {
    id: id(), at: now(), kind: item.kind, name: item.name, text, reason, learnings,
    proposedBy: input.proposedBy === 'person' ? 'person' : 'mycroft', base: itemHistory(item.kind, item.name, root).active,
  };
  const dir = proposalsDir(item.kind, item.name, root);
  rmSync(dir, { recursive: true, force: true });
  writeJson(join(dir, `${proposal.id}.json`), proposal);
  return proposal;
}

export function pendingProposals(root = ROOT): Proposal[] {
  const out: Proposal[] = [];
  for (const kind of EVOLUTION_KINDS) {
    const dir = join(evolutionDir(root), kind);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter(isItemName)) {
      const p = proposalsDir(kind, name, root);
      if (!existsSync(p)) continue;
      for (const f of readdirSync(p).filter((f) => f.endsWith('.json'))) {
        const proposal = readJson<Proposal | null>(join(p, f), null);
        if (proposal && proposal.kind === kind && proposal.name === name) out.push(proposal);
      }
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
const findProposal = (item: EvolvedItem, proposalId: unknown, root: string): Proposal => {
  const proposal = typeof proposalId === 'string' && /^[a-z0-9-]{3,40}$/.test(proposalId)
    ? readJson<Proposal | null>(join(proposalsDir(item.kind, item.name, root), `${proposalId}.json`), null) : null;
  if (!proposal) throw new Error('This proposal is no longer waiting.');
  return proposal;
};
export function declineProposal(item: EvolvedItem, proposalId: unknown, root = ROOT): void {
  findProposal(item, proposalId, root);
  rmSync(proposalsDir(item.kind, item.name, root), { recursive: true, force: true });
}

// ---------------------------------------------------------------- versions (on the person's click)

// Version 0, the original, kept once before the first change so "Restore the original" and the first diff hold.
function keepOriginal(item: EvolvedItem, root: string): void {
  const dir = versionDir(item, 0, root);
  if (existsSync(dir)) return;
  if (item.kind === 'skill') cpSync(dirname(item.file), dir, { recursive: true });
  else { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, mainName(item)), readText(item.file), 'utf8'); }
}

// Writes version N from a text (and, for a skill, the folder of version `from`), makes it the one in use.
function addVersion(item: EvolvedItem, text: string, entry: Omit<VersionEntry, 'version' | 'at' | 'base'>, from: number, root: string): ItemHistory {
  keepOriginal(item, root);
  const h = itemHistory(item.kind, item.name, root);
  const version = Math.max(0, ...h.entries.map((e) => e.version)) + 1;
  const dir = versionDir(item, version, root);
  rmSync(dir, { recursive: true, force: true });
  if (item.kind === 'skill') cpSync(from > 0 ? versionDir(item, from, root) : dirname(item.file), dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, mainName(item)), text, 'utf8');
  if (!item.builtin) writeFileSync(item.file, text, 'utf8'); // the person's own item: its file holds the version in use
  const next: ItemHistory = { active: version, entries: [...h.entries, { ...entry, version, at: now(), base: textHash(versionText(item, 0, root)) }] };
  saveHistory(item, next, root);
  return next;
}

export function approveProposal(item: EvolvedItem, proposalId: unknown, root = ROOT, projectDir?: string): ItemHistory {
  const proposal = findProposal(item, proposalId, root);
  const h = itemHistory(item.kind, item.name, root);
  if (proposal.base !== h.active) throw new Error('The item changed since this proposal was written: ask Mycroft for a new one.');
  const next = addVersion(item, proposal.text, { event: 'version', reason: proposal.reason, proposedBy: proposal.proposedBy, learnings: proposal.learnings }, h.active, root);
  rmSync(proposalsDir(item.kind, item.name, root), { recursive: true, force: true });
  updateLearnings(proposal.learnings, (l) => ({ ...l, status: 'used', usedIn: next.active }), root, projectDir);
  return next;
}

// "Go back to this version": a new version with that text (nothing is deleted). Version 0 is "Restore the original":
// a built-in item uses Moki's file again (today's, also when Moki updated it); the person's own gets its first text back.
export function revertTo(item: EvolvedItem, version: unknown, root = ROOT): ItemHistory {
  const h = itemHistory(item.kind, item.name, root);
  const known = new Set([0, ...h.entries.map((e) => e.version)]);
  if (typeof version !== 'number' || !known.has(version)) throw new Error('Unknown version.');
  if (version === h.active) throw new Error('This version is already in use.');
  if (version === 0) {
    if (!item.builtin) writeFileSync(item.file, versionText(item, 0, root), 'utf8');
    const next: ItemHistory = { active: 0, entries: [...h.entries, { version: 0, at: now(), event: 'restore', reason: '', proposedBy: 'person', learnings: [], base: textHash(versionText(item, 0, root)) }] };
    rmSync(proposalsDir(item.kind, item.name, root), { recursive: true, force: true }); // written over another version
    saveHistory(item, next, root);
    return next;
  }
  const next = addVersion(item, versionText(item, version, root), { event: 'revert', reason: '', proposedBy: 'person', learnings: [], from: version }, version, root);
  rmSync(proposalsDir(item.kind, item.name, root), { recursive: true, force: true });
  return next;
}

// The workspace path of the evolution folder, as the IDE and tests write it.
export const evolutionLabel = (root = ROOT) => `${workspaceLabel(root)}/library/evolution`;
