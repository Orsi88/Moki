// Rendered heading IDs must agree with link generation, including formatted and commented headings.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { markdownToHtml } from '../scripts/lib/markdown.mjs';
import { headingSlugs } from '../scripts/lib/heading-anchors.ts';

test('Markdown headings get stable, unique anchors from visible text', () => {
  const html = markdownToHtml('# **Criação** de usuário\n\n## Passos\n\nPassos\n------\n\n## Passos-1\n');
  assert.deepEqual([...html.matchAll(/<h\d id="([^"]*)"/g)].map((m) => m[1]), headingSlugs(['Criação de usuário', 'Passos', 'Passos', 'Passos-1']));
});

test('heading IDs are independent of comment rendering and reset per document', () => {
  const source = '# <!--c:k1-->Terms<!--/c:k1--> & conditions\n';
  assert.match(markdownToHtml(source), /id="terms--conditions"/);
  assert.match(markdownToHtml(source, { comments: true }), /id="terms--conditions"/);
  assert.match(markdownToHtml('# Terms'), /id="terms"/);
  assert.match(markdownToHtml('# <script>alert("x")<\/script>'), /&lt;script&gt;/);
  assert.doesNotMatch(markdownToHtml('# <script>alert("x")<\/script>'), /<script>/);
});
