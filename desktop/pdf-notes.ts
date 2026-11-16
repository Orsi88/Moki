// Project-local associations between PDF pages and interactive Moki notes.
// The PDF stays unchanged: associations travel with the project, not the PDF.
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { PDF_COLORS, type PdfChange } from './pdfcraft.ts';
import { resolveInside } from './fs-guard.ts';

export interface PdfNote { id: string; after: number; note: { path: string } | { loose: string }; height?: number; color?: string }
interface Entry { pdf: string; notes: PdfNote[] }
const FILE = '.moki-pdf-notes.json';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validPdfNote(value: unknown): value is PdfNote {
  if (!value || typeof value !== 'object') return false;
  const n = value as PdfNote;
  return typeof n.id === 'string' && uuid.test(n.id) && Number.isInteger(n.after) && n.after >= 0 && n.after <= 10000
    && (n.height === undefined || (Number.isFinite(n.height) && n.height >= 140 && n.height <= 2400))
    && (n.color === undefined || (typeof n.color === 'string' && PDF_COLORS.includes(n.color)))
    && !!n.note && typeof n.note === 'object' && (('path' in n.note && typeof n.note.path === 'string' && /^notes\/[^/\\]+\.md$/.test(n.note.path))
      || ('loose' in n.note && typeof n.note.loose === 'string' && uuid.test(n.note.loose)));
}

function read(dir: string): Entry[] {
  const file = resolveInside(dir, FILE);
  if (!existsSync(file)) return [];
  const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(value) || value.some((e: Entry) => !e || typeof e.pdf !== 'string' || !Array.isArray(e.notes) || !e.notes.every(validPdfNote))) throw new Error('Invalid PDF note associations.');
  return value as Entry[];
}

function write(dir: string, entries: Entry[]): void {
  const file = resolveInside(dir, FILE);
  const temporary = join(dir, `${FILE}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, `${JSON.stringify(entries, null, 2)}\n`, { flag: 'wx' });
    renameSync(temporary, file);
  } finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

export const pdfNotes = (dir: string, pdf: string): PdfNote[] => read(dir).find((e) => e.pdf === pdf)?.notes ?? [];

export function setPdfNotes(dir: string, pdf: string, notes: PdfNote[]): void {
  const entries = read(dir).filter((e) => e.pdf !== pdf);
  if (notes.length) entries.push({ pdf, notes });
  write(dir, entries);
}

// A PDF (or a folder of PDFs) moved or renamed inside the project keeps its notes.
export function movePdfNotes(dir: string, from: string, to: string): void {
  const entries = read(dir);
  const moved = (pdf: string) => (pdf === from ? to : pdf.startsWith(`${from}/`) ? to + pdf.slice(from.length) : null);
  if (!entries.some((e) => moved(e.pdf) !== null)) return;
  write(dir, entries.map((e) => ({ ...e, pdf: moved(e.pdf) ?? e.pdf })));
}

// Another project merged into this one: its associations come along under the paths the PDFs and notes have here
// (pathOf; null drops one). Notes already tied to the same PDF are kept; ids are not repeated.
export function importPdfNotes(from: string, dir: string, pathOf: (path: string) => string | null): void {
  const incoming = read(from);
  if (!incoming.length) return;
  const entries = read(dir);
  for (const source of incoming) {
    const pdf = pathOf(source.pdf);
    if (!pdf) continue;
    const notes = source.notes.flatMap((n) => {
      if (!('path' in n.note)) return [n];
      const path = pathOf(n.note.path);
      return path ? [{ ...n, note: { path } }] : [];
    });
    const entry = entries.find((e) => e.pdf === pdf);
    if (!entry) { if (notes.length) entries.push({ pdf, notes }); continue; }
    const ids = new Set(entry.notes.map((n) => n.id));
    entry.notes.push(...notes.filter((n) => !ids.has(n.id)));
  }
  write(dir, entries);
}

// A note leaving the project: the PDF pages it was tied to let it go. Returns how many associations it had;
// `apply` false only counts them (the confirmation that comes first).
export function forgetPdfNote(dir: string, note: string, apply = true): number {
  const entries = read(dir);
  const ties = (n: PdfNote) => 'path' in n.note && n.note.path === note;
  const count = entries.reduce((sum, e) => sum + e.notes.filter(ties).length, 0);
  if (apply && count) write(dir, entries.map((e) => ({ ...e, notes: e.notes.filter((n) => !ties(n)) })).filter((e) => e.notes.length));
  return count;
}

// Associations follow their page through edits made in Moki. If its page is
// deleted, keep the note after the previous surviving page (0 = before page 1).
export function remapPdfNotes(notes: PdfNote[], change: PdfChange): PdfNote[] {
  return notes.map((note) => {
    let after = note.after;
    if (change.op === 'insert-blank' && after >= change.at) after++;
    if (change.op === 'delete-pages') after = Math.max(0, after - change.pages.filter((page) => page <= after).length);
    if (change.op === 'move-page' && after > 0) {
      if (after === change.page) after = change.to;
      else if (change.page < change.to && after > change.page && after <= change.to) after--;
      else if (change.to < change.page && after >= change.to && after < change.page) after++;
    }
    return { ...note, after };
  });
}
