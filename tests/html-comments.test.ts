import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addHtmlComment, htmlComments, moveHtmlComments, removeHtmlComment } from '../desktop/html-comments.ts';
import { createService } from '../desktop/service.ts';
import { createProject } from '../scripts/lib/core.ts';
import { ROOT } from '../scripts/lib/repo.mjs';

test('HTML comments persist independently of source, follow a folder rename and reject invalid anchors', () => {
  const directory = mkdtempSync(join(tmpdir(), 'moki-html-comments-'));
  try {
    const file = join(directory, 'page.html'), source = '<script>let count=0</script><h1>Heading</h1>';
    writeFileSync(file, source);
    const comments = addHtmlComment(directory, 'inbox/page.html', { quote: 'Heading', prefix: '', suffix: '' }, 'Review <this> & that.', 'Ana');
    assert.equal(comments.length, 1);
    assert.deepEqual(htmlComments(directory, 'inbox/page.html'), comments);
    assert.equal(readFileSync(file, 'utf8'), source);
    moveHtmlComments(directory, 'inbox', 'review');
    assert.deepEqual(htmlComments(directory, 'inbox/page.html'), []);
    assert.deepEqual(htmlComments(directory, 'review/page.html'), comments);
    assert.throws(() => addHtmlComment(directory, 'page.html', { quote: '', prefix: '', suffix: '' }, 'Invalid', 'Ana'), /Select/);
    assert.deepEqual(removeHtmlComment(directory, 'review/page.html', comments[0].id), []);
    assert.deepEqual(htmlComments(directory, 'review/page.html'), []);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('HTML comment service confines calls to an existing HTML page of its project', () => {
  const root = mkdtempSync(join(tmpdir(), 'moki-html-service-'));
  try {
    cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
    createProject('acme', 'Acme', root);
    const inbox = join(root, 'workspace', 'projects', 'acme', 'inbox'); mkdirSync(inbox, { recursive: true });
    writeFileSync(join(inbox, 'page.html'), '<h1>Heading</h1>'); writeFileSync(join(inbox, 'story.md'), '# Story');
    const service = createService(root, { launch: () => ({ opened: false, message: '' }), openPath: () => {}, openFolder: () => {}, home: root });
    assert.deepEqual(service.htmlComments('acme', 'inbox/page.html'), []);
    assert.throws(() => service.htmlComments('acme', '../page.html'), /outside/i);
    assert.throws(() => service.htmlComments('acme', 'inbox/missing.html'), /HTML page/);
    assert.throws(() => service.htmlComments('acme', 'inbox/story.md'), /HTML page/);
    assert.throws(() => service.addHtmlComment('acme', 'inbox/page.html', {}, 'invalid'), /Select/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
