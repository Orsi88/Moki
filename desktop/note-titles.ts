// Display titles for project notes, stored separately so links to note files stay valid.
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { resolveInside } from './fs-guard.ts';

export interface NoteTitle { path: string; title: string }
const FILE = '.moki-note-titles.json';
export function noteTitles(dir: string): NoteTitle[] {
  const file = resolveInside(dir, FILE);
  if (!existsSync(file)) return [];
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(data) || data.some((item: NoteTitle) => !item || typeof item.path !== 'string' || typeof item.title !== 'string')) throw new Error('Invalid note titles.');
  return data as NoteTitle[];
}
export function setNoteTitle(dir: string, path: string, title: string): void {
  const entries = noteTitles(dir).filter((item) => item.path !== path);
  if (title) entries.push({ path, title });
  write(dir, entries);
}

// Another project merged into this one: its titles come along under the notes' paths here (pathOf; null drops one).
// A note that had to take another file name keeps showing the title it had (its old file name, when it had none).
export function importNoteTitles(from: string, dir: string, pathOf: (path: string) => string | null, renamed: Map<string, string>): void {
  const incoming = noteTitles(from);
  const titled = new Set(incoming.map((item) => item.path));
  const added = [
    ...incoming.flatMap((item) => { const path = pathOf(item.path); return path ? [{ path, title: item.title }] : []; }),
    ...[...renamed].filter(([old]) => /^notes\/[^/]+\.md$/.test(old) && !titled.has(old))
      .map(([old, path]) => ({ path, title: old.slice('notes/'.length, -'.md'.length).replace(/-/g, ' ') })),
  ];
  const current = noteTitles(dir), kept = new Set(current.map((item) => item.path)); // a note both had keeps this project's title
  const fresh = added.filter((item) => !kept.has(item.path));
  if (fresh.length) write(dir, [...current, ...fresh]);
}

function write(dir: string, entries: NoteTitle[]): void {
  const file = resolveInside(dir, FILE);
  const temp = join(dir, `${FILE}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, `${JSON.stringify(entries, null, 2)}\n`, { flag: 'wx' });
    renameSync(temp, file);
  } finally { if (existsSync(temp)) unlinkSync(temp); }
}
