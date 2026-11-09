// Link coordinates must match terminal cells, rather than JavaScript character offsets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { terminalPaths } from '../app/src/terminal-links.ts';
import { findPaths, projectLink, resolveInternal } from '../app/src/internal-links.ts';

test('terminal links span wrapped lines after a wide glyph and stay on the requested row', () => {
  const row = (text: string, wrapped: boolean) => {
    const cells = [...text].flatMap((char) => char === '界'
      ? [{ getWidth: () => 2, getChars: () => char }, { getWidth: () => 0, getChars: () => '' }]
      : [{ getWidth: () => 1, getChars: () => char }]);
    while (cells.length < 14) cells.push({ getWidth: () => 1, getChars: () => '' });
    return { length: cells.length, isWrapped: wrapped, getCell: (x: number) => cells[x] };
  };
  const lines = [row('界 inbox/story', false), row('.md#rules', true), row('ordinary text', false)];
  const buffer = { length: lines.length, getLine: (y: number) => lines[y] } as unknown as Parameters<typeof terminalPaths>[0];
  const wanted = [{ text: 'inbox/story.md#rules', range: { start: { x: 4, y: 1 }, end: { x: 9, y: 2 } } }];
  assert.deepEqual(terminalPaths(buffer, 14, 1, () => true), wanted);
  assert.deepEqual(terminalPaths(buffer, 14, 2, () => true), wanted);
  assert.deepEqual(terminalPaths(buffer, 14, 3, () => true), []);
  assert.deepEqual(terminalPaths(buffer, 14, 1, () => false), []);
  assert.deepEqual(terminalPaths(buffer, 14, 0, () => true), []);
});

test('printed project paths include Windows, Unix and encoded Markdown destinations, not URLs', () => {
  assert.deepEqual(findPaths('Veja C:\\Moki\\projects\\acme\\inbox\\story.md e /inbox/spec%20v2.pdf#comment-id%201').map((p) => p.text), [
    'C:\\Moki\\projects\\acme\\inbox\\story.md', '/inbox/spec%20v2.pdf#comment-id%201',
  ]);
  assert.deepEqual(findPaths('https://example.com/path/file.md and ana@example.com'), []);
});

test('copied links escape labels and paths, retaining comment identity from any document', () => {
  const path = 'inbox/spec [v2] (final).pdf';
  const link = projectLink(path, { kind: 'comment', id: 'NM with/slash' });
  assert.equal(link, '[spec \\[v2\\] (final).pdf](/inbox/spec%20%5Bv2%5D%20%28final%29.pdf#comment-NM%20with%2Fslash)');
  const href = link.slice(link.indexOf('](') + 2, -1);
  assert.deepEqual(resolveInternal('notes/a.md', href, 'acme', (p) => p === path), { path, anchor: { kind: 'comment', id: 'NM with/slash' }, found: true });
});
