// Diagram reviews reuse the HTML review store without changing the diagram's source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addDiagramComment, addHtmlComment, changeDiagramComment, changeHtmlComment, diagramComments, htmlComments, moveHtmlComments, readDiagramView, removeDiagramComment, removeHtmlComment, saveDiagramView } from '../desktop/html-comments.ts';
import { isDiagramAnchor, isDiagramCommentChange, isDiagramViewState, type DiagramAnchor, type DiagramViewState } from '../scripts/lib/diagram-types.ts';
import { isHtmlAnchor } from '../scripts/lib/html-comments.ts';

const source = 'flowchart TD\n  A[Start] --> B[Done]\n';
const sourceHash = createHash('sha256').update(source).digest('hex');
const anchor: DiagramAnchor = { kind: 'diagram', x: 0.2, y: 0.3, width: 0.15, height: 0.1, sourceHash, elementId: 'node-A', elementLabel: 'Start' };
const view: DiagramViewState = { sourceHash, zoom: 1.5, scrollLeft: 200, scrollTop: 80, mode: 'hand' };

function fixture(work: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'moki-diagram-comments-'));
  try { work(directory); }
  finally { rmSync(directory, { recursive: true, force: true }); }
}

test('diagram reviews and old HTML comments reopen from one existing store without changing sources', () => fixture((directory) => {
  const path = join(directory, 'flow.mmd'); writeFileSync(path, source);
  const html = addHtmlComment(directory, 'page.html', { quote: 'Heading', prefix: '', suffix: '' }, 'Existing review', 'Ana');
  const notes = addDiagramComment(directory, 'flow.mmd', anchor, ' Check this region. ', 'Bia', 'purple');
  assert.equal(notes.length, 1); assert.equal(notes[0].text, 'Check this region.');
  assert.deepEqual(notes[0].anchor, anchor); assert.equal(notes[0].color, 'purple');
  assert.deepEqual(diagramComments(directory, 'flow.mmd'), notes);
  assert.deepEqual(htmlComments(directory, 'page.html'), html);
  assert.deepEqual(htmlComments(directory, 'flow.mmd'), []);
  assert.deepEqual(diagramComments(directory, 'page.html'), []);
  assert.equal(readFileSync(path, 'utf8'), source);
  assert.deepEqual(readdirSync(directory).sort(), ['.moki-html-comments.json', 'flow.mmd']);
}));

test('diagram threads preserve author, original anchor and dates through edits, replies, colors and resolving', () => fixture((directory) => {
  const first = addDiagramComment(directory, 'flow.dot', anchor, 'Question', 'Ana')[0];
  changeDiagramComment(directory, 'flow.dot', { op: 'reply', id: first.id, text: ' Answer ' }, 'Bia');
  changeDiagramComment(directory, 'flow.dot', { op: 'edit', id: first.id, text: ' Updated question ' }, 'Bia');
  changeDiagramComment(directory, 'flow.dot', { op: 'color', id: first.id, color: 'green' }, 'Bia');
  changeDiagramComment(directory, 'flow.dot', { op: 'resolve', id: first.id, resolved: true }, 'Bia');
  const reopened = diagramComments(directory, 'flow.dot')[0];
  assert.equal(reopened.author, 'Ana'); assert.equal(reopened.date, first.date); assert.deepEqual(reopened.anchor, first.anchor);
  assert.equal(reopened.text, 'Updated question'); assert.equal(reopened.color, 'green'); assert.equal(reopened.resolved, true);
  assert.equal(reopened.replies?.[0].author, 'Bia'); assert.equal(reopened.replies?.[0].text, 'Answer');
  assert.equal(changeDiagramComment(directory, 'flow.dot', { op: 'resolve', id: first.id, resolved: false }, 'Bia')[0].resolved, false);
  assert.deepEqual(removeDiagramComment(directory, 'flow.dot', first.id), []);
  assert.deepEqual(diagramComments(directory, 'flow.dot'), []);
}));

test('source changes retain every review anchor, while saved view records the current source separately', () => fixture((directory) => {
  const path = join(directory, 'flow.d2'); writeFileSync(path, source);
  const notes = addDiagramComment(directory, 'flow.d2', anchor, 'Review old rendering', 'Ana');
  saveDiagramView(directory, 'flow.d2', view);
  const changed = 'A -> C: Updated source\n'; writeFileSync(path, changed);
  const changedHash = createHash('sha256').update(changed).digest('hex');
  saveDiagramView(directory, 'flow.d2', { ...view, sourceHash: changedHash });
  assert.deepEqual(diagramComments(directory, 'flow.d2'), notes);
  assert.equal(readDiagramView(directory, 'flow.d2')?.sourceHash, changedHash);
  assert.equal(diagramComments(directory, 'flow.d2')[0].anchor.sourceHash, sourceHash);
  assert.equal(readFileSync(path, 'utf8'), changed);
}));

test('viewport-only entries reopen, follow file and folder renames and survive the last comment removal', () => fixture((directory) => {
  assert.equal(readDiagramView(directory, 'inbox/flow.puml'), null);
  assert.deepEqual(saveDiagramView(directory, 'inbox/flow.puml', view), view);
  moveHtmlComments(directory, 'inbox/flow.puml', 'inbox/renamed.puml');
  assert.equal(readDiagramView(directory, 'inbox/flow.puml'), null);
  assert.deepEqual(readDiagramView(directory, 'inbox/renamed.puml'), view);
  const first = addDiagramComment(directory, 'inbox/renamed.puml', anchor, 'Review', 'Ana')[0];
  removeDiagramComment(directory, 'inbox/renamed.puml', first.id);
  assert.deepEqual(readDiagramView(directory, 'inbox/renamed.puml'), view);
  addDiagramComment(directory, 'inbox/another.gv', anchor, 'Another', 'Ana');
  moveHtmlComments(directory, 'inbox', 'reviewed');
  assert.deepEqual(readDiagramView(directory, 'reviewed/renamed.puml'), view);
  assert.equal(diagramComments(directory, 'reviewed/another.gv').length, 1);
}));

test('HTML and diagram APIs reject each other anchors and never edit another review kind', () => fixture((directory) => {
  const textual = { quote: 'Heading', prefix: '', suffix: '' };
  const html = addHtmlComment(directory, 'shared', textual, 'HTML review', 'Ana')[0];
  const diagram = addDiagramComment(directory, 'shared', anchor, 'Diagram review', 'Ana')[0];
  assert.equal(isHtmlAnchor({ ...textual, ...anchor }), false);
  assert.equal(isDiagramAnchor(textual), false);
  assert.throws(() => addHtmlComment(directory, 'page.html', { ...textual, ...anchor }, 'Invalid', 'Ana'), /Select/);
  assert.throws(() => changeHtmlComment(directory, 'shared', { op: 'edit', id: diagram.id, text: 'Wrong kind' }, 'Ana'), /not found/);
  assert.throws(() => changeDiagramComment(directory, 'shared', { op: 'edit', id: html.id, text: 'Wrong kind' }, 'Ana'), /not found/);
  assert.throws(() => removeHtmlComment(directory, 'shared', diagram.id), /not found/);
  assert.throws(() => removeDiagramComment(directory, 'shared', html.id), /not found/);
  assert.deepEqual(htmlComments(directory, 'shared'), [html]);
  assert.deepEqual(diagramComments(directory, 'shared'), [diagram]);
}));

test('diagram contracts reject malformed hashes, coordinates, regions, colors, resolving values and viewport bounds', () => fixture((directory) => {
  assert.ok(isDiagramAnchor({ ...anchor, x: 1, y: 1, width: 0, height: 0 }));
  for (const value of [null, [], {}, { ...anchor, sourceHash: 'invalid' }, { ...anchor, x: -0.1 }, { ...anchor, y: Infinity }, { ...anchor, width: NaN },
    { ...anchor, x: 0.9, width: 0.2 }, { ...anchor, y: 0.95, height: 0.2 }, { ...anchor, elementId: 'x'.repeat(301) }, { ...anchor, elementLabel: 5 }]) assert.equal(isDiagramAnchor(value), false);
  for (const value of [null, [], { op: 'resolve', id: 'id', resolved: 1 }, { op: 'resolve', id: '', resolved: true }, { op: 'color', id: 'id', color: 'url(untrusted)' }]) assert.equal(isDiagramCommentChange(value), false);
  for (const value of [{ ...view, sourceHash: 'bad' }, { ...view, zoom: 0.1 }, { ...view, zoom: 6 }, { ...view, scrollLeft: -1 }, { ...view, scrollTop: Infinity }, { ...view, mode: 'unknown' }]) {
    assert.equal(isDiagramViewState(value), false);
    assert.throws(() => saveDiagramView(directory, 'flow.mmd', value as DiagramViewState), /Invalid diagram view/);
  }
  assert.throws(() => addDiagramComment(directory, 'flow.mmd', anchor, '', 'Ana'), /Select/);
  assert.throws(() => addDiagramComment(directory, 'flow.mmd', anchor, 'x'.repeat(10001), 'Ana'), /Select/);
  assert.throws(() => addDiagramComment(directory, 'flow.mmd', anchor, 'Review', 'Ana', 'url(untrusted)'), /color/);
  assert.deepEqual(readdirSync(directory), []);
}));

test('persisted view and anchors contain only the reviewed contract, without caller-supplied source or drafts', () => fixture((directory) => {
  const withDraft = { ...view, draft: 'private draft', svg: '<svg/>', text: source };
  const withSource = { ...anchor, source: 'private source' };
  saveDiagramView(directory, 'flow.mermaid', withDraft);
  addDiagramComment(directory, 'flow.mermaid', withSource, 'Review', 'Ana');
  const raw = readFileSync(join(directory, '.moki-html-comments.json'), 'utf8');
  assert.ok(!raw.includes('private') && !raw.includes('<svg/>') && !raw.includes('draft'));
  assert.deepEqual(readDiagramView(directory, 'flow.mermaid'), view);
  assert.deepEqual(diagramComments(directory, 'flow.mermaid')[0].anchor, anchor);
}));

test('legacy comment and reply limits also protect diagram reviews and malformed stored data is not replaced', () => fixture((directory) => {
  const original = addDiagramComment(directory, 'flow.mmd', anchor, 'Review', 'Ana')[0];
  const file = join(directory, '.moki-html-comments.json');
  writeFileSync(file, JSON.stringify([{ html: 'flow.mmd', comments: Array.from({ length: 500 }, (_, id) => ({ ...original, id: String(id) })) }]));
  assert.throws(() => addDiagramComment(directory, 'flow.mmd', anchor, 'Over limit', 'Ana'), /500 comments/);
  const maxReplies = { ...original, replies: Array.from({ length: 50 }, () => ({ author: 'Ana', at: original.date, text: 'Reply' })) };
  writeFileSync(file, JSON.stringify([{ html: 'flow.mmd', comments: [maxReplies] }]));
  assert.throws(() => changeDiagramComment(directory, 'flow.mmd', { op: 'reply', id: original.id, text: 'Over limit' }, 'Ana'), /Invalid/);
  const corrupt = JSON.stringify([{ html: 'flow.mmd', comments: [{ ...original, resolved: 'yes' }] }]); writeFileSync(file, corrupt);
  assert.throws(() => diagramComments(directory, 'flow.mmd'), /Invalid/);
  assert.throws(() => saveDiagramView(directory, 'flow.mmd', view), /Invalid/);
  assert.equal(readFileSync(file, 'utf8'), corrupt);
}));
