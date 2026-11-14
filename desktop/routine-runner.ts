// Turns a routine into the operation it runs, and runs one pass: read, compare, propose, notify.
// The service supplies the MCP call and the operation start, so this file does not import Electron.

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { isEditable, resolveInside } from './fs-guard.ts';
import { readRun } from '../scripts/lib/operation-runs.ts';
import { isUsableAgent, listAgents } from '../scripts/lib/agents.ts';
import { listProjects, projectsDir } from '../scripts/lib/core.ts';
import { enabledServers, type McpServer } from '../scripts/lib/mcp.ts';
import { checkOperation, formatMessage, listOperations, removeOperation, writeOperation, type Operation, type OperationAgent } from '../scripts/lib/operations.ts';
import {
  appendEvent, appendNote, assertRoutineWorkspace, bodyHash, boundedNumber, classify, cleanRoutine, defaultSettings, dueAction, listExecutions, listNotes, listProposals,
  dismissNotes, listRoutineFiles, markNotes, newId, pidAlive, readCheckpoints, readLock, readProposal, readRoutine, readSettings, removeRoutineFiles, RoutineError,
  routineDir, routineProjectDir, routineWorkspace, RoutineInterrupted, sameProposal, saveChange, saveExecution, saveProposal, saveRoutineFile, textHash, trimExecutions, withRoutineWorkspace, writeCheckpoints, writeLock, writeSettings,
  type ChangeKind, type Execution, type Proposal, type Routine, type RoutineNote, type RoutineSettings, type Snapshot,
} from '../scripts/lib/routines.ts';
import { readSource, sourcePath, type SourceResult } from './routine-sources.ts';

export interface RunHooks {
  callTool: (server: McpServer, tool: string, args: Record<string, unknown>) => Promise<unknown>;
  startOperation?: (project: string, operationId: string, request: OperationRequest) => { id: string };
  agents: OperationAgent[];
  now?: () => Date;
  driveOperation?: (project: string, runId: string) => void;
}

export interface OperationRequest {
  tools: Record<string, string>;
  answers: { step: string; input: string; text: string; files: string[] }[];
  context: string;
}

const nowIso = (hooks?: RunHooks) => (hooks?.now?.() ?? new Date()).toISOString();

export function buildOperation(routine: Routine, taken: { id: string; name: string }[]): Operation {
  const keys = routine.agents.length ? routine.agents : ['library:routine-analyst'];
  const steps = keys.map((agent, i) => ({ id: `s${i + 1}`, agent, x: 48 + i * 220, y: 72 }));
  const gate = routine.executionPolicy === 'authorized' ? 'approval' : 'auto';
  const links = steps.slice(1).map((step, i) => ({ from: steps[i].id, to: step.id, gate, map: {} as Record<string, string>, when: '' }));
  let name = routine.name;
  if (taken.some((o) => o.id !== routine.operationId && o.name.toLowerCase() === name.toLowerCase())) {
    const suffix = ` (${routine.projectId})`;
    name = `${name.slice(0, Math.max(0, 80 - suffix.length))}${suffix}`;
  }
  return {
    schemaVersion: 1, id: routine.operationId, name, description: routine.description,
    start: steps[0]?.id ?? '', maxRounds: 1,
    lanes: [{ id: 'l1', name: 'Routine', color: '#c4a574', width: 320 }],
    steps, links,
  };
}

function knownAgents(agents: OperationAgent[]): Set<string> {
  return new Set(agents.map((a) => a.key));
}

function assertAgents(routine: Routine, agents: OperationAgent[]): void {
  const known = knownAgents(agents);
  const keys = routine.agents.length ? routine.agents : ['library:routine-analyst'];
  const missing = keys.filter((k) => !known.has(k));
  if (missing.length) throw new RoutineError(`These agents are not available: ${missing.join(', ')}.`);
}

function projectFile(root: string, project: string): string {
  return join(projectsDir(root), project, 'project.json');
}

function linkedIds(root: string, project: string): string[] {
  try {
    const data = JSON.parse(readFileSync(projectFile(root, project), 'utf8')) as { operations?: unknown };
    return Array.isArray(data.operations) ? data.operations.map(String) : [];
  } catch { return []; }
}

function setLinked(root: string, project: string, ids: string[]): void {
  const file = projectFile(root, project);
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...data, operations: ids }, null, 2)}\n`, 'utf8');
}

function rememberOperation(root: string, project: string, id: string): void {
  const ids = linkedIds(root, project);
  if (!ids.includes(id)) setLinked(root, project, [...ids, id]);
}

function forgetOperation(root: string, project: string, id: string): void {
  setLinked(root, project, linkedIds(root, project).filter((x) => x !== id));
}

// The project's id and name, for the {{project.id}} / {{project.name}} placeholders of a query.
function projectInfo(root: string, project: string): { id: string; name: string } {
  try {
    const data = JSON.parse(readFileSync(projectFile(root, project), 'utf8')) as { name?: unknown };
    return { id: project, name: typeof data.name === 'string' && data.name ? data.name : project };
  } catch { return { id: project, name: project }; }
}

export function saveRoutine(root: string, project: string, raw: unknown, agents: OperationAgent[], zone = 'UTC'): { routine: Routine; rebuilt: boolean } {
  const currentId = typeof (raw as { id?: unknown })?.id === 'string' ? (raw as { id: string }).id : '';
  const previous = currentId ? listRoutineFiles(root, project).find((r) => r.id === currentId) : undefined;
  const routine = cleanRoutine({ timezone: zone, ...(raw as object), ...(previous ? { id: previous.id, createdAt: previous.createdAt, operationBody: previous.operationBody } : {}) }, project, nowIso());
  for (const resource of routine.resources) {
    if (resource.kind === 'query') {
      const server = enabledServers(project, root).find((s) => s.id === resource.serverId);
      if (!server || server.access !== 'read') throw new RoutineError('Choose a read-only MCP server enabled for this project.');
      if (!/^[\w.-]{1,80}$/.test(resource.tool)) throw new RoutineError('Invalid tool name.');
    } else {
      for (const path of resource.kind === 'files' ? resource.paths : [resource.path]) sourcePath(path);
    }
  }
  if (previous) routine.nextRunAt = previous.schedule.kind === routine.schedule.kind && JSON.stringify(previous.schedule) === JSON.stringify(routine.schedule)
    ? previous.nextRunAt : routine.nextRunAt;
  assertAgents(routine, agents);
  const taken = listOperations(root).map((o) => ({ id: o.id, name: o.name }));
  const fingerprint = bodyHash(routine.agents, routine.executionPolicy);
  const existing = listOperations(root).find((o) => o.id === routine.operationId);
  let rebuilt = false;
  if (existing && previous?.operationBody === fingerprint) {
    writeOperation({ ...existing, name: buildOperation(routine, taken).name, description: routine.description }, root);
  } else {
    const op = buildOperation(routine, taken);
    const check = checkOperation(op, agents);
    if (check.errors.length) throw new RoutineError(check.errors.map(formatMessage).join(' '));
    writeOperation(op, root);
    routine.operationBody = fingerprint;
    rebuilt = true;
  }
  saveRoutineFile(root, routine);
  rememberOperation(root, project, routine.operationId);
  return { routine, rebuilt };
}

export function archiveRoutine(root: string, project: string, routineId: string): Routine {
  const routine = readRoutine(root, project, routineId);
  routine.archived = true;
  routine.enabled = false;
  routine.updatedAt = nowIso();
  saveRoutineFile(root, routine);
  forgetOperation(root, project, routine.operationId);
  return routine;
}

export function deleteRoutine(root: string, project: string, routineId: string): void {
  const routine = readRoutine(root, project, routineId);
  forgetOperation(root, project, routine.operationId);
  if (listOperations(root).some((o) => o.id === routine.operationId)) removeOperation(routine.operationId, root);
  removeRoutineFiles(root, project, routineId);
}

export function duplicateRoutine(root: string, project: string, routineId: string, agents: OperationAgent[]): Routine {
  const source = readRoutine(root, project, routineId);
  const copy = cleanRoutine({ ...source, id: '', name: `${source.name} copy`.slice(0, 80), operationBody: '' }, project, nowIso());
  return saveRoutine(root, project, copy, agents).routine;
}

export function setEnabled(root: string, project: string, routineId: string, enabled: boolean): Routine {
  const routine = readRoutine(root, project, routineId);
  routine.enabled = enabled;
  routine.updatedAt = nowIso();
  if (enabled && !routine.nextRunAt) {
    const again = cleanRoutine(routine, project, nowIso());
    routine.nextRunAt = again.nextRunAt;
  }
  saveRoutineFile(root, routine);
  return routine;
}

function note(root: string, routine: Routine, category: RoutineNote['category'], title: string, message: string, executionId: string, proposalId = ''): void {
  if (!routine.notifyInternal && !routine.notifySystem) return;
  if (category === 'info' && routine.conditions.notifyWhenRelevant) return;
  appendNote(root, {
    id: newId('n'), category, severity: category, title, message, projectId: routine.projectId, routineId: routine.id,
    executionId, proposalId, readAt: '', createdAt: nowIso(),
    internal: routine.notifyInternal, system: routine.notifySystem,
    navigationTarget: { tab: 'routines', projectId: routine.projectId, routineId: routine.id, proposalId },
  });
}

function held(root: string, routine: Routine): boolean {
  const lock = readLock(root, routine);
  if (!lock || !pidAlive(lock.pid)) return false;
  const exec = listExecutions(root, routine.projectId, routine.id).find((e) => e.id === lock.executionId);
  return exec?.status === 'running' || exec?.status === 'waiting';
}

// Routines of the project with an execution in progress (a project cannot be suspended under them).
export function runningRoutines(root: string, project: string): number {
  return listRoutineFiles(root, project).filter((routine) => held(root, routine)).length;
}

export async function runRoutine(root: string, project: string, routineId: string, trigger: Execution['triggerType'], hooks: RunHooks): Promise<Execution> {
  return withRoutineWorkspace(root, () => runScoped(root, project, routineId, trigger, hooks));
}

function assertCurrent(root: string, routine: Routine, execution: Execution): void {
  assertRoutineWorkspace(root);
  if (readLock(root, routine)?.executionId !== execution.id) throw new RoutineInterrupted('A newer check replaced this execution.');
}

async function runScoped(root: string, project: string, routineId: string, trigger: Execution['triggerType'], hooks: RunHooks): Promise<Execution> {
  assertRoutineWorkspace(root);
  syncExecutions(root, project, routineId, hooks);
  const routine = readRoutine(root, project, routineId);
  if (routine.archived) throw new RoutineError('This routine is archived.');
  const at = nowIso(hooks);
  if (held(root, routine)) {
    if (routine.conditions.overlap !== 'cancel-previous') {
      const skipped: Execution = {
        id: newId('e'), routineId, projectId: project, status: 'cancelled', scheduledAt: routine.nextRunAt, startedAt: at, finishedAt: at,
        triggerType: trigger, resultSummary: 'Skipped because the previous run is still active.', error: '', operationRunId: '', warnings: [],
      };
      saveExecution(root, project, routineId, skipped);
      return skipped;
    }
    const current = listExecutions(root, project, routineId).find((e) => e.status === 'running');
    if (current) {
      current.status = 'interrupted';
      current.finishedAt = at;
      current.resultSummary = 'Interrupted because a new run was allowed to replace it.';
      saveExecution(root, project, routineId, current);
    }
  }
  const execution: Execution = {
    id: newId('e'), routineId, projectId: project, status: 'running', scheduledAt: routine.nextRunAt, startedAt: at, finishedAt: '',
    triggerType: trigger, resultSummary: '', error: '', operationRunId: '', warnings: [],
  };
  saveExecution(root, project, routineId, execution);
  writeLock(root, routine, { pid: process.pid, executionId: execution.id, at });
  appendEvent(root, routine, execution.id, 'routine.started', trigger);
  try {
    const outcome = await pass(root, routine, execution, hooks);
    assertCurrent(root, routine, execution);
    execution.status = outcome.operationRunId ? 'waiting' : outcome.warnings.length ? 'completed-with-warnings' : 'completed';
    execution.resultSummary = outcome.summary;
    execution.warnings = outcome.warnings;
    execution.operationRunId = outcome.operationRunId;
  } catch (e) {
    execution.status = e instanceof RoutineInterrupted ? 'interrupted' : 'failed';
    execution.error = e instanceof Error ? e.message : String(e);
    execution.resultSummary = execution.error;
    if (!(e instanceof RoutineInterrupted)) note(root, routine, 'alert', routine.name, execution.error, execution.id);
    appendEvent(root, routine, execution.id, 'routine.failed', execution.error);
  } finally {
    execution.finishedAt = execution.status === 'waiting' ? '' : nowIso(hooks);
    saveExecution(root, project, routineId, execution);
    if (execution.status !== 'waiting' && readLock(root, routine)?.executionId === execution.id) writeLock(root, routine, null);
    trimExecutions(root, routine, readSettings(root).retention);
    // The scheduler advances its slot before dispatch. Never overwrite edits
    // saved while this asynchronous check was reading an external resource.
  }
  return execution;
}

async function pass(root: string, routine: Routine, execution: Execution, hooks: RunHooks): Promise<{ summary: string; warnings: string[]; operationRunId: string }> {
  const warnings: string[] = [];
  const checkpoints = readCheckpoints(root, routine);
  const proposals = listProposals(root, routine.projectId, routine.id);
  const changes: string[] = [];
  let relevant = false;
  let baselines = 0;
  if (!routine.resources.length) warnings.push('No source is selected, so nothing was read.');
  const project = projectInfo(root, routine.projectId);
  for (const resource of routine.resources) {
    let result: SourceResult;
    try {
      result = await readSource(root, project, resource, hooks.callTool, () => assertCurrent(root, routine, execution));
    } catch (e) {
      if (e instanceof RoutineInterrupted) throw e;
      const message = e instanceof Error ? e.message : String(e);
      if (routine.conditions.stopWhenResourceMissing) throw new RoutineError(message);
      warnings.push(message);
      continue;
    }
    assertCurrent(root, routine, execution);
    const { sourceId, snapshots: snaps } = result;
    // A source seen before reports what joined or left it; its first reading is only the baseline.
    const known = checkpoints.some((c) => c.sourceId === sourceId);
    const record = (kind: ChangeKind, resourceId: string, previousVersion: string, currentVersion: string, summary: string, snap: Snapshot) => {
      const change = { id: newId('c'), executionId: execution.id, sourceId, resourceId, previousVersion, currentVersion, changeType: kind, summary, detectedAt: execution.startedAt };
      saveChange(root, routine, change);
      appendEvent(root, routine, execution.id, 'change.detected', change.summary);
      if (kind === 'baseline') { baselines += 1; return; }
      relevant = true;
      changes.push(change.summary);
      if (routine.executionPolicy !== 'monitor' && routine.conditions.proposeWhenImpact) {
        const pending = proposals.find((p) => p.status === 'preparing' && p.sourceSnapshot.hash === snap.hash && p.sourceSnapshot.resourceId === snap.resourceId);
        if (pending) { pending.executionId = execution.id; saveProposal(root, pending); }
        else if (!sameProposal(proposals, snap)) {
          const proposal = makeProposal(routine, execution, change.id, change.summary, snap);
          saveProposal(root, proposal);
          proposals.push(proposal);
          appendEvent(root, routine, execution.id, 'proposal.created', proposal.id);
        }
      } else {
        note(root, routine, 'change', routine.name, change.summary, execution.id);
      }
    };
    for (const snap of snaps) {
      const previous = checkpoints.find((c) => c.sourceId === sourceId && c.resourceId === snap.resourceId);
      let kind = classify(previous, snap);
      if (kind === 'baseline' && known) kind = 'added';
      const row = { sourceId, resourceId: snap.resourceId, version: snap.version, updatedAt: snap.updatedAt, hash: snap.hash, lastSuccessfulSync: execution.startedAt };
      const at = checkpoints.findIndex((c) => c.sourceId === sourceId && c.resourceId === snap.resourceId);
      if (at >= 0) checkpoints[at] = row; else checkpoints.push(row);
      if (kind === 'unchanged') continue;
      const summary = kind === 'baseline' ? `Baseline for ${snap.resourceId}.`
        : kind === 'added' ? `${snap.resourceId} is new in this source.`
        : `${snap.resourceId} changed${snap.version ? ` to version ${snap.version}` : ''}.`;
      record(kind, snap.resourceId, previous?.version ?? '', snap.version, summary, snap);
    }
    const present = new Set(snaps.map((x) => x.resourceId));
    for (const gone of checkpoints.filter((c) => c.sourceId === sourceId && !present.has(c.resourceId))) {
      checkpoints.splice(checkpoints.indexOf(gone), 1);
      const snap = { resourceId: gone.resourceId, version: gone.version, updatedAt: gone.updatedAt, hash: `removed:${gone.hash}` };
      record('removed', gone.resourceId, gone.version, '', `${gone.resourceId} is no longer in this source.`, snap);
    }
  }
  assertCurrent(root, routine, execution);
  let operationRunId = '';
  const shouldThink = routine.executionPolicy !== 'monitor' && (relevant || !routine.conditions.runWhenChanges);
  if (shouldThink && routine.executionPolicy !== 'monitor') {
    const active = projectIds(root).flatMap((id) => listRoutineFiles(root, id).flatMap((r) => listExecutions(root, id, r.id)))
      .filter((e) => e.operationRunId && ['running', 'waiting'].includes(e.status)).length;
    if (active >= readSettings(root).maxAiCalls) throw new RoutineError('The AI operation limit was reached. Try again when another analysis finishes.');
    operationRunId = startLinked(root, routine, execution, changes, hooks, warnings);
    if (!operationRunId) throw new RoutineError(warnings.join(' ') || 'The analysis could not start.');
  }
  writeCheckpoints(root, routine, checkpoints);
  const summary = !routine.resources.length ? 'Nothing to read.'
    : relevant ? changes.join(' ') || 'Changes recorded.'
    : baselines ? 'Baseline recorded. Nothing to approve yet.'
    : 'No change since the last successful check.';
  if (!relevant) appendEvent(root, routine, execution.id, 'routine.completed', summary);
  else appendEvent(root, routine, execution.id, 'routine.completed', summary);
  return { summary, warnings, operationRunId };
}

function makeProposal(routine: Routine, execution: Execution, changeId: string, summary: string, snap: Snapshot): Proposal {
  return {
    id: newId('p'), projectId: routine.projectId, routineId: routine.id, executionId: execution.id, detectedChangeIds: [changeId],
    status: 'preparing', summary, justification: routine.instructions || 'The watched item changed since the last check.',
    proposedChanges: [], sourceSnapshot: snap, decision: null, createdAt: execution.startedAt, updatedAt: execution.startedAt,
  };
}

function startLinked(root: string, routine: Routine, execution: Execution, changes: string[], hooks: RunHooks, warnings: string[]): string {
  if (!hooks.startOperation) {
    warnings.push('The operation was not started.');
    return '';
  }
  if (!routine.tool) {
    warnings.push('Choose an AI tool for this routine before the operation can start.');
    return '';
  }
  const op = listOperations(root).find((o) => o.id === routine.operationId);
  if (!op) {
    warnings.push('The routine has no operation to start.');
    return '';
  }
  const tools: Record<string, string> = {};
  for (const step of op.steps) tools[step.id] = routine.tool;
  const text = [routine.instructions, ...changes].filter(Boolean).join('\n');
  try {
    const run = hooks.startOperation(routine.projectId, op.id, {
      tools,
      answers: [
        { step: op.start || op.steps[0]?.id || 's1', input: 'Routine objective', text: routine.instructions || routine.name, files: [] },
        { step: op.start || op.steps[0]?.id || 's1', input: 'Detected changes', text, files: [] },
      ],
      context: text,
    });
    appendEvent(root, routine, execution.id, 'operation.started', run.id);
    hooks.driveOperation?.(routine.projectId, run.id);
    return run.id;
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : String(e));
    return '';
  }
}

export function decideProposal(root: string, project: string, routineId: string, proposalId: string, result: 'approved' | 'rejected' | 'deferred'): Proposal {
  const proposal = readProposal(root, project, routineId, proposalId);
  if (proposal.status !== 'pending' && proposal.status !== 'deferred') throw new RoutineError('This proposal is no longer waiting.');
  const at = nowIso();
  if (result === 'deferred') {
    proposal.status = 'deferred';
  } else if (result === 'rejected') {
    proposal.status = 'rejected';
  } else {
    proposal.status = proposal.proposedChanges.some((c) => c.path) ? 'applying' : 'approved';
  }
  proposal.decision = { at, result, by: 'user' };
  proposal.updatedAt = at;
  // Persist the decision before the first file write, so a restart can recover it.
  saveProposal(root, proposal);
  if (proposal.status === 'applying') {
    try {
      applyFiles(root, project, proposal);
      proposal.status = 'applied';
    } catch (e) {
      proposal.status = e instanceof RoutineError && /changed/.test(e.message) ? 'obsolete' : 'apply-failed';
      proposal.summary = `${proposal.summary} ${e instanceof Error ? e.message : ''}`.trim();
    }
  }
  saveProposal(root, proposal);
  return proposal;
}

function applyFiles(root: string, project: string, proposal: Proposal): void {
  const base = routineProjectDir(root, project);
  const seen = new Set<string>();
  const planned = proposal.proposedChanges.filter((c) => c.path).map((change) => {
    const file = proposalTarget(base, change.path);
    if (seen.has(file)) throw new RoutineError('A proposal cannot update the same file twice.');
    seen.add(file);
    const current = readFileSync(file, 'utf8');
    if (textHash(current) !== change.baseHash) throw new RoutineError('A file changed since this proposal was prepared.');
    return { path: change.path, before: current, nextText: change.nextText };
  });
  const latest = readCheckpoints(root, readRoutine(root, project, proposal.routineId)).filter((c) => c.resourceId === proposal.sourceSnapshot.resourceId);
  if (latest.length && !latest.some((c) => c.hash === proposal.sourceSnapshot.hash && c.version === proposal.sourceSnapshot.version)) throw new RoutineError('The source changed since this proposal was prepared.');
  const journalFolder = join(routineDir(root, project, proposal.routineId), 'applications');
  mkdirSync(journalFolder, { recursive: true });
  const journal = join(journalFolder, `${proposal.id}.json`);
  replaceText(journal, JSON.stringify({ status: 'applying', changes: planned }));
  const applied: typeof planned = [];
  try {
    for (const change of planned) {
      const file = resolveInside(base, change.path);
      if (textHash(readFileSync(file, 'utf8')) !== textHash(change.before)) throw new RoutineError('A file changed since this proposal was prepared.');
      replaceText(file, change.nextText);
      applied.push(change);
    }
    replaceText(journal, JSON.stringify({ status: 'applied', changes: planned }));
  } catch (error) {
    for (const change of applied.reverse()) {
      const file = resolveInside(base, change.path);
      if (textHash(readFileSync(file, 'utf8')) === textHash(change.nextText)) replaceText(file, change.before);
    }
    replaceText(journal, JSON.stringify({ status: 'rolled-back', changes: planned }));
    throw error;
  }
}

function proposalTarget(base: string, path: string): string {
  const file = resolveInside(base, path);
  const canonical = relative(base, file).split(sep).join('/');
  if (!isEditable(file) || !existsSync(file) || canonical.startsWith('.') || /^(runs|routines)\//.test(canonical)) throw new RoutineError('Proposals may update existing project Markdown or text files only.');
  return file;
}

function recoverApplications(root: string, routine: Routine): void {
  const base = routineProjectDir(root, routine.projectId);
  for (const proposal of listProposals(root, routine.projectId, routine.id).filter((p) => p.status === 'applying')) {
    try {
      const journal = resolveInside(base, `routines/${routine.id}/applications/${proposal.id}.json`);
      const data = JSON.parse(readFileSync(journal, 'utf8')) as { status?: unknown; changes?: unknown };
      if (data.status === 'applied') proposal.status = 'applied';
      else {
        if (!Array.isArray(data.changes)) throw new RoutineError('The interrupted application needs manual review.');
        for (const entry of data.changes.slice().reverse()) {
          const change = entry as { path?: unknown; before?: unknown; nextText?: unknown };
          if (typeof change?.path !== 'string' || typeof change.before !== 'string' || typeof change.nextText !== 'string') throw new RoutineError('The interrupted application needs manual review.');
          const file = proposalTarget(base, change.path);
          const current = readFileSync(file, 'utf8');
          if (textHash(current) === textHash(change.nextText)) replaceText(file, change.before);
          else if (textHash(current) !== textHash(change.before)) throw new RoutineError('A file changed during recovery. Review the interrupted application.');
        }
        replaceText(journal, JSON.stringify({ ...data, status: 'rolled-back' }));
        proposal.status = 'apply-failed';
        proposal.summary += ' The interrupted application was rolled back.';
      }
    } catch (e) {
      proposal.status = 'apply-failed';
      proposal.summary += ` ${e instanceof Error ? e.message : String(e)}`;
    }
    proposal.updatedAt = nowIso(); saveProposal(root, proposal);
  }
}

function replaceText(file: string, text: string): void {
  const temporary = `${file}.${newId('routine')}.tmp`;
  try { writeFileSync(temporary, text, 'utf8'); renameSync(temporary, file); }
  finally { rmSync(temporary, { force: true }); }
}

export function syncExecutions(root: string, project: string, routineId: string, hooks: RunHooks, drive = false): void {
  const routine = readRoutine(root, project, routineId);
  recoverApplications(root, routine);
  for (const execution of listExecutions(root, project, routineId)) {
    if (!execution.operationRunId || !['waiting', 'running'].includes(execution.status)) continue;
    const dir = resolveInside(routineProjectDir(root, project), `runs/${execution.operationRunId}`);
    try {
      if (drive) hooks.driveOperation?.(project, execution.operationRunId);
      const run = readRun(dir);
      if (!['completed', 'cancelled', 'blocked'].includes(run.status)) continue;
      if (run.status !== 'completed') throw new RoutineError(run.visits.at(-1)?.error || 'The analysis did not complete.');
      const visit = run.visits.findLast((v) => v.status === 'done');
      if (!visit || !/^[\w.-]+$/.test(visit.slot)) throw new RoutineError('The analysis did not deliver a result.');
      const file = resolveInside(dir, `outputs/${visit.slot}/analysis.json`);
      const analysis = JSON.parse(readFileSync(file, 'utf8')) as { summary?: unknown; findings?: unknown; proposedChanges?: unknown };
      if (typeof analysis.summary !== 'string' || !analysis.summary.trim() || !Array.isArray(analysis.findings)) throw new RoutineError('The analysis result is invalid.');
      const findings = analysis.findings.map((f: unknown) => {
        const row = f as { statement?: unknown; kind?: unknown };
        if (typeof row?.statement !== 'string' || row.kind !== 'analysis') throw new RoutineError('The analysis result is invalid.');
        return { statement: row.statement.slice(0, 4000), kind: 'analysis' as const };
      });
      const proposedChanges = (Array.isArray(analysis.proposedChanges) ? analysis.proposedChanges : []).slice(0, 30).map((c: unknown) => {
        const row = c as { path?: unknown; baseHash?: unknown; nextText?: unknown; note?: unknown };
        if (typeof row?.path !== 'string' || typeof row.baseHash !== 'string' || !/^[a-f0-9]{64}$/.test(row.baseHash) || typeof row.nextText !== 'string' || row.nextText.length > 2_000_000) throw new RoutineError('The proposed file changes are invalid.');
        proposalTarget(routineProjectDir(root, project), row.path);
        return { path: row.path, baseHash: row.baseHash, nextText: row.nextText, note: typeof row.note === 'string' ? row.note.slice(0, 1000) : '' };
      });
      for (const proposal of listProposals(root, project, routineId).filter((p) => p.executionId === execution.id && p.status === 'preparing')) {
        proposal.status = 'pending'; proposal.summary = analysis.summary.trim().slice(0, 4000); proposal.findings = findings; proposal.proposedChanges = proposedChanges; proposal.updatedAt = nowIso(hooks);
        saveProposal(root, proposal);
        note(root, routine, 'approval', routine.name, proposal.summary, execution.id, proposal.id);
      }
      execution.status = execution.warnings.length ? 'completed-with-warnings' : 'completed';
      execution.resultSummary = analysis.summary.trim().slice(0, 4000);
    } catch (e) {
      execution.status = 'failed'; execution.error = e instanceof Error ? e.message : String(e);
      for (const proposal of listProposals(root, project, routineId).filter((p) => p.executionId === execution.id && p.status === 'preparing')) {
        proposal.status = 'analysis-failed'; proposal.updatedAt = nowIso(hooks); saveProposal(root, proposal);
      }
      note(root, routine, 'alert', routine.name, execution.error, execution.id);
    }
    execution.finishedAt = nowIso(hooks);
    saveExecution(root, project, routineId, execution);
    if (readLock(root, routine)?.executionId === execution.id) writeLock(root, routine, null);
  }
}

const lastTicks = new Map<string, Date>();
const ticking = new Map<string, Promise<Execution[]>>();
export function tick(root: string, hooks: RunHooks): Promise<Execution[]> {
  const key = routineWorkspace(root);
  const active = ticking.get(key);
  if (active) return active;
  const running = withRoutineWorkspace(root, () => tickScoped(root, hooks));
  ticking.set(key, running);
  void running.finally(() => { if (ticking.get(key) === running) ticking.delete(key); }).catch(() => {});
  return running;
}
async function tickScoped(root: string, hooks: RunHooks): Promise<Execution[]> {
  const settings = readSettings(root);
  if (settings.schedulerPaused) return Promise.resolve([]);
  const now = hooks.now?.() ?? new Date();
  const previous = lastTicks.get(routineWorkspace(root));
  const lastTick = previous && now.getTime() - previous.getTime() <= 90_000 ? previous : undefined;
  lastTicks.set(routineWorkspace(root), now);
  const due: { project: string; routine: Routine }[] = [];
  for (const project of projectIds(root)) {
    for (const routine of listRoutineFiles(root, project)) {
      syncExecutions(root, project, routine.id, hooks, true);
      if (!routine.enabled || routine.archived) continue;
      const action = dueAction(routine.schedule, routine.nextRunAt, now, lastTick);
      if (action.following !== routine.nextRunAt) {
        routine.nextRunAt = action.following;
        routine.updatedAt = now.toISOString();
        saveRoutineFile(root, routine);
      }
      if (action.run) due.push({ project, routine });
    }
  }
  return due.reduce<Promise<Execution[]>>(async (acc, item) => {
    const all = await acc;
    all.push(await runRoutine(root, item.project, item.routine.id, 'schedule', hooks));
    return all;
  }, Promise.resolve([]));
}

function projectIds(root: string): string[] {
  return listProjects(root);
}

export function settingsOf(root: string): RoutineSettings {
  return readSettings(root);
}

export function saveSettings(root: string, raw: unknown): RoutineSettings {
  const r = (raw ?? {}) as Record<string, unknown>;
  const base = defaultSettings();
  const next = {
    schedulerPaused: r.schedulerPaused === true,
    background: r.background === true,
    openAtLogin: r.openAtLogin === true,
    maxAiCalls: boundedNumber(r.maxAiCalls, base.maxAiCalls, 0, 20),
    retention: Math.min(Math.max(Number(r.retention) || base.retention, 5), 200),
  };
  writeSettings(root, next);
  return next;
}

export function notesOf(root: string): RoutineNote[] {
  return listNotes(root).filter((n) => n.internal !== false);
}

export function systemNotesOf(root: string): RoutineNote[] { return listNotes(root).filter((n) => n.system !== false); }

export function readNotes(root: string, ids: string[] | 'all'): RoutineNote[] {
  const visible = notesOf(root);
  const selected = ids === 'all' ? visible.map((note) => note.id) : ids.filter((id) => visible.some((note) => note.id === id));
  return markNotes(root, selected).filter((n) => n.internal !== false);
}

export function dismissVisibleNotes(root: string, ids: string[] | 'all'): RoutineNote[] {
  const visible = notesOf(root);
  const known = new Set(visible.map((note) => note.id));
  const drop = ids === 'all' ? visible.map((note) => note.id) : ids.filter((id) => known.has(id));
  return dismissNotes(root, drop).filter((n) => n.internal !== false);
}

export function analystAvailable(root: string): boolean {
  return listAgents(root).some((a) => a.name === 'routine-analyst' && isUsableAgent(a));
}

export function previewOperation(routine: Routine): Operation {
  return buildOperation(routine, []);
}
