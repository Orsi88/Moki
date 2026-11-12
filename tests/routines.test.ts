// Routines: clocks, workspace isolation, real operation lifecycle and safe approval.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { ROOT, setWorkspaceDir, workspaceDir } from '../scripts/lib/repo.mjs';
import { createProject, projectsDir, TOOLS, type ToolKey } from '../scripts/lib/core.ts';
import { saveServer } from '../scripts/lib/mcp.ts';
import { classify, defaultSchedule, dueAction, listExecutions, nextRun, readLock, saveProposal, textHash, type Execution, type RoutineSchedule } from '../scripts/lib/routines.ts';
import { createService, type Deps } from '../desktop/service.ts';

const daily = (zone: string): RoutineSchedule => ({ ...defaultSchedule(zone), kind: 'daily', time: '08:00', timezone: zone, missed: 'once' });
function fixture(t: TestContext, extra: Partial<Deps> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'moki-routines-'));
  t.after(() => { const rel = relative(tmpdir(), root); if (!rel || rel.startsWith('..' + sep)) throw new Error('Unsafe fixture cleanup'); rmSync(root, { recursive: true, force: true }); });
  for (const dir of ['templates', 'agents']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  for (const skill of ['routine-analysis', 'project-context']) cpSync(join(ROOT, 'skills', skill), join(root, 'skills', skill), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }));
  createProject('acme', 'Acme', root);
  const server = saveServer({ name: 'Synthetic read server', transport: 'stdio', command: 'fake-never-started', access: 'read', enabled: true, projects: [] }, root);
  let rev = 4;
  const launched: string[] = [], started: string[] = [];
  const service = createService(root, {
    home: join(root, 'fake-home'),
    detectTools: () => Object.fromEntries(Object.keys(TOOLS).map((key) => [key, true])) as Record<ToolKey, boolean>,
    launch: (_tool, prompt) => { launched.push(prompt); return { opened: true, message: 'Synthetic launch', terminal: { id: `fake-${launched.length}`, title: 'Synthetic AI' } }; },
    startTerminal: (id) => { started.push(id); return ''; },
    openFolder: () => {}, openPath: () => {},
    callTool: async () => ({ id: 123, rev, fields: { 'System.Rev': rev, 'System.Title': 'Synthetic item' } }),
    ...extra,
  });
  const save = (raw: Record<string, unknown> = {}) => service.saveRoutine('acme', {
    name: 'Watch 123', instructions: 'Review the synthetic changes.', executionPolicy: 'supervised', tool: 'claude',
    schedule: daily('UTC'), resources: [{ serverId: server.id, tool: 'fake_read', watchedIds: ['123'] }], ...raw,
  }).routine;
  const finish = (execution: Execution, analysis: object = { summary: 'A synthetic change needs review.', findings: [{ statement: 'An analysis, not a confirmed rule.', kind: 'analysis' }], proposedChanges: [] }) => {
    const dir = join(projectsDir(root), 'acme', 'runs', execution.operationRunId);
    mkdirSync(join(dir, 'outputs', 's1'), { recursive: true });
    writeFileSync(join(dir, 'outputs', 's1', 'analysis.json'), JSON.stringify(analysis));
    writeFileSync(join(dir, 'handoff', 's1.md'), 'Synthetic analysis delivered.');
    service.advanceOperations('acme');
    return service.routine('acme', execution.routineId);
  };
  return { root, server, service, save, finish, launched, started, change: () => { rev++; } };
}

test('the next daily run is 08:00 in that time zone, including summer time', () => {
  assert.equal(nextRun(daily('America/New_York'), new Date('2026-01-15T13:00:00.000Z'))?.toISOString(), '2026-01-16T13:00:00.000Z');
  assert.equal(nextRun(daily('America/New_York'), new Date('2026-07-15T12:00:00.000Z'))?.toISOString(), '2026-07-16T12:00:00.000Z');
});
test('a missed slot runs once; skip and next still run an on-time slot', () => {
  assert.deepEqual(dueAction(daily('UTC'), '2026-03-01T08:00:00.000Z', new Date('2026-03-10T09:00:00.000Z')), { run: true, following: '2026-03-11T08:00:00.000Z' });
  for (const missed of ['skip', 'next'] as const) {
    const schedule = { ...daily('UTC'), missed };
    assert.equal(dueAction(schedule, '2026-03-01T08:00:00.000Z', new Date('2026-03-10T09:00:00.000Z')).run, false);
    assert.equal(dueAction(schedule, '2026-03-10T08:00:00.000Z', new Date('2026-03-10T08:00:00.000Z')).run, true);
    assert.equal(dueAction(schedule, '2026-03-10T08:00:00.000Z', new Date('2026-03-10T08:00:25.000Z'), new Date('2026-03-10T07:59:55.000Z')).run, true);
  }
});
test('weekly days, month-end and intervals use their configured values', () => {
  assert.equal(nextRun({ ...daily('UTC'), kind: 'weekly', daysOfWeek: [5] }, new Date('2026-11-11T10:00:00Z'))?.toISOString(), '2026-11-13T08:00:00.000Z');
  assert.equal(nextRun({ ...daily('UTC'), kind: 'monthly', dayOfMonth: 31 }, new Date('2026-02-01T10:00:00Z'))?.toISOString(), '2026-02-28T08:00:00.000Z');
  assert.equal(nextRun({ ...daily('UTC'), kind: 'interval', intervalMinutes: 17 }, new Date('2026-11-11T10:00:00Z'))?.toISOString(), '2026-11-11T10:17:00.000Z');
});
test('the first snapshot is a baseline, identical content is unchanged', () => {
  const snapshot = { resourceId: '123', version: '4', updatedAt: '', hash: textHash('synthetic') };
  assert.equal(classify(undefined, snapshot), 'baseline');
  const checkpoint = { ...snapshot, sourceId: 'fake/read', lastSuccessfulSync: '' };
  assert.equal(classify(checkpoint, snapshot), 'unchanged');
  assert.equal(classify(checkpoint, { ...snapshot, version: '5' }), 'changed');
});
test('a changed item starts its AI in the background and becomes reviewable only after the delivered analysis', async (t) => {
  const f = fixture(t), routine = f.save();
  assert.equal((await f.service.runRoutine('acme', routine.id)).status, 'completed');
  assert.equal(f.service.notifications().length, 0);
  f.change();
  const execution = await f.service.runRoutine('acme', routine.id);
  assert.equal(execution.status, 'waiting');
  assert.equal(execution.finishedAt, '');
  assert.equal(f.launched.length, 1);
  assert.deepEqual(f.started, ['fake-1']);
  let detail = f.service.routine('acme', routine.id);
  assert.equal(detail.proposals[0].status, 'preparing');
  assert.equal(f.service.notifications().length, 0, 'no approval notification before an analysis exists');
  assert.throws(() => f.service.decideProposal('acme', routine.id, detail.proposals[0].id, 'approved'), /no longer waiting/);
  detail = f.finish(execution);
  assert.equal(detail.proposals[0].status, 'pending');
  assert.equal(detail.proposals[0].findings?.[0].kind, 'analysis');
  assert.equal(detail.executions.find((e) => e.id === execution.id)?.status, 'completed');
  assert.equal(f.service.notifications().length, 1);
  const again = await f.service.runRoutine('acme', routine.id);
  assert.match(again.resultSummary, /No change/);
  assert.equal(f.service.routine('acme', routine.id).proposals.length, 1);
  assert.equal(f.service.decideProposal('acme', routine.id, detail.proposals[0].id, 'approved').status, 'approved');
});
test('internal and system notification preferences are independent', async (t) => {
  const f = fixture(t), routine = f.save({ executionPolicy: 'monitor', notifyInternal: false, notifySystem: true });
  await f.service.runRoutine('acme', routine.id); f.change(); await f.service.runRoutine('acme', routine.id);
  assert.equal(f.service.notifications().length, 0);
  assert.equal(f.service.systemNotifications().length, 1);
  assert.equal(f.service.readNotifications('all').length, 0);
  assert.equal(f.service.systemNotifications()[0].readAt, '', 'marking the bell as read does not dismiss hidden system notifications');
  f.service.saveRoutine('acme', { ...routine, notifyInternal: true, notifySystem: false });
  f.change(); await f.service.runRoutine('acme', routine.id);
  assert.equal(f.service.notifications().length, 1);
  assert.equal(f.service.systemNotifications().length, 1);
});
test('a workspace switch interrupts the check without writing into the other workspace', async (t) => {
  let release: (value: unknown) => void = () => {};
  const f = fixture(t, { callTool: () => new Promise((resolve) => { release = resolve; }) });
  const routine = f.save({ executionPolicy: 'monitor' });
  const original = workspaceDir(f.root);
  const pending = f.service.runRoutine('acme', routine.id);
  setWorkspaceDir(f.root, join(f.root, 'alternate'));
  createProject('acme', 'Another synthetic project', f.root);
  release({ id: 123, rev: 1 });
  const execution = await pending;
  assert.equal(execution.status, 'interrupted');
  assert.equal(existsSync(join(projectsDir(f.root), 'acme', 'routines')), false);
  setWorkspaceDir(f.root, original);
  assert.equal(listExecutions(f.root, 'acme', routine.id)[0].status, 'interrupted');
  assert.equal(readLock(f.root, routine), null);
});
test('an edit made during a scheduled read is preserved', async (t) => {
  let release: (value: unknown) => void = () => {};
  const f = fixture(t, { callTool: () => new Promise((resolve) => { release = resolve; }) }), routine = f.save({ executionPolicy: 'monitor' });
  const pending = f.service.runRoutine('acme', routine.id);
  f.service.saveRoutine('acme', { ...routine, name: 'Edited while reading', enabled: false });
  release({ id: 123, rev: 1 }); await pending;
  const saved = f.service.routine('acme', routine.id).routine;
  assert.equal(saved.name, 'Edited while reading'); assert.equal(saved.enabled, false);
});
test('an AI limit of zero is retained and prevents AI launch without losing the change', async (t) => {
  const f = fixture(t), routine = f.save();
  assert.equal(f.service.saveRoutineSettings({ maxAiCalls: 0 }).maxAiCalls, 0);
  assert.equal(f.service.routineSettings().maxAiCalls, 0);
  await f.service.runRoutine('acme', routine.id); f.change();
  assert.equal((await f.service.runRoutine('acme', routine.id)).status, 'failed');
  assert.equal(f.launched.length, 0);
  f.service.saveRoutineSettings({ maxAiCalls: 1 });
  assert.equal((await f.service.runRoutine('acme', routine.id)).status, 'waiting');
  assert.equal(f.launched.length, 1);
});
test('a conflict in the second file leaves both files untouched', async (t) => {
  const f = fixture(t), routine = f.save();
  await f.service.runRoutine('acme', routine.id); f.change();
  const run = await f.service.runRoutine('acme', routine.id);
  const proposal = f.finish(run).proposals[0];
  const base = join(projectsDir(f.root), 'acme', 'inbox');
  writeFileSync(join(base, 'first.md'), 'old'); writeFileSync(join(base, 'second.md'), 'changed outside');
  proposal.proposedChanges = ['first.md', 'second.md'].map((name) => ({ path: `inbox/${name}`, baseHash: textHash('old'), nextText: 'new', note: '' }));
  saveProposal(f.root, proposal);
  assert.equal(f.service.decideProposal('acme', routine.id, proposal.id, 'approved').status, 'obsolete');
  assert.equal(readFileSync(join(base, 'first.md'), 'utf8'), 'old');
  assert.equal(readFileSync(join(base, 'second.md'), 'utf8'), 'changed outside');
});
test('the exact reviewed changes can apply, including empty text; the journal is not another proposal', async (t) => {
  const f = fixture(t), routine = f.save();
  await f.service.runRoutine('acme', routine.id); f.change();
  const run = await f.service.runRoutine('acme', routine.id);
  const file = join(projectsDir(f.root), 'acme', 'inbox', 'approved.md');
  writeFileSync(file, 'old');
  const detail = f.finish(run, { summary: 'Clear this synthetic text.', findings: [], proposedChanges: [{ path: 'inbox/approved.md', baseHash: textHash('old'), nextText: '', note: 'Explicit empty content.' }] });
  const proposal = detail.proposals[0];
  assert.equal(f.service.decideProposal('acme', routine.id, proposal.id, 'approved').status, 'applied');
  assert.equal(readFileSync(file, 'utf8'), '');
  assert.equal(f.service.routine('acme', routine.id).proposals.length, 1);
});
test('invalid proposal ids and executable target files are refused', async (t) => {
  const f = fixture(t), routine = f.save();
  assert.throws(() => f.service.decideProposal('acme', routine.id, '../../project', 'approved'), /Unknown proposal/);
  await f.service.runRoutine('acme', routine.id); f.change();
  const run = await f.service.runRoutine('acme', routine.id);
  const file = join(projectsDir(f.root), 'acme', 'inbox', 'script.js'); writeFileSync(file, 'original');
  const detail = f.finish(run, { summary: 'Invalid file target.', findings: [], proposedChanges: [{ path: 'inbox/script.js', baseHash: textHash('original'), nextText: 'changed', note: '' }] });
  assert.equal(detail.executions.find((e) => e.id === run.id)?.status, 'failed');
  assert.equal(detail.proposals[0].status, 'analysis-failed');
  assert.equal(readFileSync(file, 'utf8'), 'original');
});
test('a failed analysis cannot become an approvable proposal', async (t) => {
  const f = fixture(t), routine = f.save();
  await f.service.runRoutine('acme', routine.id); f.change();
  const run = await f.service.runRoutine('acme', routine.id);
  const detail = f.finish(run, { summary: '', findings: [] });
  assert.equal(detail.proposals[0].status, 'analysis-failed');
  assert.throws(() => f.service.decideProposal('acme', routine.id, detail.proposals[0].id, 'approved'), /no longer waiting/);
});
test('archiving keeps history available while removing the routine from the active list', async (t) => {
  const f = fixture(t), routine = f.save({ executionPolicy: 'monitor' });
  await f.service.runRoutine('acme', routine.id); f.service.archiveRoutine('acme', routine.id);
  assert.equal(f.service.listRoutines().length, 0);
  assert.equal(f.service.routineActivity().executions.length, 1);
});


test('an interrupted file application recovers its journal without repeating writes', async (t) => {
  const f = fixture(t), routine = f.save();
  await f.service.runRoutine('acme', routine.id); f.change();
  const run = await f.service.runRoutine('acme', routine.id), proposal = f.finish(run).proposals[0];
  const base = join(projectsDir(f.root), 'acme');
  const file = join(base, 'inbox', 'interrupted.md'); writeFileSync(file, 'partially applied');
  const folder = join(base, 'routines', routine.id, 'applications'); mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, proposal.id + '.json'), JSON.stringify({ status: 'applying', changes: [{ path: 'inbox/interrupted.md', before: 'original', nextText: 'partially applied' }] }));
  proposal.status = 'applying'; saveProposal(f.root, proposal);
  assert.equal(f.service.routine('acme', routine.id).proposals[0].status, 'apply-failed');
  assert.equal(readFileSync(file, 'utf8'), 'original');
  f.service.routine('acme', routine.id);
  assert.equal(readFileSync(file, 'utf8'), 'original');
});
test('an MCP tool error is a failed read and never becomes a baseline', async (t) => {
  const f = fixture(t, { callTool: async () => ({ isError: true, content: [{ type: 'text', text: 'Synthetic failure' }] }) });
  const routine = f.save({ executionPolicy: 'monitor' });
  const run = await f.service.runRoutine('acme', routine.id);
  assert.equal(run.status, 'failed');
  assert.match(run.error, /MCP tool returned an error/);
  assert.equal(existsSync(join(projectsDir(f.root), 'acme', 'routines', routine.id, 'checkpoints.json')), false);
});
test('a query follows every record it returns: new, changed and gone, with the project name in its arguments', async (t) => {
  let rows = [{ id: 'A', rev: 1 }, { id: 'B', rev: 1 }];
  const calls: Record<string, unknown>[] = [];
  const f = fixture(t, { callTool: async (_server, _tool, args) => { calls.push(args); return { value: rows }; } });
  const routine = f.save({ executionPolicy: 'monitor', resources: [{ kind: 'query', serverId: f.server.id, tool: 'fake_query', arguments: { query: "State = 'Active'", project: '{{project.name}}' } }] });
  assert.equal(routine.resources[0].kind, 'query');
  const first = await f.service.runRoutine('acme', routine.id);
  assert.equal(first.status, 'completed');
  assert.match(first.resultSummary, /Baseline/);
  assert.deepEqual(calls[0], { query: "State = 'Active'", project: 'Acme' });
  rows = [{ id: 'A', rev: 2 }, { id: 'C', rev: 1 }];
  const second = await f.service.runRoutine('acme', routine.id);
  assert.match(second.resultSummary, /A changed/);
  assert.match(second.resultSummary, /C is new/);
  assert.match(second.resultSummary, /B is no longer/);
  const third = await f.service.runRoutine('acme', routine.id);
  assert.equal(third.resultSummary, 'No change since the last successful check.');
});
test('a folder source reports new, edited and deleted files and refuses paths outside the project', async (t) => {
  const f = fixture(t);
  const kb = join(projectsDir(f.root), 'acme', 'context', 'kb');
  mkdirSync(kb, { recursive: true });
  writeFileSync(join(kb, 'rules.md'), '# Rules\n');
  writeFileSync(join(kb, 'old.md'), '# Old\n');
  const routine = f.save({ executionPolicy: 'monitor', resources: [{ kind: 'folder', path: 'context/kb' }] });
  assert.match((await f.service.runRoutine('acme', routine.id)).resultSummary, /Baseline/);
  writeFileSync(join(kb, 'rules.md'), '# Rules\n\nNew rule.\n');
  writeFileSync(join(kb, 'new.md'), '# New\n');
  rmSync(join(kb, 'old.md'));
  const summary = (await f.service.runRoutine('acme', routine.id)).resultSummary;
  assert.match(summary, /context\/kb\/rules\.md changed/);
  assert.match(summary, /context\/kb\/new\.md is new/);
  assert.match(summary, /context\/kb\/old\.md is no longer/);
  assert.throws(() => f.save({ resources: [{ kind: 'folder', path: '../other' }] }));
  assert.throws(() => f.save({ resources: [{ kind: 'files', paths: ['runs/x/state.json'] }] }));
});
test('a files source follows only the files it names', async (t) => {
  const f = fixture(t);
  const ctx = join(projectsDir(f.root), 'acme', 'context');
  writeFileSync(join(ctx, 'x.md'), 'x');
  writeFileSync(join(ctx, 'y.md'), 'y');
  writeFileSync(join(ctx, 'z.md'), 'z');
  const routine = f.save({ executionPolicy: 'monitor', resources: [{ kind: 'files', paths: ['context/x.md', 'context/y.md'] }] });
  await f.service.runRoutine('acme', routine.id);
  writeFileSync(join(ctx, 'z.md'), 'z2');
  assert.equal((await f.service.runRoutine('acme', routine.id)).resultSummary, 'No change since the last successful check.');
  writeFileSync(join(ctx, 'y.md'), 'y2');
  assert.match((await f.service.runRoutine('acme', routine.id)).resultSummary, /context\/y\.md changed/);
});
