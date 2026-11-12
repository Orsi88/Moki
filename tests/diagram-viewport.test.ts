import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampDiagramZoom, diagramLayout, diagramPoint, diagramRegion, fitDiagram, zoomDiagramAt } from '../app/src/diagram-viewport.ts';

test('diagram fit and manual zoom keep the supported magnification range', () => {
  assert.equal(clampDiagramZoom(0), 0.25);
  assert.equal(clampDiagramZoom(9), 5);
  assert.equal(clampDiagramZoom(Number.NaN), 1);
  assert.equal(fitDiagram({ width: 1000, height: 2000 }, { width: 1048, height: 548 }, 'screen'), 0.25);
  assert.equal(fitDiagram({ width: 1000, height: 2000 }, { width: 1048, height: 548 }, 'width'), 1);
  assert.deepEqual(diagramLayout({ width: 200, height: 100 }, { width: 1000, height: 600 }, 1), { left: 400, top: 250, width: 1000, height: 600 });
});

test('zooming around a cursor preserves its normalized diagram coordinates', () => {
  const size = { width: 1600, height: 1200 }, viewport = { width: 800, height: 600 };
  const current = { zoom: 1, scrollLeft: 300, scrollTop: 200 }, cursor = { x: 350, y: 240 };
  const before = diagramPoint(size, viewport, current, cursor);
  const scroll = zoomDiagramAt(size, viewport, current, 2, cursor);
  assert.deepEqual(diagramPoint(size, viewport, { ...scroll, zoom: 2 }, cursor), before);
  const bounded = zoomDiagramAt(size, viewport, { zoom: 5, scrollLeft: 7000, scrollTop: 5000 }, 0.25, cursor);
  assert.deepEqual(bounded, { scrollLeft: 0, scrollTop: 0 });
});

test('diagram comments use normalized bounds unaffected by viewport position', () => {
  const size = { width: 200, height: 100 }, viewport = { width: 1000, height: 600 }, state = { zoom: 1, scrollLeft: 0, scrollTop: 0 };
  assert.deepEqual(diagramPoint(size, viewport, state, { x: 500, y: 300 }), { x: 0.5, y: 0.5 });
  assert.equal(diagramPoint(size, viewport, state, { x: 100, y: 100 }), null);
  assert.deepEqual(diagramRegion({ x: 0.9, y: 0.8 }, { x: 0.2, y: 0.1 }), { x: 0.2, y: 0.1, width: 0.7, height: 0.7000000000000001 });
});
