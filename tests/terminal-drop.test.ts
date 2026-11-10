import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pastedImages, pathsText, quotePath } from '../app/src/terminal-drop.ts';

test('terminal-drop: paths are typed as a terminal types dropped files, quoted when needed, with a space after', () => {
  assert.equal(quotePath('C:\\proj\\print.png'), 'C:\\proj\\print.png');
  assert.equal(quotePath('C:\\Users\\Ana Maria\\print 1.png'), '"C:\\Users\\Ana Maria\\print 1.png"');
  assert.equal(quotePath('/tmp/a&b.png'), '"/tmp/a&b.png"');
  assert.equal(pathsText(['/a.png', '/b c.png']), '/a.png "/b c.png" ');
  assert.equal(pathsText([]), '');
});

test('terminal-drop: only a paste with images and no text is taken as images', () => {
  const files = [{ type: 'image/png' }, { type: 'text/plain' }, { type: 'image/svg+xml' }, { type: 'image/jpeg' }];
  assert.deepEqual(pastedImages(files, ''), [0, 3]);
  assert.deepEqual(pastedImages(files, 'texto copiado'), []); // a text paste stays a text paste
  assert.deepEqual(pastedImages(undefined, ''), []);
});
