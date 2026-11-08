import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../scripts/lib/repo.mjs';
import { createProject, saveTag, setProjectTags } from '../scripts/lib/core.ts';
import { NOWHERE, appliesTo, cleanTags, reachOf, withProject } from '../scripts/lib/tags.mjs';
import { agentTags, agentsOfProject, setAgentTags, setAgentsOfProject } from '../scripts/lib/agent-tags.ts';
import { listTemplates, removeTemplate, saveTemplate, setProjectTemplate, styleFor, templateFor } from '../scripts/lib/doc-style.mjs';

// Fixture: three projects; beta and gamma share the "cliente-x" tag; acme had its own document style
// and only two agents enabled (project.json "agents"), as before tags existed.
const root = mkdtempSync(join(tmpdir(), 'qa-tags-'));
const projects = join(root, 'workspace', 'projects');
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const patchProject = (id: string, extra: object) => {
  const file = join(projects, id, 'project.json');
  writeFileSync(file, JSON.stringify({ ...json(file), ...extra }));
};

before(() => {
  for (const s of ['project-context', 'test-design', 'failure-analysis', 'requirements-review']) cpSync(join(ROOT, 'skills', s), join(root, 'skills', s), { recursive: true });
  cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
  cpSync(join(ROOT, 'agents'), join(root, 'agents'), { recursive: true });
  cpSync(join(ROOT, 'activities'), join(root, 'activities'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  for (const [id, name] of [['acme', 'Acme'], ['beta', 'Beta'], ['gamma', 'Gamma']]) createProject(id, name, root);
  saveTag({ name: 'Cliente X' }, root);
  setProjectTags('beta', ['cliente-x'], root);
  setProjectTags('gamma', ['cliente-x'], root);
  patchProject('acme', { agents: ['test-designer', 'failure-analyst'] });
  writeFileSync(join(root, 'workspace', 'document-style.json'), JSON.stringify({ accent: '#112233' }));
  writeFileSync(join(projects, 'acme', 'document-style.json'), JSON.stringify({ accent: '#AA0000' }));
});

after(() => rmSync(root, { recursive: true, force: true }));

test('one rule: no tag = every project; the project\'s own tag; a shared tag', () => {
  assert.ok(appliesTo([], 'acme', root));
  assert.ok(appliesTo(['project:acme'], 'acme', root) && !appliesTo(['project:acme'], 'beta', root));
  assert.ok(appliesTo(['cliente-x'], 'beta', root) && appliesTo(['cliente-x'], 'gamma', root) && !appliesTo(['cliente-x'], 'acme', root));
  assert.deepEqual(cleanTags(['cliente-x', 'project:acme', 'cliente-x', 'Bad Tag', '../x']), ['cliente-x', 'project:acme']);
});

test('agents: the old per-project lists become tags, each project keeps exactly what it had', () => {
  const before = { acme: ['failure-analyst', 'test-designer'], beta: agentsOfProject('beta', root) };
  assert.deepEqual(agentsOfProject('acme', root).sort(), before.acme);
  assert.ok(before.beta.includes('requirements-analyst'), 'a project without a list keeps every usable agent');
  const tags = agentTags(root);
  assert.equal(tags['test-designer'], undefined, 'in every project: no tag');
  assert.deepEqual(tags['requirements-analyst'], ['project:beta', 'project:gamma']);

  // A shared tag reaches every project that carries it.
  setAgentTags('requirements-analyst', ['cliente-x'], root);
  assert.ok(agentsOfProject('gamma', root).includes('requirements-analyst') && !agentsOfProject('acme', root).includes('requirements-analyst'));
  // Turning it off where a shared tag brings it is refused, with the tag named.
  assert.throws(() => setAgentsOfProject('beta', agentsOfProject('beta', root).filter((n) => n !== 'requirements-analyst'), root), /through the tag "cliente-x"/);
  // On in acme through its own tag; every project's own tag is the same as no tag.
  setAgentsOfProject('acme', [...agentsOfProject('acme', root), 'requirements-analyst'], root);
  assert.deepEqual(agentTags(root)['requirements-analyst'], ['cliente-x', 'project:acme']);
  setAgentTags('failure-analyst', ['project:acme', 'project:beta', 'project:gamma'], root);
  assert.deepEqual(agentTags(root)['failure-analyst'], ['project:acme', 'project:beta', 'project:gamma']); // kept as chosen: a new project will not get it
  assert.throws(() => setAgentTags('nobody', [], root), /Unknown agent/);
});

test('templates: the old styles become a list; each project uses its default, else the one without tags', () => {
  const list = listTemplates(root);
  assert.deepEqual(list.map((t) => [t.id, t.tags]), [['default', []], ['acme', ['project:acme']]]);
  assert.equal(list[0].style.accent, '#112233');
  assert.equal(json(join(projects, 'acme', 'project.json')).template, 'acme', 'the migrated style is acme\'s default');
  assert.equal(templateFor('acme', root)?.id, 'acme');
  assert.equal(templateFor('beta', root)?.id, 'default');

  // A template for the "cliente-x" projects: it applies, but beta keeps the general one until it is chosen.
  const client = saveTemplate({ name: 'Cliente X', tags: ['cliente-x'], style: { accent: '#00AA00' } }, root);
  assert.equal(templateFor('beta', root)?.id, 'default');
  setProjectTemplate('beta', client.id, root);
  assert.equal(templateFor('beta', root)?.id, client.id);
  assert.throws(() => setProjectTemplate('acme', client.id, root), /does not apply/);
  // The generators read it by the file's project.
  assert.equal(styleFor(join(projects, 'beta', 'runs', 'r', 'outputs', 'x.pdf'), { root }).style.accent, '#00AA00');
  assert.equal(styleFor(join(projects, 'acme', 'outputs', 'x.docx'), { root }).style.accent, '#AA0000');
  assert.equal(styleFor(join(projects, 'gamma', 'x.xlsx'), { root }).style.accent, '#112233');

  // Renaming keeps the id; removing clears the projects' choice; the last one stays.
  assert.equal(saveTemplate({ ...client, name: 'Cliente X (novo)' }, root).id, client.id);
  removeTemplate(client.id, root);
  assert.equal(json(join(projects, 'beta', 'project.json')).template, undefined);
  assert.equal(templateFor('beta', root)?.id, 'default');
  removeTemplate('acme', root);
  assert.throws(() => removeTemplate('default', root), /at least one/);
  assert.throws(() => saveTemplate({ name: '  ' }, root), /name/);
  assert.ok(existsSync(join(root, 'workspace', 'document-style.json')), 'the old file stays, unread');
});

test('seen from one project: how an item reaches it, and turning it on or off there through the project\'s own tag', () => {
  const all = ['acme', 'beta', 'gamma'];
  assert.deepEqual(reachOf([], 'acme', root), { state: 'all' });
  assert.deepEqual(reachOf(['project:acme'], 'acme', root), { state: 'own' });
  assert.deepEqual(reachOf(['cliente-x', 'project:beta'], 'beta', root), { state: 'shared', via: 'cliente-x' });
  assert.deepEqual(reachOf(['cliente-x'], 'acme', root), { state: 'off' });
  // On: the project's tag joins the others; every project by its own tag is the same as no tag.
  assert.deepEqual(withProject(['cliente-x'], 'acme', true, all, root), ['cliente-x', 'project:acme']);
  assert.deepEqual(withProject([NOWHERE], 'acme', true, all, root), ['project:acme']);
  assert.deepEqual(withProject(['project:beta', 'project:gamma'], 'acme', true, all, root), []);
  // Off: only this project's tag goes; what reached every project now reaches the others; the last one leaves it nowhere.
  assert.deepEqual(withProject(['project:acme', 'project:beta'], 'acme', false, all, root), ['project:beta']);
  assert.deepEqual(withProject([], 'acme', false, all, root), ['project:beta', 'project:gamma']);
  assert.deepEqual(withProject(['project:acme'], 'acme', false, all, root), [NOWHERE]);
  assert.equal(appliesTo([NOWHERE], 'acme', root), false);
  // A shared tag is the workspace's choice: refused here, with the tag named. Nothing to do is no change.
  assert.throws(() => withProject(['cliente-x'], 'beta', false, all, root), /through the tag "cliente-x"/);
  assert.deepEqual(withProject(['cliente-x'], 'beta', true, all, root), ['cliente-x']);
  assert.deepEqual(withProject(['cliente-x'], 'acme', false, all, root), ['cliente-x']);
});
