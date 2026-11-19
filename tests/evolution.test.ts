// Evolution of agents, skills and activities (Mycroft): learnings, checked proposals, versions that requests follow,
// going back and restoring the original, and a newer original from Moki. A copy of the framework stands in.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ROOT, setWorkspaceDir } from '../scripts/lib/repo.mjs';
import { activeFile, approveProposal, currentText, declineProposal, itemHistory, learn, listLearnings, originalChanged, pendingProposals, propose, revertTo, versionText, type EvolvedItem } from '../scripts/lib/evolution.ts';
import { versionProblems } from '../scripts/lib/evolution-check.ts';
import { lineDiff } from '../scripts/lib/text-diff.ts';
import { listAgents } from '../scripts/lib/agents.ts';
import { listActivities } from '../scripts/lib/activities.ts';
import { buildPrompt, createProject, skillFile } from '../scripts/lib/core.ts';

function framework(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'moki-evolution-'));
  t.after(() => { setWorkspaceDir(root, null); rmSync(root, { recursive: true, force: true }); });
  for (const dir of ['agents', 'skills', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  return root;
}
const agentItem = (root: string, name: string): EvolvedItem => {
  const a = listAgents(root).find((x) => x.name === name)!;
  return { kind: 'agent', name, file: resolve(root, a.originalPath ?? a.path), builtin: a.source === 'builtin' };
};
const skillItem = (root: string, name: string): EvolvedItem => ({ kind: 'skill', name, file: join(root, 'skills', name, 'SKILL.md'), builtin: true });

test('evolution: a learning becomes a checked proposal; one that changes an agent\'s access or drops a skill section is refused', (t) => {
  const root = framework(t);
  const learning = learn({ kind: 'agent', name: 'test-designer', text: 'Always number the test cases TC-001, TC-002.' }, root);
  assert.equal(listLearnings(root)[0].text, 'Always number the test cases TC-001, TC-002.');
  assert.throws(() => learn({ kind: 'agent', name: '../x', text: 'a' }, root), /Name the agent/);
  const item = agentItem(root, 'test-designer');
  const original = readFileSync(item.file, 'utf8');
  const better = original.replace('## Boundaries', '## Boundaries\n\n- Number the test cases TC-001, TC-002…');
  assert.deepEqual(versionProblems(item, better, root), []);
  const escalated = better.replace(/^access: .*$/m, 'access: repository-write');
  assert.ok(versionProblems(item, escalated, root).includes('the access level cannot change'));
  assert.throws(() => propose(item, { text: escalated, reason: 'r' }, versionProblems(item, escalated, root), root), /breaks the item's rules/);
  const skill = skillItem(root, 'test-design');
  const noApproval = readFileSync(skill.file, 'utf8').replace('## Human approval points', '## Approvals');
  assert.ok(versionProblems(skill, noApproval, root).includes('missing section "## Human approval points"'));
  assert.throws(() => propose(item, { text: original, reason: 'same' }, [], root), /changes nothing/);
  const proposal = propose(item, { text: better, reason: 'The person numbers test cases this way.', learnings: [learning.id] }, [], root);
  assert.deepEqual(pendingProposals(root).map((p) => p.id), [proposal.id]);
  assert.equal(readFileSync(item.file, 'utf8'), original, 'a proposal changes nothing until it is approved');
});

test('evolution: an approved version is what requests read; the built-in file never changes; back and restore', (t) => {
  const root = framework(t);
  const item = agentItem(root, 'test-designer');
  const original = readFileSync(item.file, 'utf8');
  const v1 = original.replace('## Boundaries', '## Boundaries\n\n- Number the test cases TC-001.');
  const learning = learn({ kind: 'agent', name: 'test-designer', text: 'Number the cases.' }, root);
  approveProposal(item, propose(item, { text: v1, reason: 'Numbering.', learnings: [learning.id] }, [], root).id, root);
  const agent = listAgents(root).find((a) => a.name === 'test-designer')!;
  assert.equal(agent.evolved, 1);
  assert.match(agent.path, /^workspace\/library\/evolution\/agent\/test-designer\/v1\/test-designer\.md$/);
  assert.equal(readFileSync(resolve(root, agent.path), 'utf8'), v1);
  assert.equal(readFileSync(item.file, 'utf8'), original, 'Moki\'s own file is untouched');
  assert.equal(listLearnings(root)[0].status, 'used');
  // A second version, then back to the first (a new version, nothing deleted), then the original.
  const v2 = v1.replace('TC-001.', 'TC-001 and a priority.');
  approveProposal(item, propose(item, { text: v2, reason: 'Priority.' }, [], root).id, root);
  const back = revertTo(item, 1, root);
  assert.equal(back.active, 3);
  assert.equal(currentText(item, root), v1);
  assert.deepEqual(back.entries.map((e) => [e.version, e.event]), [[1, 'version'], [2, 'version'], [3, 'revert']]);
  const restored = revertTo(item, 0, root);
  assert.equal(restored.active, 0);
  assert.equal(activeFile(item, root), null);
  assert.equal(listAgents(root).find((a) => a.name === 'test-designer')!.path, 'agents/quality/test-designer.md');
  assert.equal(versionText(item, 2, root), v2, 'every version stays in the history');
  assert.throws(() => revertTo(item, 0, root), /already in use/);
});

test('evolution: a skill version is read by every request, and an activity version by the activity list', (t) => {
  const root = framework(t);
  const skill = skillItem(root, 'test-design');
  const v1 = readFileSync(skill.file, 'utf8').replace('## Purpose', '## Purpose\n\nThe person wants TC- numbering.');
  approveProposal(skill, propose(skill, { text: v1, reason: 'Numbering.' }, versionProblems(skill, v1, root), root).id, root);
  assert.equal(skillFile('test-design', root), 'workspace/library/evolution/skill/test-design/v1/SKILL.md');
  assert.ok(existsSync(join(root, 'workspace', 'library', 'evolution', 'skill', 'test-design', 'v1', 'references')), 'the skill\'s other files come along');
  createProject('acme', 'Acme', root);
  const prompt = buildPrompt({ project: 'acme', activity: 'skill', skill: 'test-design', root });
  assert.match(prompt, /Use the test-design skill: read workspace\/library\/evolution\/skill\/test-design\/v1\/SKILL\.md/);
  assert.match(prompt, /Skills evolved in this workspace: read their current version instead of the installed one: test-design → /);
  const activity = listActivities(root).find((a) => a.id === 'review')!;
  const file = join(root, 'activities', 'review.md');
  const item: EvolvedItem = { kind: 'activity', name: 'review', file, builtin: true };
  const changed = readFileSync(file, 'utf8').replace(/^label: .*$/m, 'label: Review stories (my way)');
  approveProposal(item, propose(item, { text: changed, reason: 'Name.' }, versionProblems(item, changed, root), root).id, root);
  assert.notEqual(activity.label, 'Review stories (my way)');
  assert.equal(listActivities(root).find((a) => a.id === 'review')!.label, 'Review stories (my way)');
});

test('evolution: the person\'s own agent gets the new text in its file; restoring brings its first text back', (t) => {
  const root = framework(t);
  const dir = join(root, 'workspace', 'library', 'agents', 'quality');
  mkdirSync(dir, { recursive: true });
  const source = readFileSync(join(root, 'agents', 'quality', 'test-designer.md'), 'utf8').replace(/^name: .*$/m, 'name: my-tester');
  writeFileSync(join(dir, 'my-tester.md'), source);
  const item = agentItem(root, 'my-tester');
  assert.equal(item.builtin, false);
  const v1 = source.replace('## Boundaries', '## Boundaries\n\n- My rule.');
  approveProposal(item, propose(item, { text: v1, reason: 'Mine.' }, [], root).id, root);
  assert.equal(readFileSync(item.file, 'utf8'), v1);
  assert.equal(listAgents(root).find((a) => a.name === 'my-tester')!.evolved, 1);
  revertTo(item, 0, root);
  assert.equal(readFileSync(item.file, 'utf8'), source);
});

test('evolution: a newer original from Moki shows; a proposal written over another version, or declined, is not applied', (t) => {
  const root = framework(t);
  const item = agentItem(root, 'test-designer');
  const original = readFileSync(item.file, 'utf8');
  const first = propose(item, { text: original.replace('## Role', '## Role\n\nFirst.'), reason: 'a' }, [], root);
  approveProposal(item, first.id, root);
  assert.equal(originalChanged(item, root), false);
  writeFileSync(item.file, original.replace('## Role', '## Role\n\nMoki 2.0 wording.')); // an app update
  assert.equal(originalChanged(item, root), true);
  const stale = propose(item, { text: original.replace('## Role', '## Role\n\nSecond.'), reason: 'b' }, [], root);
  revertTo(item, 0, root);
  assert.throws(() => approveProposal(item, stale.id, root), /no longer waiting|changed since/);
  const declined = propose(item, { text: original.replace('## Role', '## Role\n\nThird.'), reason: 'c' }, [], root);
  declineProposal(item, declined.id, root);
  assert.deepEqual(pendingProposals(root), []);
  assert.equal(itemHistory('agent', 'test-designer', root).active, 0);
});

test('evolution: learnings of one project stay in it and are read only with it', (t) => {
  const root = framework(t);
  createProject('acme', 'Acme', root);
  createProject('beta', 'Beta', root);
  const acme = join(root, 'workspace', 'projects', 'acme');
  learn({ kind: 'skill', name: 'test-design', text: 'In Acme, cases in English.', scope: 'project' }, root, { id: 'acme', dir: acme });
  learn({ kind: 'skill', name: 'test-design', text: 'Everywhere: short steps.' }, root);
  assert.ok(existsSync(join(acme, 'learnings.jsonl')));
  assert.deepEqual(listLearnings(root, acme).map((l) => l.scope), ['workspace', 'project']);
  assert.deepEqual(listLearnings(root, join(root, 'workspace', 'projects', 'beta')).map((l) => l.text), ['Everywhere: short steps.']);
});

test('text diff: lines kept, removed and added, in order', () => {
  assert.deepEqual(lineDiff('a\nb\nc', 'a\nB\nc\nd').map((l) => `${l.kind[0]}${l.text}`), ['sa', 'rb', 'aB', 'sc', 'ad']);
  assert.deepEqual(lineDiff('same', 'same'), [{ kind: 'same', text: 'same' }]);
});
