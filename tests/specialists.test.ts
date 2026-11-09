// Exercise the real activity/service/CLI routing for the new specialists in an isolated framework.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../scripts/lib/repo.mjs';
import { buildPrompt, createProject } from '../scripts/lib/core.ts';
import { createService } from '../desktop/service.ts';

const root = mkdtempSync(join(tmpdir(), 'moki-specialists-'));
const specialists = [
  { activity: 'model-data', agent: 'cartografo', category: 'engineering' },
  { activity: 'design-solution', agent: 'inventor', category: 'engineering' },
  { activity: 'prototype-interface', agent: 'artesao', category: 'engineering' },
  { activity: 'validate-api', agent: 'sentinela', category: 'quality' },
];
let service: ReturnType<typeof createService>;
let launches = 0;
const request = { project: 'acme', tool: 'print', files: [], note: 'Review the supplied scope only.', language: 'Portuguese (pt-BR)' };

before(() => {
  for (const dir of ['agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  for (const skill of ['data-modeling', 'database-engineering', 'solution-design', 'interface-prototyping', 'api-assessment', 'api-testing', 'test-design', 'requirements-review', 'project-context']) {
    cpSync(join(ROOT, 'skills', skill), join(root, 'skills', skill), { recursive: true });
  }
  createProject('acme', 'Acme', root);
  createProject('other', 'Other', root);
  writeFileSync(join(root, 'workspace', 'projects', 'acme', 'inbox', 'brief.md'), '# Synthetic brief\n');
  service = createService(root, {
    launch: () => { launches++; return { opened: true, message: '' }; },
    openFolder: () => {},
    openPath: () => {},
  });
});

after(() => rmSync(root, { recursive: true, force: true }));

for (const { activity, agent, category } of specialists) {
  test(`${agent}: activity starts discovery without a file and CLI selects the same role`, () => {
    assert.equal(service.activities('acme').activities.find((a) => a.id === activity)?.available, true);
    const prepared = service.launch({ ...request, activity }).prompt;
    const role = `Act as the ${agent} agent: read agents/${category}/${agent}.md and follow it.`;
    assert.ok(prepared.includes(role));
    assert.ok(prepared.includes(request.note));
    assert.ok(prepared.includes(request.language));
    assert.ok(buildPrompt({ project: 'acme', activity, root }).includes(role));
    assert.doesNotMatch(prepared, /\{(?:files|no-files|project)\}/);
    assert.equal(launches, 0, 'preparing a request does not launch an AI or execute a tool');
  });

  test(`${agent}: selected sources stay in the active project`, () => {
    const prepared = service.launch({ ...request, activity, files: ['brief.md'] }).prompt;
    assert.ok(prepared.includes('workspace/projects/acme/inbox/brief.md'));
    assert.throws(() => service.launch({ ...request, project: 'other', activity, files: ['brief.md'] }));
    assert.equal(launches, 0);
  });
}

test('api-tester remains usable independently of Sentinela', () => {
  const prepared = service.launch({ ...request, activity: 'talk', agent: 'api-tester' }).prompt;
  assert.match(prepared, /Act as the api-tester agent: read agents\/quality\/api-tester\.md/);
  assert.doesNotMatch(prepared, /Act as the sentinela agent/);
});

test('explicit specialist selection respects the project agent configuration', () => {
  service.setProjectAgents('other', ['api-tester']);
  for (const { activity, agent } of specialists) assert.throws(() => service.launch({ ...request, project: 'other', activity, agent }));
  assert.match(service.launch({ ...request, project: 'other', activity: 'talk', agent: 'api-tester' }).prompt, /api-tester/);
});
