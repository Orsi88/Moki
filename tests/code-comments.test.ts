// Comments and markers on lines of a source file: where they are found again when the file changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeAnchorLine, isCodeAnchor, isCodeCommentChange } from '../scripts/lib/code-comment-types.ts';

const lines = ['import x', '', 'function login() {', '  return 1;', '}'];

test('a comment stays on its lines, or follows its first line when the file moved it', () => {
  const anchor = { kind: 'code' as const, line: 3, endLine: 5, first: 'function login() {' };
  assert.deepEqual(codeAnchorLine(anchor, lines), { line: 3, endLine: 5, moved: false });
  // Two lines were added above it: found two lines down, the block keeps its length.
  assert.deepEqual(codeAnchorLine(anchor, ['// a', '// b', ...lines]), { line: 5, endLine: 7, moved: true });
  // Its first line is gone: it stays where it was.
  assert.deepEqual(codeAnchorLine({ ...anchor, first: 'function gone() {' }, lines), { line: 3, endLine: 5, moved: false });
});

test('anchors and changes are checked before they are stored', () => {
  assert.equal(isCodeAnchor({ kind: 'code', line: 2, endLine: 4, first: 'x' }), true);
  assert.equal(isCodeAnchor({ kind: 'code', line: 4, endLine: 2, first: 'x' }), false);
  assert.equal(isCodeAnchor({ kind: 'code', line: 0, endLine: 1, first: 'x' }), false);
  assert.equal(isCodeAnchor({ quote: 'x', prefix: '', suffix: '' }), false);
  assert.equal(isCodeCommentChange({ op: 'resolve', id: 'a', resolved: true }), true);
  assert.equal(isCodeCommentChange({ op: 'color', id: 'a', color: 'teal' }), false);
  assert.equal(isCodeCommentChange({ op: 'edit', id: 'a', text: '  ' }), false);
});
