// Project panel: one Call picker for activities, agents, skills and operations, plus the project's details and executions.

import { useEffect, useState, type ReactNode } from 'react';
import { api, describeRun, statusLabel, type OpenRun, type ProjectSummary, type RunState, type LaunchPreset, type ToolInfo } from '../api';
import { t } from '../i18n';
import { preferredTool } from '../prefs';
import { IconCheck, IconChevron, IconEdit, IconGraph, IconPanel, IconPlay, IconX } from './Icons';
import { AiPick, QUICK_KINDS } from './ToolCatalog';
import { pluginList } from './SkillsDialog';

interface Props {
  project: ProjectSummary;
  runId: string | null;
  refreshKey: number;
  tools: ToolInfo[];
  onOpenPath: (path: string) => void;
  onLaunch: (preset?: LaunchPreset) => void;
  onOperationRun: (run: string) => void;
  onOpenRun: (run: string) => void; // a run from this panel opens in the main area
  onSetup: () => void; // description and the global skills the project uses
  onProjectChanged: () => void;
  collapsed: boolean; // shown as a thin rail
  onToggle: () => void; // collapse / expand
  graphOn: boolean;
  onGraph: () => void;
  onMyAis: () => void; // Settings › My AIs
  operations?: ReactNode; // the Operations card (OperationsPanel), below everything, taking the room left
}

const statusDot = (s: string): string => (s === 'completed' ? 'dot-ok' : s === 'cancelled' ? 'dot-muted' : s === 'blocked' ? 'dot-err' : 'dot-warn');
const NEEDS_YOU = ['awaiting-approval', 'awaiting-input', 'blocked'];

export function SidePanel({ project, runId, refreshKey, tools, onOpenPath, onLaunch, onOperationRun, onOpenRun, onSetup, onProjectChanged, collapsed, onToggle, graphOn, onGraph, onMyAis, operations }: Props) {
  const [run, setRun] = useState<RunState | null>(null);
  const [runs, setRuns] = useState<OpenRun[]>([]);
  const [planPending, setPlanPending] = useState(false); // the AI left a plan.json to review
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(project.name);
  const [descriptionMode, setDescriptionMode] = useState<'closed' | 'view' | 'edit'>('closed');
  const [descriptionDraft, setDescriptionDraft] = useState(project.description);
  const [savingProject, setSavingProject] = useState(false);
  const [projectError, setProjectError] = useState('');
  const quick = tools.filter((x) => x.available && QUICK_KINDS.includes(x.kind));
  // Starts on the default AI (Settings › My AIs); another choice here is for this panel only.
  // It is the one AI of the card: calling an agent and starting an activity use the same pick.
  const [toolId, setToolId] = useState('');
  const tool = quick.find((x) => x.id === toolId) ?? preferredTool(quick);
  const [launchMsg, setLaunchMsg] = useState('');
  const [pluginOn, setPluginOn] = useState<string[]>(project.plugins);
  const [pluginBusy, setPluginBusy] = useState(false);
  useEffect(() => { setPluginOn(project.plugins); }, [project.id, project.plugins]);

  useEffect(() => {
    if (runId) api.run(project.id, runId).then(setRun).catch(() => setRun(null));
    else setRun(null);
  }, [project.id, runId, refreshKey]);

  useEffect(() => {
    api.openRuns(project.id).then(setRuns).catch(() => setRuns([]));
    api.readPlan(project.id).then((p) => setPlanPending(Boolean(p && !p.approved))).catch(() => setPlanPending(false));
  }, [project.id, refreshKey]);

  const pickTool = (id: string) => { setToolId(id); setLaunchMsg(''); };
  const saveProject = async (field: 'name' | 'description') => {
    setSavingProject(true); setProjectError('');
    try {
      if (field === 'name') await api.setProjectName(project.id, nameDraft);
      else await api.setProjectDescription(project.id, descriptionDraft);
      onProjectChanged();
      if (field === 'name') setEditingName(false); else setDescriptionMode('closed');
    } catch (e) { setProjectError(e instanceof Error ? e.message : String(e)); }
    finally { setSavingProject(false); }
  };

  const togglePlugin = (name: string) => {
    const next = pluginOn.includes(name) ? pluginOn.filter((p) => p !== name) : [...pluginOn, name];
    setPluginOn(next);
    setPluginBusy(true);
    api.setProjectPlugins(project.id, next).then(() => onProjectChanged()).catch((e: Error) => { setPluginOn(project.plugins); setLaunchMsg(e.message); }).finally(() => setPluginBusy(false));
  };

  const prefix = `workspace/projects/${project.id}/`;
  const local = (p: string) => (p.startsWith(prefix) ? p.slice(prefix.length) : null);

  const needsYou = runs.filter((r) => NEEDS_YOU.includes(r.status));
  const collapseBtn = <button type="button" className="icon-btn pp-collapse" onClick={onToggle} title={t('Collapse the panel')} aria-label={t('Collapse the panel')} aria-expanded="true"><IconPanel size={16} /></button>;

  if (collapsed) {
    return (
      <aside className="panel panel-rail" aria-label={t('Project panel')}>
        <button type="button" className="icon-btn" onClick={onToggle} title={t('Expand the panel')} aria-label={t('Expand the panel')} aria-expanded="false"><IconPanel size={17} /></button>
        <button type="button" className="icon-btn accent" onClick={() => onLaunch({ tool: tool?.id })} title={t('Call…')} aria-label={t('Call…')}><IconPlay size={17} /></button>
        <button type="button" className={`icon-btn${graphOn ? ' on' : ''}`} onClick={onGraph} title={t('Graph view')} aria-label={t('Graph view')} aria-pressed={graphOn}><IconGraph size={17} /></button>
        {needsYou.length > 0 && (
          <button type="button" className="rail-badge" onClick={onToggle} title={t('{n} need you', { n: needsYou.length })}>{needsYou.length}</button>
        )}
        {launchMsg && <span className="rail-msg-dot" title={launchMsg} />}
      </aside>
    );
  }

  if (run?.operation) {
    const info = describeRun(run.id);
    return (
      <aside className="panel run-detail" aria-label={t('Operation')}>
        <header className="run-detail-head">
          <div className="pp-label-row"><div className="panel-label">{t('Operation')}</div>{collapseBtn}</div>
          <h2 className="panel-title">{run.operation.name}</h2>
          <p className="muted small">{info.date}</p>
          <span className={`pill pill-${run.status}`}>{statusLabel(run.status)}</span>
        </header>
        {run.currentStep && <section className="run-detail-current"><span className="muted small">{t('Current step:')}</span><strong>{run.currentStep}</strong></section>}

        <button type="button" className="btn btn-block" onClick={() => onOperationRun(run.id)}><IconPlay size={15} /> {t('Open operation')}</button>

        {Boolean(run.completedSteps?.length) && (
          <section className="panel-section">
            <h3>{t('Completed steps')}</h3>
            <div className="chips">{run.completedSteps?.map((s) => <span key={s} className="chip">{s}</span>)}</div>
          </section>
        )}
        {Boolean(run.pending?.length) && (
          <section className="panel-section">
            <h3>{t('Pending ({n})', { n: run.pending?.length ?? 0 })}</h3>
            <ul className="panel-list">{run.pending?.map((p) => <li key={p.id}><strong>{p.id}</strong> {p.description}</li>)}</ul>
          </section>
        )}
        {Boolean(run.approvals?.length) && (
          <section className="panel-section">
            <h3>{t('Approvals')}</h3>
            <ul className="panel-list">{run.approvals?.map((a, i) => <li key={`${a.step}-${i}`}><strong>{a.step}</strong> — {a.decision}{a.notes ? ` (${a.notes})` : ''}</li>)}</ul>
          </section>
        )}
        {Boolean(run.artifacts?.length) && (
          <section className="panel-section">
            <h3>{t('Files produced')}</h3>
            <ul className="panel-list links">
              {run.artifacts?.map((a) => {
                const rel = local(a);
                const parts = rel?.split('/') ?? [];
                return <li key={a}>{rel ? <button type="button" className="run-detail-file" title={rel} onClick={() => onOpenPath(rel)}><span>{parts.pop()}</span><small>{parts.join('/')}</small></button> : <span className="muted">{a}</span>}</li>;
              })}
            </ul>
          </section>
        )}
      </aside>
    );
  }

  return (
    <aside className="panel pp">
      <header className="pp-head">
        <div className="pp-label-row"><div className="panel-label">{t('Project')}</div>{collapseBtn}</div>
        <div className="pp-title-row">
          {editingName ? <form className="pp-name-form" onSubmit={(e) => { e.preventDefault(); void saveProject('name'); }}>
            <input aria-label={t('Project name')} autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setEditingName(false); setProjectError(''); } }} />
            <button type="submit" className="icon-btn" title={t('Save')} aria-label={t('Save')} disabled={savingProject || !nameDraft.trim()}><IconCheck size={15} /></button>
            <button type="button" className="icon-btn" title={t('Cancel')} aria-label={t('Cancel')} disabled={savingProject} onClick={() => { setEditingName(false); setProjectError(''); }}><IconX size={15} /></button>
          </form> : <>
            <h2 className="panel-title">{project.name}</h2>
            <button type="button" className="icon-btn pp-edit" onClick={() => { setNameDraft(project.name); setProjectError(''); setEditingName(true); }} title={t('Edit project name')} aria-label={t('Edit project name')}><IconEdit size={15} /></button>
          </>}
        </div>
        {project.description
          ? <><p className="pp-desc small">{project.description}</p><button type="button" className="link small pp-description-link" onClick={() => { setProjectError(''); setDescriptionMode('view'); }}>{t('See full description…')}</button></>
          : <button type="button" className="link small pp-description-link" onClick={() => { setDescriptionDraft(project.description); setProjectError(''); setDescriptionMode('edit'); }}>{t('Add a description')}</button>}
        {descriptionMode !== 'closed' && <div className="pp-description-card" role="region" aria-label={t('Description')}>
          <div className="pp-description-head"><strong>{t('Description')}</strong><button type="button" className="icon-btn" title={t('Close')} aria-label={t('Close')} disabled={savingProject} onClick={() => { setDescriptionMode('closed'); setProjectError(''); }}><IconX size={15} /></button></div>
          {descriptionMode === 'view' ? <><p className="pp-description-full">{project.description}</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDescriptionDraft(project.description); setDescriptionMode('edit'); }}>{t('Edit description')}</button></>
            : <form onSubmit={(e) => { e.preventDefault(); void saveProject('description'); }}>
              <textarea aria-label={t('Description')} autoFocus rows={4} maxLength={2000} value={descriptionDraft} onChange={(e) => setDescriptionDraft(e.target.value)} />
              <div className="form-actions"><button type="button" className="btn btn-ghost btn-sm" disabled={savingProject} onClick={() => { setDescriptionMode('closed'); setProjectError(''); }}>{t('Cancel')}</button><button type="submit" className="btn btn-sm" disabled={savingProject}>{savingProject ? t('Saving…') : t('Save')}</button></div>
            </form>}
        </div>}
        {projectError && <p className="error small" role="alert">{projectError}</p>}
      </header>

      {planPending && <button type="button" className="pp-banner" onClick={onSetup}>{t('The AI proposed a plan — review it')}<IconChevron size={14} /></button>}

      <section className="pp-card" aria-label={t('AI assistant')}>
        <button type="button" className="btn btn-block" onClick={() => onLaunch({ tool: tool?.id })} title={t('Call… (Ctrl+Shift+K / ⌘⇧K)')}>
          <IconPlay size={15} /> {t('Call…')}
        </button>
        {tool ? <AiPick label={t('In')} tools={tools} value={tool.id} onChange={pickTool} onInstall={onMyAis} />
          : <p className="pp-hint">{t('No AI tool found on this computer.')} <button type="button" className="link" onClick={onMyAis}>{t('Install in Settings › My AIs')}</button></p>}
        {launchMsg && <p className="pp-msg" role="status">{launchMsg}</p>}
        <details className="pp-plugins">
          <summary>{t('Plugins')}</summary>
          {pluginList().filter((p) => p.optional).map((p) => (
            <label key={p.name} className="check-row" title={p.text}>
              <input type="checkbox" checked={pluginOn.includes(p.name)} disabled={pluginBusy} onChange={() => togglePlugin(p.name)} />
              <span>{p.name}</span>
            </label>
          ))}
          <p className="pp-hint">{t('When on, these load in every AI session opened from this project.')}</p>
        </details>
      </section>

      {needsYou.length > 0 && (
        <section className="panel-section pp-needs">
          <h3>{t('Needs you')}</h3>
          <ul className="pp-runs">
            {needsYou.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpenRun(r.id)} title={r.currentStep || undefined}>
                  <span className={`dot ${statusDot(r.status)}`} />
                  <span className="pp-run-title">{describeRun(r.id).title}</span>
                  <span className="pp-run-status">{statusLabel(r.status)}</span>
                </button>
                {r.status !== 'blocked' && (
                  <button type="button" className="pp-resume" onClick={() => onLaunch({ activity: 'resume', run: r.id })} title={t('Continue in your AI tool')}><IconPlay size={13} /></button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {operations}
    </aside>
  );
}
