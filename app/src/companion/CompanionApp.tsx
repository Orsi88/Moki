// Moki light: activities, agents, context, operations and runs for the connected project.
// The selected AI starts in a separate native chat; connection details and alternative
// launch routes are shown on demand, using the same request service as the desktop app.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { describeRun, statusLabel, type ActivityInfo, type AgentInfo, type InboxFile, type LaunchResult, type OpenRun, type OperationRun } from '../api';
import { activityFace, agentFace, skillFace } from '../catalog-copy';
import { conversationLanguage, t } from '../i18n';
import { remember } from '../prefs';
import { ACTIVITY_CAT } from '../icons/cats';
import { CatIcon } from '../components/CatIcon';
import { IconChevron, IconCopy, IconMcp, IconPlay, IconRefresh, IconStar } from '../components/Icons';
import { call, onVisible, setBadge } from './bridge';
import { OperationRunScreen, OperationStarter, visitText } from './Operations';
import { useShortlist } from './Shortlist';
import { Connections } from './Connections';
import type { IdeConnections, IdeChatResult } from '../../../ide/companion-types';

type Tab = 'activities' | 'agents' | 'context' | 'operations' | 'runs';
interface State { project: { id: string; name: string; description: string; repository: string } | null; projects: { id: string; name: string }[]; folder: string | null; mcp: { id: string; name: string; access: string; transport: string }[] }
interface ContextFile { id: string; path: string; title: string; description: string; kind: string; source: string; included: boolean; priority: boolean; folder: string; size: number }
interface Launch { activity: string; run?: string; agent?: string; needsFiles?: boolean; key: string }
type NoticeTone = 'success' | 'warn';

export function CompanionApp() {
  const [state, setState] = useState<State | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('activities');
  const [activities, setActivities] = useState<ActivityInfo[]>([]);
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [inbox, setInbox] = useState<InboxFile[]>([]);
  const [runs, setRuns] = useState<OpenRun[]>([]);
  const [operations, setOperations] = useState<OperationRun[]>([]);
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [open, setOpen] = useState<string>(''); // the card whose launch options are showing
  const [notice, setNotice] = useState<{ text: string; tone?: NoticeTone } | null>(null);
  const [connections, setConnections] = useState<IdeConnections | null>(null);
  const [showConnections, setShowConnections] = useState(false);
  const [selectingAi, setSelectingAi] = useState(false);
  const [switchingProject, setSwitchingProject] = useState(false);
  const generation = useRef(0);
  const [openRun, setOpenRun] = useState(''); // the operation run whose screen is showing
  const [tick, setTick] = useState(0); // counts reloads, so an open run screen reloads with the rest
  // Run updates not seen yet: each run's last seen state, per project (kept in this webview's storage).
  const [visible, setVisible] = useState(true);
  useEffect(() => onVisible(setVisible), []);
  const [seen, setSeen] = useState<Record<string, string> | null>(null);

  const shownActivities = useShortlist('activities', useMemo(() => activities.filter((a) => a.available && a.id !== 'resume'), [activities]), (a) => a.id, (a) => { const face = activityFace(a.id, a.label, a.hint); return `${face.label} ${face.hint} ${t(a.label)}`; });
  const shownAgents = useShortlist('agents', agents, (a) => a.name, (a) => { const face = agentFace(a.name, a.description); return `${face.label} ${face.hint} ${a.name} ${a.description}`; });
  const fail = (e: unknown) => setNotice({ text: e instanceof Error ? e.message : String(e), tone: 'warn' });
  const notify = useCallback((text: string, warn?: boolean) => setNotice({ text, tone: warn ? 'warn' : undefined }), []);
  const load = useCallback(() => {
    const current = ++generation.current;
    const update = <T,>(fn: (value: T) => void) => (value: T) => { if (generation.current === current) fn(value); };
    const error = update(fail);
    setLoadError('');
    setTick((n) => n + 1);
    call<State>('state').then((s) => {
      if (generation.current !== current) return;
      setState(s);
      setSwitchingProject(false);
      if (!s.project) { setConnections(null); return; }
      call<IdeConnections>('connections').then(update((value) => { if (Array.isArray(value.choices)) setConnections(value); })).catch(error);
      call<{ activities: ActivityInfo[]; languages: string[] }>('activities').then(update((a) => { setActivities(a.activities); setLanguages(a.languages); })).catch(error);
      call<AgentInfo[]>('agents').then(update(setAgents)).catch(error);
      call<InboxFile[]>('inbox').then(update(setInbox)).catch(update(() => setInbox([])));
      call<OpenRun[]>('openRuns').then(update(setRuns)).catch(update(() => setRuns([])));
      call<OperationRun[]>('operationRuns').then(update(setOperations)).catch(update(() => setOperations([])));
      call<ContextFile[]>('context').then(update(setFiles)).catch(error);
    }).catch(update((e: unknown) => { setLoadError(e instanceof Error ? e.message : String(e)); setSwitchingProject(false); }));
  }, []);
  useEffect(() => { load(); return window.qa?.onChanged(() => load()); }, [load]);

  const choose = (id: string) => {
    ++generation.current; setSwitchingProject(true); setConnections(null); setShowConnections(false); setOpen(''); setOpenRun(''); setNotice(null);
    setActivities([]); setAgents([]); setInbox([]); setRuns([]); setOperations([]); setFiles([]);
    call('chooseProject', id).then(load).catch((e: unknown) => { setSwitchingProject(false); fail(e); });
  };
  const selectAi = async (id: string) => {
    const current = generation.current;
    setSelectingAi(true);
    try { const value = await call<IdeConnections>('selectAi', id); if (current === generation.current) setConnections(value); }
    catch (e) { if (current === generation.current) fail(e); }
    finally { setSelectingAi(false); }
  };

  // What is seen: the first time, everything listed; then the Runs list while it is on screen, and the run whose screen is open.
  const project = state?.project?.id ?? '';
  useEffect(() => {
    if (!project) return;
    const now = runStates(operations, runs);
    const key = `moki-seen:${project}`;
    let known: Record<string, string> | null = null;
    try { known = JSON.parse(localStorage.getItem(key) ?? 'null') as Record<string, string> | null; } catch { /* storage off */ }
    const next = { ...(known ?? now) };
    if (visible && tab === 'runs') {
      if (openRun) { if (now[openRun]) next[openRun] = now[openRun]; } else Object.assign(next, now);
    }
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage off */ }
    setSeen(next);
    setBadge(Object.keys(now).filter((id) => next[id] !== now[id]).length);
  }, [project, operations, runs, visible, tab, openRun]);

  const loadFailure = loadError && <div className="result warn" role="alert">
    <p className="result-title">{t(loadError)}</p>
    <button type="button" className="btn btn-ghost btn-sm" onClick={load}>{t('Try again')}</button>
  </div>;
  if (!state) return <div className="mk">{loadFailure
    ? <div className="mk-empty">{loadFailure}</div>
    : <p className="mk-empty muted">{t('Loading…')}</p>}</div>;

  const header = (
    <header className="mk-head">
      {/* The view's title already says Moki: here only whether a project is connected, and which. */}
      <span className={`mk-dot${state.project ? ' on' : ''}`} role="img"
        aria-label={state.project ? t('Connected') : t('No project')} title={state.project ? t('Connected') : t('No project')} />
      <select value={state.project?.id ?? ''} disabled={switchingProject} onChange={(e) => choose(e.target.value)} aria-label={t('Project')}>
        {!state.project && <option value="">{t('Choose a project')}</option>}
        {state.projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </header>
  );

  if (switchingProject) return <div className="mk">{header}<p className="mk-empty muted">{t('Loading…')}</p></div>;

  if (!state.project) {
    return (
      <div className="mk">
        {header}
        {loadFailure}
        <div className="mk-empty">
          <CatIcon id="question" size={72} />
          <p><strong>{t('This folder is not linked to a Moki project.')}</strong></p>
          <p className="muted small">{state.projects.length
            ? t('Choose a project above. To link this folder for good, use the link button of the ribbon in the Moki app.')
            : t('Create a project here to use its context, activities and tools.')}</p>
          <button type="button" className="btn" onClick={() => { void call('createProject').then(load).catch(fail); }}>{t('Create project')}</button>
        </div>
      </div>
    );
  }

  const included = files.filter((f) => f.included).length;
  const states = runStates(operations, runs);
  const fresh = seen ? Object.keys(states).filter((id) => seen[id] !== states[id]) : [];
  const openOps = operations.filter((o) => !['completed', 'cancelled'].includes(o.status)).length;
  const toggle = (key: string) => { setOpen((o) => (o === key ? '' : key)); setNotice(null); };
  const launchBox = (l: Launch) => open === l.key && (
    <LaunchBox key={`${project}:${l.key}:${connections?.ai ?? ''}`} launch={l} connections={connections} inbox={inbox} languages={languages} agents={l.agent || l.run ? [] : agents.filter((a) => !l.activity || a.skills.includes(activities.find((x) => x.id === l.activity)?.skill ?? ''))}
      onDone={(text, tone) => setNotice({ text, tone })} />
  );

  return (
    <div className="mk">
      {header}
      <div className="mk-ai-bar">
        <label htmlFor="moki-ai">{t('AI')}</label>
        <select id="moki-ai" value={connections?.ai ?? ''} disabled={selectingAi} onChange={(e) => { void selectAi(e.target.value); }}>
          <option value="" disabled>{t('Choose your AI')}</option>
          {(connections?.choices ?? []).map((ai) => <option key={ai.id} value={ai.id}>{ai.label}</option>)}
        </select>
      </div>
      <div className="dialog-tabs mk-tabs" role="tablist">
        {([['activities', t('Activities')], ['agents', t('Agents')], ['context', t('Context')], ['operations', t('Operations')], ['runs', t('Runs')]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`dialog-tab${tab === id ? ' on' : ''}`} onClick={() => { setTab(id); setOpen(''); }}>
            {label}{id === 'runs' && runs.length + openOps > 0 && <span className="mk-count">{runs.length + openOps}</span>}
            {id === 'runs' && fresh.length > 0 && <span className="mk-new" role="img" aria-label={t('Updates not seen')} title={t('Updates not seen')} />}
          </button>
        ))}
      </div>

      <main className="mk-body">
        {showConnections && connections && <Connections key={`${project}:${connections.ai}:${connections.folder}`} value={connections} onChange={setConnections} onClose={() => setShowConnections(false)} />}
        {loadFailure}
        {notice && <div className={`result${notice.tone ? ` ${notice.tone}` : ''}`} role="status"><p className="result-title">{notice.text}</p></div>}

        {tab === 'activities' && (
          <div className="mk-list">
            {shownActivities.search}
            {shownActivities.shown.map((a) => (
              <Card key={a.id} star={shownActivities.star(a.id, activityFace(a.id, a.label, a.hint).label)} on={open === a.id} icon={<CatIcon id={ACTIVITY_CAT[a.id] ?? 'puzzle'} size={40} />} title={activityFace(a.id, a.label, a.hint).label} hint={activityFace(a.id, a.label, a.hint).hint} onPick={() => toggle(a.id)}>
                {launchBox({ key: a.id, activity: a.id, needsFiles: a.needsFiles })}
              </Card>
            ))}
          </div>
        )}

        {tab === 'agents' && (
          <div className="mk-list">
            {!agents.length && <p className="muted small">{t('No agents are enabled in this project. Choose them in the Moki app (Set up project).')}</p>}
            {shownAgents.search}
            {shownAgents.shown.map((a) => (
              <Card key={a.name} star={shownAgents.star(a.name, agentFace(a.name, a.description).label)} on={open === `agent:${a.name}`} icon={<CatIcon id="robot" size={40} />} title={agentFace(a.name, a.description).label} hint={agentFace(a.name, a.description).hint} onPick={() => toggle(`agent:${a.name}`)}
                chips={a.skills.map((name) => skillFace(name).label)}>
                {launchBox({ key: `agent:${a.name}`, activity: 'open', agent: a.name })}
              </Card>
            ))}
          </div>
        )}

        {tab === 'context' && (
          <ContextTab files={files} included={included} onChange={setFiles} onError={fail}
            onPrepare={() => {
              // The activity that writes the context: planning with the AI for a blank project, else preparing or updating it.
              const id = ['plan', 'setup', 'context'].find((a) => activities.some((x) => x.id === a && x.available));
              setTab('activities'); setOpen(id ?? '');
            }} />
        )}

        {tab === 'operations' && (
          <div className="mk-list">
            <p className="muted small">{t('Pick an operation, choose the AI of each step and start it: each step opens in its own terminal and the next one starts when it delivers. Follow it in Runs.')}</p>
            <OperationStarter inbox={inbox} notify={notify} onStarted={(id) => { setOpenRun(id); setTab('runs'); load(); }} />
          </div>
        )}

        {tab === 'runs' && !openRun && (
          <div className="mk-list">
            {!runs.length && !operations.length && <p className="muted small">{t('Nothing in progress in this project.')}</p>}
            {operations.length > 0 && <h3 className="mk-section">{t('Operations')}</h3>}
            {operations.map((o) => {
              const v = o.visits.at(-1);
              const agent = v ? o.steps.find((s) => s.id === v.step)?.name ?? v.step : '';
              return (
                <Card key={o.id} on={false} fresh={fresh.includes(o.id)} icon={<CatIcon id="flow" size={40} />} title={o.operation.name}
                  hint={v && !o.ended ? `${agent}: ${visitText(v)}` : describeRun(o.id).date} pill={o.paused ? t('Paused') : statusLabel(o.status)} onPick={() => setOpenRun(o.id)} />
              );
            })}
            {runs.length > 0 && <h3 className="mk-section">{t('Activities to resume')}</h3>}
            {runs.map((r) => (
              <Card key={r.id} on={open === `run:${r.id}`} fresh={fresh.includes(r.id)} icon={<CatIcon id="run" size={40} />} title={describeRun(r.id).title}
                hint={`${describeRun(r.id).date}${r.currentStep ? ` · ${t('stopped at:')} ${r.currentStep}` : ''}`} pill={statusLabel(r.status)} onPick={() => toggle(`run:${r.id}`)}>
                {launchBox({ key: `run:${r.id}`, activity: 'resume', run: r.id })}
              </Card>
            ))}
          </div>
        )}
        {tab === 'runs' && openRun && <OperationRunScreen runId={openRun} tick={tick} notify={notify} onBack={() => { setOpenRun(''); load(); }} />}
      </main>

      <footer className="mk-foot">
        <button type="button" className="mk-mcp link" aria-expanded={showConnections} onClick={() => setShowConnections((v) => !v)}><IconMcp size={14} /> {t('Connections')}</button>
        <button type="button" className="icon-btn" onClick={load} title={t('Refresh')} aria-label={t('Refresh')}><IconRefresh size={14} /></button>
      </footer>
    </div>
  );
}

// Each run's state as a short text: a change means something happened (a step moved on, asked, finished…).
function runStates(operations: OperationRun[], runs: OpenRun[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const o of operations) { const v = o.visits.at(-1); out[o.id] = `${o.status}|${o.paused}|${o.visits.length}|${v?.status ?? ''}|${v?.outcome ?? ''}`; }
  for (const r of runs) out[r.id] = `${r.status}|${r.currentStep}`;
  return out;
}

function Card({ star, on, fresh = false, icon, title, hint, pill, chips, onPick, children }: { star?: ReactNode; on: boolean; fresh?: boolean; icon: ReactNode; title: string; hint: string; pill?: string; chips?: string[]; onPick?: () => void; children?: ReactNode }) {
  return (
    <div className={`mk-card${on ? ' on' : ''}${fresh ? ' fresh' : ''}`}>
      <button type="button" className="mk-card-head" onClick={onPick} disabled={!onPick} aria-expanded={onPick ? on : undefined}>
        <span className="mk-card-icon">{icon}</span>
        <span className="mk-card-text">
          <span className="mk-card-title">{title}</span>
          {pill && <span className="pill mk-pill">{pill}</span>}
          {hint && <span className="mk-card-hint">{hint}</span>}
          {chips && chips.length > 0 && <span className="mk-chips">{chips.map((c) => <span key={c} className="mk-chip">{c}</span>)}</span>}
        </span>
      </button>
      {star && <span className="mk-star">{star}</span>}
      {children}
    </div>
  );
}

// What the request needs: inbox files, an agent, a note and the language.
function LaunchBox({ launch, connections, inbox, languages, agents, onDone }: { launch: Launch; connections: IdeConnections | null; inbox: InboxFile[]; languages: string[]; agents: AgentInfo[]; onDone: (text: string, tone?: NoticeTone) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [agent, setAgent] = useState(launch.agent ?? '');
  const [note, setNote] = useState('');
  const [language, setLanguage] = useState(conversationLanguage);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const done = (text: string, tone?: NoticeTone) => { if (live.current) onDone(text, tone); };
  const sending = useRef(false);
  const attempt = useRef({ signature: '', id: '' });
  const missingFiles = Boolean(launch.needsFiles && !picked.length);
  const input = { activity: launch.activity, run: launch.run, agent: agent || undefined, files: picked, note, language };

  const go = async (where: 'terminal' | 'chat') => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    remember('qa-language', language);
    try {
      if (where === 'terminal') {
        const r = await call<LaunchResult>('launch', { ...input, ai: connections?.ai });
        done(r.message ?? (r.opened ? t('The AI is opening in a terminal.') : t('The AI could not open.')), r.opened ? undefined : 'warn');
      } else {
        const signature = JSON.stringify({ ...input, ai: connections?.ai });
        if (attempt.current.signature !== signature) attempt.current = { signature, id: crypto.randomUUID().replaceAll('-', '') };
        const r = await call<IdeChatResult>('startChat', { ...input, ai: connections?.ai, requestId: attempt.current.id });
        done(t(r.message), r.status === 'blocked' ? 'warn' : undefined);
        if (r.status === 'blocked' || r.status === 'submitted' || r.session) attempt.current.signature = '';
        if (live.current && (r.status === 'submitted' || r.session)) setStarted(true);
      }
    } catch (e) { done(e instanceof Error ? e.message : String(e), 'warn'); } finally { sending.current = false; if (live.current) setBusy(false); }
  };

  return (
    <div className="mk-launch">
      {(launch.needsFiles || (inbox.length > 0 && !launch.run)) && (
        <div className="field">
          <span className="label">{launch.needsFiles ? t('Files from the inbox') : t('Files from the inbox (optional)')}</span>
          {inbox.length ? (
            <ul className="mk-files">
              {inbox.map((f) => (
                <li key={f.name}><label><input type="checkbox" checked={picked.includes(f.name)} onChange={() => setPicked((p) => (p.includes(f.name) ? p.filter((x) => x !== f.name) : [...p, f.name]))} /> <span title={f.name}>{f.name}</span></label></li>
              ))}
            </ul>
          ) : <span className="muted small">{t('The project inbox is empty: put the stories, logs or documents in its inbox folder.')}</span>}
        </div>
      )}
      {agents.length > 0 && (
        <label className="field"><span className="label">{t('Agent (optional)')}</span>
          <select value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">{t('No agent')}</option>
            {agents.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
          </select>
        </label>
      )}
      <label className="field"><span className="label">{t('Note (optional)')}</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Anything the AI should know')} />
      </label>
      <label className="field"><span className="label">{t('Language')}</span>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>{languages.map((l) => <option key={l} value={l}>{t(l)}</option>)}</select>
      </label>
      <div className="mk-actions">
        <button type="button" className="btn" disabled={busy || missingFiles || !connections?.choices.find((ai) => ai.id === connections.ai)?.automatic} onClick={() => { void go('chat'); }}><IconPlay size={14} /> {busy ? t('Starting…') : started ? t('Start another chat') : t('Start in a new chat')}</button>
        {connections?.ai && !connections.choices.find((ai) => ai.id === connections.ai)?.automatic && <p className="muted small">{t(connections.choices.find((ai) => ai.id === connections.ai)?.reason ?? '')}</p>}
        <details className="mk-alternatives"><summary>{t('Other ways to start')}</summary>
          <button type="button" className="btn btn-ghost" disabled={busy || missingFiles} onClick={() => { void go('terminal'); }}>{t('Open {tool} in a terminal', { tool: connections?.ai === 'codex' ? 'Codex' : connections?.ai === 'cursor' ? 'Cursor Agent' : 'Claude Code' })}</button>
          <button type="button" className="btn btn-ghost" disabled={busy || missingFiles} onClick={() => { void call('copyRequest', input).then(() => done(t('Request copied. Paste it in the chat of your AI.'), 'success')).catch((e: unknown) => done(e instanceof Error ? e.message : String(e), 'warn')); }}><IconCopy size={14} /> {t('Copy for the chat')}</button>
        </details>
      </div>
      {missingFiles && <span className="muted small">{t('Choose at least one file.')}</span>}
    </div>
  );
}

// Roughly what a text costs the AI: about four characters per token, shown short ("≈ 1.2K tokens").
const tokens = (bytes: number): string => new Intl.NumberFormat(document.documentElement.lang || 'en', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(1, Math.round(bytes / 4)));
// Moki's folders by meaning, in this order; the person's own folders come after them by name, then loose files,
// deliverables and what other projects share by tags.
const FOLDER_ORDER = ['context', 'notes', 'inbox'];
const FOLDER_LABEL: Record<string, string> = { context: 'Project context', notes: 'Notes', inbox: 'Inbox', runs: 'Deliveries', '': 'Other files', '\0shared': 'Shared by tags' };

// "What the AI sees": one row per folder with a checkbox (partly checked when some of its files are left out),
// how many files and roughly how many tokens; the files show only when the folder is opened, each with a quiet
// "leave out" / "let in" exception and the priority star.
function ContextTab({ files, included, onChange, onError, onPrepare }: { files: ContextFile[]; included: number; onChange: (f: ContextFile[]) => void; onError: (e: unknown) => void; onPrepare: () => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const groups = useMemo(() => {
    const by = new Map<string, ContextFile[]>();
    for (const f of files) { const key = f.kind === 'shared' ? '\0shared' : f.folder; by.set(key, [...(by.get(key) ?? []), f]); }
    const own = [...by.keys()].filter((k) => k && k !== 'runs' && k !== '\0shared' && !FOLDER_ORDER.includes(k)).sort((a, b) => a.localeCompare(b));
    return [...FOLDER_ORDER, ...own, '', 'runs', '\0shared'].filter((k) => by.has(k)).map((key) => {
      const items = by.get(key)!;
      const on = items.filter((f) => f.included);
      return { key, label: key in FOLDER_LABEL ? t(FOLDER_LABEL[key]) : key, yours: own.includes(key), items, on: on.length, size: on.reduce((n, f) => n + f.size, 0) };
    });
  }, [files]);
  const total = groups.reduce((n, g) => n + g.size, 0);
  const run = (work: () => Promise<ContextFile[]>) => { setBusy(true); work().then(onChange).catch(onError).finally(() => setBusy(false)); };
  const set = (method: string, id: string, on: boolean) => run(() => call<ContextFile[]>(method, id, on));
  // The shared files are not a folder of this project: each one is switched.
  const setGroup = (g: (typeof groups)[number], on: boolean) => run(async () => {
    if (g.key !== '\0shared') return call<ContextFile[]>('setFolder', g.key, on);
    let last = files;
    for (const f of g.items) if (f.included !== on) last = await call<ContextFile[]>('setIncluded', f.id, on);
    return last;
  });
  const toggleOpen = (key: string) => setOpen((s) => { const n = new Set(s); if (!n.delete(key)) n.add(key); return n; });
  if (!files.length) {
    return (
      <div className="mk-empty mk-empty-inline">
        <CatIcon id="reading" size={64} />
        <p><strong>{t('This project has no context yet.')}</strong></p>
        <p className="muted small">{t('It was created blank, or its context was never prepared. The AI writes it from the project\'s description and the documents in its inbox; then the files show up here.')}</p>
        <button type="button" className="btn" onClick={onPrepare}>{t('Prepare the context with the AI')}</button>
      </div>
    );
  }
  return (
    <div className="mk-list">
      <p className="mk-summary"><strong>{t('{n} of {total} files go to the AI', { n: included, total: files.length })}</strong>
        {total > 0 && <span className="muted"> · {t('≈ {n} tokens', { n: tokens(total) })}</span>}</p>
      <p className="muted small">{t('Check a folder to give it to the AI. Open it to leave a file out or to give one to the AI first (star).')}</p>
      <ul className="mk-folders" aria-busy={busy}>
        {groups.map((g) => {
          const all = g.on === g.items.length, none = g.on === 0, expanded = open.has(g.key);
          return (
            <li key={g.key} className={`mk-folder${none ? ' off' : ''}`}>
              <div className="mk-folder-row">
                <input type="checkbox" checked={all} disabled={busy} aria-label={t('{folder} goes to the AI', { folder: g.label })}
                  ref={(el) => { if (el) el.indeterminate = !all && !none; }} onChange={() => setGroup(g, !all)} />
                <button type="button" className="mk-folder-name" aria-expanded={expanded} onClick={() => toggleOpen(g.key)}>
                  <IconChevron size={12} />
                  <span className="mk-folder-label">{g.label}</span>
                  {g.yours && <span className="mk-folder-tag">{t('your folder')}</span>}
                </button>
                <span className="mk-folder-meta">
                  {g.items.length === 1 ? t('1 file') : t('{n} files', { n: g.items.length })}{g.size > 0 && <> · {t('≈ {n} tokens', { n: tokens(g.size) })}</>}
                  {!all && !none && <> · {t('{n} left out', { n: g.items.length - g.on })}</>}
                </span>
              </div>
              {expanded && (
                <ul className="mk-folder-files">
                  {g.items.map((f) => (
                    <li key={f.id} className={f.included ? '' : 'off'}>
                      <span className="mk-ctx-text">
                        <span className="mk-ctx-name" title={f.id}>{g.key === '\0shared' ? f.title : g.key ? f.path.slice(g.key.length + 1) : f.path}</span>
                        {f.description && <span className="mk-card-hint">{f.description}</span>}
                      </span>
                      <button type="button" className="link mk-file-toggle" disabled={busy} onClick={() => set('setIncluded', f.id, !f.included)}>
                        {f.included ? t('Leave out') : t('Let in')}
                      </button>
                      <button type="button" className={`icon-btn${f.priority ? ' accent' : ''}`} disabled={busy} onClick={() => set('setPriority', f.id, !f.priority)}
                        title={f.priority ? t('Priority: the AI reads it first') : t('Make it a priority')} aria-pressed={f.priority}><IconStar size={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

