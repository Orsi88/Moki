// Color and replies for a Word comment or an Excel note. The comment text stays a native Office comment;
// this part keeps what Office has no field for, so the cards match Markdown and PDF.
import { appendXmlChild, attribute as attr, descendants, parseXml, patchXml } from './office-xml.ts';

export const OFFICE_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange', 'red', 'purple'] as const;
export type OfficeColor = typeof OFFICE_COLORS[number];
export interface OfficeReply { author: string; at: string; text: string }
export interface OfficeNote { color?: OfficeColor; at?: string; replies: OfficeReply[] }

const PART = 'moki/comments.json';
const isReply = (value: unknown): value is OfficeReply => Boolean(value) && typeof value === 'object'
  && typeof (value as OfficeReply).author === 'string' && typeof (value as OfficeReply).at === 'string' && typeof (value as OfficeReply).text === 'string';
export const isOfficeColor = (value: unknown): value is OfficeColor => typeof value === 'string' && OFFICE_COLORS.some((color) => color === value);

export function applyOfficeNote<T extends { date: string; color?: string; replies?: OfficeReply[] }>(comment: T, note: OfficeNote | undefined): T {
  if (!note) return comment;
  return { ...comment, ...(note.color ? { color: note.color } : {}), ...(!comment.date && note.at ? { date: note.at } : {}), ...(note.replies.length ? { replies: note.replies } : {}) };
}

export function officeNotes(files: Map<string, Buffer>): Record<string, OfficeNote> {
  const raw = files.get(PART)?.toString('utf8');
  if (!raw) return {};
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return {}; }
  if (!data || typeof data !== 'object') return {};
  const notes: Record<string, OfficeNote> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const note = value as { color?: unknown; at?: unknown; replies?: unknown };
    const color = isOfficeColor(note.color) ? note.color : undefined;
    const at = typeof note.at === 'string' ? note.at : undefined;
    const replies = (Array.isArray(note.replies) ? note.replies.filter(isReply) : []).slice(0, 50);
    if (color || at || replies.length) notes[key] = { ...(color ? { color } : {}), ...(at ? { at } : {}), replies };
  }
  return notes;
}

export function saveOfficeNote(files: Map<string, Buffer>, key: string, note: OfficeNote | null): void {
  const notes = officeNotes(files);
  if (!note || (!note.color && !note.at && note.replies.length === 0)) delete notes[key];
  else notes[key] = note;
  if (!Object.keys(notes).length) {
    files.delete(PART);
    const types = files.get('[Content_Types].xml')?.toString('utf8') ?? '';
    const override = types ? descendants(parseXml(types), 'Override').find((node) => attr(node, 'PartName') === '/moki/comments.json') : undefined;
    if (override) files.set('[Content_Types].xml', Buffer.from(patchXml(types, [{ start: override.start, end: override.end, text: '' }])));
    return;
  }
  files.set(PART, Buffer.from(JSON.stringify(notes)));
  let types = files.get('[Content_Types].xml')?.toString('utf8') ?? '';
  if (types && !types.includes('PartName="/moki/comments.json"')) {
    const root = parseXml(types).children[0];
    if (root) types = appendXmlChild(types, root, '<Override PartName="/moki/comments.json" ContentType="application/json"/>');
    files.set('[Content_Types].xml', Buffer.from(types));
  }
}
