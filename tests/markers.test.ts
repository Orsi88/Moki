// Markers: the workspace's set and the prefix a comment carries its marker in.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_MARKERS, MARKERS_FILE, cleanMarkers, ensureMarkers, markerLabel, markersForAi, readMarkers, saveMarkers, splitMarker, withMarker } from '../scripts/lib/markers.ts';

const set = DEFAULT_MARKERS;

test('a comment carries its marker as the prefix of its text, matched by icon or name', () => {
  assert.equal(markerLabel(set[1]), '[🔍 To review]');
  assert.deepEqual(splitMarker('[🔍 To review] check the total', set), { marker: set[1], body: 'check the total' });
  // Renamed in Settings: the icon still finds it. An icon changed: the name does.
  assert.equal(splitMarker('[🔍 Old name] x', set).marker?.id, 'review');
  assert.equal(splitMarker('[🧷 important] x', set).marker?.id, 'important');
  // A marker no longer in the set still shows, as written.
  assert.deepEqual(splitMarker('[🧪 Lab] x', set).marker, { icon: '🧪', name: 'Lab' });
  // Not a marker: a link-like bracket, text without a space, nothing.
  assert.equal(splitMarker('[see](x) text', set).marker, null);
  assert.equal(splitMarker('plain text', set).body, 'plain text');
  assert.equal(splitMarker('[⚠️ Attention] two code units', set).marker?.id, 'attention');
});

test('setting, changing and clearing a marker keeps the rest of the text', () => {
  assert.equal(withMarker('check the total', set[1], set), '[🔍 To review] check the total');
  assert.equal(withMarker('[🔍 To review] check the total', set[4], set), '[✅ Done] check the total');
  assert.equal(withMarker('[🔍 To review] check the total', null, set), 'check the total');
  assert.equal(withMarker('no marker', null, set), 'no marker');
});

test('the set: defaults until saved, cleaned on save, written once in the person\'s language', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'moki-markers-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  assert.deepEqual(readMarkers(dir), DEFAULT_MARKERS);
  assert.equal(existsSync(join(dir, MARKERS_FILE)), false, 'reading writes nothing');
  const pt = [{ id: 'review', icon: '🔍', name: 'Revisar', meaning: 'Conferir antes de confiar.' }];
  assert.deepEqual(ensureMarkers(dir, pt), pt);
  assert.deepEqual(ensureMarkers(dir, DEFAULT_MARKERS), pt, 'an existing set is never replaced by the defaults');
  const saved = saveMarkers(dir, [
    { id: 'review', icon: '🔍', name: '  To [re]view\n', meaning: 'x' },
    { id: 'review', icon: '📌', name: 'Pinned', meaning: '' }, // a repeated id gets a new one
    { icon: '', name: 'No icon' }, { icon: '🔥', name: '' }, // incomplete: dropped
  ]);
  assert.deepEqual(saved.map((m) => [m.icon, m.name]), [['🔍', 'To re view'], ['📌', 'Pinned']]);
  assert.notEqual(saved[1].id, 'review');
  assert.deepEqual(JSON.parse(readFileSync(join(dir, MARKERS_FILE), 'utf8')), saved);
  // A color is one of the comment colors; anything else is dropped (the app then uses the default of the same id).
  assert.deepEqual(cleanMarkers([{ id: 'a', icon: '⭐', name: 'A', color: 'purple' }, { id: 'b', icon: '🔍', name: 'B', color: '#123456' }]).map((m) => m.color), ['purple', undefined]);
  assert.ok(DEFAULT_MARKERS.every((m) => m.color));
  assert.throws(() => cleanMarkers('nope'), /Invalid markers/);
  writeFileSync(join(dir, MARKERS_FILE), '{broken');
  assert.deepEqual(readMarkers(dir), DEFAULT_MARKERS, 'a broken file falls back to the defaults');
});

test('the AI is told where the markers are and how they read, in plain ASCII', () => {
  const text = markersForAi('workspace/markers.json');
  assert.match(text, /workspace\/markers\.json/);
  assert.match(text, /only that label marks its passage/);
  assert.match(text, /^[\x20-\x7e]*$/, 'Windows command lines keep it as is');
});
