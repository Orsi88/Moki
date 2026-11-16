// Merging a project into another: nothing of either project is lost or overwritten, the stores that point at files
// follow the new names, and a failure leaves the receiving project as it was.
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../scripts/lib/repo.mjs';
import { createProject, fileTags, projectSummary, saveTag, setFileTags, setProjectTags } from '../scripts/lib/core.ts';
import { listServers, saveServer } from '../scripts/lib/mcp.ts';
import { createService } from '../desktop/service.ts';
import { noteTitles, setNoteTitle } from '../desktop/note-titles.ts';
import { pdfNotes, setPdfNotes } from '../desktop/pdf-notes.ts';
import { addCodeNote, addHtmlComment, codeNotes, htmlComments } from '../desktop/html-comments.ts';
import { relink } from '../desktop/project-merge.ts';

const root = mkdtempSync(join(tmpdir(), 'qa-merge-'));
const projects = join(root, 'workspace', 'projects');
const service = createService(root, { launch: () => ({ opened: true, message: '' }), openFolder: () => {}, openPath: () => {} });
const put = (project: string, rel: string, text: string) => {
  const file = join(projects, project, rel);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, text);
};
const read = (project: string, rel: string) => readFileSync(join(projects, project, rel), 'utf8');
const NOTE_ID = '11111111-1111-4111-8111-111111111111';
const RUN = '20261101-0900-test-design-x';

before(() => {
  cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  for (const [id, name] of [['alpha', 'Alpha'], ['beta', 'Beta'], ['gamma', 'Gamma']]) createProject(id, name, root);
  const alpha = join(projects, 'alpha'), beta = join(projects, 'beta');
  // The same note file name in both projects, with different content and titles.
  put('alpha', 'notes/ideias.md', '# Ideias\n\nVer [a spec](../inbox/spec.md), [a outra](outra.md#topo) e [o site](https://example.com).');
  put('alpha', 'notes/outra.md', '# Outra');
  put('alpha', 'notes/sem-titulo.md', 'alpha');
  put('beta', 'notes/ideias.md', '# Ideias da beta');
  put('beta', 'notes/sem-titulo.md', 'beta');
  setNoteTitle(alpha, 'notes/ideias.md', 'Ideias de teste');
  setNoteTitle(alpha, 'notes/outra.md', 'Outra nota');
  setNoteTitle(beta, 'notes/ideias.md', 'Ideias da Beta');
  put('alpha', 'inbox/spec.md', 'spec alpha');
  put('beta', 'inbox/spec.md', 'spec beta');
  put('alpha', 'inbox/same.txt', 'same');
  put('beta', 'inbox/same.txt', 'same');
  put('alpha', 'inbox/doc.pdf', '%PDF-1.4 alpha');
  put('alpha', 'inbox/page.html', '<p>Hello</p>');
  put('alpha', 'inbox/code.ts', 'const a = 1;');
  setPdfNotes(alpha, 'inbox/doc.pdf', [{ id: NOTE_ID, after: 1, note: { path: 'notes/ideias.md' } }]);
  addHtmlComment(alpha, 'inbox/page.html', { quote: 'Hello', prefix: '', suffix: '' }, 'Check this', 'qa');
  addHtmlComment(alpha, '@folder/src/app.ts', { quote: 'x', prefix: '', suffix: '' }, 'On the linked folder', 'qa');
  addCodeNote(alpha, 'inbox/code.ts', { kind: 'code', line: 1, endLine: 1, first: 'const a = 1;' }, 'notes/ideias.md');
  // Confirmed context edited in both projects; another context file untouched (still the template).
  put('alpha', 'context/glossary.md', '# Glossary\n\n- Apólice: contrato da alpha');
  put('beta', 'context/glossary.md', '# Glossary\n\n- Apólice: contrato da beta');
  // The same run id in both projects.
  for (const id of ['alpha', 'beta']) {
    put(id, `runs/${RUN}/state.json`, JSON.stringify({ id: RUN, project: id, status: 'completed', artifacts: [{ path: `workspace/projects/${id}/runs/${RUN}/outputs/cases.md`, project: id }] }));
    put(id, `runs/${RUN}/outputs/cases.md`, `cases ${id}`);
  }
  put('alpha', 'proposed-updates.md', `${readFileSync(join(alpha, 'proposed-updates.md'), 'utf8')}\n## PU-001 — Alpha rule\n- Status: proposed\n`);
  put('beta', 'proposed-updates.md', `${readFileSync(join(beta, 'proposed-updates.md'), 'utf8')}\n## PU-001 — Beta rule\n- Status: proposed\n`);
  put('alpha', 'activity-log.md', `${readFileSync(join(alpha, 'activity-log.md'), 'utf8')}| 2026-11-01 | test-design | ${RUN} | completed |\n`);
  saveTag({ name: 'Cliente X' }, root);
  saveTag({ name: 'Cliente Y' }, root);
  setProjectTags('alpha', ['cliente-x'], root);
  setProjectTags('beta', ['cliente-y'], root);
  setFileTags('alpha', 'inbox/spec.md', ['cliente-y'], root);
  saveServer({ name: 'Jira', command: 'npx', args: ['jira-mcp'], projects: ['alpha'] }, root);
});
after(() => rmSync(root, { recursive: true, force: true }));

test('the preview lists what changes without touching either project', () => {
  const plan = service.mergePlan('alpha', 'beta');
  assert.deepEqual(plan.renamed.map((m) => m.to).sort(), ['inbox/spec-2.md', 'notes/ideias-2.md', 'notes/sem-titulo-2.md', `runs/${RUN}-2`]);
  assert.deepEqual(plan.context, [{ from: 'context/glossary.md', to: 'context/glossary-alpha.md' }]);
  assert.equal(plan.runs, 1);
  assert.equal(plan.dropped, 1, 'the comment on the linked folder of alpha, which beta does not share');
  assert.ok(plan.identical >= 2, 'inbox/same.txt and the untouched template files');
  assert.ok(!existsSync(join(projects, 'beta', 'notes', 'ideias-2.md')));
  assert.throws(() => service.mergePlan('alpha', 'alpha'), /another project/);
  assert.throws(() => service.mergePlan('alpha', '../beta'), /Unknown project/);
});

test('a merge needs the receiving project name typed', () => {
  assert.throws(() => service.mergeProject('alpha', 'beta', 'beta'), /Type the name/);
  assert.ok(existsSync(join(projects, 'alpha')));
});

test('a failure undoes everything written to the receiving project', () => {
  const store = join(projects, 'beta', '.moki-html-comments.json');
  writeFileSync(store, '{ not json');
  const titles = readFileSync(join(projects, 'beta', '.moki-note-titles.json'), 'utf8');
  assert.throws(() => service.mergeProject('alpha', 'beta', 'Beta'));
  assert.ok(!existsSync(join(projects, 'beta', 'notes', 'ideias-2.md')));
  assert.ok(!existsSync(join(projects, 'beta', 'notes', 'outra.md')));
  assert.ok(!existsSync(join(projects, 'beta', 'runs', `${RUN}-2`)));
  assert.equal(readFileSync(join(projects, 'beta', '.moki-note-titles.json'), 'utf8'), titles);
  assert.equal(readFileSync(store, 'utf8'), '{ not json');
  assert.ok(existsSync(join(projects, 'alpha', 'project.json')), 'the source stays where it was');
  rmSync(store);
});

test('merging copies everything, keeps titles, links and associations, and suspends the source', () => {
  const result = service.mergeProject('alpha', 'beta', 'Beta');
  assert.equal(result.suspended, true);
  assert.ok(!existsSync(join(projects, 'alpha')));
  assert.deepEqual(service.suspendedProjects(), [{ id: 'alpha', name: 'Alpha' }]);
  const beta = join(projects, 'beta');

  // Nothing of beta was overwritten; alpha's files took free names.
  assert.equal(read('beta', 'notes/ideias.md'), '# Ideias da beta');
  assert.equal(read('beta', 'notes/sem-titulo.md'), 'beta');
  assert.equal(read('beta', 'notes/sem-titulo-2.md'), 'alpha');
  assert.equal(read('beta', 'inbox/spec.md'), 'spec beta');
  assert.equal(read('beta', 'inbox/spec-2.md'), 'spec alpha');
  assert.equal(read('beta', 'notes/outra.md'), '# Outra');

  // Titles: each note shows what it showed before.
  const titles = Object.fromEntries(noteTitles(beta).map((t) => [t.path, t.title]));
  assert.equal(titles['notes/ideias.md'], 'Ideias da Beta');
  assert.equal(titles['notes/ideias-2.md'], 'Ideias de teste');
  assert.equal(titles['notes/outra.md'], 'Outra nota');
  assert.equal(titles['notes/sem-titulo-2.md'], 'sem titulo');

  // Links inside the copied note follow the renamed files.
  assert.equal(read('beta', 'notes/ideias-2.md'), '# Ideias\n\nVer [a spec](../inbox/spec-2.md), [a outra](outra.md#topo) e [o site](https://example.com).');

  // PDF notes, comments and code notes point at the new paths; the linked-folder comment is not carried.
  assert.deepEqual(pdfNotes(beta, 'inbox/doc.pdf').map((n) => n.note), [{ path: 'notes/ideias-2.md' }]);
  assert.equal(htmlComments(beta, 'inbox/page.html').length, 1);
  assert.equal(htmlComments(beta, '@folder/src/app.ts').length, 0);
  assert.deepEqual(codeNotes(beta, 'inbox/code.ts').map((n) => n.note), ['notes/ideias-2.md']);

  // Context: kept beside, with a proposal to consolidate; proposals renumbered after beta's.
  assert.equal(read('beta', 'context/glossary.md'), '# Glossary\n\n- Apólice: contrato da beta');
  assert.equal(read('beta', 'context/glossary-alpha.md'), '# Glossary\n\n- Apólice: contrato da alpha');
  const proposals = read('beta', 'proposed-updates.md');
  assert.match(proposals, /## PU-001 — Beta rule/);
  assert.match(proposals, /## PU-002 — Alpha rule/);
  assert.match(proposals, /## PU-003 — Consolidate context\/glossary\.md[\s\S]*context\/glossary-alpha\.md/);

  // Runs: the colliding one took a new id, and its state names beta.
  const state = JSON.parse(read('beta', `runs/${RUN}-2/state.json`));
  assert.equal(state.id, `${RUN}-2`);
  assert.equal(state.project, 'beta');
  assert.equal(state.artifacts[0].path, `workspace/projects/beta/runs/${RUN}-2/outputs/cases.md`);
  assert.equal(read('beta', `runs/${RUN}/outputs/cases.md`), 'cases beta');
  assert.match(read('beta', 'activity-log.md'), new RegExp(`\\| ${RUN} \\| completed \\|\\n\\| \\d{4}-\\d{2}-\\d{2} \\| merge \\| — \\| Merged project Alpha \\(alpha\\) into this one \\|`));

  // Tags and MCP servers.
  assert.deepEqual(fileTags('beta', root)['inbox/spec-2.md'], ['cliente-y']);
  assert.deepEqual(projectSummary('beta', root).tags.sort(), ['cliente-x', 'cliente-y']);
  assert.deepEqual(listServers(root).find((s) => s.name === 'Jira')?.projects, ['alpha', 'beta']);

  // The suspended source still holds its own copy.
  assert.equal(readFileSync(join(root, 'workspace', 'suspended', 'alpha', 'notes', 'ideias.md'), 'utf8').startsWith('# Ideias\n\nVer [a spec](../inbox/spec.md)'), true);
});

test('a merge stops while something runs in either project', () => {
  const busy = createService(root, { launch: () => ({ opened: true, message: '' }), openFolder: () => {}, openPath: () => {}, runningTerminals: (p) => (p === 'beta' ? 1 : 0) });
  assert.throws(() => busy.mergeProject('gamma', 'beta', 'Beta'), /still running.*terminal of Beta/);
});

test('relink leaves external, anchor-only and unchanged links alone', () => {
  const pathOf = (rel: string) => (rel === 'notes/a b.md' ? 'notes/a b-2.md' : rel);
  assert.equal(relink('[x](a%20b.md) [y](#top) [z](mailto:a@b.c) [w](c.md)', 'notes/n.md', 'notes/n.md', pathOf), '[x](a%20b-2.md) [y](#top) [z](mailto:a@b.c) [w](c.md)');
});
