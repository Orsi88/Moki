// Merging one project into another (the start screen's "Merge into another project…"). Every file of the source is
// copied into the target, never over one of its files: a name the target already uses gets a number (-2, -3…), and a
// confirmed context file stays beside the target's own with the source id in its name, listed in proposed-updates.md
// to be consolidated (two systems' confirmed knowledge is never joined by itself). The project-local stores that
// point at files (note titles, PDF notes, comments, code notes) follow the new names, and so do the links between the
// copied Markdown files and the paths in the run states. The source folder is only read: on any failure everything
// written to the target is undone. The service then suspends the source, which keeps its own complete copy.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { importHtmlComments } from './html-comments.ts';
import { importNoteTitles } from './note-titles.ts';
import { importPdfNotes } from './pdf-notes.ts';

export interface MergeMove { from: string; to: string }
export interface MergePlan {
  files: number; // files copied, outside runs/
  runs: number; // activities (run folders) copied
  renamed: MergeMove[]; // files and runs that take another name in the target
  context: MergeMove[]; // context files kept beside the target's own, to consolidate
  identical: number; // same path and content in both, or template files never edited: not copied
  appended: string[]; // activity-log.md / proposed-updates.md entries added to the target's
  dropped: number; // comments on files of a linked folder the target does not share
}
export interface MergeSide { id: string; name: string; dir: string; linked: string }

const LINKED = '@folder';
const APPENDED = ['activity-log.md', 'proposed-updates.md'];
// The target keeps its own identity, file tags (merged by the service), README and scratch folder.
const NOT_COPIED = new Set(['project.json', 'tags.json', 'README.md', 'temporary', 'runs', ...APPENDED]);
const STORES = ['.moki-note-titles.json', '.moki-pdf-notes.json', '.moki-html-comments.json'];

const isFile = (path: string) => { try { return lstatSync(path).isFile(); } catch { return false; } };
const isDir = (path: string) => { try { return lstatSync(path).isDirectory(); } catch { return false; } };
const sameBytes = (a: string, b: string) => isFile(b) && readFileSync(a).equals(readFileSync(b));
const text = (path: string) => (isFile(path) ? readFileSync(path, 'utf8') : '');

// The project's files, "/"-separated and relative to it. Dot entries at the top (Moki's stores, routines, AI
// tool settings) and symbolic links (which could reach outside the project) are left out.
function filesOf(dir: string, rel = ''): string[] {
  return readdirSync(join(dir, rel)).sort().flatMap((name) => {
    const path = rel ? `${rel}/${name}` : name;
    if (!rel && (name.startsWith('.') || NOT_COPIED.has(name))) return [];
    const stat = lstatSync(join(dir, path));
    return stat.isDirectory() ? filesOf(dir, path) : stat.isFile() ? [path] : [];
  });
}

interface Layout {
  plan: MergePlan;
  files: Map<string, string>; // source path → target path
  runs: Map<string, string>; // runs/<id> → runs/<id in the target>
  same: Set<string>; // already in the target as they are
  keepLinked: boolean;
}

function layout(source: MergeSide, target: MergeSide, templateDir: string): Layout {
  const files = new Map<string, string>(), runs = new Map<string, string>(), same = new Set<string>();
  const renamed: MergeMove[] = [], context: MergeMove[] = [];
  const taken = new Set<string>(); // planned target paths, lower-cased (Windows and macOS ignore letter case)
  const blocked = (rel: string) => { // a file of the target is where a folder of this path must be
    const parts = rel.split('/');
    return parts.slice(0, -1).some((_, i) => isFile(join(target.dir, ...parts.slice(0, i + 1))));
  };
  const free = (rel: string) => !taken.has(rel.toLowerCase()) && !existsSync(join(target.dir, rel)) && !blocked(rel);
  const claim = (from: string, to: string) => { files.set(from, to); taken.add(to.toLowerCase()); };
  let unchanged = 0;
  const later: string[] = [];
  for (const rel of filesOf(source.dir)) {
    const file = join(source.dir, rel);
    if (sameBytes(file, join(target.dir, rel))) { same.add(rel); continue; }
    if (sameBytes(file, join(templateDir, rel))) { unchanged++; continue; } // a context file never filled in
    if (free(rel)) claim(rel, rel); else later.push(rel); // names that do not collide are kept first
  }
  for (const rel of later) {
    const base = blocked(rel) ? `inbox/${source.id}/${rel}` : rel;
    const dot = base.lastIndexOf('.'), cut = dot > base.lastIndexOf('/') + 1 ? dot : base.length;
    const stem = base.slice(0, cut), ext = base.slice(cut);
    const tag = rel.startsWith('context/') ? `-${source.id}` : '';
    let to = tag ? `${stem}${tag}${ext}` : `${stem}-2${ext}`;
    for (let i = 2; !free(to); i++) to = `${stem}${tag}-${tag ? i : i + 1}${ext}`;
    claim(rel, to);
    (tag ? context : renamed).push({ from: rel, to });
  }
  const runsDir = join(source.dir, 'runs');
  for (const id of isDir(runsDir) ? readdirSync(runsDir).sort() : []) {
    if (!isDir(join(runsDir, id))) continue;
    let to = id;
    for (let i = 2; !free(`runs/${to}`); i++) to = `${id}-${i}`;
    runs.set(`runs/${id}`, `runs/${to}`);
    taken.add(`runs/${to}`.toLowerCase());
    if (to !== id) renamed.push({ from: `runs/${id}`, to: `runs/${to}` });
  }
  const keepLinked = Boolean(source.linked && target.linked && posix.normalize(source.linked.replace(/\\/g, '/')).toLowerCase() === posix.normalize(target.linked.replace(/\\/g, '/')).toLowerCase());
  let dropped = 0;
  if (!keepLinked) {
    try {
      const entries: unknown = JSON.parse(text(join(source.dir, '.moki-html-comments.json')) || '[]');
      if (Array.isArray(entries)) dropped = entries.filter((e: { html?: unknown }) => typeof e?.html === 'string' && (e.html === LINKED || e.html.startsWith(`${LINKED}/`))).length;
    } catch { /* an unreadable store fails when it is imported */ }
  }
  const appended = APPENDED.filter((name) => {
    const own = join(source.dir, name);
    return isFile(own) && !sameBytes(own, join(templateDir, name)) && !sameBytes(own, join(target.dir, name));
  });
  return {
    plan: { files: files.size, runs: runs.size, renamed, context, identical: same.size + unchanged, appended, dropped },
    files, runs, same, keepLinked,
  };
}

export const planMerge = (source: MergeSide, target: MergeSide, templateDir: string): MergePlan => layout(source, target, templateDir).plan;

// Where a source path is in the target after the merge, or null when it is not there.
function locator(l: Layout) {
  return (rel: string): string | null => {
    if (rel === LINKED || rel.startsWith(`${LINKED}/`)) return l.keepLinked ? rel : null;
    const run = /^(runs\/[^/]+)(\/.*)?$/.exec(rel);
    if (run) { const to = l.runs.get(run[1]); return to ? to + (run[2] ?? '') : null; }
    return l.files.get(rel) ?? (l.same.has(rel) ? rel : null);
  };
}

const hrefOf = (rel: string) => encodeURI(rel).replace(/#/g, '%23').replace(/\(/g, '%28').replace(/\)/g, '%29');
// Relative links of a copied Markdown file that point at a file whose path changed: they point at its new path.
export function relink(markdown: string, from: string, to: string, pathOf: (rel: string) => string | null): string {
  return markdown.replace(/(\]\(<?)([^)\s>]+)/g, (all, open: string, href: string) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return all;
    const hash = href.indexOf('#');
    const part = hash < 0 ? href : href.slice(0, hash), fragment = hash < 0 ? '' : href.slice(hash);
    let decoded: string;
    try { decoded = decodeURIComponent(part); } catch { return all; }
    const linked = posix.normalize(posix.join(posix.dirname(from), decoded));
    if (linked.startsWith('..')) return all;
    const now = pathOf(linked);
    if (!now || (now === linked && posix.dirname(to) === posix.dirname(from))) return all;
    return open + hrefOf(posix.relative(posix.dirname(to), now)) + fragment;
  });
}

// The project files a Markdown file at `from` points at with relative links (decoded, without the #fragment).
export function linkedFiles(markdown: string, from: string): string[] {
  return [...markdown.matchAll(/\]\(<?([^)\s>]+)/g)].flatMap(([, href]) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return [];
    try {
      const path = posix.normalize(posix.join(posix.dirname(from), decodeURIComponent(href.split('#')[0])));
      return path.startsWith('..') ? [] : [path];
    } catch { return []; }
  });
}

// A run's state names its project and paths under it: they now name the target.
function restate(file: string, source: MergeSide, target: MergeSide, from: string, to: string, pathOf: (rel: string) => string | null): void {
  let data: unknown;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { return; } // not ours to repair
  const marker = `projects/${source.id}/`;
  const fix = (value: unknown): unknown => {
    if (typeof value === 'string') {
      const at = value.indexOf(marker);
      if (at < 0) return value;
      const rest = value.slice(at + marker.length), slash = rest.endsWith('/') ? '/' : '';
      const moved = pathOf(rest.slice(0, rest.length - slash.length));
      return `${value.slice(0, at)}projects/${target.id}/${moved ? moved + slash : rest}`;
    }
    if (Array.isArray(value)) return value.map(fix);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fix(v)]));
    return value;
  };
  const state = fix(data) as Record<string, unknown>;
  if (state && typeof state === 'object' && !Array.isArray(state)) {
    if (state.project === source.id) state.project = target.id;
    if (state.id === from.slice('runs/'.length)) state.id = to.slice('runs/'.length);
  }
  writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`);
}

// The source's activity rows join the target's table, with one row for the merge itself.
function mergedActivityLog(own: string, incoming: string, source: MergeSide, date: string): string {
  const lines = incoming.split(/\r?\n/);
  const separator = lines.findIndex((l) => /^\|\s*:?-/.test(l));
  const rows = separator < 0 ? [] : lines.slice(separator + 1).filter((l) => l.startsWith('|'));
  const other = lines.filter((l, i) => !(separator >= 0 && i >= separator - 1 && l.startsWith('|')) && !/^# /.test(l)).join('\n').trim();
  const row = `| ${date} | merge | — | Merged project ${source.name} (${source.id}) into this one |`;
  const base = own.trimEnd();
  const table = base.split('\n').pop()?.startsWith('|');
  if (!table) return `${base ? `${base}\n\n` : ''}## Merged from ${source.name} (${source.id}), ${date}\n\n${incoming.replace(/^# .*\r?\n/, '').trim() || `Project ${source.name} was merged into this one.`}\n`;
  return `${base}\n${[...rows, row].join('\n')}\n${other ? `\n## From ${source.name} (${source.id})\n\n${other}\n` : ''}`;
}

// The source's proposals (renumbered after the target's) and one proposal per context file to consolidate.
function mergedProposals(own: string, incoming: string, source: MergeSide, context: MergeMove[], date: string): string {
  const mine = own.split(/\r?\n/), theirs = incoming.split(/\r?\n/);
  let common = 0;
  while (common < mine.length && common < theirs.length && mine[common] === theirs[common]) common++; // the template's text
  let body = theirs.slice(common).join('\n').trim();
  let next = Math.max(0, ...[...own.matchAll(/\bPU-(\d+)\b/g)].map((m) => Number(m[1]))) + 1;
  const ids = new Map<string, string>();
  for (const m of body.matchAll(/^##\s+(PU-\d+)\b/gm)) if (!ids.has(m[1])) ids.set(m[1], `PU-${String(next++).padStart(3, '0')}`);
  body = body.replace(/\bPU-\d+\b/g, (id) => ids.get(id) ?? id);
  const entries = context.map((c) => [
    `## PU-${String(next++).padStart(3, '0')} — Consolidate ${c.from}`,
    `- Proposed on: ${date} (merge of project ${source.name})`,
    `- Target file: ${c.from}`,
    `- Content: the merged project's confirmed version is in ${c.to}; consolidate it into ${c.from} and delete ${c.to}.`,
    `- Source: project ${source.name} (${source.id}), merged on ${date}`,
    '- Status: proposed',
  ].join('\n'));
  const added = [body, ...entries].filter(Boolean).join('\n\n');
  return added ? `${own.trimEnd()}\n\n<!-- Merged from ${source.name} (${source.id}) on ${date} -->\n\n${added}\n` : own;
}

// Copies the source into the target. `extra` runs last, inside the same undo: it passes every file it will change
// to `keep` first (the service's file tags, project tags and MCP servers).
export function mergeProjects(source: MergeSide, target: MergeSide, templateDir: string, date: string, extra: (keep: (file: string) => void, plan: MergePlan) => void = () => {}): MergePlan {
  const l = layout(source, target, templateDir);
  const pathOf = locator(l);
  const created: string[] = []; // files and the top folders this merge created in the target
  const saved = new Map<string, Buffer | null>(); // target files changed in place, as they were
  const keep = (file: string) => { if (!saved.has(file)) saved.set(file, isFile(file) ? readFileSync(file) : null); };
  const folder = (dir: string) => {
    if (existsSync(dir)) return;
    let top = dir;
    while (!existsSync(dirname(top))) top = dirname(top);
    mkdirSync(dir, { recursive: true });
    created.push(top);
  };
  try {
    for (const [from, to] of l.files) {
      const dest = join(target.dir, to);
      folder(dirname(dest));
      if (existsSync(dest)) throw new Error(`${to} appeared in the project during the merge.`);
      created.push(dest);
      if (from.toLowerCase().endsWith('.md')) writeFileSync(dest, relink(readFileSync(join(source.dir, from), 'utf8'), from, to, pathOf), { flag: 'wx' });
      else cpSync(join(source.dir, from), dest, { errorOnExist: true, force: false });
    }
    for (const [from, to] of l.runs) {
      const dest = join(target.dir, to);
      folder(dirname(dest));
      if (existsSync(dest)) throw new Error(`${to} appeared in the project during the merge.`);
      created.push(dest);
      cpSync(join(source.dir, from), dest, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true });
      if (isFile(join(dest, 'state.json'))) restate(join(dest, 'state.json'), source, target, from, to, pathOf);
    }
    for (const store of STORES) keep(join(target.dir, store));
    importNoteTitles(source.dir, target.dir, pathOf, new Map(l.plan.renamed.map((m) => [m.from, m.to])));
    importPdfNotes(source.dir, target.dir, pathOf);
    importHtmlComments(source.dir, target.dir, pathOf);
    const log = join(target.dir, 'activity-log.md');
    keep(log);
    writeFileSync(log, mergedActivityLog(text(log), l.plan.appended.includes('activity-log.md') ? text(join(source.dir, 'activity-log.md')) : '', source, date));
    const proposals = join(target.dir, 'proposed-updates.md');
    const incoming = l.plan.appended.includes('proposed-updates.md') ? text(join(source.dir, 'proposed-updates.md')) : '';
    if (incoming || l.plan.context.length) { keep(proposals); writeFileSync(proposals, mergedProposals(text(proposals), incoming, source, l.plan.context, date)); }
    extra(keep, l.plan);
  } catch (e) {
    for (const path of created.reverse()) rmSync(path, { recursive: true, force: true });
    for (const [file, bytes] of saved) { if (bytes === null) rmSync(file, { force: true }); else writeFileSync(file, bytes); }
    throw e;
  }
  return l.plan;
}
