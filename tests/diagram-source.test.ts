import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinDiagramFences, joinSource, replaceDiagram, splitDiagramFences, splitSource, takeDiagramFence } from '../app/src/diagram-source.ts';

test('a closed drawing or diagram folds out of the text and joins back', () => {
  const md = 'antes\n\n```excalidraw\n{"type":"excalidraw"}\n```\n\ndepois\n```mermaid\nflowchart LR\n  A --> B\n```\n';
  const parts = splitDiagramFences(md);
  assert.deepEqual(parts.map((part) => part.kind === 'text' ? part.text : part.kind === 'diagram' ? part.lang : part.kind), ['antes\n\n', 'excalidraw', '\n\ndepois\n', 'mermaid', '\n']);
  assert.equal(joinDiagramFences(parts), md);
});

test('an embedded image stays a picture and joins back to the same markdown', () => {
  const md = 'oi\n\n![foto](data:image/jpeg;base64,AAAA)\n\nfim\n';
  const parts = splitSource(md);
  assert.deepEqual(parts.map((part) => part.kind), ['text', 'image', 'text']);
  assert.equal(joinSource(parts), md);
});

test('the viewer height stays on the fence line and survives an edit', () => {
  const md = '```mermaid height=320\nflowchart LR\n  A --> B\n```\n';
  const taken = takeDiagramFence(md);
  assert.equal(taken?.height, 320);
  assert.equal(taken?.body, 'flowchart LR\n  A --> B');
  const parts = splitDiagramFences(md);
  assert.equal(joinDiagramFences(parts), md);
  const edited = replaceDiagram(md, 0, 'mermaid', 'flowchart LR\n  A --> C');
  assert.match(edited, /^```mermaid height=320\n/);
  assert.match(edited, /A --> C/);
  assert.match(replaceDiagram(md, 0, 'mermaid', 'flowchart LR\n  A --> C', 480), /^```mermaid height=480\n/);
});

test('a diagram fence is taken only from the start of the text', () => {
  const md = '```excalidraw\n{"type":"excalidraw"}\n```\ndepois';
  const taken = takeDiagramFence(md);
  assert.equal(taken?.lang, 'excalidraw');
  assert.equal(taken?.body, '{"type":"excalidraw"}');
  assert.equal(taken?.raw, '```excalidraw\n{"type":"excalidraw"}\n```');
  assert.equal(takeDiagramFence('depois\n' + md), null);
  assert.equal(takeDiagramFence('```js\nconst a = 1;\n```'), null);
});

test('an unfinished fence and any other code fence stay in the text', () => {
  const md = '```js\nconst a = 1;\n```\n```excalidraw\n{"type":"excalidraw"}';
  const parts = splitDiagramFences(md);
  assert.equal(parts.length, 1);
  assert.equal(parts[0].kind, 'text');
  assert.equal(joinDiagramFences(parts), md);
});
