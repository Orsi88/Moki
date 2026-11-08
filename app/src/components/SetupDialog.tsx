// "Project settings": the project's name and description; what an AI opened in it without a choice starts with
// (its defaults - several agents, skills, activities and operations - and the instructions sent with them); the
// agents it enables, the global skills it links (by name, nothing copied) and the optional app plugins its
// sessions load. One section per kind, stacked, so nothing is mixed. New skills come from the registry (Find
// skills, prefilled with the description). The AI tool can then adapt the context to the description ("Prepare
// the project"), or, for a blank project, interview the user and leave a plan.json ("Plan the project"): this
// dialog then opens with the plan's skills, agents and context files checked, for the user to approve.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, type ActivityInfo, type AgentInfo, type Operation, type Plan, type ProjectDefault, type ProjectSummary } from '../api';
import { t } from '../i18n';
import { SkillsDialog, pluginList } from './SkillsDialog';
import { ClaudeUpload } from './ClaudeUpload';
import { IconCheck, IconSearch, IconStar, IconX } from './Icons';

interface Props {
  project: ProjectSummary;
  onClose: () => void;
  onSaved: (activity: string | null) => void; // activity to open in the AI tool next, if any
}

const INSTRUCTIONS_LIMIT = 2000;

// A kind's defaults as removable chips, and what can still be added, in one select.
function DefaultList({ label, items, chosen, onAdd, onRemove }: {
  label: string; items: { id: string; name: string }[]; chosen: string[]; onAdd: (id: string) => void; onRemove: (id: string) => void;
}) {
  const name = (id: string) => items.find((i) => i.id === id)?.name ?? id;
  const left = items.filter((i) => !chosen.includes(i.id));
  return (
    <div className="setup-defaults">
      {chosen.length > 0 && <div className="chips" role="list" aria-label={label}>
        {chosen.map((id) => (
          <span key={id} className="chip setup-chip" role="listitem">{name(id)}
            <button type="button" className="chip-x" onClick={() => onRemove(id)} title={t('Remove')} aria-label={`${t('Remove')} ${name(id)}`}><IconX size={11} /></button>
          </span>
        ))}
      </div>}
      {left.length > 0 && (
        <select aria-label={label} value="" onChange={(e) => { if (e.target.value) onAdd(e.target.value); }}>
          <option value="">{t('Add…')}</option>
          {left.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      )}
    </div>
  );
}

// One kind of setting: a frame with its title and a line saying what it is for.
const Section = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <fieldset className="setup-section">
    <legend>{title}</legend>
    {hint && <p className="muted small">{hint}</p>}
    {children}
  </fieldset>
);

export function SetupDialog({ project, onClose, onSaved }: Props) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [instructions, setInstructions] = useState(project.startInstructions);
  const [defaults, setDefaults] = useState<ProjectDefault[]>(project.defaults);
  const [global, setGlobal] = useState<string[]>([]);
  const [artcraft, setArtcraft] = useState<string[]>([]);
  const [linked, setLinked] = useState<string[]>(project.linkedSkills);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [agentsChanged, setAgentsChanged] = useState(false);
  const [activities, setActivities] = useState<ActivityInfo[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [operations, setOperations] = useState<Operation[]>([]);
  const [plugins, setPlugins] = useState<string[]>(project.plugins);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  // Ask the AI next: on by default only in the plan flows (a blank project, a plan to approve); editing settings opens nothing.
  const [prepare, setPrepare] = useState<boolean | null>(null);
  const [finding, setFinding] = useState<string | null>(null); // Find skills query while open
  const [uploading, setUploading] = useState(false); // the upload of skills or a .claude folder is open on top
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadGlobal = useCallback(() => { api.installedSkills(project.id).then((s) => { setGlobal(s.global); setArtcraft(s.artcraft); }).catch(() => { /* keep */ }); }, [project.id]);
  useEffect(loadGlobal, [loadGlobal]);
  // What can be a default here: the activities this project sees (not the app's own actions), usable skills, operations.
  useEffect(() => {
    api.activities(project.id).then((r) => setActivities(r.activities.filter((a) => a.source !== 'moki' && a.available))).catch(() => setActivities([]));
    api.skills().then((list) => setSkills(list.filter((s) => s.status === 'draft' || s.status === 'stable').map((s) => s.name))).catch(() => setSkills([]));
    api.operations().then(setOperations).catch(() => setOperations([]));
  }, [project.id]);

  // A plan waiting for approval preselects what the AI recommended.
  useEffect(() => {
    api.agents().then((list) => setAgents(list.filter((a) => a.usable))).catch(() => setAgents([]));
    Promise.all([api.readPlan(project.id).catch(() => null), api.projectAgents(project.id).catch(() => [])]).then(([p, current]) => {
      setPlan(p);
      if (p && !p.approved) {
        setLinked((s) => [...new Set([...s, ...p.skills])]);
        setEnabled(p.agents);
        setFiles(p.contextFiles.map((f) => f.path));
        setFolders(p.folders.map((f) => f.path));
      } else setEnabled(current);
    });
  }, [project.id]);

  // While Find skills is open on top, Escape belongs to it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && finding === null && !uploading) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [finding, uploading, onClose]);

  const flip = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const pending = Boolean(plan && !plan.approved);
  const suggested = (list: string[] | undefined, item: string) => pending && list?.includes(item) ? <span className="chip">{t('suggested by the AI')}</span> : null;

  // Defaults, kind by kind. A default agent is turned on in the project.
  const chosen = (kind: ProjectDefault['kind']) => defaults.filter((d) => d.kind === kind).map((d) => d.id);
  const addDefault = (kind: ProjectDefault['kind'], id: string) => setDefaults((ds) => (ds.some((d) => d.kind === kind && d.id === id) ? ds : [...ds, { kind, id }]));
  const removeDefault = (kind: ProjectDefault['kind'], id: string) => setDefaults((ds) => ds.filter((d) => !(d.kind === kind && d.id === id)));
  const toggleAgentDefault = (agent: string) => {
    if (chosen('agent').includes(agent)) { removeDefault('agent', agent); return; }
    addDefault('agent', agent);
    if (!enabled.includes(agent)) { setEnabled((s) => [...s, agent]); setAgentsChanged(true); }
  };
  // What an AI opened here does, with what is set now (the same rule as the service's startOf).
  const startHint = (() => {
    const set = defaults.filter((d) => d.kind !== 'operation');
    const only = set.length === 1 && set[0].kind === 'activity' ? activities.find((a) => a.id === set[0].id) : undefined;
    if (only && only.files === 'none') return t('An AI opened here starts "{name}" right away.', { name: t(only.label) });
    if (set.length || instructions.trim()) return t('An AI opened here says what is set up and waits for you.');
    return t('An AI opened here starts with nothing set.');
  })();

  // What the AI does next: create the approved files, interview for a blank project, or adapt the QA context.
  const next = pending
    ? { activity: 'plan', label: t('Then ask the AI to create the approved context files'), ready: true }
    : project.starter === 'blank' && !plan
      ? { activity: 'plan', label: t('Then the AI asks me what the project needs and proposes a plan to review here'), ready: true }
      : { activity: 'setup', label: t('Then ask the AI to adapt the project context to this description (it proposes, you approve)'), ready: Boolean(description.trim()) };

  const asking = next.ready && (prepare ?? (pending || (project.starter === 'blank' && !plan)));
  const save = async () => {
    setBusy(true); setError('');
    try {
      // Links to skills that are no longer installed are dropped. Agents are only written when chosen here,
      // so a project without a list keeps getting every agent.
      await api.setupProject(project.id, {
        name, description, linkedSkills: linked.filter((n) => global.includes(n) || artcraft.includes(n)),
        defaults, startInstructions: instructions,
        ...(pending || agentsChanged ? { agents: enabled } : {}),
        ...(pending ? { contextFiles: files, folders } : {}),
      });
      await api.setProjectPlugins(project.id, plugins);
      onSaved(asking ? next.activity : null);
    } catch (e) { setError(e instanceof Error ? t(e.message) : String(e)); } finally { setBusy(false); }
  };

  const skillItems = [...new Set([...skills, ...global, ...artcraft])].sort().map((s) => ({ id: s, name: s }));
  const linkList = (list: string[], label: string) => (
    <ul className="pick-list" role="listbox" aria-multiselectable="true" aria-label={label}>
      {list.map((n) => (
        <li key={n}>
          <button type="button" role="option" aria-selected={linked.includes(n)} className={`library-item${linked.includes(n) ? ' active' : ''}`} onClick={() => setLinked((s) => flip(s, n))}>
            <span className="library-item-name">{n}</span>
            {suggested(plan?.skills, n)}
            {linked.includes(n) && <IconCheck size={15} />}
          </button>
        </li>
      ))}
    </ul>
  );

  return (<>
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title">
        <header className="modal-head">
          <div>
            <h2 id="setup-title">{pending ? t('Review the plan for {name}', { name: project.name }) : t('Settings of {name}', { name: project.name })}</h2>
            <p className="muted small">{pending
              ? t('The AI recommended what is checked below (the full plan is in proposed-updates.md). Keep what you want; nothing is created before you save.')
              : t('What the project is, what an AI opened in it starts with, and what it uses. You can change this later.')}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title={t('Close (Esc)')}><IconX size={18} /></button>
        </header>

        <div className="modal-body">
          <Section title={t('Project')}>
            <label className="field"><span className="label">{t('Name')}</span>
              <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="field"><span className="label">{t('Description')}</span>
              <textarea rows={3} maxLength={2000} autoFocus value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('e.g. "I want to start a project with React"')} />
            </label>
          </Section>

          <Section title={t('When an AI opens here')} hint={t('Sent to every AI opened in this project without choosing something, with the defaults below. An activity you choose at the time goes without it.')}>
            <label className="field"><span className="label">{t('Instructions at start (optional)')}</span>
              <textarea rows={3} maxLength={INSTRUCTIONS_LIMIT} value={instructions} onChange={(e) => setInstructions(e.target.value)}
                placeholder={t('e.g. "The logs come from service X, in Brasília time. Answer in short points."')} />
            </label>
            <p className="setup-start" role="status">{startHint}</p>
          </Section>

          <Section title={t('Agents')} hint={t('The agents this project enables. The star makes one a default: an AI opened here takes its role.')}>
            <ul className="agent-toggles">
              {agents.map((a) => {
                const isDefault = chosen('agent').includes(a.name);
                return (
                  <li key={a.name}>
                    <label title={a.description}>
                      <input type="checkbox" checked={enabled.includes(a.name)} disabled={isDefault} onChange={() => { setEnabled((s) => flip(s, a.name)); setAgentsChanged(true); }} />
                      <span>{a.name}</span>
                      {a.source === 'custom' && <span className="chip">{t('yours')}</span>}
                      {suggested(plan?.agents, a.name)}
                    </label>
                    <button type="button" className={`icon-btn setup-star${isDefault ? ' on' : ''}`} aria-pressed={isDefault} onClick={() => toggleAgentDefault(a.name)}
                      title={isDefault ? t('Default of this project: click to remove') : t('Make it a default of this project')} aria-label={`${t('Default')}: ${a.name}`}><IconStar size={14} /></button>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title={t('Skills')}>
            <div className="field">
              <span className="label">{t('Default skills')}</span>
              <span className="muted small">{t('An AI opened here uses them whenever they fit.')}</span>
              <DefaultList label={t('Default skills')} items={skillItems} chosen={chosen('skill')}
                onAdd={(id) => { addDefault('skill', id); if (global.includes(id) || artcraft.includes(id)) setLinked((s) => (s.includes(id) ? s : [...s, id])); }}
                onRemove={(id) => removeDefault('skill', id)} />
            </div>
            <div className="field">
              <span className="label">{t('Skills for all projects to use here')}</span>
              <span className="muted small">{t('Linked by name: requests from this project tell the AI to use them. Nothing is copied.')}</span>
              {global.length === 0 ? <p className="muted small">{t('No skills installed for all projects yet.')}</p> : linkList(global, t('Skills for all projects to use here'))}
              <div className="row-actions">
                {pending && plan?.searchSkills.map((q) => (
                  <button key={q} type="button" className="btn btn-ghost btn-sm" onClick={() => setFinding(q)} title={t('Suggested by the AI: not installed yet')}><IconSearch size={15} /> {t('Find “{q}”', { q })}</button>
                ))}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFinding(description)}><IconSearch size={15} /> {t('Find new skills')}</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUploading(true)}>{t('Upload skills or a .claude folder')}</button>
              </div>
            </div>
            {artcraft.length > 0 && (
              <div className="field">
                <span className="label">{t('ArtCraft skills')}</span>
                <span className="muted small">{t('Moki references for the Craft App Suite. Linked by name, like the skills above.')}</span>
                {linkList(artcraft, t('ArtCraft skills'))}
              </div>
            )}
          </Section>

          <Section title={t('Activities')} hint={t('Default activities. Just one that needs no files starts by itself; otherwise the AI says what it can do and waits.')}>
            <DefaultList label={t('Default activities')} items={activities.map((a) => ({ id: a.id, name: t(a.label) }))} chosen={chosen('activity')}
              onAdd={(id) => addDefault('activity', id)} onRemove={(id) => removeDefault('activity', id)} />
          </Section>

          <Section title={t('Operations')} hint={t('Default operations come first when you call one. Each step runs in its own terminal.')}>
            <DefaultList label={t('Default operations')} items={operations.map((o) => ({ id: o.id, name: o.name }))} chosen={chosen('operation')}
              onAdd={(id) => addDefault('operation', id)} onRemove={(id) => removeDefault('operation', id)} />
          </Section>

          <Section title={t('Plugins')} hint={t('ponytail and rtk are always on. These load only in the sessions opened from this project.')}>
            <ul className="file-pick plugin-pick">
              {pluginList().filter((p) => p.optional).map((p) => (
                <li key={p.name}>
                  <label className={plugins.includes(p.name) ? 'on' : ''}>
                    <input type="checkbox" checked={plugins.includes(p.name)} onChange={() => setPlugins((s) => flip(s, p.name))} />
                    <span className="file-name">{p.name}</span>
                    <span className="muted small">{p.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Section>

          {pending && Boolean(plan?.folders.length) && (
            <div className="field">
              <span className="label">{t('Folders the AI will create')}</span>
              <ul className="file-pick">{plan?.folders.map((f) => <li key={f.path}>
                <label><input type="checkbox" checked={folders.includes(f.path)} onChange={() => setFolders((s) => flip(s, f.path))} />
                  <span className="file-name">{f.path}</span>{f.contains && <span className="muted small">{f.contains}</span>}
                </label>
              </li>)}</ul>
            </div>
          )}
          {pending && Boolean(plan?.contextFiles.length) && (
            <div className="field">
              <span className="label">{t('Context files the AI will create')}</span>
              <ul className="file-pick">
                {plan?.contextFiles.map((f) => (
                  <li key={f.path}>
                    <label className={files.includes(f.path) ? 'on' : ''}>
                      <input type="checkbox" checked={files.includes(f.path)} onChange={() => setFiles((s) => flip(s, f.path))} />
                      <span className="file-name">{f.path}</span>
                      {f.contains && <span className="muted small">{f.contains}</span>}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="field inline">
            <input type="checkbox" checked={asking} disabled={!next.ready} onChange={(e) => setPrepare(e.target.checked)} />
            <span>{next.label}</span>
          </label>
          {error && <p className="error small" role="alert">{error}</p>}
        </div>

        <footer className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{pending ? t('Later') : t('Cancel')}</button>
          <button type="button" className="btn" disabled={busy || !name.trim()} onClick={() => { void save(); }}>{busy ? t('Saving…') : pending ? t('Approve plan') : t('Save')}</button>
        </footer>
      </div>
    </div>
    {uploading && (
      <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) { setUploading(false); loadGlobal(); } }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
          <header className="modal-head">
            <h2 id="upload-title">{t('Upload skills or a .claude folder')}</h2>
            <button type="button" className="icon-btn" onClick={() => { setUploading(false); loadGlobal(); }} title={t('Close')}><IconX size={18} /></button>
          </header>
          <div className="modal-body"><ClaudeUpload project={project} scopes={['project', 'global']} onInstalled={loadGlobal} /></div>
          <footer className="modal-foot"><button type="button" className="btn btn-ghost" onClick={() => { setUploading(false); loadGlobal(); }}>{t('Close')}</button></footer>
        </div>
      </div>
    )}
    {finding !== null && <SkillsDialog project={project} initialQuery={finding} onClose={() => { setFinding(null); loadGlobal(); }} />}
  </>);
}
