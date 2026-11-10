// The quick assistants of a note, on the page's side: where an accepted answer goes, and the differences between
// the note and a rewritten version, word by word. Pure. The run itself is desktop/note-assist.ts.

import type { NoteHelper } from './api.ts';

// Where the answer goes when accepted: the whole note, above it, or below it.
export const PLACEMENT: Record<NoteHelper, 'replace' | 'prepend' | 'append'> = { write: 'replace', summary: 'prepend', research: 'append', critique: 'append' };

// The note with an accepted answer in its place.
export function applyAnswer(note: string, answer: string, helper: NoteHelper): string {
  const body = note.replace(/\s+$/, '');
  if (PLACEMENT[helper] === 'replace' || !body) return `${answer.trim()}\n`;
  return PLACEMENT[helper] === 'prepend' ? `${answer.trim()}\n\n${body}\n` : `${body}\n\n${answer.trim()}\n`;
}

export interface DiffPart { kind: 'same' | 'added' | 'removed'; text: string }

// Words and the spaces after them, so the parts put back together give the texts again.
const pieces = (text: string) => text.match(/\S+\s*|\s+/g) ?? [];
const MAX_CELLS = 4_000_000; // beyond this (two very long notes), the whole text is one removal and one addition

// What changed from `before` to `after`: the longest common run of words kept, the rest removed or added.
export function wordDiff(before: string, after: string): DiffPart[] {
  const a = pieces(before);
  const b = pieces(after);
  const push = (out: DiffPart[], kind: DiffPart['kind'], text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text; else if (text) out.push({ kind, text });
  };
  if (a.length * b.length > MAX_CELLS) {
    const out: DiffPart[] = [];
    push(out, 'removed', before); push(out, 'added', after);
    return out;
  }
  const key = (s: string) => s.trim();
  // lcs[i][j]: the longest common run of a[i..] and b[j..].
  const lcs: Uint32Array[] = Array.from({ length: a.length + 1 }, () => new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) lcs[i][j] = key(a[i]) === key(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const out: DiffPart[] = [];
  let i = 0; let j = 0;
  while (i < a.length && j < b.length) {
    if (key(a[i]) === key(b[j])) { push(out, 'same', b[j]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) push(out, 'removed', a[i++]);
    else push(out, 'added', b[j++]);
  }
  while (i < a.length) push(out, 'removed', a[i++]);
  while (j < b.length) push(out, 'added', b[j++]);
  return out;
}
