import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorFragment, findPaths, headingSlugs, hrefTo, parseAnchor, resolveInternal, slugify } from '../app/src/internal-links.ts';

const files = new Set(['inbox/US-12.md', 'inbox/spec v2.pdf', 'context/glossary.md', 'runs/r1/outputs/report.md', 'notes/n.md', 'activity-log.md']);
const exists = (p: string) => files.has(p);
const go = (from: string, href: string) => resolveInternal(from, href, 'acme', exists);

test('a link relative to the document leads to the file it names', () => {
  assert.deepEqual(go('runs/r1/outputs/report.md', '../../../inbox/US-12.md'), { path: 'inbox/US-12.md', anchor: null, found: true });
  assert.deepEqual(go('context/index.md', 'glossary.md'), { path: 'context/glossary.md', anchor: null, found: true });
  assert.deepEqual(go('context/index.md', './glossary.md'), { path: 'context/glossary.md', anchor: null, found: true });
});

test('a project path works from any document, rooted or not (the note @ mention)', () => {
  assert.equal(go('runs/r1/outputs/report.md', '/inbox/US-12.md')?.path, 'inbox/US-12.md');
  assert.deepEqual(go('notes/n.md', 'inbox/US-12.md'), { path: 'inbox/US-12.md', anchor: null, found: true });
  assert.equal(go('notes/n.md', 'inbox/spec%20v2.pdf')?.path, 'inbox/spec v2.pdf');
});

test('a path through this project folder, as AIs write it, is cut at the project', () => {
  assert.equal(go('activity-log.md', 'workspace/projects/acme/inbox/US-12.md')?.path, 'inbox/US-12.md');
  assert.equal(go('activity-log.md', 'C:\\Users\\ana\\Moki\\workspace\\projects\\acme\\inbox\\US-12.md')?.path, 'inbox/US-12.md');
  assert.equal(go('activity-log.md', '/home/ana/vault/projects/acme/context/glossary.md#terms')?.anchor?.kind, 'heading');
});

test('what is not a place of this project leads nowhere', () => {
  assert.equal(go('a.md', 'https://example.com/x.md'), null);
  assert.equal(go('a.md', 'mailto:ana@example.com'), null);
  assert.equal(go('a.md', 'workspace/projects/other/inbox/x.md'), null);
  assert.equal(go('a.md', 'https://example.com/workspace/projects/acme/inbox/US-12.md'), null);
  assert.equal(go('a.md', '//server/workspace/projects/acme/inbox/US-12.md'), null);
  assert.equal(go('a.md', 'C:/Users/ana/secret.txt'), null);
  assert.equal(go('a.md', '../../outside.md'), null);
});

test('a link to another project is never resolved inside this one', () => {
  const t = go('a.md', 'workspace/projects/other/inbox/US-12.md');
  assert.equal(t, null);
});

test('a missing file still resolves (to say it was not found), relative to the document first', () => {
  assert.deepEqual(go('context/index.md', 'nope.md'), { path: 'context/nope.md', anchor: null, found: false });
});

test('anchors: a heading, a comment, a PDF page; # alone is the same document', () => {
  assert.deepEqual(go('context/glossary.md', '#Regras-de-Frete'), { path: 'context/glossary.md', anchor: { kind: 'heading', slug: 'regras-de-frete' }, found: true });
  assert.deepEqual(go('a.md', 'inbox/US-12.md#comment-k3')?.anchor, { kind: 'comment', id: 'k3' });
  assert.deepEqual(go('a.md', 'inbox/spec%20v2.pdf#page=4')?.anchor, { kind: 'page', page: 4 });
  assert.equal(parseAnchor('page=0'), null);
  assert.deepEqual(parseAnchor('comment-moki-2'), { kind: 'comment', id: 'moki-2' });
  assert.deepEqual(parseAnchor('cria%C3%A7%C3%A3o'), { kind: 'heading', slug: 'criação' });
});

test('heading slugs follow GitHub: accents kept, punctuation dropped, repeats numbered', () => {
  assert.equal(slugify('Regras de Frete (v2)!'), 'regras-de-frete-v2');
  assert.equal(slugify('Criação de usuário'), 'criação-de-usuário');
  assert.deepEqual(headingSlugs(['Passos', 'Resultado', 'Passos', 'Passos']), ['passos', 'resultado', 'passos-1', 'passos-2']);
  assert.deepEqual(headingSlugs(['Passos', 'Passos', 'Passos-1']), ['passos', 'passos-1', 'passos-1-1']);
});

test('hrefTo writes a link relative to the document, which resolveInternal reads back', () => {
  const cases: [string, string, Parameters<typeof hrefTo>[2]][] = [
    ['runs/r1/outputs/report.md', 'inbox/US-12.md', null],
    ['context/index.md', 'context/glossary.md', { kind: 'heading', slug: 'termos-e-siglas' }],
    ['notes/n.md', 'inbox/spec v2.pdf', { kind: 'page', page: 2 }],
    ['activity-log.md', 'inbox/US-12.md', { kind: 'comment', id: 'k1' }],
    ['activity-log.md', 'inbox/US-12.md', { kind: 'comment', id: 'PDF comment/with spaces' }],
  ];
  for (const [from, path, anchor] of cases) {
    const href = hrefTo(from, path, anchor);
    assert.ok(!/[\s()]/.test(href), href);
    const back = go(from, href);
    assert.equal(back?.path, path, href);
    assert.deepEqual(back?.anchor, anchor ?? null, href);
  }
  assert.equal(hrefTo('runs/r1/outputs/report.md', 'inbox/US-12.md'), '../../../inbox/US-12.md');
  assert.equal(hrefTo('a.md', 'a.md', { kind: 'comment', id: 'k2' }), '#comment-k2');
  assert.equal(anchorFragment({ kind: 'heading', slug: 'criação' }), 'cria%C3%A7%C3%A3o');
});

test('findPaths finds file-shaped words, not ordinary ones, without the closing period', () => {
  const text = 'Veja inbox/US-12.md. O glossary.md#termos e a pasta context/ e.g. node v1.2 e ana@x.com, ou workspace/projects/acme/runs/r1/outputs/report.md';
  assert.deepEqual(findPaths(text).map((p) => p.text), ['inbox/US-12.md', 'glossary.md#termos', 'workspace/projects/acme/runs/r1/outputs/report.md']);
  const at = findPaths(text)[0];
  assert.equal(text.slice(at.start, at.end), 'inbox/US-12.md');
  assert.deepEqual(findPaths('https://site.com/a/b.html').map((p) => p.text), []);
  assert.deepEqual(findPaths('arquivo relatório-final.docx pronto').map((p) => p.text), ['relatório-final.docx']);
});
