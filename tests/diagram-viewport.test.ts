import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampDiagramZoom, diagramFocus, diagramLayout, diagramPoint, diagramRegion, diagramVisible, fitDiagram, zoomDiagramAt } from '../app/src/diagram-viewport.ts';

test('diagram fit and manual zoom keep the supported magnification range', () => {
  assert.equal(clampDiagramZoom(0), 0.25);
  assert.equal(clampDiagramZoom(9), 5);
  assert.equal(clampDiagramZoom(Number.NaN), 1);
  assert.equal(fitDiagram({ width: 1000, height: 2000 }, { width: 1048, height: 548 }, 'screen'), 0.25);
  assert.equal(fitDiagram({ width: 1000, height: 2000 }, { width: 1048, height: 548 }, 'width'), 1);
  assert.deepEqual(diagramLayout({ width: 200, height: 100 }, { width: 1000, height: 600 }, 1), { left: 8000, top: 8000, width: 16200, height: 16100 });
  const focus = diagramFocus({ width: 200, height: 100 }, { width: 1000, height: 600 }, 1);
  assert.deepEqual(focus, { scrollLeft: 7600, scrollTop: 7750 });
  assert.equal(diagramVisible({ width: 200, height: 100 }, { width: 1000, height: 600 }, { zoom: 1, ...focus }), true);
  assert.equal(diagramVisible({ width: 200, height: 100 }, { width: 1000, height: 600 }, { zoom: 1, scrollLeft: 0, scrollTop: 0 }), false);
});

test('zooming around a cursor preserves its normalized diagram coordinates', () => {
  const size = { width: 1600, height: 1200 }, viewport = { width: 800, height: 600 };
  const current = { zoom: 1, ...diagramFocus(size, viewport, 1) }, cursor = { x: 350, y: 240 };
  const before = diagramPoint(size, viewport, current, cursor);
  const scroll = zoomDiagramAt(size, viewport, current, 2, cursor);
  assert.deepEqual(diagramPoint(size, viewport, { ...scroll, zoom: 2 }, cursor), before);
  const bounded = zoomDiagramAt(size, viewport, { zoom: 5, scrollLeft: 7000, scrollTop: 5000 }, 0.25, cursor);
  const world = diagramLayout(size, viewport, 0.25);
  assert.ok(bounded.scrollLeft >= 0 && bounded.scrollLeft <= world.width - viewport.width);
  assert.ok(bounded.scrollTop >= 0 && bounded.scrollTop <= world.height - viewport.height);
});

test('diagram comments use normalized bounds unaffected by viewport position', () => {
  const size = { width: 200, height: 100 }, viewport = { width: 1000, height: 600 }, state = { zoom: 1, ...diagramFocus(size, viewport, 1) };
  assert.deepEqual(diagramPoint(size, viewport, state, { x: 500, y: 300 }), { x: 0.5, y: 0.5 });
  assert.equal(diagramPoint(size, viewport, state, { x: 40, y: 40 }), null);
  assert.deepEqual(diagramRegion({ x: 0.9, y: 0.8 }, { x: 0.2, y: 0.1 }), { x: 0.2, y: 0.1, width: 0.7, height: 0.7000000000000001 });
});
