// Moving in the project tree: folders go into folders with what points at their files, Moki's own folders stay,
// and several items move together (an item inside a selected folder goes with it).
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../scripts/lib/repo.mjs';
import { createProject, fileTags, saveTag, setFileTags } from '../scripts/lib/core.ts';
import { createService } from '../desktop/service.ts';
import { addHtmlComment, htmlComments } from '../desktop/html-comments.ts';

const root = mkdtempSync(join(tmpdir(), 'qa-tree-move-'));
const project = join(root, 'workspace', 'projects', 'acme');
const service = createService(root, { launch: () => ({ opened: true, message: '' }), openFolder: () => {}, openPath: () => {} });
const put = (rel: string, text = 'x') => { mkdirSync(join(project, rel, '..'), { recursive: true }); writeFileSync(join(project, rel), text); };

before(() => {
  cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  createProject('acme', 'Acme', root);
  put('Bugs/bug-1.md', 'bug 1');
  put('Bugs/telas/tela.html', '<p>Tela</p>');
  put('Fluxos/fluxo.md');
  put('solto.md');
  put('outro.txt');
  saveTag({ name: 'Cliente X' }, root);
  setFileTags('acme', 'Bugs/bug-1.md', ['cliente-x'], root);
  addHtmlComment(project, 'Bugs/telas/tela.html', { quote: 'Tela', prefix: '', suffix: '' }, 'Check', 'qa');
});
after(() => rmSync(root, { recursive: true, force: true }));

test('a folder moves into another folder, with the tags and comments of its files', () => {
  assert.equal(service.moveEntry('acme', 'Bugs', 'Fluxos'), 'Fluxos/Bugs');
  assert.equal(readFileSync(join(project, 'Fluxos', 'Bugs', 'bug-1.md'), 'utf8'), 'bug 1');
  assert.ok(!existsSync(join(project, 'Bugs')));
  assert.deepEqual(fileTags('acme', root)['Fluxos/Bugs/bug-1.md'], ['cliente-x']);
  assert.equal(htmlComments(project, 'Fluxos/Bugs/telas/tela.html').length, 1);
  // Back to the root.
  assert.equal(service.moveEntry('acme', 'Fluxos/Bugs', ''), 'Bugs');
});

test('Moki folders stay, a folder never goes inside itself, and notes/ holds notes only', () => {
  assert.throws(() => service.moveEntry('acme', 'context', 'Bugs'), /fixed folders/);
  assert.throws(() => service.moveEntry('acme', 'Bugs', 'Bugs/telas'), /inside itself/);
  assert.throws(() => service.moveEntry('acme', 'Bugs', 'Bugs'), /inside itself/);
  mkdirSync(join(project, 'notes'), { recursive: true });
  assert.throws(() => service.moveEntry('acme', 'Bugs', 'notes'), /notes only/);
  assert.ok(existsSync(join(project, 'Bugs', 'bug-1.md')));
});

test('several items move together; one inside a selected folder goes with the folder', () => {
  const r = service.moveEntries('acme', ['solto.md', 'outro.txt', 'Bugs', 'Bugs/bug-1.md'], 'Fluxos');
  assert.deepEqual(r, { moved: [
    { from: 'solto.md', to: 'Fluxos/solto.md' },
    { from: 'outro.txt', to: 'Fluxos/outro.txt' },
    { from: 'Bugs', to: 'Fluxos/Bugs' },
  ], error: '' });
  assert.ok(existsSync(join(project, 'Fluxos', 'Bugs', 'bug-1.md')));
});

test('a refusal stops the batch and says which item and why; what moved stays moved', () => {
  put('a.md');
  const r = service.moveEntries('acme', ['a.md', 'context', 'Fluxos/fluxo.md'], 'inbox');
  assert.deepEqual(r.moved, [{ from: 'a.md', to: 'inbox/a.md' }]);
  assert.match(r.error, /^context: .*fixed folders/);
  assert.ok(existsSync(join(project, 'Fluxos', 'fluxo.md')));
  assert.throws(() => service.moveEntries('acme', [], 'inbox'), /Choose the files/);
  assert.throws(() => service.moveEntries('acme', 'a.md', 'inbox'), /Choose the files/);
});
