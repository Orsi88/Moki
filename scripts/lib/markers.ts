// The workspace's set of markers (workspace/markers.json), edited in Settings › Markers. What a marker is and how a
// comment carries one: marker-labels.ts.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

import { MARKER_COLORS, type Marker, type MarkerColor } from './marker-labels.ts';
export * from './marker-labels.ts';

export const MARKERS_FILE = 'markers.json';
export const MAX_MARKERS = 30;
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;

// The set a workspace starts with; the person changes it at will.
export const DEFAULT_MARKERS: Marker[] = [
  { id: 'important', icon: '⭐', name: 'Important', meaning: 'Matters most: read it first.', color: 'yellow' },
  { id: 'review', icon: '🔍', name: 'To review', meaning: 'Needs to be checked before it is relied on.', color: 'blue' },
  { id: 'complete', icon: '➕', name: 'To complete', meaning: 'Something is missing here and has to be added.', color: 'purple' },
  { id: 'attention', icon: '⚠️', name: 'Attention', meaning: 'A risk, a doubt or a point that may be wrong.', color: 'orange' },
  { id: 'done', icon: '✅', name: 'Done', meaning: 'Checked and settled.', color: 'green' },
];

const clean = (value: unknown, max: number) => String(value ?? '').replace(/[\r\n\t\[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

// A marker as typed in Settings: an icon (an emoji or a short symbol), a name and what it means. Invalid ones go.
export function cleanMarkers(raw: unknown): Marker[] {
  if (!Array.isArray(raw)) throw new Error('Invalid markers.');
  const seen = new Set<string>();
  const out: Marker[] = [];
  for (const item of raw.slice(0, MAX_MARKERS)) {
    const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const icon = clean(o.icon, 16), name = clean(o.name, 40), meaning = String(o.meaning ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!icon || !name || [...icon].length > 8) continue;
    let id = typeof o.id === 'string' && ID.test(o.id) ? o.id : '';
    if (!id || seen.has(id)) id = `m-${randomBytes(4).toString('hex')}`;
    seen.add(id);
    const color = MARKER_COLORS.find((c) => c === o.color) as MarkerColor | undefined;
    out.push({ id, icon, name, meaning, ...(color ? { color } : {}) });
  }
  return out;
}

export function readMarkers(workspace: string): Marker[] {
  const file = join(workspace, MARKERS_FILE);
  if (!existsSync(file)) return DEFAULT_MARKERS.map((m) => ({ ...m }));
  try { return cleanMarkers(JSON.parse(readFileSync(file, 'utf8'))); } catch { return DEFAULT_MARKERS.map((m) => ({ ...m })); }
}

export function saveMarkers(workspace: string, raw: unknown): Marker[] {
  const markers = cleanMarkers(raw);
  mkdirSync(workspace, { recursive: true });
  const file = join(workspace, MARKERS_FILE), temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  try { writeFileSync(temporary, `${JSON.stringify(markers, null, 2)}\n`, 'utf8'); renameSync(temporary, file); } finally { rmSync(temporary, { force: true }); }
  return markers;
}

// The set, written with the defaults the first time the app asks for it, so the file an AI is pointed to exists.
// `defaults`: the starting set in the person's language, from the app (English otherwise).
export function ensureMarkers(workspace: string, defaults: unknown = DEFAULT_MARKERS): Marker[] {
  if (existsSync(join(workspace, MARKERS_FILE))) return readMarkers(workspace);
  let start: Marker[];
  try { start = cleanMarkers(defaults); } catch { start = DEFAULT_MARKERS; }
  return saveMarkers(workspace, start.length ? start : DEFAULT_MARKERS);
}
