// Keeps the file's own text when the formatted editor changes it: only the edited stretch is rewritten, so
// untouched source (Windows line endings, spacing the editor would normalize) stays as it was. Pure.

import { Marked } from 'marked';

// The words and numbers of a Markdown text, in order: what a reader sees, whatever the syntax around them.
// HTML entities are syntax too (the editor writes &nbsp; for an empty paragraph, &lt; for a lone <).
export const wordsOf = (markdown: string): string => (markdown.normalize('NFC').replace(/&(?:[a-z][a-z0-9]*|#\d+|#x[0-9a-f]+);/gi, ' ').match(/[\p{L}\p{N}]+/gu) ?? []).join(' ');

// A file split the way the editor sees it: the text it draws, what follows (trailing newlines, the comment block) and its line ending.
// `body` is the file's text without its comment block (readComments).
export function splitSource(text: string, body: string): { core: string; tail: string; newline: string } {
  const trailing = /[\r\n]*$/.exec(body)?.[0] ?? ''; // a lone \r can end the body when the comment block follows CRLF blank lines
  return { core: body.slice(0, body.length - trailing.length), tail: trailing + text.slice(body.length), newline: body.includes('\r\n') && !/(?<!\r)\n/.test(body) ? '\r\n' : '\n' };
}

// Map rendered Markdown offsets back to the original, allowing different whitespace
// between identical tokens. This keeps untouched source (including CRLF) verbatim.
export function sourceOffsets(rendered: string, source: string): number[] | null {
  const offsets = [0];
  let a = 0;
  let b = 0;
  while (a < rendered.length && b < source.length) {
    if (/\s/.test(rendered[a]) && /\s/.test(source[b])) {
      const startA = a; const startB = b;
      while (a < rendered.length && /\s/.test(rendered[a])) a++;
      while (b < source.length && /\s/.test(source[b])) b++;
      const boundaries = [startB];
      for (let at = startB; at < b;) {
        at += source[at] === '\r' && source[at + 1] === '\n' ? 2 : 1;
        boundaries.push(at);
      }
      for (let i = 1; i <= a - startA; i++) offsets[startA + i] = boundaries[Math.floor(i * (boundaries.length - 1) / (a - startA))];
    } else {
      if (rendered[a] !== source[b]) return null;
      offsets[++a] = ++b;
    }
  }
  return a === rendered.length && b === source.length ? offsets : null;
}

export function preserveSource(before: string, after: string, source: string, newline: string): string | null {
  const offsets = sourceOffsets(before, source);
  if (!offsets) return null;
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endBefore = before.length; let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) { endBefore--; endAfter--; }
  const removed = before.slice(start, endBefore);
  const originalRemoved = source.slice(offsets[start], offsets[endBefore]).replace(/\r\n/g, '\n');
  if (removed.includes('\n') && removed !== originalRemoved) return null;
  const next = source.slice(0, offsets[start]) + after.slice(start, endAfter).replace(/\n/g, newline) + source.slice(offsets[endBefore]);
  return sourceOffsets(after, next) ? next : null;
}

// A lexer of its own: the editor adds its tokenizers to the shared `marked`, and both texts must be cut the same way.
const plain = new Marked();

// Where each top-level block of a Markdown text starts, with its words. Null when the lexer's pieces do not add up
// to the text (nothing is then patched).
function blocksOf(text: string): { start: number; words: string }[] | null {
  let at = 0;
  const out: { start: number; words: string }[] = [];
  for (const token of plain.lexer(text)) {
    if (text.slice(at, at + token.raw.length) !== token.raw) return null;
    if (token.type !== 'space') out.push({ start: at, words: wordsOf(token.raw) });
    at += token.raw.length;
  }
  return at === text.length ? out : null;
}

const join = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b);
const leads = (whole: string, part: string) => !part || whole === part || whole.startsWith(`${part} `);

// Pairs the blocks of what the editor drew with the blocks of the file: each group holds the same words on both
// sides (one table may be one block here and there, one list may be split in two by the editor). Returns where each
// group starts on each side, or null when the words do not line up.
function groupsOf(drawn: { start: number; words: string }[], file: { start: number; words: string }[]): { x: number; s: number }[] | null {
  const x = drawn.filter((b) => b.words);
  const s = file.filter((b) => b.words);
  const groups: { x: number; s: number }[] = [];
  let i = 0; let j = 0;
  while (i < x.length && j < s.length) {
    const start = { x: x[i].start, s: s[j].start };
    let wx = x[i++].words; let ws = s[j++].words;
    while (wx !== ws) {
      if (leads(ws, wx) && i < x.length) wx = join(wx, x[i++].words);
      else if (leads(wx, ws) && j < s.length) ws = join(ws, s[j++].words);
      else return null;
    }
    groups.push(start);
  }
  return i === x.length && j === s.length ? groups : null;
}

// When the editor writes the file its own way (tables padded, `*` lists as `-`, emphasis), an edit rewrites only
// the blocks it touched: every other block keeps the file's own text. `before` is what the editor drew when it
// last wrote, `after` what it draws now, `source` the file's text for `before`. Null when the blocks cannot be paired.
const CRLF = '\r\n';
export function preserveBlocks(before: string, after: string, source: string, newline: string): string | null {
  if (newline !== CRLF && source.includes('\r')) return null; // mixed line endings: the offsets would not match
  const file = newline === CRLF ? source.replace(/\r\n/g, '\n') : source;
  const drawnBlocks = blocksOf(before);
  const fileBlocks = blocksOf(file);
  if (!drawnBlocks || !fileBlocks) return null;
  const groups = groupsOf(drawnBlocks, fileBlocks);
  if (!groups || !groups.length) return null;
  // A group runs to the start of the next one (the blank lines after a block belong to it); the first starts at 0.
  const cutX = [0, ...groups.slice(1).map((g) => g.x), before.length];
  const cutS = [0, ...groups.slice(1).map((g) => g.s), file.length];
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let endBefore = before.length; let endAfter = after.length;
  while (endBefore > start && endAfter > start && before[endBefore - 1] === after[endAfter - 1]) { endBefore--; endAfter--; }
  const n = groups.length;
  const done = (next: string) => (wordsOf(next) === wordsOf(after) ? (newline === CRLF ? next.replace(/\n/g, CRLF) : next) : null);
  if (start === before.length) return done(file + after.slice(start)); // only added at the end: the file stays whole
  const at = start === endBefore ? cutX.indexOf(start) : -1;
  if (at > 0 && at < n) return done(file.slice(0, cutS[at]) + after.slice(start, endAfter) + file.slice(cutS[at])); // blocks added between two
  let first = 0;
  while (first + 1 < n && cutX[first + 1] <= start) first++;
  let last = n; // the groups [first, last) take the edit
  while (last - 1 > first && cutX[last - 1] >= endBefore) last--;
  const delta = after.length - before.length;
  const middle = after.slice(cutX[first], cutX[last] + delta);
  const head = file.slice(0, cutS[first]);
  const tail = file.slice(cutS[last]);
  // The drawn group ends with the editor's own blank lines; the file's next group needs its separator.
  const glue = middle && tail && !/\n\n$/.test(middle) ? middle.replace(/\n*$/, '\n\n') : middle;
  return done(head + (tail ? glue + tail : middle));
}
