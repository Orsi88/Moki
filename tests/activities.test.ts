// Activities (scripts/lib/activities.ts): the app's own actions in code, the ones of Moki in activities/,
// the person's own in the workspace library; edited from Settings, picked in "Open in your AI tool".
import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../scripts/lib/repo.mjs';
import { activityProblem, buildPrompt, createProject } from '../scripts/lib/core.ts';
import { duplicateAgent, parseAgent, validateAgent } from '../scripts/lib/agents.ts';
import { activityId, activityMarkdown, activityRequest, favorites, getActivity, libraryDir, listActivities, parseActivity, removeLibraryActivity, saveLibraryActivity, setFavorite } from '../scripts/lib/activities.ts';
import { createService } from '../desktop/service.ts';

const root = mkdtempSync(join(tmpdir(), 'qa-activities-'));
const prompts: string[] = [];
let svc: ReturnType<typeof createService>;

before(() => {
  for (const s of ['project-context', 'test-design', 'failure-analysis', 'requirements-review', 'qa-orchestrator']) cpSync(join(ROOT, 'skills', s), join(root, 'skills', s), { recursive: true });
  cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
  cpSync(join(ROOT, 'agents'), join(root, 'agents'), { recursive: true });
  cpSync(join(ROOT, 'activities'), join(root, 'activities'), { recursive: true });
  createProject('acme', 'Acme', root);
  createProject('beta', 'Beta', root);
  writeFileSync(join(root, 'workspace', 'projects', 'acme', 'inbox', 'us-1.md'), '# US-1');
  svc = createService(root, {
    launch: (_tool, prompt) => { prompts.push(prompt); return { opened: true, message: '' }; },
    openFolder: () => {}, openPath: () => {},
    detectTools: () => ({ claude: true }) as never,
  });
});
after(() => rmSync(root, { recursive: true, force: true }));

const text = (fields: Record<string, string>, body = '') => ['---', ...Object.entries(fields).map(([k, v]) => `${k}: ${v}`), '---', '', body, ''].join('\n');
const printRequest = { project: 'acme', tool: 'print', files: [], note: '', language: 'English' };

test('the app\'s actions and the activities that come with Moki: one list, the same ids as before', () => {
  const ids = listActivities(root).map((a) => `${a.source}:${a.id}`);
  for (const id of ['open', 'context', 'setup', 'plan', 'resume', 'talk', 'skill']) assert.ok(ids.includes(`moki:${id}`), id);
  for (const id of ['review', 'tests', 'review-then-tests', 'failure', 'evidence', 'automation']) assert.ok(ids.includes(`builtin:${id}`), id);
  assert.ok(!ids.some((i) => i.endsWith(':README')), 'the README of activities/ is not an activity');
  assert.deepEqual(getActivity('review-then-tests', root)?.target, { kind: 'workflow', name: 'requirements-to-tests' });
  assert.equal(getActivity('tests', root)?.files, 'required');
});

test('the request text: {files} lines only with files, {no-files} lines only without, {project}; an empty text asks for its target', () => {
  const failure = getActivity('failure', root)!;
  assert.equal(activityRequest(failure, ['inbox/log.txt'], 'acme'), 'Use the failure-analysis skill with the input in: inbox/log.txt.');
  assert.equal(activityRequest(failure, [], 'acme'), 'Use the failure-analysis skill. I will paste the filled input template next.');
  const own = parseActivity(text({ label: 'Mine', uses: 'skill:test-design' }, 'Project {project}.\nFiles: {files}.'), 'mine', 'library').activity!;
  assert.equal(activityRequest(own, ['a.md', 'b.md'], 'acme'), 'Project acme. Files: a.md, b.md.');
  const empty = parseActivity(text({ label: 'Empty', uses: 'workflow:test-evidence' }), 'empty', 'library').activity!;
  assert.equal(activityRequest(empty, [], 'acme'), 'Use the qa-orchestrator with the test-evidence workflow.');
});

test('a file is checked: what it uses, its files rule, its id and its name', () => {
  const errors = (fields: Record<string, string>, id = 'ok') => parseActivity(text(fields), id, 'library').errors.join(' ');
  assert.equal(errors({ label: 'Fine', uses: 'agent:test-designer', files: 'none' }), '');
  assert.match(errors({ label: 'X', uses: 'tool:x' }), /uses must be/);
  assert.match(errors({ label: 'X', uses: 'skill:test-design', files: 'always' }), /files must be/);
  assert.match(errors({ label: 'X', uses: 'skill:test-design' }, 'Bad Id'), /id/);
  assert.match(errors({ uses: 'skill:test-design' }), /label is required/);
});

test('your own activities: saved in the library, reach projects by tags, never take an id of Moki; favorites', () => {
  const md = activityMarkdown({ label: 'Release notes', description: 'Reviews them', category: 'Docs', target: { kind: 'skill', name: 'test-design' }, files: 'optional', note: '', tags: ['project:beta'], template: 'Review {files}.' });
  const saved = saveLibraryActivity('release-notes', md, root);
  assert.ok(existsSync(join(libraryDir(root), 'release-notes.md')));
  assert.equal(saved.source, 'library');
  assert.ok(listActivities(root, 'beta').some((a) => a.id === 'release-notes'));
  assert.ok(!listActivities(root, 'acme').some((a) => a.id === 'release-notes'), 'a tag of another project');
  assert.throws(() => saveLibraryActivity('tests', md, root), /comes with Moki/);
  assert.equal(activityId('Release notes', root), 'release-notes-2');
  assert.deepEqual(setFavorite('release-notes', true, root), ['release-notes']);
  assert.deepEqual(favorites(root), ['release-notes']);
  removeLibraryActivity('release-notes', root);
  assert.deepEqual(favorites(root), [], 'a deleted activity leaves the favorites');
  assert.throws(() => removeLibraryActivity('tests', root), /Only your own/);
});

test('service: Settings lists, creates, duplicates and deletes; a target that does not exist is refused', () => {
  assert.throws(() => svc.saveActivity({ label: 'X', kind: 'agent', target: 'nobody' }), /no agent "nobody"/);
  assert.throws(() => svc.saveActivity({ label: 'X', kind: 'workflow', target: 'nothing' }), /no workflow "nothing"/);
  assert.throws(() => svc.saveActivity({ label: '', kind: 'skill', target: 'test-design' }), /Give the activity a name/);
  const mine = svc.saveActivity({ label: 'Smoke check', description: 'Quick look', category: 'QA', kind: 'skill', target: 'test-design', files: 'required', template: 'Use the test-design skill to list smoke checks for: {files}.' });
  assert.equal(mine.id, 'smoke-check');
  const changed = svc.saveActivity({ id: 'smoke-check', label: 'Smoke check', kind: 'skill', target: 'test-design', files: 'required', template: 'Smoke checks for: {files}.' });
  assert.equal(changed.id, 'smoke-check', 'saving one of yours keeps its id');
  assert.throws(() => svc.saveActivity({ id: 'tests', label: 'Mine', kind: 'skill', target: 'test-design' }), /cannot be changed: duplicate it/);
  const copy = svc.duplicateActivity('tests');
  assert.equal(copy.source, 'library');
  assert.equal(copy.template, getActivity('tests', root)?.template, 'the copy has the same request');
  assert.throws(() => svc.duplicateActivity('open'), /cannot be duplicated/);
  assert.throws(() => svc.deleteActivity('tests'), /Only your own/);
  svc.setActivityFavorite('smoke-check', true);
  const listed = svc.activities('acme').activities;
  assert.equal(listed.find((a) => a.id === 'smoke-check')?.favorite, true);
  assert.equal(listed.find((a) => a.id === 'smoke-check')?.needsFiles, true);
  assert.equal(svc.activity('smoke-check').template, 'Smoke checks for: {files}.');
  assert.equal(svc.deleteActivity(copy.id), true);
});

test('launching: your activity\'s text, an agent\'s activity acts as it, an operation\'s activity opens its form instead', () => {
  prompts.length = 0;
  assert.throws(() => svc.launch({ project: 'acme', activity: 'smoke-check', tool: 'claude', files: [], note: '', language: 'English' } as never), /needs at least one file/);
  svc.launch({ project: 'acme', activity: 'smoke-check', tool: 'claude', files: ['us-1.md'], note: '', language: 'English' } as never);
  assert.match(prompts.at(-1) ?? '', /Smoke checks for: workspace\/projects\/acme\/inbox\/us-1\.md\./);

  svc.saveActivity({ label: 'Design with the designer', kind: 'agent', target: 'test-designer', files: 'optional', template: '' });
  svc.launch({ project: 'acme', activity: 'design-with-the-designer', tool: 'claude', files: [], note: '', language: 'English' } as never);
  assert.match(prompts.at(-1) ?? '', /Act as the test-designer agent: read .*test-designer\.md and follow it\./);

  const op = svc.saveOperation({ name: 'Fluxo', description: '', lanes: [], steps: [{ id: 's1', agent: 'library:test-designer', x: 0, y: 0 }], links: [] });
  svc.saveActivity({ label: 'Run Fluxo', kind: 'operation', target: op.id, files: 'none' });
  assert.equal(svc.activities('acme').activities.find((a) => a.id === 'run-fluxo')?.available, true);
  assert.throws(() => svc.launch({ project: 'acme', activity: 'run-fluxo', tool: 'claude', files: [], note: '', language: 'English' } as never), /starts the operation/);
  assert.throws(() => svc.launch({ project: 'acme', activity: 'made-up', tool: 'claude', files: [], note: '', language: 'English' } as never), /Unknown activity/);
  assert.ok(readFileSync(join(libraryDir(root), 'run-fluxo.md'), 'utf8').includes(`uses: operation:${op.id}`));
});

test('launching: "talk" is a conversation with one agent, never listed where an activity is picked', () => {
  prompts.length = 0;
  assert.ok(listActivities(root).some((a) => a.id === 'talk' && a.source === 'moki'));
  assert.ok(!svc.activities('acme').activities.some((a) => a.id === 'talk'), 'not offered as an activity');
  assert.throws(() => svc.launch({ project: 'acme', activity: 'talk', tool: 'claude', files: [], note: '', language: 'English' } as never), /Choose the agent to talk with/);
  assert.throws(() => svc.launch({ project: 'acme', activity: 'talk', tool: 'claude', files: [], note: '', language: 'English', agent: 'made-up' } as never));
  svc.launch({ project: 'acme', activity: 'talk', tool: 'claude', files: [], note: 'A coupon rule for the checkout', language: 'English', agent: 'test-designer' } as never);
  const prompt = prompts.at(-1) ?? '';
  assert.match(prompt, /Act as the test-designer agent: read .*test-designer\.md/);
  assert.match(prompt, /this is a conversation, not an activity\. Do not start a run, follow a skill procedure or write files unless I ask\./);
  assert.match(prompt, /A coupon rule for the checkout/);
  assert.doesNotMatch(prompt, /Ask me what I have in mind/);
  svc.launch({ project: 'acme', activity: 'talk', tool: 'claude', files: [], note: '', language: 'English', agent: 'test-designer' } as never);
  assert.match(prompts.at(-1) ?? '', /Ask me what I have in mind\./);
});

test('launching: "skill" names one usable skill and stays out of the activity list', () => {
  prompts.length = 0;
  assert.ok(listActivities(root).some((a) => a.id === 'skill' && a.source === 'moki'));
  assert.ok(!svc.activities('acme').activities.some((a) => a.id === 'skill'), 'not offered as an activity');
  assert.throws(() => svc.launch({ project: 'acme', activity: 'skill', tool: 'claude', files: [], note: '', language: 'English' } as never), /Choose a skill/);
  assert.throws(() => svc.launch({ project: 'acme', activity: 'skill', tool: 'claude', files: [], note: '', language: 'English', skill: 'documentation' } as never), /Choose a skill/);
  svc.launch({ project: 'acme', activity: 'skill', tool: 'claude', files: [], note: '', language: 'English', skill: 'test-design' } as never);
  assert.match(prompts.at(-1) ?? '', /Use the test-design skill: read skills\/test-design\/SKILL\.md and follow its procedure and approval gates\./);
});

test('text-only activities need a request, round-trip without uses, and keep files and project substitutions', () => {
  assert.match(parseActivity(text({ label: 'Empty' }), 'empty', 'library').errors.join(' '), /needs a request/);
  const parsed = parseActivity(text({ label: 'Summarize', files: 'optional' }, 'Summarize {project}.\nFiles: {files}.'), 'summarize', 'library');
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.activity);
  assert.deepEqual(parsed.activity.target, { kind: 'prompt' });
  assert.equal(activityRequest(parsed.activity, [], 'acme'), 'Summarize acme.');
  const serialized = activityMarkdown(parsed.activity);
  assert.doesNotMatch(serialized, /^uses:/m);
  assert.deepEqual(parseActivity(serialized, 'summarize', 'library').activity?.target, { kind: 'prompt' });

  assert.throws(() => svc.saveActivity({ label: 'Empty', kind: 'prompt', template: ' ' }), /Write the request/);
  const saved = svc.saveActivity({ label: 'Summarize the project', kind: 'prompt', template: 'Summarize {project}.\nFiles: {files}.' });
  const copy = svc.duplicateActivity(saved.id);
  assert.deepEqual(copy.target, { kind: 'prompt' });
  assert.equal(svc.activities('acme').activities.find((a) => a.id === saved.id)?.available, true);
  const prompt = svc.launch({ ...printRequest, activity: saved.id, files: ['us-1.md'] }).prompt;
  assert.match(prompt, /Summarize acme\. Files: workspace\/projects\/acme\/inbox\/us-1\.md\./);
  assert.doesNotMatch(prompt, /Use the .* skill|Act as/);
  assert.match(prompt, /--activity summarize-the-project/);
});

test('several skills round-trip in uses, all reach the request even with custom text, and invalid combinations are refused', () => {
  const parsed = parseActivity(text({ label: 'Combined', uses: 'skill:requirements-review, skill:test-design' }, 'Focus on permissions.'), 'combined', 'library');
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.activity);
  assert.deepEqual(parsed.activity.target, { kind: 'skills', names: ['requirements-review', 'test-design'] });
  assert.deepEqual(parseActivity(activityMarkdown(parsed.activity), 'combined', 'library').activity?.target, parsed.activity.target);
  assert.match(activityRequest(parsed.activity, [], 'acme'), /procedure and approval gates: requirements-review, test-design\. Focus on permissions\./);
  for (const uses of ['skill:test-design, agent:test-designer', 'agent:test-designer, agent:qa-lead', 'skill:test-design, skill:test-design', 'skill:test-design,', 'skill:../outside']) {
    assert.equal(parseActivity(text({ label: 'Invalid', uses }), 'invalid', 'library').activity, null, uses);
  }
});

test('service validates every selected skill, preserves them when copying and editing, and makes the same request for the CLI', () => {
  for (const skills of [[], ['test-design', 'missing'], ['test-design', 'test-design'], ['test-design', 3], ['../outside']]) {
    assert.throws(() => svc.saveActivity({ label: 'Bad', kind: 'skills', skills }), /Choose/);
  }
  const saved = svc.saveActivity({ label: 'Review and design', kind: 'skills', skills: ['requirements-review', 'test-design'], template: 'Focus on permissions.' });
  assert.deepEqual(svc.activity(saved.id).skills, ['requirements-review', 'test-design']);
  const copied = svc.duplicateActivity(saved.id);
  assert.deepEqual(copied.target, saved.target);
  const prompt = svc.launch({ ...printRequest, activity: saved.id }).prompt;
  assert.match(prompt, /procedure and approval gates: requirements-review, test-design\. Focus on permissions\./);
  assert.match(buildPrompt({ project: 'acme', activity: saved.id, root }), /procedure and approval gates: requirements-review, test-design/);
  const edited = svc.saveActivity({ id: saved.id, label: saved.label, kind: 'skills', skills: ['test-design'] });
  assert.deepEqual(edited.target, { kind: 'skill', name: 'test-design' });
  assert.deepEqual(svc.activity(saved.id).skills, ['test-design']);
});

test('a planned second skill makes the whole activity unavailable in the app and terminal menu', () => {
  cpSync(join(ROOT, 'skills', 'smoke-test'), join(root, 'skills', 'smoke-test'), { recursive: true });
  assert.throws(() => svc.saveActivity({ label: 'Not ready', kind: 'skills', skills: ['test-design', 'smoke-test'] }), /available in the list/);
  const activity = saveLibraryActivity('not-ready', text({ label: 'Not ready', uses: 'skill:test-design, skill:smoke-test' }), root);
  assert.match(activityProblem(activity, root), /not available yet: planned/);
  const info = svc.activities('acme').activities.find((a) => a.id === activity.id);
  assert.equal(info?.available, false);
  assert.equal(info?.status, 'planned');
  assert.throws(() => svc.launch({ ...printRequest, activity: activity.id }), /not available yet/);
});

test('an agent may have no skills: validation, profile saving and activities still retain its role', () => {
  const copy = duplicateAgent('test-designer', root);
  const body = '# Writing helper\n\n## Role\nReview writing.\n## When to use\nWhen asked.\n## How to work\nExplain unclear wording.\n## Boundaries\nRead only.\n';
  svc.saveAgentProfile(copy.name, { description: 'Reviews writing.', body, skills: [], contract: { inputs: [], outputs: [], mcps: [], ai: '' } });
  const parsed = parseAgent(readFileSync(join(root, copy.path), 'utf8'), 'custom', copy.path);
  assert.ok(parsed.agent);
  assert.deepEqual(parsed.agent.skills, []);
  assert.deepEqual(validateAgent(parsed.agent, { skills: [], categories: [], fileName: copy.name, folder: copy.category }), []);
  assert.deepEqual(validateAgent({ ...parsed.agent, skills: ['missing'] }, { skills: [], categories: [], fileName: copy.name, folder: copy.category }).filter((e) => e.includes('unknown skill')), ['unknown skill "missing"']);
  const activity = svc.saveActivity({ label: 'Review my writing', kind: 'agent', target: copy.name });
  assert.match(svc.launch({ ...printRequest, activity: activity.id }).prompt, new RegExp(`Act as the ${copy.name} agent`));
  assert.match(buildPrompt({ project: 'acme', activity: activity.id, root }), new RegExp(`Act as the ${copy.name} agent`));
});
