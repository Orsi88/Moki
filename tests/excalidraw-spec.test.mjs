import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScene, validateSpec, fence } from '../scripts/excalidraw.mjs';

const spec = {
  direction: 'LR',
  nodes: [
    { id: 'user', label: 'User', shape: 'ellipse' },
    { id: 'sp', label: 'Service provider', color: 'blue' },
    { id: 'idp', label: 'Identity provider', color: 'green' },
  ],
  edges: [
    { from: 'user', to: 'sp', label: 'opens' },
    { from: 'sp', to: 'idp', label: 'redirects' },
    { from: 'idp', to: 'user', dashed: true },
  ],
};

test('excalidraw: a spec becomes a scene Moki accepts (type excalidraw, elements list)', () => {
  const scene = buildScene(spec);
  assert.equal(scene.type, 'excalidraw');
  assert.ok(Array.isArray(scene.elements));
  const kinds = scene.elements.map((e) => e.type);
  assert.equal(kinds.filter((k) => k === 'arrow').length, 3);
  assert.deepEqual(scene.elements.filter((e) => e.type !== 'arrow' && e.type !== 'text').map((e) => e.type), ['ellipse', 'rectangle', 'rectangle']);
});

test('excalidraw: labels are bound to their shapes and arrows to both ends', () => {
  const scene = buildScene(spec);
  const byId = new Map(scene.elements.map((e) => [e.id, e]));
  for (const n of spec.nodes) {
    const shape = byId.get(`node-${n.id}`);
    const label = byId.get(`label-${n.id}`);
    assert.equal(label.containerId, shape.id);
    assert.equal(label.text, n.label);
    assert.ok(shape.boundElements.some((b) => b.id === label.id));
  }
  const arrow = byId.get('edge-0');
  assert.equal(arrow.startBinding.elementId, 'node-user');
  assert.equal(arrow.endBinding.elementId, 'node-sp');
  assert.ok(byId.get('node-user').boundElements.some((b) => b.id === 'edge-0'));
  assert.equal(byId.get('edge-2').strokeStyle, 'dashed');
  assert.equal(byId.get('edge-label-1').text, 'redirects');
});

test('excalidraw: ranks follow the edges; a cycle does not loop; the same spec gives the same scene', () => {
  const scene = buildScene(spec);
  const x = (id) => scene.elements.find((e) => e.id === `node-${id}`).x;
  assert.ok(x('user') < x('sp') && x('sp') < x('idp'));
  assert.deepEqual(buildScene(spec), scene);
  const tb = buildScene({ ...spec, direction: 'TB' });
  const y = (id) => tb.elements.find((e) => e.id === `node-${id}`).y;
  assert.ok(y('user') < y('sp') && y('sp') < y('idp'));
});

test('excalidraw: an invalid spec is refused with the reasons', () => {
  assert.deepEqual(validateSpec({ nodes: [] }), ['nodes must be a non-empty list']);
  const errors = validateSpec({ direction: 'XX', nodes: [{ id: 'a', label: 'A', shape: 'star' }, { id: 'a', label: '' }], edges: [{ from: 'a', to: 'z' }] });
  assert.ok(errors.includes('direction must be LR or TB'));
  assert.ok(errors.some((e) => e.includes('shape must be')));
  assert.ok(errors.some((e) => e.includes('duplicate id')));
  assert.ok(errors.some((e) => e.includes('label is required')));
  assert.ok(errors.some((e) => e.includes('to "z" is not a node')));
  assert.throws(() => buildScene({ nodes: [] }), /non-empty/);
});

test('excalidraw: the fence is an excalidraw block with the scene JSON', () => {
  const block = fence(buildScene(spec));
  assert.match(block, /^```excalidraw\n\{"type":"excalidraw"/);
  assert.ok(block.endsWith('\n```\n'));
  assert.equal(JSON.parse(block.slice('```excalidraw\n'.length, -'\n```\n'.length)).type, 'excalidraw');
});
