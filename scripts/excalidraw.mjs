#!/usr/bin/env node
// Builds an Excalidraw scene from a small diagram spec, so an AI never writes
// Excalidraw element JSON by hand. The scene opens in Moki inside an
// ```excalidraw fence (drawn and editable) or as a .excalidraw file.
//
// Usage:
//   node scripts/excalidraw.mjs --spec <spec.json> [--out <file.excalidraw>] [--fence]
//
// Spec:
//   { "direction": "LR" | "TB",                      (default LR)
//     "nodes": [ { "id": "a", "label": "Text", "shape": "rectangle" | "ellipse" | "diamond", "color": "blue" } ],
//     "edges": [ { "from": "a", "to": "b", "label": "optional", "dashed": false } ] }
//
// Without --out the scene is printed; --fence wraps it in an ```excalidraw block.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHAPES = new Set(['rectangle', 'ellipse', 'diamond']);
const COLORS = {
  none: ['#1e1e1e', 'transparent'],
  blue: ['#1971c2', '#a5d8ff'],
  green: ['#2f9e44', '#b2f2bb'],
  red: ['#e03131', '#ffc9c9'],
  yellow: ['#f08c00', '#ffec99'],
  gray: ['#495057', '#e9ecef'],
  violet: ['#6741d9', '#d0bfff'],
};
const NODE_H = 64;
const GAP_MAIN = 110; // between ranks, along the direction
const GAP_CROSS = 50; // between nodes of one rank
const FONT = 20;

export function validateSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') return ['the spec must be a JSON object'];
  if (spec.direction !== undefined && !['LR', 'TB'].includes(spec.direction)) errors.push('direction must be LR or TB');
  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0) errors.push('nodes must be a non-empty list');
  const ids = new Set();
  for (const [i, n] of (spec.nodes ?? []).entries()) {
    if (!n || typeof n.id !== 'string' || !n.id) { errors.push(`node ${i}: id is required`); continue; }
    if (ids.has(n.id)) errors.push(`node ${n.id}: duplicate id`);
    ids.add(n.id);
    if (typeof n.label !== 'string' || !n.label.trim()) errors.push(`node ${n.id}: label is required`);
    if (n.shape !== undefined && !SHAPES.has(n.shape)) errors.push(`node ${n.id}: shape must be rectangle, ellipse or diamond`);
    if (n.color !== undefined && !(n.color in COLORS)) errors.push(`node ${n.id}: color must be one of ${Object.keys(COLORS).join(', ')}`);
  }
  for (const [i, e] of (spec.edges ?? []).entries()) {
    if (!e || !ids.has(e.from)) errors.push(`edge ${i}: from "${e?.from}" is not a node`);
    if (!e || !ids.has(e.to)) errors.push(`edge ${i}: to "${e?.to}" is not a node`);
  }
  if (spec.edges !== undefined && !Array.isArray(spec.edges)) errors.push('edges must be a list');
  return errors;
}

// Rank = longest path from a root, ignoring edges that close a cycle.
function ranks(nodes, edges) {
  const rank = new Map(nodes.map((n) => [n.id, 0]));
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const forward = edges.filter((e) => e.from !== e.to && order.get(e.from) < order.get(e.to));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const e of forward) {
      if (rank.get(e.to) < rank.get(e.from) + 1) { rank.set(e.to, rank.get(e.from) + 1); changed = true; }
    }
    if (!changed) break;
  }
  return rank;
}

// Deterministic numbers, so the same spec always gives the same scene.
function seedOf(text) {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return h % 2000000000;
}

function base(id, type, x, y, width, height, extra = {}) {
  return {
    id, type, x, y, width, height, angle: 0,
    strokeColor: '#1e1e1e', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid',
    roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null,
    seed: seedOf(`${id}:seed`), version: 1, versionNonce: seedOf(`${id}:nonce`), isDeleted: false,
    boundElements: [], updated: 1, link: null, locked: false, ...extra,
  };
}

function text(id, containerId, label, x, y, width, height) {
  return base(id, 'text', x, y, width, height, {
    text: label, originalText: label, fontSize: FONT, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle',
    containerId, lineHeight: 1.25, autoResize: true,
  });
}

export function buildScene(spec) {
  const errors = validateSpec(spec);
  if (errors.length) throw new Error(errors.join('; '));
  const dir = spec.direction ?? 'LR';
  const nodes = spec.nodes;
  const edges = spec.edges ?? [];
  const rank = ranks(nodes, edges);
  const width = (n) => Math.max(140, Math.round(n.label.length * FONT * 0.55) + 48);

  // Columns (LR) or rows (TB) by rank; inside a rank, nodes keep their spec order.
  const byRank = new Map();
  for (const n of nodes) byRank.set(rank.get(n.id), [...(byRank.get(rank.get(n.id)) ?? []), n]);
  const maxRank = Math.max(...byRank.keys());
  const mainSize = [];
  for (let r = 0; r <= maxRank; r++) {
    const list = byRank.get(r) ?? [];
    mainSize.push(dir === 'LR' ? Math.max(0, ...list.map(width)) : NODE_H);
  }
  const box = new Map();
  let main = 0;
  for (let r = 0; r <= maxRank; r++) {
    let cross = 0;
    for (const n of byRank.get(r) ?? []) {
      const w = width(n);
      box.set(n.id, dir === 'LR' ? { x: main, y: cross, w, h: NODE_H } : { x: cross, y: main, w, h: NODE_H });
      cross += (dir === 'LR' ? NODE_H : w) + GAP_CROSS;
    }
    main += mainSize[r] + GAP_MAIN;
  }

  const elements = [];
  const shapes = new Map();
  for (const n of nodes) {
    const b = box.get(n.id);
    const [stroke, fill] = COLORS[n.color ?? 'none'];
    const shapeId = `node-${n.id}`;
    const shape = base(shapeId, n.shape ?? 'rectangle', b.x, b.y, b.w, b.h, {
      strokeColor: stroke, backgroundColor: fill, roundness: (n.shape ?? 'rectangle') === 'rectangle' ? { type: 3 } : { type: 2 },
    });
    const label = text(`label-${n.id}`, shapeId, n.label, b.x + 8, b.y + b.h / 2 - FONT * 0.625, b.w - 16, FONT * 1.25);
    shape.boundElements.push({ type: 'text', id: label.id });
    shapes.set(n.id, shape);
    elements.push(shape, label);
  }

  for (const [i, e] of edges.entries()) {
    const s = box.get(e.from);
    const t = box.get(e.to);
    const start = dir === 'LR' ? [s.x + s.w, s.y + s.h / 2] : [s.x + s.w / 2, s.y + s.h];
    const end = dir === 'LR' ? [t.x, t.y + t.h / 2] : [t.x + t.w / 2, t.y];
    const arrowId = `edge-${i}`;
    const arrow = base(arrowId, 'arrow', start[0], start[1], Math.abs(end[0] - start[0]), Math.abs(end[1] - start[1]), {
      points: [[0, 0], [end[0] - start[0], end[1] - start[1]]], lastCommittedPoint: null,
      startBinding: { elementId: `node-${e.from}`, focus: 0, gap: 4 }, endBinding: { elementId: `node-${e.to}`, focus: 0, gap: 4 },
      startArrowhead: null, endArrowhead: 'arrow', strokeStyle: e.dashed ? 'dashed' : 'solid', roundness: { type: 2 },
    });
    shapes.get(e.from).boundElements.push({ type: 'arrow', id: arrowId });
    shapes.get(e.to).boundElements.push({ type: 'arrow', id: arrowId });
    elements.push(arrow);
    if (e.label) {
      const w = Math.max(60, Math.round(e.label.length * 16 * 0.55) + 16);
      const label = text(`edge-label-${i}`, arrowId, e.label, (start[0] + end[0]) / 2 - w / 2, (start[1] + end[1]) / 2 - 10, w, 20);
      label.fontSize = 16;
      arrow.boundElements.push({ type: 'text', id: label.id });
      elements.push(label);
    }
  }

  return { type: 'excalidraw', version: 2, source: 'moki', elements, appState: { viewBackgroundColor: '#ffffff', gridSize: null }, files: {} };
}

export const fence = (scene) => '```excalidraw\n' + JSON.stringify(scene) + '\n```\n';

function main(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const specPath = arg('--spec');
  if (!specPath) {
    process.stderr.write('Usage: node scripts/excalidraw.mjs --spec <spec.json> [--out <file.excalidraw>] [--fence]\n');
    return 2;
  }
  let spec;
  try { spec = JSON.parse(readFileSync(specPath, 'utf8')); } catch (err) {
    process.stderr.write(`Cannot read the spec: ${err.message}\n`);
    return 1;
  }
  const errors = validateSpec(spec);
  if (errors.length) { process.stderr.write(`Invalid spec:\n- ${errors.join('\n- ')}\n`); return 1; }
  const scene = buildScene(spec);
  const output = argv.includes('--fence') ? fence(scene) : JSON.stringify(scene, null, 2) + '\n';
  const out = arg('--out');
  if (out) { writeFileSync(out, output); process.stdout.write(`Wrote ${out} (${spec.nodes.length} nodes, ${(spec.edges ?? []).length} edges).\n`); }
  else process.stdout.write(output);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2));
