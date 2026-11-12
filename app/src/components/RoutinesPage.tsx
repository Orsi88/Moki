// Scheduled project checks, reviewable proposals and workspace preferences.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ROUTINE_FOCUS, type McpEntry, type ProjectSummary, type RoutineActivity, type RoutineInfo, type RoutineResource, type RoutineSettings, type RoutineTarget, type ToolInfo } from '../api';
import { t } from '../i18n';
import { confirmDialog } from '../dialogs';
import { IconBell, IconChevron, IconPlay, IconRefresh, IconX } from './Icons';
import { BackArrow, ListHead, ListTabs, ListTools, matchesQuery } from './ListPage';

const newSource = (): RoutineResource => ({ kind: 'query', serverId: '', tool: '', arguments: {}, recordsPath: '', idPath: '', pagination: null, paths: [], path: '', recursive: true });
// "name: value" lines <-> the tool arguments. A value that reads as JSON (number, list, true) keeps its type.
const argsText = (args: Record<string, unknown>) => Object.entries(args).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n');
function parseArgs(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const line of text.split(/\r?\n/)) {
    const at = line.indexOf(':');
    if (at < 1) continue;
    const key = line.slice(0, at).trim(), raw = line.slice(at + 1).trim();
    if (!key) continue;
    try { const v: unknown = JSON.parse(raw); out[key] = v !== null && typeof v !== 'string' ? v : raw; } catch { out[key] = raw; }
  }
  return out;
}

type Area = 'routines' | 'approvals' | 'history' | 'preferences';
const empty = (projectId: string, zone: string): RoutineInfo => ({
  id: '', name: '', description: '', projectId, operationId: '', instructions: '', enabled: true, archived: false,
  schedule: { kind: 'daily', intervalMinutes: 60, time: '08:00', daysOfWeek: [1, 2, 3, 4, 5], dayOfMonth: 1, timezone: zone, missed: 'once' },
  executionPolicy: 'supervised', tool: '', agents: [], resources: [newSource()], nextRunAt: '', notifyInternal: true, notifySystem: true,
  conditions: { runWhenChanges: true, notifyWhenRelevant: true, proposeWhenImpact: true, overlap: 'skip', stopWhenResourceMissing: true },
});
const message = (e: unknown) => e instanceof Error ? e.message : String(e);
const when = (iso: string) => iso ? new Date(iso).toLocaleString() : '—';
const weekdays = () => Array.from({ length: 7 }, (_, day) => new Intl.DateTimeFormat(document.documentElement.lang || 'en', { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + day, 12))));
function scheduleLabel(row: RoutineInfo): string {
  const schedule = row.schedule;
  if (schedule.kind === 'manual') return t('Manual');
  if (schedule.kind === 'daily') return t('Daily at {time}', { time: schedule.time });
  if (schedule.kind === 'interval') return t('Every {n} minutes', { n: schedule.intervalMinutes });
  if (schedule.kind === 'monthly') return t('Day {day}, at {time}', { day: schedule.dayOfMonth, time: schedule.time });
  return t('{days}, at {time}', { days: schedule.daysOfWeek.map((day) => weekdays()[day]).join(', '), time: schedule.time });
}
function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: t('Completed'), 'completed-with-warnings': t('Completed with warnings'), failed: t('Failed'), interrupted: t('Interrupted'), cancelled: t('Cancelled'),
    running: t('Running'), waiting: t('Waiting for analysis'), scheduled: t('Scheduled'), preparing: t('Preparing analysis'), 'analysis-failed': t('Analysis failed'),
    pending: t('Needs your review'), deferred: t('Deferred'), approved: t('Acknowledged'), rejected: t('Rejected'), applied: t('Applied'), applying: t('Applying'), 'apply-failed': t('Could not apply'), obsolete: t('Out of date'),
  };
  return labels[status] ?? status;
}
function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="routine-toggle"><span><strong>{label}</strong>{hint && <span className="muted small">{hint}</span>}</span><input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>;
}
function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="routine-empty"><span className="routine-empty-icon"><IconBell size={25} /></span><h2>{title}</h2><p className="muted">{children}</p></div>;
}

export function RoutinesPage({ projects, tools, registerLeave }: { projects: ProjectSummary[]; tools: ToolInfo[]; registerLeave?: (guard: (() => Promise<boolean>) | null) => void }) {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [area, setArea] = useState<Area>('routines');
  const [rows, setRows] = useState<RoutineInfo[]>([]);
  const [activity, setActivity] = useState<RoutineActivity>({ executions: [], proposals: [] });
  const [servers, setServers] = useState<McpEntry[]>([]);
  const [settings, setSettings] = useState<RoutineSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState('');
  const [draft, setDraft] = useState<RoutineInfo | null>(null);
  const [savedDraft, setSavedDraft] = useState('');
  // What the person typed in the text boxes of each source, kept as typed while it is edited.
  const [sourceText, setSourceText] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedProposal, setSelectedProposal] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const unsaved = draft !== null && JSON.stringify(draft) !== savedDraft;
  const unsavedRef = useRef(false);
  unsavedRef.current = unsaved || (area === 'preferences' && settings !== null && JSON.stringify(settings) !== savedSettings);

  const refresh = useCallback(async () => {
    const [routines, nextActivity] = await Promise.all([api.listRoutines(), api.routineActivity()]);
    setRows(routines); setActivity(nextActivity);
  }, []);
  useEffect(() => {
    let current = true;
    void Promise.all([refresh(), api.mcpCatalog(), api.routineSettings()]).then(([, catalog, preferences]) => {
      if (!current) return;
      setServers(catalog.servers); setSettings(preferences); setSavedSettings(JSON.stringify(preferences));
    }).catch((e) => { if (current) setError(message(e)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; generation.current++; };
  }, [refresh]);
  useEffect(() => {
    if (draft || area === 'preferences') return;
    const timer = window.setInterval(() => { void refresh().catch((e) => setError(message(e))); }, 5000);
    return () => window.clearInterval(timer);
  }, [draft, area, refresh]);
  const leave = async () => !unsavedRef.current || await confirmDialog(t('Discard unsaved changes?'), { danger: true });
  useEffect(() => {
    registerLeave?.(() => !unsavedRef.current ? Promise.resolve(true) : confirmDialog(t('Discard unsaved changes?'), { danger: true }));
    return () => registerLeave?.(null);
  }, [registerLeave]);
  const open = useCallback(async (projectId: string, id: string) => {
    const request = ++generation.current;
    try {
      setError(''); setNotice('');
      const got = await api.routine(projectId, id);
      if (request !== generation.current) return;
      setDraft(got.routine); setSavedDraft(JSON.stringify(got.routine)); setSourceText({}); setArea('routines');
    } catch (e) { if (request === generation.current) setError(message(e)); }
  }, []);
  useEffect(() => {
    const follow = async (target: RoutineTarget) => {
      if (!await leave()) return;
      try { sessionStorage.removeItem(ROUTINE_FOCUS); } catch { /* optional persistence */ }
      if (target.proposalId) { setDraft(null); setSelectedProposal(target.proposalId); setArea('approvals'); await refresh(); }
      else await open(target.projectId, target.routineId);
    };
    const listener = (event: Event) => { void follow((event as CustomEvent<RoutineTarget>).detail).catch((e) => setError(message(e))); };
    window.addEventListener(ROUTINE_FOCUS, listener);
    try {
      const raw = sessionStorage.getItem(ROUTINE_FOCUS);
      if (raw) { const target = JSON.parse(raw) as RoutineTarget; if (target.projectId && target.routineId) void follow(target).catch((e) => setError(message(e))); }
    } catch { /* stale navigation */ }
    return () => window.removeEventListener(ROUTINE_FOCUS, listener);
  }, [open, refresh]);
  useEffect(() => { if (selectedProposal && area === 'approvals') document.getElementById(`proposal-${selectedProposal}`)?.scrollIntoView({ block: 'nearest' }); }, [selectedProposal, area, activity]);
  const act = async (action: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await action(); await refresh(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };
  const go = async (next: Area) => {
    if (!await leave()) return;
    generation.current++; setDraft(null); setArea(next); setQuery(''); setStatusFilter(''); setError(''); setNotice('');
    if (next === 'preferences') { const value = await api.routineSettings(); setSettings(value); setSavedSettings(JSON.stringify(value)); }
  };
  const save = async () => {
    if (!draft) return;
    await act(async () => {
      const result = await api.saveRoutine(draft.projectId, draft);
      setDraft(result.routine); setSavedDraft(JSON.stringify(result.routine)); setNotice(t('Routine saved.'));
    });
  };
  const editResource = (index: number, patch: Partial<RoutineInfo['resources'][number]>) => setDraft((d) => d && ({ ...d, resources: d.resources.map((r, i) => i === index ? { ...r, ...patch } : r) }));
  const filtered = rows.filter((row) => (!projectFilter || row.projectId === projectFilter) && (!statusFilter || (statusFilter === 'active' ? row.enabled : !row.enabled)) && matchesQuery(query, row.name, row.description, row.projectName ?? ''));
  const proposals = activity.proposals.filter((p) => (!projectFilter || p.projectId === projectFilter) && (!statusFilter || (statusFilter === 'pending' ? ['pending', 'deferred'].includes(p.status) : !['pending', 'deferred'].includes(p.status))) && matchesQuery(query, p.summary, p.routineName, p.projectName));
  const executions = activity.executions.filter((e) => (!projectFilter || e.projectId === projectFilter) && matchesQuery(query, e.routineName, e.projectName, e.resultSummary));
  const pending = activity.proposals.filter((p) => ['pending', 'deferred'].includes(p.status)).length;
  const installed = tools.filter((tool) => tool.available && tool.kind === 'terminal');
  const projectPicker = <select aria-label={t('Filter by project')} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}><option value="">{t('All projects')}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>;

  return <div className="list-page routines-page">
    {draft ? <header className="library-head"><div className="title-row"><BackArrow label={t('Routines')} onBack={() => { void go('routines'); }} /><h1>{draft.id ? draft.name || t('Edit routine') : t('New routine')}</h1></div></header> : <ListHead title={t('Routines and notifications')} intro={t('Keep an eye on your projects. Review the changes that matter.')} action={!draft && area === 'routines' ? <button type="button" className="btn" disabled={!projects.length || loading} onClick={() => { const value = empty(projects[0]?.id ?? '', zone); setDraft(value); setSavedDraft(JSON.stringify(value)); setSourceText({}); setNotice(''); setError(''); }}>{t('New routine')}</button> : undefined} />}
    {!draft && <ListTabs label={t('Routines and notifications')} value={area} onChange={(next) => { void go(next).catch((e) => setError(message(e))); }} tabs={[
      { id: 'routines', label: t('Routines') }, { id: 'approvals', label: t('Approvals'), ...(pending ? { count: pending } : {}) }, { id: 'history', label: t('History') }, { id: 'preferences', label: t('Preferences') },
    ]} />}
    {error && <p className="result warn" role="alert">{error}</p>}
    {notice && <p className="result" role="status">{notice}</p>}
    {loading ? <p className="muted" role="status">{t('Loading…')}</p> : draft ? <form className="routine-editor" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <section className="routine-section"><header><h2>{t('What should happen?')}</h2><p className="muted small">{t('Give this check a clear purpose and a home.')}</p></header><div className="routine-fields">
        <label>{t('Name')}<input autoFocus value={draft.name} maxLength={80} required placeholder={t('A name you will recognize')} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <label>{t('Project')}<select value={draft.projectId} disabled={Boolean(draft.id)} required onChange={(e) => { setDraft({ ...draft, projectId: e.target.value, resources: [newSource()] }); setSourceText({}); }}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="routine-wide">{t('What this routine should do')}<textarea rows={3} value={draft.instructions} maxLength={4000} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} placeholder={t('For example: follow the active items of the sprint and prepare knowledge base updates for my approval.')} /></label>
      </div></section>
      <section className="routine-section"><header><h2>{t('What should it watch?')}</h2><p className="muted small">{t('Every run checks everything the source has at that moment and tells you what is new, what changed and what is gone.')}</p></header>
        {draft.resources.map((resource, index) => <div className="routine-source" key={index}>
          <div className="choice-grid routine-kinds" role="radiogroup" aria-label={t('Where from?')}>
            {([['query', t('A query in a connection'), t('Azure DevOps, Jira or another read-only MCP server')], ['files', t('Project files'), t('Specific files, like the knowledge base')], ['folder', t('A project folder'), t('Every file inside it')]] as const).map(([kind, title, hint]) =>
              <label key={kind} className={`choice${resource.kind === kind ? ' on' : ''}`}><input type="radio" name={`routine-kind-${index}`} checked={resource.kind === kind} onChange={() => editResource(index, { kind })} /><span className="choice-title">{title}</span><span className="choice-hint">{hint}</span></label>)}
          </div>
          <div className="routine-fields">
          {resource.kind === 'query' ? <>
            <label>{t('Connection')}<select value={resource.serverId} required onChange={(e) => editResource(index, { serverId: e.target.value, tool: '' })}><option value="">{t('Choose a connection')}</option>{servers.filter((s) => s.enabled && s.access === 'read' && (!s.projects.length || s.projects.includes(draft.projectId))).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label>{t('Tool on that server')}<input list={`routine-tools-${index}`} value={resource.tool} required maxLength={80} pattern="[a-zA-Z0-9_.-]+" onChange={(e) => editResource(index, { tool: e.target.value })} placeholder={t('Select or enter a tool name')} /><datalist id={`routine-tools-${index}`}>{servers.find((s) => s.id === resource.serverId)?.status?.tools.map((tool) => <option key={tool.name} value={tool.name}>{tool.description}</option>)}</datalist></label>
            <label className="routine-wide">{t('What to search (optional)')}<textarea rows={3} value={sourceText[`args-${index}`] ?? argsText(resource.arguments)} placeholder={t('One per line, for example:\nquery: [System.State] = \'Active\'\nproject: {{project.name}}')} onChange={(e) => { const value = e.target.value; setSourceText((all) => ({ ...all, [`args-${index}`]: value })); editResource(index, { arguments: parseArgs(value) }); }} /><span className="muted small">{t('Sent to the tool on every run. {{project.name}} becomes the name of this project.')}</span></label>
            <details className="routine-wide routine-advanced"><summary>{t('Advanced')}</summary><div className="routine-fields">
              <label>{t('Field with the list')}<input value={resource.recordsPath} placeholder="value" onChange={(e) => editResource(index, { recordsPath: e.target.value.trim() })} /></label>
              <label>{t('Field with each item id')}<input value={resource.idPath} placeholder="id" onChange={(e) => editResource(index, { idPath: e.target.value.trim() })} /></label>
              <label>{t('Next page parameter')}<input value={resource.pagination?.cursorArgument ?? ''} placeholder="continuationToken" onChange={(e) => editResource(index, { pagination: { cursorArgument: e.target.value.trim(), nextCursorPath: resource.pagination?.nextCursorPath ?? '' } })} /></label>
              <label>{t('Field with the next page')}<input value={resource.pagination?.nextCursorPath ?? ''} placeholder="nextCursor" onChange={(e) => editResource(index, { pagination: { cursorArgument: resource.pagination?.cursorArgument ?? '', nextCursorPath: e.target.value.trim() } })} /></label>
              <p className="muted small routine-wide">{t('Only when the tool answers in an unusual shape. Moki finds the usual lists and ids by itself.')}</p>
            </div></details>
          </> : resource.kind === 'files' ? <label className="routine-wide">{t('Files')}<textarea rows={3} required value={sourceText[`paths-${index}`] ?? resource.paths.join('\n')} placeholder={t('One per line, inside the project, for example:\ncontext/business-rules.md\ninbox/spec.docx')} onChange={(e) => { const value = e.target.value; setSourceText((all) => ({ ...all, [`paths-${index}`]: value })); editResource(index, { paths: value.split(/\r?\n/).map((p) => p.trim()).filter(Boolean) }); }} /></label>
          : <>
            <label className="routine-wide">{t('Folder')}<input required value={resource.path} placeholder={t('Inside the project, for example: context')} onChange={(e) => editResource(index, { path: e.target.value })} /></label>
            <label className="routine-check routine-wide"><input type="checkbox" checked={resource.recursive} onChange={(e) => editResource(index, { recursive: e.target.checked })} />{t('Include subfolders')}</label>
          </>}
          </div>
          {draft.resources.length > 1 && <button type="button" className="icon-btn routine-remove-source" aria-label={t('Remove source')} onClick={() => { setDraft({ ...draft, resources: draft.resources.filter((_, i) => i !== index) }); setSourceText({}); }}><IconX size={16} /></button>}</div>)}
        <button type="button" className="link small" disabled={draft.resources.length >= 20} onClick={() => setDraft({ ...draft, resources: [...draft.resources, newSource()] })}>{t('Add another source')}</button>
      </section>
      <section className="routine-section"><header><h2>{t('When should it run?')}</h2><p className="muted small">{t('The schedule follows the time zone you choose.')}</p></header><div className="routine-fields">
        <label>{t('Schedule')}<select value={draft.schedule.kind} onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, kind: e.target.value } })}>{[[ 'manual', t('Manual') ], [ 'daily', t('Daily') ], [ 'weekly', t('Weekly') ], [ 'monthly', t('Monthly') ], [ 'interval', t('Interval') ]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        {draft.schedule.kind === 'interval' ? <label>{t('Interval in minutes')}<input type="number" min={5} max={10080} step={1} required value={draft.schedule.intervalMinutes} onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, intervalMinutes: e.target.valueAsNumber } })} /></label> : draft.schedule.kind !== 'manual' && <label>{t('Time')}<input type="time" required value={draft.schedule.time} onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, time: e.target.value } })} /></label>}
        {draft.schedule.kind === 'weekly' && <fieldset className="routine-weekdays routine-wide"><legend>{t('Days of the week')}</legend>{weekdays().map((day, i) => <label key={i}><input type="checkbox" checked={draft.schedule.daysOfWeek.includes(i)} onChange={(e) => { const next = e.target.checked ? [...draft.schedule.daysOfWeek, i].sort() : draft.schedule.daysOfWeek.filter((d) => d !== i); if (next.length) setDraft({ ...draft, schedule: { ...draft.schedule, daysOfWeek: next } }); }} /><span>{day}</span></label>)}</fieldset>}
        {draft.schedule.kind === 'monthly' && <label>{t('Day of the month')}<input type="number" min={1} max={31} required value={draft.schedule.dayOfMonth} onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, dayOfMonth: e.target.valueAsNumber } })} /><span className="muted small">{t('Shorter months use their last day.')}</span></label>}
        {draft.schedule.kind !== 'manual' && <label>{t('Time zone')}<input value={draft.schedule.timezone} required onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, timezone: e.target.value } })} /></label>}
      </div>{draft.schedule.kind !== 'manual' && <div className="routine-schedule-summary"><IconRefresh size={15} /><span>{scheduleLabel(draft)}<span className="muted"> · {draft.schedule.timezone}</span></span></div>}
        {draft.schedule.kind !== 'manual' && <label className="routine-check"><input type="checkbox" checked={draft.schedule.missed === 'once'} onChange={(e) => setDraft({ ...draft, schedule: { ...draft.schedule, missed: e.target.checked ? 'once' : 'skip' } })} /><span>{t('Run one missed check when Moki comes back')}</span></label>}
      </section>
      <section className="routine-section"><header><h2>{t('How should it respond?')}</h2><p className="muted small">{t('Monitor changes or ask an AI to prepare an analysis for you.')}</p></header><div className="routine-fields">
        <label>{t('Mode')}<select value={draft.executionPolicy} onChange={(e) => setDraft({ ...draft, executionPolicy: e.target.value })}><option value="monitor">{t('Monitor and notify')}</option><option value="supervised">{t('Prepare an analysis for review')}</option>{draft.executionPolicy === 'authorized' && <option value="authorized">{t('Authorized')}</option>}</select></label>
        {draft.executionPolicy !== 'monitor' && <label>{t('AI tool')}<select required value={draft.tool} onChange={(e) => setDraft({ ...draft, tool: e.target.value })}><option value="">{t('Choose an AI')}</option>{installed.map((tool) => <option key={tool.id} value={tool.id}>{tool.label}</option>)}</select></label>}
      </div>
        {draft.executionPolicy !== 'monitor' && <><label className="routine-check"><input type="checkbox" checked={draft.conditions.runWhenChanges} onChange={(e) => setDraft({ ...draft, conditions: { ...draft.conditions, runWhenChanges: e.target.checked } })} /><span>{t('Only analyze when something changes')}</span></label><p className="routine-approval-hint"><IconBell size={15} />{t('You review the analysis and exact file changes before anything is applied.')}</p></>}
        <Toggle label={t('In-app notifications')} hint={t('Show updates in the notification bell.')} checked={draft.notifyInternal !== false} onChange={(value) => setDraft({ ...draft, notifyInternal: value })} />
        <Toggle label={t('System notifications')} hint={t('Show a notification on your desktop.')} checked={draft.notifySystem !== false} onChange={(value) => setDraft({ ...draft, notifySystem: value })} />
      </section>
      <footer className="routine-save-bar"><span className="muted small">{unsaved ? t('Unsaved changes') : t('All changes saved')}</span><button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { void go('routines'); }}>{t('Cancel')}</button><button type="submit" className="btn" disabled={busy || (!unsaved && Boolean(draft.id))}>{busy ? t('Saving…') : t('Save routine')}</button></footer>
    </form> : <>
      {area !== 'preferences' && <ListTools query={query} onQuery={setQuery} placeholder={area === 'routines' ? t('Find a routine…') : t('Search history or proposals…')}>{projectPicker}{area !== 'history' && <select aria-label={t('Filter by status')} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">{t('All statuses')}</option>{area === 'routines' ? <><option value="active">{t('Active')}</option><option value="paused">{t('Paused')}</option></> : <><option value="pending">{t('Needs your review')}</option><option value="other">{t('Other statuses')}</option></>}</select>}</ListTools>}
      {area === 'routines' && (filtered.length ? <ul className="routine-list">{filtered.map((row) => <li key={`${row.projectId}:${row.id}`} className="routine-card">
        <button type="button" className="routine-row" onClick={() => void open(row.projectId, row.id)}><span className="routine-row-icon"><IconRefresh size={18} /></span><span><strong>{row.name}</strong><span className="muted small">{row.projectName} · {scheduleLabel(row)}</span></span><IconChevron size={16} /></button>
        <div className="routine-row-meta"><span className={`routine-status ${row.enabled ? 'active' : ''}`}><i />{row.enabled ? t('Active') : t('Paused')}</span><span className="muted small">{row.schedule.kind === 'manual' ? t('Runs when you choose') : row.enabled ? t('Next: {when}', { when: when(row.nextRunAt) }) : t('Schedule paused')}</span></div>
        <div className="routine-row-actions"><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act(async () => { const run = await api.runRoutine(row.projectId, row.id); setNotice(run.status === 'failed' || run.status === 'interrupted' ? run.error : t('Check started. Follow its progress in History.')); })}><IconPlay size={14} />{t('Run now')}</button><details className="routine-menu"><summary aria-label={t('More actions for {name}', { name: row.name })}>•••</summary><div><button type="button" disabled={busy} onClick={() => void act(async () => { await api.setRoutineEnabled(row.projectId, row.id, !row.enabled); })}>{row.enabled ? t('Pause') : t('Resume')}</button><button type="button" disabled={busy} onClick={() => void act(async () => { await api.duplicateRoutine(row.projectId, row.id); setNotice(t('Routine duplicated.')); })}>{t('Duplicate')}</button><button type="button" disabled={busy} onClick={() => void act(async () => { if (await confirmDialog(t('Archive the routine "{name}"?', { name: row.name }))) await api.archiveRoutine(row.projectId, row.id); })}>{t('Archive')}</button></div></details></div>
      </li>)}</ul> : <EmptyState title={rows.length ? t('No matching routines') : t('Your next check can run itself.')} >{rows.length ? t('Try a different search or filter.') : t('Create a routine to watch a project and bring relevant changes to your attention.')}</EmptyState>)}
      {area === 'approvals' && (proposals.length ? <div className="routine-proposals">{proposals.map((p) => <details id={`proposal-${p.id}`} key={p.id} className="routine-proposal" open={selectedProposal === p.id} onToggle={(e) => { if (e.currentTarget.open) setSelectedProposal(p.id); }}>
        <summary><span><span className="muted small">{p.projectName} · {p.routineName}</span><strong>{p.summary}</strong></span><span className={`routine-status ${['pending', 'deferred'].includes(p.status) ? 'review' : ''}`}>{statusLabel(p.status)}</span><IconChevron size={16} /></summary>
        <div className="routine-proposal-body"><p className="muted small">{t('Source: {id} · version {version}', { id: p.sourceSnapshot.resourceId, version: p.sourceSnapshot.version || '—' })}</p>{p.justification && <p>{p.justification}</p>}{p.findings?.length ? <div className="routine-findings"><strong>{t('Analysis')}</strong><ul>{p.findings.map((finding, i) => <li key={i}>{finding.statement}</li>)}</ul></div> : null}
          {p.proposedChanges?.length ? <div className="routine-changes"><h3>{t('Proposed file changes')}</h3>{p.proposedChanges.map((change, i) => <details key={i}><summary>{change.path}</summary>{change.note && <p>{change.note}</p>}<pre>{change.nextText}</pre></details>)}</div> : <p className="muted small">{t('This is a finding to acknowledge. It does not change any file.')}</p>}
          {['pending', 'deferred'].includes(p.status) && <div className="routine-actions"><button type="button" className="btn btn-sm" disabled={busy} onClick={() => void act(async () => { if (p.proposedChanges?.length && !await confirmDialog(t('Apply the displayed changes to {n} files?', { n: p.proposedChanges.length }))) return; const decided = await api.decideProposal(p.projectId, p.routineId, p.id, 'approved'); if (['obsolete', 'apply-failed'].includes(decided.status)) throw new Error(decided.summary); setNotice(p.proposedChanges?.length ? t('Changes applied.') : t('Finding acknowledged.')); })}>{p.proposedChanges?.length ? t('Approve and apply') : t('Acknowledge finding')}</button><button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void act(async () => { await api.decideProposal(p.projectId, p.routineId, p.id, 'rejected'); })}>{t('Reject')}</button>{p.status !== 'deferred' && <button type="button" className="link small" disabled={busy} onClick={() => void act(async () => { await api.decideProposal(p.projectId, p.routineId, p.id, 'deferred'); })}>{t('Review later')}</button>}</div>}
        </div></details>)}</div> : <EmptyState title={t('Nothing waiting for your review')}>{t('Completed analyses will appear here when a routine finds something relevant.')}</EmptyState>)}
      {area === 'history' && (executions.length ? <ol className="routine-history">{executions.slice(0, 100).map((run) => <li key={run.id}><span className={`routine-history-dot ${run.status}`} /><div><div className="routine-history-title"><strong>{run.routineName}</strong><span className="routine-status">{statusLabel(run.status)}</span></div><span className="muted small">{run.projectName} · {when(run.startedAt)} · {run.triggerType === 'manual' ? t('Manual') : t('Scheduled')}</span>{run.resultSummary && <p>{run.resultSummary}</p>}{run.error && run.error !== run.resultSummary && <p className="warn-text">{run.error}</p>}{run.warnings.length > 0 && <ul className="small warn-text">{run.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}</div></li>)}</ol> : <EmptyState title={t('No checks yet')}>{t('Run a routine or let its schedule start the first check.')}</EmptyState>)}
      {area === 'preferences' && settings && <form className="routine-preferences" onSubmit={(e) => { e.preventDefault(); void act(async () => { const saved = await api.saveRoutineSettings(settings); setSettings(saved); setSavedSettings(JSON.stringify(saved)); setNotice(t('Preferences saved.')); }); }}>
        <section className="routine-section"><header><h2>{t('Let Moki take care of the schedule')}</h2><p className="muted small">{t('These preferences apply to routines in this workspace.')}</p></header><Toggle label={t('Scheduled checks')} hint={t('Turn off to pause schedules. You can still run a check manually.')} checked={!settings.schedulerPaused} onChange={(value) => setSettings({ ...settings, schedulerPaused: !value })} /><Toggle label={t('Keep Moki in the background')} hint={t('Closing the window keeps scheduled checks running. Quit Moki from its tray menu.')} checked={settings.background} onChange={(value) => setSettings({ ...settings, background: value })} /><Toggle label={t('Start Moki when you sign in')} checked={settings.openAtLogin} onChange={(value) => setSettings({ ...settings, openAtLogin: value })} /></section>
        <section className="routine-section"><header><h2>{t('Analysis and history limits')}</h2><p className="muted small">{t('Control how many analyses can run and how much history to keep.')}</p></header><div className="routine-fields"><label>{t('Concurrent AI analyses')}<input type="number" aria-label={t('Concurrent AI analyses')} min={0} max={20} required value={settings.maxAiCalls} onChange={(e) => setSettings({ ...settings, maxAiCalls: e.target.valueAsNumber })} /><span className="muted small">{t('Set to 0 to pause AI analysis. Monitoring continues.')}</span></label><label>{t('Runs to keep per routine')}<input type="number" min={5} max={200} required value={settings.retention} onChange={(e) => setSettings({ ...settings, retention: e.target.valueAsNumber })} /></label></div></section>
        <footer className="routine-save-bar"><span className="muted small">{JSON.stringify(settings) === savedSettings ? t('All changes saved') : t('Unsaved changes')}</span><button type="submit" className="btn" disabled={busy || JSON.stringify(settings) === savedSettings}>{busy ? t('Saving…') : t('Save preferences')}</button></footer>
      </form>}
    </>}
  </div>;
}
