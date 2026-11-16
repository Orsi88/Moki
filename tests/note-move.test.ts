// Moving a project note to another project: it keeps its title and tags under a free name there, the project it
// left lets go of it (title, tags, PDF and code ties), and a failure leaves both projects as they were.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../scripts/lib/repo.mjs';
import { createProject, fileTags, saveTag, setFileTags } from '../scripts/lib/core.ts';
import { createService } from '../desktop/service.ts';
import { noteTitles, setNoteTitle } from '../desktop/note-titles.ts';
import { pdfNotes, setPdfNotes } from '../desktop/pdf-notes.ts';
import { addCodeNote, codeNotes } from '../desktop/html-comments.ts';

const root = mkdtempSync(join(tmpdir(), 'qa-note-move-'));
const projects = join(root, 'workspace', 'projects');
const deps = { launch: () => ({ opened: true, message: '' }), openFolder: () => {}, openPath: () => {} };
const service = createService(root, deps);
const put = (project: string, rel: string, text: string) => {
  const file = join(projects, project, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, text);
};
const NOTE = 'notes/ideias.md';

before(() => {
  cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  createProject('alpha', 'Alpha', root);
  createProject('beta', 'Beta', root);
  const alpha = join(projects, 'alpha');
  put('alpha', NOTE, '# Ideias\n\nVer [a spec](../inbox/spec.md) e [o site](https://example.com).');
  put('alpha', 'inbox/spec.md', 'spec');
  put('alpha', 'inbox/doc.pdf', '%PDF-1.4');
  put('alpha', 'inbox/code.ts', 'const a = 1;');
  put('beta', NOTE, '# Ideias da beta');
  setNoteTitle(alpha, NOTE, 'Ideias de teste');
  saveTag({ name: 'Cliente X' }, root);
  setFileTags('alpha', NOTE, ['cliente-x'], root);
  setPdfNotes(alpha, 'inbox/doc.pdf', [{ id: '11111111-1111-4111-8111-111111111111', after: 1, note: { path: NOTE } }]);
  addCodeNote(alpha, 'inbox/code.ts', { kind: 'code', line: 1, endLine: 1, first: 'const a = 1;' }, NOTE);
});
after(() => rmSync(root, { recursive: true, force: true }));

test('the plan counts what stays behind', () => {
  assert.deepEqual(service.moveNotePlan('alpha', NOTE, 'beta'), { pdf: 1, code: 1, links: 1 });
  assert.throws(() => service.moveNotePlan('alpha', 'inbox/spec.md', 'beta'), /Only notes/);
  assert.throws(() => service.moveNotePlan('alpha', NOTE, 'alpha'), /another project/);
  assert.throws(() => service.moveNotePlan('alpha', 'notes/none.md', 'beta'), /no longer exists/);
  assert.throws(() => service.moveNotePlan('alpha', NOTE, '../beta'), /Unknown project/);
});

test('a failure leaves both projects as they were', async () => {
  const failing = createService(root, { ...deps, trash: async () => { throw new Error('The trash is not available.'); } });
  await assert.rejects(failing.moveNote('alpha', NOTE, 'beta'), /trash is not available/);
  assert.ok(existsSync(join(projects, 'alpha', NOTE)));
  assert.ok(!existsSync(join(projects, 'beta', 'notes', 'ideias-2.md')));
  assert.equal(noteTitles(join(projects, 'beta')).length, 0);
  assert.equal(fileTags('beta', root)['notes/ideias-2.md'], undefined);
});

test('the note moves under a free name with its title and tags, and the old project lets it go', async () => {
  assert.equal(await service.moveNote('alpha', NOTE, 'beta'), 'notes/ideias-2.md');
  const alpha = join(projects, 'alpha'), beta = join(projects, 'beta');
  assert.equal(readFileSync(join(beta, 'notes', 'ideias-2.md'), 'utf8').startsWith('# Ideias\n'), true);
  assert.equal(readFileSync(join(beta, NOTE), 'utf8'), '# Ideias da beta', 'the note already there is untouched');
  assert.deepEqual(noteTitles(beta), [{ path: 'notes/ideias-2.md', title: 'Ideias de teste' }]);
  assert.deepEqual(fileTags('beta', root)['notes/ideias-2.md'], ['cliente-x']);
  assert.ok(!existsSync(join(alpha, NOTE)));
  assert.deepEqual(noteTitles(alpha), []);
  assert.equal(fileTags('alpha', root)[NOTE], undefined);
  assert.deepEqual(pdfNotes(alpha, 'inbox/doc.pdf'), []);
  assert.deepEqual(codeNotes(alpha, 'inbox/code.ts'), []);
});
