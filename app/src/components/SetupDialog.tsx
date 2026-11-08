// "Project settings": the project's name and description; what an AI opened in it without a choice starts with
// (its defaults - several agents, skills, activities and operations - and the instructions sent with them); the
// agents it enables, the global skills it links (by name, nothing copied) and the optional app plugins its
// sessions load. One section per kind, stacked, so nothing is mixed. New skills come from the registry (Find
// skills, prefilled with the description). The AI tool can then adapt the context to the description ("Prepare
// the project"), or, for a blank project, interview the user and leave a plan.json ("Plan the project"): this
// dialog then opens with the plan's skills, agents and context files checked, for the user to approve.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, type ActivityInfo, type AgentInfo, type Operation, type Plan, type ProjectDefault, type ProjectLinks, type ProjectSummary, type Reach } from '../api';
import { t } from '../i18n';
import { SkillsDialog, pluginList } from './SkillsDialog';
import { ClaudeUpload } from './ClaudeUpload';
import { IconLock, IconSearch, IconX } from './Icons';
import { ChipPicker, type PickChip, type PickOption } from './ChipPicker';
import { Modal } from './Modal';

interface Props {
  project: ProjectSummary;
  onClose: () => void;
  onSaved: (activity: string | null) => void; // activity to open in the AI tool next, if any
}

const INSTRUCTIONS_LIMIT = 2000;

// Why an item cannot be removed from this project alone: what brings it here, said in the workspace's settings.
const lockedWhy = (r: Reach | undefined): string | undefined => (r?.state === 'shared' ? t('Comes through the tag "{tag}". Change it in the workspace settings.', { tag: r.via ?? '' }) : undefined);
// The lock and the tag that brings an item (templates).
const Locked = ({ reach }: { reach: Reach | undefined }) => (reach?.state === 'shared'
  ? <span className="setup-locked" title={lockedWhy(reach)}><IconLock size={12} /> {t('tag {tag}', { tag: reach.via ?? '' })}</span> : null);
// Defaults (starred) first, the rest in their order.
const starredFirst = (chips: PickChip[]) => [...chips.filter((c) => c.star), ...chips.filter((c) => !c.star)];
const byGroup = (options: PickOption[]) => [...options].sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '') || a.name.localeCompare(b.name));
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
  // The workspace's items as this project sees them (the same tags), and what was changed here.
  const [links, setLinks] = useState<ProjectLinks | null>(null);
  const [activityOn, setActivityOn] = useState<Record<string, boolean>>({});
  const [templateOn, setTemplateOn] = useState<Record<string, boolean>>({});
  const [templateUse, setTemplateUse] = useState<string | null | undefined>(undefined);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  // Ask the AI next: on by default only in the plan flows (a blank project, a plan to approve); editing settings opens nothing.
  const [prepare, setPrepare] = useState<boolean | null>(null);
  const [finding, setFinding] = useState<string | null>(null); // Find skills query while open
  const [uploading, setUploading] = useState(false); // the upload of skills or a .claude folder is open on top
  const [uploadBusy, setUploadBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadGlobal = useCallback(() => { api.installedSkills(project.id).then((s) => { setGlobal(s.global); setArtcraft(s.artcraft); }).catch(() => { /* keep */ }); }, [project.id]);
  useEffect(loadGlobal, [loadGlobal]);
  // What can be a default here: the activities this project sees (not the app's own actions), usable skills, operations.
  useEffect(() => {
    api.activities(project.id).then((r) => setActivities(r.activities.filter((a) => a.source !== 'moki' && a.available))).catch(() => setActivities([]));
    api.skills().then((list) => setSkills(list.filter((s) => s.status === 'draft' || s.status === 'stable').map((s) => s.name))).catch(() => setSkills([]));
    api.operations().then(setOperations).catch(() => setOperations([]));
    api.projectLinks(project.id).then(setLinks).catch(() => setLinks(null));
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


  const flip = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  const pending = Boolean(plan && !plan.approved);
  const isOn = (r: Reach, changed: boolean | undefined) => changed ?? r.state !== 'off';
  const templates = (links?.templates ?? []).map((tp) => ({ ...tp, on: isOn(tp, templateOn[tp.id]) }));
  // The template in use: the one picked here, else the project's choice while it still applies, else the automatic one.
  const usedTemplate = (() => {
    if (templateUse) { const picked = templates.find((tp) => tp.id === templateUse && tp.on); if (picked) return picked.id; }
    const auto = templates.find((tp) => tp.on && tp.state === 'all') ?? templates.find((tp) => tp.on);
    return (templateUse === null ? auto : templates.find((tp) => tp.chosen && tp.on) ?? auto)?.id ?? '';
  })();

  // Defaults, kind by kind. A default agent is turned on in the project.
  const chosen = (kind: ProjectDefault['kind']) => defaults.filter((d) => d.kind === kind).map((d) => d.id);
  const addDefault = (kind: ProjectDefault['kind'], id: string) => setDefaults((ds) => (ds.some((d) => d.kind === kind && d.id === id) ? ds : [...ds, { kind, id }]));
  const removeDefault = (kind: ProjectDefault['kind'], id: string) => setDefaults((ds) => ds.filter((d) => !(d.kind === kind && d.id === id)));
  const toggleAgentDefault = (agent: string) => {
    if (chosen('agent').includes(agent)) { removeDefault('agent', agent); return; }
    addDefault('agent', agent);
    if (!enabled.includes(agent)) { setEnabled((s) => [...s, agent]); setAgentsChanged(true); }
  };
  const aiSuggests = (list: string[] | undefined, id: string) => (pending && list?.includes(id) ? t('suggested by the AI') : undefined);
  const stars = (kind: ProjectDefault['kind'], id: string) => chosen(kind).includes(id);
  const toggleDefault = (kind: ProjectDefault['kind'], id: string) => (stars(kind, id) ? removeDefault(kind, id) : addDefault(kind, id));

  // Agents: the ones on in this project; the star makes one a default.
  const agentChips = starredFirst(agents.filter((a) => enabled.includes(a.name)).map((a) => ({
    id: a.name, name: a.name, star: stars('agent', a.name), locked: lockedWhy(links?.agents[a.name]), marked: aiSuggests(plan?.agents, a.name),
  })));
  const agentOptions = byGroup(agents.filter((a) => !enabled.includes(a.name)).map((a) => ({ id: a.name, name: a.name, hint: a.description, group: a.source === 'custom' ? t('Your own') : 'Moki' })));
  const addAgent = (id: string) => { setEnabled((s) => (s.includes(id) ? s : [...s, id])); setAgentsChanged(true); };
  const removeAgent = (id: string) => { setEnabled((s) => s.filter((x) => x !== id)); removeDefault('agent', id); setAgentsChanged(true); };

  // Skills: the ones installed for all projects are linked by name (the star: always used); the Moki ones are in every
  // project, so one shows here only as a default.
  const linkable = [...global, ...artcraft];
  const skillChips = starredFirst([
    ...linked.filter((n) => linkable.includes(n)).map((n) => ({ id: n, name: n, star: stars('skill', n), marked: aiSuggests(plan?.skills, n) })),
    ...chosen('skill').filter((n) => !linkable.includes(n)).map((n) => ({ id: n, name: n, star: true })),
  ]);
  const skillOptions = byGroup([
    ...global.filter((n) => !linked.includes(n)).map((n) => ({ id: n, name: n, group: t('For all projects') })),
    ...artcraft.filter((n) => !linked.includes(n)).map((n) => ({ id: n, name: n, group: 'ArtCraft' })),
    ...skills.filter((n) => !linkable.includes(n) && !stars('skill', n)).map((n) => ({ id: n, name: n, group: 'Moki' })),
  ]);
  const addSkill = (id: string) => (linkable.includes(id) ? setLinked((s) => (s.includes(id) ? s : [...s, id])) : addDefault('skill', id));
  const removeSkill = (id: string) => { setLinked((s) => s.filter((x) => x !== id)); removeDefault('skill', id); };
  const starSkill = (id: string) => { toggleDefault('skill', id); if (linkable.includes(id)) setLinked((s) => (s.includes(id) ? s : [...s, id])); };

  // Activities: yours by this project's tag (also seen in Settings › Activities); the Moki ones only as defaults.
  const yours = links?.activities ?? [];
  const yourOn = (a: (typeof yours)[number]) => isOn(a, activityOn[a.id]);
  const builtin = activities.filter((a) => a.source === 'builtin');
  const activityChips = starredFirst([
    ...yours.filter(yourOn).map((a) => ({ id: a.id, name: a.name, star: stars('activity', a.id), locked: lockedWhy(a) })),
    ...builtin.filter((a) => stars('activity', a.id)).map((a) => ({ id: a.id, name: t(a.label), star: true })),
  ]);
  const activityOptions = byGroup([
    ...yours.filter((a) => !yourOn(a)).map((a) => ({ id: a.id, name: a.name, group: t('Your own') })),
    ...builtin.filter((a) => !stars('activity', a.id)).map((a) => ({ id: a.id, name: t(a.label), hint: t(a.hint), group: 'Moki' })),
  ]);
  const isYours = (id: string) => yours.some((a) => a.id === id);
  const addActivity = (id: string) => (isYours(id) ? setActivityOn((o) => ({ ...o, [id]: true })) : addDefault('activity', id));
  const removeActivity = (id: string) => { if (isYours(id)) setActivityOn((o) => ({ ...o, [id]: false })); removeDefault('activity', id); };

  // Operations: the defaults, first when one is called.
  const operationChips = chosen('operation').map((id) => ({ id, name: operations.find((o) => o.id === id)?.name ?? id }));
  const operationOptions = operations.filter((o) => !stars('operation', o.id)).map((o) => ({ id: o.id, name: o.name, hint: o.description }));

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
      const some = <T,>(o: Record<string, T>) => (Object.keys(o).length ? o : undefined);
      if (Object.keys(activityOn).length || Object.keys(templateOn).length || templateUse !== undefined) {
        await api.setProjectLinks(project.id, { activities: some(activityOn), templates: some(templateOn), ...(templateUse !== undefined ? { template: templateUse } : {}) });
      }
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

  return (<>
    <Modal className="setup-modal" labelledBy="setup-title" onClose={onClose} busy={busy}>
        <header className="modal-head">
          <div>
            <h2 id="setup-title">{pending ? t('Review the plan for {name}', { name: project.name }) : t('Settings of {name}', { name: project.name })}</h2>
            <p className="muted small">{pending
              ? t('The AI recommended what is checked below (the full plan is in proposed-updates.md). Keep what you want; nothing is created before you save.')
              : t('What the project is, what an AI opened in it starts with, and what it uses. You can change this later.')}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} disabled={busy} title={t('Close (Esc)')}><IconX size={18} /></button>
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

          <Section title={t('Agents')} hint={t('The agents of this project. The star makes one a default: an AI opened here takes its role.')}>
            <ChipPicker label={t('Agents')} chips={agentChips} options={agentOptions} onAdd={addAgent} onRemove={removeAgent} onStar={toggleAgentDefault} empty={t('Choose agents…')} />
          </Section>

          <Section title={t('Skills')} hint={t('The Moki skills are in every project; skills installed for all projects are linked by name, nothing copied. The star: an AI opened here uses it whenever it fits.')}>
            <ChipPicker label={t('Skills')} chips={skillChips} options={skillOptions} onAdd={addSkill} onRemove={removeSkill} onStar={starSkill} empty={t('Choose skills…')} />
            <div className="row-actions">
              {pending && plan?.searchSkills.map((q) => (
                <button key={q} type="button" className="btn btn-ghost btn-sm" onClick={() => setFinding(q)} title={t('Suggested by the AI: not installed yet')}><IconSearch size={15} /> {t('Find “{q}”', { q })}</button>
              ))}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFinding(description)}><IconSearch size={15} /> {t('Find new skills')}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setUploading(true)}>{t('Upload skills or a .claude folder')}</button>
            </div>
          </Section>

          <Section title={t('Activities')} hint={t("Yours get this project's tag (also in Settings › Activities); the Moki ones are in every project. The star: a default. Just one that needs no files starts by itself; otherwise the AI says what it can do and waits.")}>
            <ChipPicker label={t('Activities')} chips={activityChips} options={activityOptions} onAdd={addActivity} onRemove={removeActivity} onStar={(id) => toggleDefault('activity', id)} empty={t('Choose activities…')} />
          </Section>

          <Section title={t('Operations')} hint={t('Default operations come first when you call one. Each step runs in its own terminal.')}>
            <ChipPicker label={t('Operations')} chips={operationChips} options={operationOptions} onAdd={(id) => addDefault('operation', id)} onRemove={(id) => removeDefault('operation', id)} empty={t('Choose operations…')} />
          </Section>

          {templates.length > 0 && (
            <Section title={t('Templates')} hint={t("The document styles of this project's deliverables. Checking one gives it this project's tag, also in Settings › Templates; the one in use styles them.")}>
              <ul className="agent-toggles setup-templates" aria-label={t('Templates')}>
                {templates.map((tp) => (
                  <li key={tp.id}>
                    <label title={tp.state === 'all' ? t('For every project: used when no other applies.') : lockedWhy(tp)}>
                      <input type="checkbox" checked={tp.on} disabled={tp.state === 'all' || tp.state === 'shared'}
                        onChange={(e) => { const on = e.target.checked; setTemplateOn((o) => ({ ...o, [tp.id]: on })); if (!on && usedTemplate === tp.id) setTemplateUse(null); }} />
                      <span>{tp.name}</span>
                      {tp.state === 'all' && <span className="setup-locked"><IconLock size={12} /> {t('every project')}</span>}
                      <Locked reach={tp} />
                    </label>
                    {tp.on && (
                      <label className="setup-use">
                        <input type="radio" name="template-in-use" checked={usedTemplate === tp.id} onChange={() => setTemplateUse(tp.id)} />
                        <span>{t('In use')}</span>
                      </label>
                    )}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title={t('MCP servers')} hint={t('The servers the AIs opened here get. Change them in Settings › MCP servers.')}>
            {(links?.mcp ?? []).some((m) => m.state !== 'off')
              ? <ul className="setup-readonly" aria-label={t('MCP servers')}>
                  {links!.mcp.filter((m) => m.state !== 'off').map((m) => (
                    <li key={m.id}><span>{m.name}</span><span className="muted small">{m.state === 'all' ? t('every project') : t('this project')}</span></li>
                  ))}
                </ul>
              : <p className="muted small">{t('No MCP server for this project.')}</p>}
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
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>{pending ? t('Later') : t('Cancel')}</button>
          <button type="button" className="btn" disabled={busy || !name.trim()} onClick={() => { void save(); }}>{busy ? t('Saving…') : pending ? t('Approve plan') : t('Save')}</button>
        </footer>
    </Modal>
    {uploading && (
      <Modal labelledBy="upload-title" onClose={() => { setUploading(false); loadGlobal(); }} busy={uploadBusy}>
          <header className="modal-head">
            <h2 id="upload-title">{t('Upload skills or a .claude folder')}</h2>
            <button type="button" className="icon-btn" disabled={uploadBusy} onClick={() => { setUploading(false); loadGlobal(); }} title={t('Close')}><IconX size={18} /></button>
          </header>
          <div className="modal-body"><ClaudeUpload project={project} scopes={['project', 'global']} onInstalled={loadGlobal} onBusyChange={setUploadBusy} /></div>
          <footer className="modal-foot"><button type="button" className="btn btn-ghost" disabled={uploadBusy} onClick={() => { setUploading(false); loadGlobal(); }}>{t('Close')}</button></footer>
      </Modal>
    )}
    {finding !== null && <SkillsDialog project={project} initialQuery={finding} onClose={() => { setFinding(null); loadGlobal(); }} />}
  </>);
}
