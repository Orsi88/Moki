import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addHtmlComment, changeHtmlComment, htmlComments, moveHtmlComments, removeHtmlComment } from '../desktop/html-comments.ts';
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

test('HTML comment colors, replies and edits survive reopening and moving without changing source or old comments', () => {
  const directory = mkdtempSync(join(tmpdir(), 'moki-html-threads-'));
  try {
    const file = join(directory, 'page.html'), source = '<h1>Heading</h1>';
    writeFileSync(file, source);
    const old = addHtmlComment(directory, 'page.html', { quote: 'Heading', prefix: '', suffix: '' }, 'Old comment', 'Ana')[0];
    assert.equal(htmlComments(directory, 'page.html')[0].color, undefined);
    assert.equal(htmlComments(directory, 'page.html')[0].replies, undefined);
    changeHtmlComment(directory, 'page.html', { op: 'color', id: old.id, color: 'purple' }, 'Bia');
    changeHtmlComment(directory, 'page.html', { op: 'reply', id: old.id, text: 'Answer & <text>' }, 'Bia');
    changeHtmlComment(directory, 'page.html', { op: 'edit', id: old.id, text: 'Edited comment' }, 'Bia');
    const reopened = htmlComments(directory, 'page.html')[0];
    assert.equal(reopened.author, 'Ana'); assert.equal(reopened.date, old.date); assert.deepEqual(reopened.anchor, old.anchor);
    assert.equal(reopened.text, 'Edited comment'); assert.equal(reopened.color, 'purple');
    assert.equal(reopened.replies?.[0].author, 'Bia'); assert.equal(reopened.replies?.[0].text, 'Answer & <text>');
    moveHtmlComments(directory, 'page.html', 'renamed.html');
    assert.deepEqual(htmlComments(directory, 'renamed.html'), [reopened]);
    assert.equal(readFileSync(file, 'utf8'), source);
    assert.throws(() => changeHtmlComment(directory, 'renamed.html', { op: 'color', id: old.id, color: 'url(invalid)' }, 'Bia'), /Invalid/);
    assert.throws(() => changeHtmlComment(directory, 'other.html', { op: 'edit', id: old.id, text: 'Wrong page' }, 'Bia'), /not found/);
    assert.deepEqual(removeHtmlComment(directory, 'renamed.html', old.id), []);
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
    assert.throws(() => service.changeHtmlComment('acme', '../page.html', { op: 'edit', id: 'id', text: 'Outside' }), /outside/i);
    assert.throws(() => service.changeHtmlComment('acme', 'inbox/story.md', { op: 'reply', id: 'id', text: 'Wrong type' }), /HTML page/);
    assert.throws(() => service.changeHtmlComment('acme', 'inbox/page.html', { op: 'reply', id: 'id', text: '' }), /Invalid/);
    const comment = service.addHtmlComment('acme', 'inbox/page.html', { quote: 'Heading', prefix: '', suffix: '' }, 'Question', 'yellow')[0];
    const changed = service.changeHtmlComment('acme', 'inbox/page.html', { op: 'reply', id: comment.id, text: 'Answer', author: 'Spoofed' })[0];
    assert.notEqual(changed.replies?.[0].author, 'Spoofed');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
