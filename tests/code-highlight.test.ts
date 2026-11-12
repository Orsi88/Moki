import assert from 'node:assert/strict';
import { test } from 'node:test';
import { highlightParts } from '../app/src/code-highlight.ts';

test('highlighting a line keeps every character and marks the words', () => {
  const parts = highlightParts('const n = 1;\n', 'javascript');
  assert.equal(parts.map((part) => part.text).join(''), 'const n = 1;\n');
  assert.equal(parts.find((part) => part.text === 'const')?.kind, 'key');
  assert.equal(parts.find((part) => part.text === '1')?.kind, 'num');
});

test('bash colors the command, a quoted text, a comment and a symbol', () => {
  const source = 'echo "hi"\n# fim\na -= 1\n';
  const parts = highlightParts(source, 'bash');
  assert.equal(parts.map((part) => part.text).join(''), source);
  assert.equal(parts.find((part) => part.text === 'echo')?.kind, 'key');
  assert.equal(parts.find((part) => part.text === '"hi"')?.kind, 'str');
  assert.equal(parts.find((part) => part.text.startsWith('#'))?.kind, 'cmt');
  assert.equal(parts.find((part) => part.text === '-')?.kind, 'op');
  assert.equal(parts.find((part) => part.text === '1')?.kind, 'num');
});

test('sql keywords match in either case', () => {
  const parts = highlightParts('SELECT name FROM t WHERE id = 1', 'sql');
  assert.equal(parts.find((part) => part.text === 'SELECT')?.kind, 'key');
  assert.equal(parts.find((part) => part.text === 'WHERE')?.kind, 'key');
});

test('html tags and css comments take a color and the text still joins', () => {
  const html = highlightParts('<div class="x">1</div>', 'html');
  assert.equal(html.map((part) => part.text).join(''), '<div class="x">1</div>');
  assert.equal(html.find((part) => part.text === '<div')?.kind, 'key');
  assert.equal(html.find((part) => part.text === '</div')?.kind, 'key');
  const css = highlightParts('/* note */ color: #fff;', 'css');
  assert.equal(css.map((part) => part.text).join(''), '/* note */ color: #fff;');
  assert.equal(css[0]?.kind, 'cmt');
});

test('a string and a python comment are marked and the text still joins', () => {
  const source = 'name = "ada"  # quem\n';
  const parts = highlightParts(source, 'python');
  assert.equal(parts.map((part) => part.text).join(''), source);
  assert.equal(parts.find((part) => part.text.startsWith('"'))?.kind, 'str');
  assert.equal(parts.find((part) => part.text.startsWith('#'))?.kind, 'cmt');
});
