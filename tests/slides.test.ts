import { test } from 'node:test';
import assert from 'node:assert/strict';
import { borderCss, byOrder, cleanStyle, fontStack, cropBox, fillCss, inheritedBullet, notesText, safeColor, safeImage, transformCss, vAlignCss } from '../app/src/slides.ts';

test('fills become CSS backgrounds and never reach a remote or script URL', () => {
  assert.equal(fillCss({ type: 'color', value: '#FF9933' }), '#FF9933');
  assert.equal(fillCss({ type: 'color', value: '' }), '');
  assert.equal(fillCss(null), '');
  assert.equal(fillCss({ type: 'pattern', value: { foregroundColor: '#123456', backgroundColor: '#fff' } }), '#123456');
  assert.equal(fillCss({ type: 'gradient', value: { path: 'line', rot: 0, colors: [{ pos: '0%', color: '#000000' }, { pos: '100%', color: '#ffffff' }] } }), 'linear-gradient(90deg, #000000 0%, #ffffff 100%)');
  assert.match(fillCss({ type: 'gradient', value: { path: 'circle', rot: 0, colors: [{ pos: '0%', color: '#000' }, { pos: '100%', color: '#fff' }] } }), /^radial-gradient/);
  assert.equal(fillCss({ type: 'image', value: { base64: 'https://evil.example/x.png' } }), '');
  assert.equal(fillCss({ type: 'color', value: 'red;background:url(https://evil.example)' }), '');
  assert.match(fillCss({ type: 'image', value: { base64: 'data:image/png;base64,iVBORw0KGgo=' } }), /^center \/ cover no-repeat url\("data:image\/png;base64,/);
  assert.equal(safeImage('javascript:alert(1)'), '');
  assert.equal(safeImage('data:text/html;base64,PHNjcmlwdD4='), '');
  assert.equal(safeColor('rgb(1, 2, 3)'), 'rgb(1, 2, 3)');
});

test('borders, transforms, alignment, crops and stacking order', () => {
  assert.equal(borderCss(1.5, 'dashed', '#030e13'), '1.5pt dashed #030e13');
  assert.equal(borderCss(0, 'solid', '#000'), '');
  assert.equal(borderCss(2, 'weird', '#000'), '2pt solid #000');
  assert.equal(transformCss(90, true, false), 'rotate(90deg) scaleX(-1)');
  assert.equal(transformCss(0, false, false), '');
  assert.equal(vAlignCss('mid'), 'center');
  assert.equal(vAlignCss('down'), 'flex-end');
  assert.equal(vAlignCss('up'), 'flex-start');
  assert.deepEqual(cropBox(undefined), { left: '0%', top: '0%', width: '100%', height: '100%' });
  assert.deepEqual(cropBox({ l: 25, r: 25 }), { left: '-50%', top: '0%', width: '200%', height: '100%' });
  assert.deepEqual(byOrder([{ order: 3, id: 'c' }, { order: 1, id: 'a' }, { order: 2, id: 'b' }]).map((e) => e.id), ['a', 'b', 'c']);
});

test('styles keep text formatting only', () => {
  assert.equal(cleanStyle('color: #000000;font-size: 60pt;font-family: Aptos Display;'), 'color: #000000; font-size: 60pt; font-family: "Aptos Display", "Aptos", "Calibri", "Segoe UI", "Arial", sans-serif');
  assert.equal(fontStack('Calibri'), '"Calibri", "Aptos", "Segoe UI", "Arial", sans-serif');
  assert.equal(fontStack('"Times New Roman", x;y'), '"Times New Roman", "Aptos", "Calibri", "Segoe UI", "Arial", sans-serif');
  assert.equal(cleanStyle('position: fixed; top: 0; color: red'), 'color: red');
  assert.equal(cleanStyle('background-color: url(https://evil.example/a.png); color: blue'), 'color: blue');
  assert.equal(cleanStyle('font-family: x</style><script>'), '');
});

test('a hanging indent without a bullet of its own gets the bullet the master gives', () => {
  assert.equal(inheritedBullet('text-align: left; margin-top: 10pt; margin-left: 18pt; text-indent: -18pt'), 18);
  assert.equal(inheritedBullet('text-align: center; margin-left: 0pt'), 0);
  assert.equal(inheritedBullet('margin-left: 36pt; text-indent: 0pt'), 0);
  assert.equal(inheritedBullet('margin-left: 10pt; text-indent: -40pt'), 0, 'an outdent wider than the margin is not a bullet');
});

test('speaker notes become plain lines', () => {
  assert.equal(notesText('<p style="text-align:left;">Falar&nbsp;sobre &lt;tudo&gt;.</p><p>Depois</p>'), 'Falar sobre <tudo>.\nDepois');
  assert.equal(notesText(''), '');
});
