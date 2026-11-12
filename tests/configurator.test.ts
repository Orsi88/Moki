// The Configurador: the AI's plan is read strictly, and applying goes through the same service calls as Settings.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../scripts/lib/repo.mjs';
import { createProject, listTags, projectSummary, TOOLS, type ToolKey } from '../scripts/lib/core.ts';
import { listRoutineFiles } from '../scripts/lib/routines.ts';
import { configPrompt, readConfigPlan } from '../desktop/configurator.ts';
import { createService } from '../desktop/service.ts';

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'moki-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['templates', 'agents', 'activities']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  for (const skill of ['routine-analysis', 'project-context']) cpSync(join(ROOT, 'skills', skill), join(root, 'skills', skill), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  createProject('acme', 'Acme', root);
  const service = createService(root, {
    home: join(root, 'fake-home'),
    detectTools: () => Object.fromEntries(Object.keys(TOOLS).map((key) => [key, true])) as Record<ToolKey, boolean>,
    launch: () => ({ opened: false, message: '' }), openFolder: () => {}, openPath: () => {},
  });
  return { root, service };
}

test('the plan keeps only known kinds with object data; routine and project steps need a project', () => {
  const answer = '```json\n' + JSON.stringify({
    steps: [
      { kind: 'tag', title: 'Tag', data: { name: 'Client' } },
      { kind: 'routine', title: 'Watch', data: { name: 'Watch' } },
      { kind: 'delete-everything', title: 'No', data: {} },
      { kind: 'tag', title: 'No data' },
    ],
    questions: ['Which folder?'], answer: 'Here is the plan.',
  }) + '\n```';
  assert.deepEqual(readConfigPlan(answer, false).steps.map((s) => s.kind), ['tag']);
  assert.deepEqual(readConfigPlan(answer, true).steps.map((s) => s.kind), ['tag', 'routine']);
  assert.deepEqual(readConfigPlan(answer, true).questions, ['Which folder?']);
  assert.deepEqual(readConfigPlan('not json', true), { steps: [], questions: [], answer: '' });
  const prompt = configPrompt('a routine for the context folder', { project: { id: 'acme', name: 'Acme', description: '', tags: [] }, projects: [], agents: [], skills: [], activities: [], operations: [], routines: [], mcp: [], templates: [], tags: [] }, 'Portuguese (pt-BR)');
  assert.match(prompt, /JSON only/);
  assert.match(prompt, /"kind":"folder"/);
  assert.match(prompt, /a routine for the context folder/);
});

test('applying uses the app checks: valid steps are made, an invalid one fails alone with its reason', async (t) => {
  const { root, service } = fixture(t);
  const results = await service.configApply('acme', [
    { kind: 'tag', title: 'Tag for the client', why: '', data: { name: 'Cliente Y' } },
    { kind: 'routine', title: 'Watch the context', why: '', data: { name: 'Context watch', executionPolicy: 'monitor', schedule: { kind: 'daily', time: '08:00', timezone: 'UTC' }, resources: [{ kind: 'folder', path: 'context' }] } },
    { kind: 'routine', title: 'Outside the project', why: '', data: { name: 'Bad', resources: [{ kind: 'folder', path: '../other' }] } },
    { kind: 'project', title: 'Describe', why: '', data: { description: 'Library system under test.' } },
  ]);
  assert.deepEqual(results.map((r) => r.ok), [true, true, false, true]);
  assert.ok(listTags(root).some((x) => x.name === 'Cliente Y'));
  assert.deepEqual(listRoutineFiles(root, 'acme').map((r) => r.name), ['Context watch']);
  assert.equal(projectSummary('acme', root).description, 'Library system under test.');
  assert.ok(service.configSnapshot('acme').routines.some((r) => r.name === 'Context watch'));
});

test('npm run configure applies a plan file from a terminal the same way', (t) => {
  const { root } = fixture(t);
  const plan = join(root, 'plan.json');
  writeFileSync(plan, JSON.stringify({ steps: [{ kind: 'tag', title: 'Tag', why: '', data: { name: 'Squad A' } }] }));
  const env: NodeJS.ProcessEnv = { ...process.env, QA_ROOT: root };
  delete env.QA_WORKSPACE;
  const check = spawnSync(process.execPath, [join(ROOT, 'scripts', 'configure.ts'), 'check', plan], { env, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.match(check.stdout, /\[tag\] Tag/);
  const apply = spawnSync(process.execPath, [join(ROOT, 'scripts', 'configure.ts'), 'apply', plan], { env, encoding: 'utf8' });
  assert.equal(apply.status, 0, apply.stderr);
  assert.match(apply.stdout, /✓ Tag/);
  assert.ok(listTags(root).some((x) => x.name === 'Squad A'));
});
