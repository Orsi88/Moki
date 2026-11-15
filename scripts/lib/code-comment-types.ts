// Comments and markers on lines of a source file, kept apart from it (the project's comment store) so the code is
// never changed. A comment holds its lines and the text of its first line: when the file changes, the app finds that
// text again near where it was (codeAnchorLine).

export interface CodeAnchor { kind: 'code'; line: number; endLine: number; first: string }
export interface CodeReply { author: string; at: string; text: string }
export interface CodeComment { id: string; author: string; date: string; text: string; anchor: CodeAnchor; color?: string; replies?: CodeReply[]; resolved?: boolean }
export type CodeCommentChange = { op: 'edit' | 'reply'; id: string; text: string } | { op: 'color'; id: string; color: string } | { op: 'resolve'; id: string; resolved: boolean };

const COLORS = ['yellow', 'green', 'blue', 'pink', 'orange', 'red', 'purple'];
const LINE_LIMIT = 1_000_000;

export function isCodeAnchor(value: unknown): value is CodeAnchor {
  const a = value as CodeAnchor | null;
  return Boolean(a && typeof a === 'object' && a.kind === 'code' && Number.isSafeInteger(a.line) && Number.isSafeInteger(a.endLine)
    && a.line >= 1 && a.endLine >= a.line && a.endLine <= LINE_LIMIT && typeof a.first === 'string' && a.first.length <= 500);
}

// A project note tied to lines of a source file ("Create a note from here"): the note lives in notes/, this only says
// where it belongs.
export interface CodeNote { id: string; anchor: CodeAnchor; note: string }
export const isCodeNote = (value: unknown): value is CodeNote => {
  const n = value as CodeNote | null;
  return Boolean(n && typeof n === 'object' && typeof n.id === 'string' && n.id.length > 0 && n.id.length <= 100 && isCodeAnchor(n.anchor)
    && typeof n.note === 'string' && /^notes\/[^/\\]+\.md$/.test(n.note));
};

export function isCodeCommentChange(value: unknown): value is CodeCommentChange {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (typeof c.id !== 'string' || !c.id || c.id.length > 100) return false;
  if (c.op === 'color') return typeof c.color === 'string' && COLORS.includes(c.color);
  if (c.op === 'resolve') return typeof c.resolved === 'boolean';
  return (c.op === 'edit' || c.op === 'reply') && typeof c.text === 'string' && Boolean(c.text.trim()) && c.text.length <= 10000;
}

// Where a comment's lines are now: where they were when the first line still reads the same, else the nearest line
// that reads like it (within 200 lines), else where they were. The range keeps its length. Pure: the app uses it.
export function codeAnchorLine(anchor: CodeAnchor, lines: string[]): { line: number; endLine: number; moved: boolean } {
  const span = anchor.endLine - anchor.line;
  const same = (n: number) => (lines[n - 1] ?? '').trim() === anchor.first.trim();
  if (!anchor.first.trim() || same(anchor.line)) return { line: anchor.line, endLine: anchor.endLine, moved: false };
  for (let d = 1; d <= 200; d++) {
    for (const n of [anchor.line - d, anchor.line + d]) {
      if (n >= 1 && n <= lines.length && same(n)) return { line: n, endLine: Math.min(n + span, lines.length), moved: true };
    }
  }
  return { line: anchor.line, endLine: anchor.endLine, moved: false };
}

// The note "Create a note from here" makes of selected lines: the code as a fenced block in its language, then where it
// comes from (the file, linked from the project, and its lines). Pure.
export function codeSelectionNote(file: string, language: string, lines: string[], start: number, end: number): { title: string; text: string } {
  const name = file.split('/').pop() ?? file;
  const where = start === end ? `L${start}` : `L${start}-${end}`;
  const body = lines.slice(start - 1, end).join('\n');
  const fence = body.includes('```') ? '````' : '```';
  return {
    title: `${name} ${where}`,
    text: `${fence}${language}\n${body}\n${fence}\n\nSource: [@${name}](${file}) · ${start === end ? `line ${start}` : `lines ${start}–${end}`}\n`,
  };
}

// Highlighted HTML (highlight.js) cut into lines: a span open at a line break is closed at its end and opened again at
// the start of the next line, so any run of lines can be drawn on its own. Pure.
export function splitHighlightedLines(html: string): string[] {
  const lines: string[] = [];
  const open: string[] = []; // the opening tags in effect, outermost first
  let current = '';
  const tag = /<span[^>]*>|<\/span>|\n/g;
  let last = 0;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    current += html.slice(last, m.index);
    last = m.index + m[0].length;
    if (m[0] === '\n') {
      lines.push(current + '</span>'.repeat(open.length));
      current = open.join('');
    } else if (m[0] === '</span>') { open.pop(); current += m[0]; }
    else { open.push(m[0]); current += m[0]; }
  }
  lines.push(current + html.slice(last));
  return lines;
}
