// Project paths in xterm's logical lines, mapped back to cells (including wraps and wide glyphs).
import { findPaths } from './internal-links.ts';

interface CellPosition { x: number; y: number }
interface BufferLine { isWrapped: boolean; length: number; getCell(x: number): { getWidth(): number; getChars(): string } | undefined }
interface TerminalBuffer { length: number; getLine(y: number): BufferLine | undefined }
export interface TerminalPath { text: string; range: { start: CellPosition; end: CellPosition } }
export function terminalPaths(buffer: TerminalBuffer, cols: number, y: number, exists: (href: string) => boolean): TerminalPath[] {
  let first = y - 1;
  if (first < 0 || first >= buffer.length) return [];
  while (first > 0 && y - first < 128 && buffer.getLine(first)?.isWrapped) first--;
  let last = y - 1;
  while (last + 1 < buffer.length && last - first < 128 && buffer.getLine(last + 1)?.isWrapped) last++;
  let text = '';
  const starts: CellPosition[] = [];
  const ends: CellPosition[] = [];
  for (let row = first; row <= last; row++) {
    const line = buffer.getLine(row);
    if (!line) break;
    for (let col = 0; col < Math.min(cols, line.length); col++) {
      const cell = line.getCell(col);
      const width = cell?.getWidth() ?? 1;
      if (!width) continue; // the trailing cell of a wide character
      const chars = cell?.getChars() || ' ';
      text += chars;
      for (let n = 0; n < chars.length; n++) {
        starts.push({ x: col + 1, y: row + 1 });
        ends.push({ x: Math.min(cols, col + width), y: row + 1 });
      }
    }
  }
  return findPaths(text).flatMap((match) => {
    const start = starts[match.start];
    const end = ends[match.end - 1];
    return start && end && start.y <= y && end.y >= y && exists(match.text) ? [{ text: match.text, range: { start, end } }] : [];
  });
}
