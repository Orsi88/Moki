// A line diff of two texts (longest common subsequence), for showing what a new version of an agent, skill or
// activity changes. Hand-written on purpose: Moki has no runtime dependencies, and these texts are short.

export interface DiffLine { kind: 'same' | 'added' | 'removed'; text: string }

const MAX_CELLS = 4_000_000; // lines(a) × lines(b): beyond this, the texts are shown as one block removed, one added

export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n/g, '\n').split('\n');
  const b = after.replace(/\r\n/g, '\n').split('\n');
  // The common start and end are kept as they are: the table only covers what is between them.
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  const head = a.slice(0, start).map((text): DiffLine => ({ kind: 'same', text }));
  const tail = a.slice(a.length - end).map((text): DiffLine => ({ kind: 'same', text }));
  const x = a.slice(start, a.length - end);
  const y = b.slice(start, b.length - end);
  if (x.length * y.length > MAX_CELLS) {
    return [...head, ...x.map((text): DiffLine => ({ kind: 'removed', text })), ...y.map((text): DiffLine => ({ kind: 'added', text })), ...tail];
  }
  // lcs[i][j]: length of the longest common subsequence of x[i..] and y[j..].
  const lcs = Array.from({ length: x.length + 1 }, () => new Uint32Array(y.length + 1));
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const middle: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < x.length && j < y.length) {
    if (x[i] === y[j]) { middle.push({ kind: 'same', text: x[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) middle.push({ kind: 'removed', text: x[i++] });
    else middle.push({ kind: 'added', text: y[j++] });
  }
  while (i < x.length) middle.push({ kind: 'removed', text: x[i++] });
  while (j < y.length) middle.push({ kind: 'added', text: y[j++] });
  return [...head, ...middle, ...tail];
}

// How much a diff changes, for a short summary ("+3 −1").
export const diffSize = (lines: DiffLine[]) => ({ added: lines.filter((l) => l.kind === 'added').length, removed: lines.filter((l) => l.kind === 'removed').length });
