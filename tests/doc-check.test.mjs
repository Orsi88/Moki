import test from 'node:test';
import assert from 'node:assert/strict';
import { checkMarkdown } from '../scripts/doc-check.mjs';

const rules = (text, opts) => checkMarkdown(text, opts).map((p) => `${p.level}:${p.rule}@${p.line}`);

test('doc-check: a clean document has no problems', () => {
  const doc = [
    '# Dossier', '', '## 1. Summary', 'Tokens must be single use [S1 §Intro].', '',
    'The table lists the sources.', '', '| Id | Source |', '|---|---|', '| S1 | OWASP |', '',
    '```mermaid', 'flowchart LR', '  A[Request] --> B{Valid?}', '  B -->|yes| C[Reset]', '```', '',
    '> **Note:** single source.',
  ].join('\n');
  assert.deepEqual(checkMarkdown(doc), []);
});

test('doc-check: what Moki shows wrongly is an error (callouts, HTML, links to headings)', () => {
  const doc = ['# T', '> [!NOTE] read this', 'line<br>break', 'See [gaps](#gaps-and-limits).', '`<br>` in code is fine'].join('\n');
  assert.deepEqual(rules(doc), ['error:callout@2', 'error:html@3', 'error:anchor-link@4']);
});

test('doc-check: headings skip a level or repeat the title; text inside code blocks is ignored', () => {
  const doc = ['# A', '### C', '# B', '```', '# not a heading', '| not | a table', '```'].join('\n');
  assert.deepEqual(rules(doc), ['warning:title@1', 'warning:heading-level@2']);
});

test('doc-check: tables need a separator and the same number of cells; wide tables warn', () => {
  assert.deepEqual(rules('| a | b |\n| c | d |'), ['error:table@1']);
  assert.deepEqual(rules('| a | b |\n|---|---|\n| 1 | 2 | 3 |'), ['error:table@3']);
  assert.deepEqual(rules('| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |\n|---|---|---|---|---|---|---|---|\n| a | b | c | d | e | f | g | h |'), ['warning:wide-table@1']);
  assert.deepEqual(rules('| 1 | 2 | 3 | 4 | 5 | 6 | 7 |\n|---|---|---|---|---|---|---|\n| a | b | c | d | e | f | g |'), [], 'seven columns (the dossier bibliography) are fine');
  assert.deepEqual(rules('| a \\| b | c |\n|---|---|\n| 1 | 2 |'), [], 'an escaped pipe is not a cell border');
});

test('doc-check: Mermaid blocks name their type, have no HTML or click, and stay small', () => {
  assert.deepEqual(rules('```mermaid\nA --> B\n```'), ['error:mermaid-type@1']);
  assert.deepEqual(rules('```mermaid\nflowchart LR\n  A["x<br/>y"] --> B\n  click A call\n```'), ['error:mermaid-html@1', 'error:mermaid-click@1']);
  const big = ['```mermaid', 'flowchart TB', ...Array.from({ length: 17 }, (_, i) => `  n${i} --> n${i + 1}`), '```'].join('\n');
  assert.deepEqual(rules(big), ['warning:mermaid-size@1']);
  assert.deepEqual(rules('```mermaid\nsequenceDiagram\n  A->>B: hi\n```'), []);
});

test('doc-check: Excalidraw blocks hold a scene; an unclosed block is an error', () => {
  assert.deepEqual(rules('```excalidraw\n{"type":"excalidraw","elements":[]}\n```'), []);
  assert.deepEqual(rules('```excalidraw\n{"elements":[]}\n```'), ['error:excalidraw@1']);
  assert.deepEqual(rules('```excalidraw\nnot json\n```'), ['error:excalidraw@1']);
  assert.deepEqual(rules('```mermaid\nflowchart LR'), ['error:fence@1']);
});

test('doc-check: cited sources need a bibliography row; local links and images must exist', () => {
  const doc = ['# D', 'A claim [S1 p. 2] and another [S2 §3].', '', '| Id | Source |', '|---|---|', '| S1 | OWASP |'].join('\n');
  assert.deepEqual(rules(doc), ['error:source-id@1']);
  const files = new Set(['/p/runs/r/outputs/shot.png']);
  const exists = (p) => files.has(p.replace(/\\/g, '/').replace(/^[A-Z]:/, ''));
  const links = '# D\n![print](shot.png)\n[missing](other.md)\n[web](https://example.com)\n![remote](https://example.com/a.png)';
  assert.deepEqual(rules(links, { file: '/p/runs/r/outputs/doc.md', exists }), ['error:missing-file@3', 'warning:remote-image@5']);
});
