// Scheduled routines: one per project, stored as JSON under that project.
// The clock, the MCP call and the operation run live in the desktop process.
// This module only validates, compares, and reads and writes the files.

import { createHash, randomBytes } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { workspaceDir } from './repo.mjs';

export const POLICIES = ['monitor', 'supervised', 'authorized'] as const;
export const SCHEDULE_KINDS = ['manual', 'interval', 'daily', 'weekly', 'monthly'] as const;
export const OVERLAPS = ['skip', 'queue', 'cancel-previous'] as const;
export const MISSED = ['once', 'skip', 'next'] as const;
export const EXECUTION_STATUSES = ['scheduled', 'waiting', 'running', 'completed', 'completed-with-warnings', 'failed', 'cancelled', 'interrupted'] as const;
export const PROPOSAL_STATUSES = ['preparing', 'analysis-failed', 'pending', 'approved', 'rejected', 'deferred', 'applying', 'applied', 'apply-failed', 'obsolete'] as const;
export const NOTE_CATEGORIES = ['info', 'change', 'approval', 'alert'] as const;

export type Policy = (typeof POLICIES)[number];
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];
export type Overlap = (typeof OVERLAPS)[number];
export type Missed = (typeof MISSED)[number];
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export interface RoutineSchedule {
  kind: ScheduleKind;
  intervalMinutes: number;
  time: string; // HH:mm
  daysOfWeek: number[]; // 0 Sunday .. 6 Saturday
  dayOfMonth: number;
  timezone: string;
  missed: Missed;
}

export const SOURCE_KINDS = ['query', 'files', 'folder'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

// Where a routine looks. A query is called again on every run and every record it returns is
// followed (new, changed, gone); files and folders are read from the routine's own project.
export interface RoutineResource {
  kind: SourceKind;
  serverId: string; // query
  tool: string; // query
  arguments: Record<string, unknown>; // query; strings may use {{project.id}} and {{project.name}}
  recordsPath: string; // query, optional: dotted field holding the list
  idPath: string; // query, optional: dotted field holding each record's id
  pagination: { cursorArgument: string; nextCursorPath: string } | null; // query, optional
  paths: string[]; // files: project-relative
  path: string; // folder: project-relative
  recursive: boolean; // folder
}

export interface RoutineConditions {
  runWhenChanges: boolean;
  notifyWhenRelevant: boolean;
  proposeWhenImpact: boolean;
  overlap: Overlap;
  stopWhenResourceMissing: boolean;
}

export interface Routine {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  projectId: string;
  operationId: string;
  instructions: string;
  enabled: boolean;
  archived: boolean;
  schedule: RoutineSchedule;
  executionPolicy: Policy;
  tool: string;
  agents: string[]; // operation agent keys; empty means the built-in routine-analyst
  resources: RoutineResource[];
  conditions: RoutineConditions;
  notifyInternal: boolean;
  notifySystem: boolean;
  createdAt: string;
  updatedAt: string;
  nextRunAt: string; // '' when manual
  operationBody: string; // hash of the steps last written from this form
}

export interface Checkpoint {
  sourceId: string;
  resourceId: string;
  version: string;
  updatedAt: string;
  hash: string;
  lastSuccessfulSync: string;
}

export interface Snapshot {
  resourceId: string;
  version: string;
  updatedAt: string;
  hash: string;
}

export type ChangeKind = 'baseline' | 'unchanged' | 'changed' | 'added' | 'removed';

export interface DetectedChange {
  id: string;
  executionId: string;
  sourceId: string;
  resourceId: string;
  previousVersion: string;
  currentVersion: string;
  changeType: ChangeKind;
  summary: string;
  detectedAt: string;
}

export interface ProposalChange {
  path: string; // project-relative; '' when the proposal only records the finding
  baseHash: string;
  nextText: string;
  note: string;
}

export interface Proposal {
  id: string;
  projectId: string;
  routineId: string;
  executionId: string;
  detectedChangeIds: string[];
  status: ProposalStatus;
  summary: string;
  justification: string;
  proposedChanges: ProposalChange[];
  sourceSnapshot: Snapshot;
  findings?: { statement: string; kind: 'analysis' }[];
  decision: { at: string; result: string; by: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Execution {
  id: string;
  routineId: string;
  projectId: string;
  status: ExecutionStatus;
  scheduledAt: string;
  startedAt: string;
  finishedAt: string;
  triggerType: 'schedule' | 'manual';
  resultSummary: string;
  error: string;
  operationRunId: string;
  warnings: string[];
}

export interface RoutineNote {
  id: string;
  category: NoteCategory;
  severity: NoteCategory;
  title: string;
  message: string;
  projectId: string;
  routineId: string;
  executionId: string;
  proposalId: string;
  readAt: string;
  createdAt: string;
  navigationTarget: { tab: 'routines'; projectId: string; routineId: string; proposalId: string };
  internal?: boolean; // absent in older notifications means enabled
  system?: boolean;
}

export interface RoutineSettings {
  schedulerPaused: boolean;
  background: boolean;
  openAtLogin: boolean;
  maxAiCalls: number;
  retention: number;
}

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class RoutineError extends Error {}
export class RoutineInterrupted extends RoutineError {}

// Async work retains its original workspace, even while the person opens another.
const routineScope = new AsyncLocalStorage<{ root: string; workspace: string }>();
export function withRoutineWorkspace<T>(root: string, action: () => T): T {
  const current = routineScope.getStore();
  return current?.root === resolve(root) ? action() : routineScope.run({ root: resolve(root), workspace: workspaceDir(root) }, action);
}
export const routineWorkspace = (root: string): string => {
  const current = routineScope.getStore();
  return current?.root === resolve(root) ? current.workspace : workspaceDir(root);
};
export function assertRoutineWorkspace(root: string): void {
  if (resolve(routineWorkspace(root)) !== resolve(workspaceDir(root))) throw new RoutineInterrupted('The workspace changed. This check was interrupted.');
}
export function routineProjectDir(root: string, projectId: string): string {
  if (!ID.test(projectId)) throw new RoutineError('Unknown project.');
  const base = join(routineWorkspace(root), 'projects');
  const dir = join(base, projectId);
  if (existsSync(dir)) {
    const rel = relative(realpathSync(base), realpathSync(dir));
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new RoutineError('Path outside the project folder.');
  }
  return dir;
}
function confined(base: string, ...parts: string[]): string {
  const path = join(base, ...parts);
  if (existsSync(path)) {
    const rel = relative(realpathSync(base), realpathSync(path));
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new RoutineError('Path outside the project folder.');
  } else {
    let parent = join(path, '..');
    while (!existsSync(parent)) parent = join(parent, '..');
    const rel = relative(realpathSync(base), realpathSync(parent));
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new RoutineError('Path outside the project folder.');
  }
  return path;
}

const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const stamp = () => new Date().toISOString();
const writeJson = (file: string, data: unknown) => {
  mkdirSync(join(file, '..'), { recursive: true });
  const temporary = `${file}.${randomBytes(6).toString('hex')}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    renameSync(temporary, file);
  } finally { rmSync(temporary, { force: true }); }
};
const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'));

export function newId(prefix = ''): string {
  const body = randomBytes(6).toString('hex');
  return prefix ? `${prefix}-${body}` : body;
}

export function textHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

export function contentHash(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

export function timeZoneOk(zone: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; }
}

// Minutes to add to UTC to get the wall clock in `zone` at this instant.
function zoneOffset(zone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - utcMs;
}

// The UTC instant of a wall-clock time in `zone`. Two passes cover a DST offset change.
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, zone: string): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 2; i++) utc = Date.UTC(year, month - 1, day, hour, minute, 0) - zoneOffset(zone, utc);
  return new Date(utc);
}

function wall(zone: string, utc: Date): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(utc);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const week = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return {
    year: Number(get('year')), month: Number(get('month')), day: Number(get('day')),
    hour: Number(get('hour')) % 24, minute: Number(get('minute')), weekday: week.indexOf(get('weekday')),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// The next instant strictly after `after` when this schedule fires. Manual has none.
export function nextRun(schedule: RoutineSchedule, after: Date): Date | null {
  if (schedule.kind === 'manual') return null;
  const zone = timeZoneOk(schedule.timezone) ? schedule.timezone : 'UTC';
  if (schedule.kind === 'interval') {
    const minutes = Math.min(Math.max(schedule.intervalMinutes || 60, 5), 7 * 24 * 60);
    return new Date(after.getTime() + minutes * 60_000);
  }
  const [hh, mm] = (TIME.test(schedule.time) ? schedule.time : '08:00').split(':').map(Number);
  const start = wall(zone, after);
  const days = schedule.daysOfWeek.length ? schedule.daysOfWeek : [1];
  for (let add = 0; add < 400; add++) {
    const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day + add));
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const d = cursor.getUTCDate();
    if (schedule.kind === 'monthly' && d !== Math.min(schedule.dayOfMonth || 1, daysInMonth(y, m))) continue;
    const at = zonedToUtc(y, m, d, hh, mm, zone);
    if (at.getTime() <= after.getTime()) continue;
    if (schedule.kind === 'weekly' && !days.includes(wall(zone, at).weekday)) continue;
    return at;
  }
  return null;
}

// One catch-up at most: a missed daily slot runs now, then the schedule jumps to the next future slot.
export function dueAction(schedule: RoutineSchedule, nextRunAt: string, now: Date, lastTick?: Date): { run: boolean; following: string } {
  if (schedule.kind === 'manual' || !nextRunAt) return { run: false, following: '' };
  const due = new Date(nextRunAt);
  if (Number.isNaN(due.getTime()) || due.getTime() > now.getTime()) return { run: false, following: nextRunAt };
  const following = nextRun(schedule, now);
  const followingIso = following ? following.toISOString() : '';
  // A slot reached during normal polling is not a missed slot. Startup/resume
  // without a previous tick uses the current minute as the normal clock window.
  const reached = lastTick ? due.getTime() > lastTick.getTime() : now.getTime() - due.getTime() < 60_000;
  if (reached || schedule.missed === 'once') return { run: true, following: followingIso };
  return { run: false, following: followingIso };
}

export function defaultSchedule(zone = 'UTC'): RoutineSchedule {
  return { kind: 'daily', intervalMinutes: 60, time: '08:00', daysOfWeek: [1, 2, 3, 4, 5], dayOfMonth: 1, timezone: timeZoneOk(zone) ? zone : 'UTC', missed: 'once' };
}

export function defaultConditions(): RoutineConditions {
  return { runWhenChanges: true, notifyWhenRelevant: true, proposeWhenImpact: true, overlap: 'skip', stopWhenResourceMissing: true };
}

export function cleanSchedule(raw: unknown, fallbackZone: string): RoutineSchedule {
  const r = (raw ?? {}) as Record<string, unknown>;
  const base = defaultSchedule(fallbackZone);
  const kind = SCHEDULE_KINDS.includes(r.kind as ScheduleKind) ? r.kind as ScheduleKind : base.kind;
  const days = Array.isArray(r.daysOfWeek) ? [...new Set(r.daysOfWeek.map(Number).filter((n) => n >= 0 && n <= 6))] : base.daysOfWeek;
  const zone = timeZoneOk(String(r.timezone ?? '')) ? String(r.timezone) : base.timezone;
  return {
    kind,
    intervalMinutes: Math.min(Math.max(Number(r.intervalMinutes) || base.intervalMinutes, 5), 7 * 24 * 60),
    time: TIME.test(String(r.time ?? '')) ? String(r.time) : base.time,
    daysOfWeek: days.length ? days : base.daysOfWeek,
    dayOfMonth: Math.min(Math.max(Number(r.dayOfMonth) || 1, 1), 31),
    timezone: zone,
    missed: MISSED.includes(r.missed as Missed) ? r.missed as Missed : 'once',
  };
}

export function cleanRoutine(raw: unknown, projectId: string, now = stamp()): Routine {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = ID.test(String(r.id ?? '')) ? String(r.id) : newId();
  const name = text(r.name, 80);
  if (!name) throw new RoutineError('Give the routine a name.');
  const resources = (Array.isArray(r.resources) ? r.resources : []).slice(0, 20).map(cleanSource).filter((x): x is RoutineResource => x !== null);
  const conditionsRaw = (r.conditions ?? {}) as Record<string, unknown>;
  const base = defaultConditions();
  const schedule = cleanSchedule(r.schedule, text(r.timezone, 80) || 'UTC');
  const policy = POLICIES.includes(r.executionPolicy as Policy) ? r.executionPolicy as Policy : 'supervised';
  const agents = Array.isArray(r.agents) ? r.agents.map((a) => text(a, 80)).filter((a) => /^(library|global):[a-z0-9-]+$/.test(a)).slice(0, 12) : [];
  const next = nextRun(schedule, new Date(now));
  return {
    schemaVersion: 1,
    id,
    name,
    description: text(r.description, 1000),
    projectId,
    operationId: `routine-${id}`,
    instructions: text(r.instructions, 4000),
    enabled: r.enabled !== false,
    archived: r.archived === true,
    schedule,
    executionPolicy: policy,
    tool: text(r.tool, 40),
    agents,
    resources,
    conditions: {
      runWhenChanges: conditionsRaw.runWhenChanges !== false,
      notifyWhenRelevant: conditionsRaw.notifyWhenRelevant !== false,
      proposeWhenImpact: policy === 'monitor' ? false : conditionsRaw.proposeWhenImpact !== false,
      overlap: OVERLAPS.includes(conditionsRaw.overlap as Overlap) ? conditionsRaw.overlap as Overlap : base.overlap,
      stopWhenResourceMissing: conditionsRaw.stopWhenResourceMissing !== false,
    },
    notifyInternal: r.notifyInternal !== false,
    notifySystem: r.notifySystem !== false,
    createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : now,
    updatedAt: now,
    nextRunAt: next ? next.toISOString() : '',
    operationBody: typeof r.operationBody === 'string' ? r.operationBody : '',
  };
}

const DOTTED = /^[A-Za-z0-9_$-]+(\.[A-Za-z0-9_$-]+)*$/;
const dotted = (v: unknown) => { const s = text(v, 120); return DOTTED.test(s) ? s : ''; };

// One source from the form or from disk. A routine saved before sources had kinds watched fixed
// ids through one MCP tool; it becomes a query that sends the same arguments.
export function cleanSource(item: unknown): RoutineResource | null {
  const x = (item ?? {}) as Record<string, unknown>;
  const legacy = !x.kind && Array.isArray(x.watchedIds);
  const kind = legacy ? 'query' : SOURCE_KINDS.includes(x.kind as SourceKind) ? x.kind as SourceKind : null;
  if (!kind) return null;
  const base: RoutineResource = { kind, serverId: '', tool: '', arguments: {}, recordsPath: '', idPath: '', pagination: null, paths: [], path: '', recursive: true };
  if (kind === 'query') {
    let args: Record<string, unknown> = {};
    if (legacy) {
      const ids = (x.watchedIds as unknown[]).map((id) => text(id, 40)).filter(Boolean).slice(0, 50);
      args = ids.length === 1 ? { ids, id: ids[0] } : ids.length ? { ids } : {};
    } else if (x.arguments && typeof x.arguments === 'object' && !Array.isArray(x.arguments)) {
      args = x.arguments as Record<string, unknown>;
      if (JSON.stringify(args).length > 8000) throw new RoutineError('The query parameters are too long.');
    }
    const p = (x.pagination ?? null) as Record<string, unknown> | null;
    const cursorArgument = p ? dotted(p.cursorArgument) : '', nextCursorPath = p ? dotted(p.nextCursorPath) : '';
    const out = { ...base, serverId: text(x.serverId, 80), tool: text(x.tool, 80), arguments: args, recordsPath: dotted(x.recordsPath), idPath: dotted(x.idPath),
      pagination: cursorArgument && nextCursorPath ? { cursorArgument, nextCursorPath } : null };
    return out.serverId && out.tool ? out : null;
  }
  if (kind === 'files') {
    const paths = [...new Set((Array.isArray(x.paths) ? x.paths : []).map((p) => String(p ?? '').trim().replace(/\\/g, '/').slice(0, 400)).filter(Boolean))].slice(0, 100);
    return paths.length ? { ...base, paths } : null;
  }
  const path = String(x.path ?? '').trim().replace(/\\/g, '/').replace(/\/+$/, '').slice(0, 400);
  return path ? { ...base, path, recursive: x.recursive !== false } : null;
}

export function routineDir(root: string, projectId: string, routineId: string): string {
  if (!ID.test(routineId)) throw new RoutineError('Unknown routine.');
  return confined(routineProjectDir(root, projectId), 'routines', routineId);
}

export function listRoutineFiles(root: string, projectId: string): Routine[] {
  const dir = confined(routineProjectDir(root, projectId), 'routines');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).sort().flatMap((id) => {
    try {
      const raw = readJson(join(dir, id, 'routine.json'));
      const routine = cleanRoutine({ ...(raw as object), id }, projectId, (raw as { updatedAt?: string }).updatedAt);
      routine.createdAt = (raw as { createdAt?: string }).createdAt || routine.createdAt;
      routine.updatedAt = (raw as { updatedAt?: string }).updatedAt || routine.updatedAt;
      routine.nextRunAt = typeof (raw as { nextRunAt?: unknown }).nextRunAt === 'string' ? (raw as { nextRunAt: string }).nextRunAt : routine.nextRunAt;
      routine.operationBody = typeof (raw as { operationBody?: unknown }).operationBody === 'string' ? (raw as { operationBody: string }).operationBody : '';
      routine.archived = (raw as { archived?: unknown }).archived === true;
      routine.enabled = (raw as { enabled?: unknown }).enabled !== false;
      return [routine];
    } catch { return []; }
  });
}

export function readRoutine(root: string, projectId: string, routineId: string): Routine {
  const file = join(routineDir(root, projectId, routineId), 'routine.json');
  if (!existsSync(file)) throw new RoutineError('Unknown routine.');
  const found = listRoutineFiles(root, projectId).find((r) => r.id === routineId);
  if (!found) throw new RoutineError('Unknown routine.');
  return found;
}

export function saveRoutineFile(root: string, routine: Routine): void {
  writeJson(join(routineDir(root, routine.projectId, routine.id), 'routine.json'), routine);
}

export function removeRoutineFiles(root: string, projectId: string, routineId: string): void {
  rmSync(routineDir(root, projectId, routineId), { recursive: true, force: true });
}

export function readCheckpoints(root: string, routine: Routine): Checkpoint[] {
  const file = join(routineDir(root, routine.projectId, routine.id), 'checkpoints.json');
  if (!existsSync(file)) return [];
  const data = readJson(file);
  return Array.isArray(data) ? data as Checkpoint[] : [];
}

export function writeCheckpoints(root: string, routine: Routine, rows: Checkpoint[]): void {
  writeJson(join(routineDir(root, routine.projectId, routine.id), 'checkpoints.json'), rows);
}

export function saveExecution(root: string, projectId: string, routineId: string, execution: Execution): void {
  writeJson(join(routineDir(root, projectId, routineId), 'executions', `${execution.id}.json`), execution);
}

export function listExecutions(root: string, projectId: string, routineId: string): Execution[] {
  const dir = join(routineDir(root, projectId, routineId), 'executions');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((f) => {
    try { return [readJson(join(dir, f)) as Execution]; } catch { return []; }
  }).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function saveChange(root: string, routine: Routine, change: DetectedChange): void {
  writeJson(join(routineDir(root, routine.projectId, routine.id), 'changes', `${change.id}.json`), change);
}

export function saveProposal(root: string, proposal: Proposal): void {
  writeJson(join(routineDir(root, proposal.projectId, proposal.routineId), 'proposals', `${proposal.id}.json`), proposal);
}

export function listProposals(root: string, projectId: string, routineId: string): Proposal[] {
  const dir = join(routineDir(root, projectId, routineId), 'proposals');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).flatMap((f) => {
    try { return [readJson(join(dir, f)) as Proposal]; } catch { return []; }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function readProposal(root: string, projectId: string, routineId: string, proposalId: string): Proposal {
  if (!ID.test(proposalId)) throw new RoutineError('Unknown proposal.');
  const file = join(routineDir(root, projectId, routineId), 'proposals', `${proposalId}.json`);
  if (!existsSync(file)) throw new RoutineError('Unknown proposal.');
  const proposal = readJson(file) as Proposal;
  if (proposal.projectId !== projectId || proposal.routineId !== routineId || proposal.id !== proposalId) throw new RoutineError('Unknown proposal.');
  return proposal;
}

export interface Lock { pid: number; executionId: string; at: string }

export function readLock(root: string, routine: Routine): Lock | null {
  const file = join(routineDir(root, routine.projectId, routine.id), 'lock.json');
  if (!existsSync(file)) return null;
  try { return readJson(file) as Lock; } catch { return null; }
}

export function writeLock(root: string, routine: Routine, lock: Lock | null): void {
  const file = join(routineDir(root, routine.projectId, routine.id), 'lock.json');
  if (!lock) { rmSync(file, { force: true }); return; }
  writeJson(file, lock);
}

export function pidAlive(pid: number): boolean {
  if (!pid || pid < 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// A tools/call result is often `{ content: [{ type: 'text', text }] }`. The text is the record when it is JSON.
export function toolPayload(result: unknown): unknown {
  if ((result as { isError?: unknown } | null)?.isError === true) throw new RoutineError('The MCP tool returned an error. Check the connection and try again.');
  const content = (result as { content?: { type?: string; text?: string }[] } | null)?.content;
  const text = Array.isArray(content) ? content.find((c) => c?.type === 'text' && typeof c.text === 'string')?.text : undefined;
  if (typeof text !== 'string') return result;
  try { return JSON.parse(text); } catch { return { text }; }
}
export function snapshotsOf(result: unknown): Snapshot[] {
  return unwrap(result).map((item, i) => snapshot(item, String(i + 1)));
}

function unwrap(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (!result || typeof result !== 'object') return [];
  const o = result as Record<string, unknown>;
  if (Array.isArray(o.value)) return o.value;
  if (Array.isArray(o.workItems)) return o.workItems;
  if (Array.isArray(o.items)) return o.items;
  return [result];
}

function snapshot(item: unknown, fallbackId: string): Snapshot {
  const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
  const fields = (o.fields && typeof o.fields === 'object' ? o.fields : {}) as Record<string, unknown>;
  const resourceId = text(o.id ?? fields['System.Id'] ?? fallbackId, 80) || fallbackId;
  const version = text(o.rev ?? o.version ?? fields['System.Rev'] ?? '', 80);
  const updatedAt = text(fields['System.ChangedDate'] ?? o.changedDate ?? o.updatedAt ?? '', 80);
  return { resourceId, version, updatedAt, hash: contentHash(item) };
}

export function classify(previous: Checkpoint | undefined, snap: Snapshot): ChangeKind {
  if (!previous) return 'baseline';
  if (previous.hash === snap.hash && previous.version === snap.version) return 'unchanged';
  return 'changed';
}

export function sameProposal(existing: Proposal[], snap: Snapshot): boolean {
  return existing.some((p) => !['obsolete', 'rejected', 'analysis-failed'].includes(p.status) && p.sourceSnapshot.resourceId === snap.resourceId && p.sourceSnapshot.version === snap.version && p.sourceSnapshot.hash === snap.hash);
}

export function defaultSettings(): RoutineSettings {
  return { schedulerPaused: false, background: false, openAtLogin: false, maxAiCalls: 4, retention: 50 };
}

export function readSettings(root: string): RoutineSettings {
  const file = join(routineWorkspace(root), 'routine-settings.json');
  if (!existsSync(file)) return defaultSettings();
  try {
    const r = readJson(file) as Record<string, unknown>;
    const base = defaultSettings();
    return {
      schedulerPaused: r.schedulerPaused === true,
      background: r.background === true,
      openAtLogin: r.openAtLogin === true,
      maxAiCalls: boundedNumber(r.maxAiCalls, base.maxAiCalls, 0, 20),
      retention: Math.min(Math.max(Number(r.retention) || base.retention, 5), 200),
    };
  } catch { return defaultSettings(); }
}

export function writeSettings(root: string, settings: RoutineSettings): void {
  writeJson(join(routineWorkspace(root), 'routine-settings.json'), settings);
}

export function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(number) ? Math.min(Math.max(Math.trunc(number), min), max) : fallback;
}

const notesFile = (root: string) => join(routineWorkspace(root), 'notifications.jsonl');

export function appendNote(root: string, note: RoutineNote): void {
  mkdirSync(routineWorkspace(root), { recursive: true });
  appendFileSync(notesFile(root), `${JSON.stringify(note)}\n`, 'utf8');
}

export function listNotes(root: string): RoutineNote[] {
  const file = notesFile(root);
  if (!existsSync(file)) return [];
  const rows = readFileSync(file, 'utf8').split('\n').flatMap((line) => {
    if (!line.trim()) return [];
    try { return [JSON.parse(line) as RoutineNote]; } catch { return []; }
  });
  return rows.slice(-500).reverse();
}

export function markNotes(root: string, ids: string[] | 'all', at = stamp()): RoutineNote[] {
  mkdirSync(routineWorkspace(root), { recursive: true });
  const rows = listNotes(root).reverse();
  const want = ids === 'all' ? null : new Set(ids);
  const next = rows.map((n) => (!n.readAt && (want === null || want.has(n.id)) ? { ...n, readAt: at } : n));
  writeFileSync(notesFile(root), next.map((n) => JSON.stringify(n)).join('\n') + (next.length ? '\n' : ''), 'utf8');
  return next.slice().reverse();
}

export function trimExecutions(root: string, routine: Routine, keep: number): void {
  const all = listExecutions(root, routine.projectId, routine.id);
  for (const old of all.slice(keep)) rmSync(join(routineDir(root, routine.projectId, routine.id), 'executions', `${old.id}.json`), { force: true });
}

export function appendEvent(root: string, routine: Routine, executionId: string, event: string, detail: string): void {
  const file = join(routineDir(root, routine.projectId, routine.id), 'executions', `${executionId}.events.jsonl`);
  mkdirSync(join(file, '..'), { recursive: true });
  appendFileSync(file, `${JSON.stringify({ at: stamp(), event, detail: detail.slice(0, 500) })}\n`, 'utf8');
}

// Steps the routine form last wrote, so a later edit on the operation board is kept until the form changes them.
export function bodyHash(agents: string[], policy: Policy): string {
  return contentHash({ agents: agents.length ? agents : ['library:routine-analyst'], policy });
}
