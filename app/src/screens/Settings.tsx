// Settings. Agents: the library, plus agents installed for one project or for
// every project, and the only place an agent is created. Operations: agents
// linked by arrows into multi-agent operations. Skills: what is
// already installed (and where), and adding a skill. Templates: the look of the files
// activities and agents generate (header, footer, fonts, colours, watermark). MCP servers:
// one catalog for the workspace, each server global or for the projects chosen (components/McpManager.tsx).
// My AIs: the AI tools, the default one, installing them and the Moki extension (components/AiToolsPage.tsx).

import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ConfiguratorButton, ConfiguratorPanel } from '../components/ConfiguratorPanel';
import { api, type ProjectSummary, type SkillScope, type TerminalRef, type ToolInfo } from '../api';
import { t } from '../i18n';
import { recall, remember } from '../prefs';
import { AgentForm } from '../components/AgentForm';
import { type SkillDialogTab } from '../components/SkillsDialog';
import { Library } from './Library';
import { DocumentStyleForm } from '../components/DocumentStyleForm';
import { SkillsPage } from '../components/SkillsPage';
import { Operations } from './Operations';
import { McpManager } from '../components/McpManager';
import { ActivitiesPage } from '../components/ActivitiesPage';
import { AiToolsPage } from '../components/AiToolsPage';
import { RoutinesPage } from '../components/RoutinesPage';
import { ThemesPage } from '../components/ThemesPage';
import { IconAgent, IconBell, IconLanes, IconMcp, IconMoon, IconPages, IconPlay, IconSkill, IconTerminal, IconX } from '../components/Icons';

export type SettingsTab = 'agents' | 'activities' | 'ai' | 'operations' | 'skills' | 'mcp' | 'documents' | 'themes' | 'routines';

interface Props {
  tab: SettingsTab;
  onTab: (tab: SettingsTab) => void;
  onClose: () => void;
  onBack?: () => void;
  backLabel?: string;
  /** The open project, when settings was opened from one. */
  project: ProjectSummary | null;
  projects: ProjectSummary[];
  tools: ToolInfo[];
  onTerminal: (terminal: TerminalRef, projectId: string) => void;
  onToolsChanged: () => void; // My AIs installed or found something: the app reads the tool list again
}

export function Settings({ tab, onTab, onClose, onBack, backLabel, project, projects: given, tools, onTerminal, onToolsChanged }: Props) {
  const leaveGuard = useRef<(() => Promise<boolean>) | null>(null);
  const registerLeave = useCallback((guard: (() => Promise<boolean>) | null) => { leaveGuard.current = guard; }, []);
  const changeTab = async (next: SettingsTab) => { if (next !== tab && (!leaveGuard.current || await leaveGuard.current())) onTab(next); };
  const close = async () => { if (!leaveGuard.current || await leaveGuard.current()) onClose(); };
  // Every project of the workspace, for the tabs' pickers (opened from a project, Settings is given only that one).
  const [projects, setProjects] = useState<ProjectSummary[]>(given);
  useEffect(() => { api.projects().then((all) => { if (all.length) setProjects(all); }).catch(() => {}); }, []);
  const [skillsTab, setSkillsTab] = useState<SkillDialogTab>('installed');
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [installedTick, setInstalledTick] = useState(0);
  const [configuring, setConfiguring] = useState(false); // the Configurador panel above the open page
  const [applied, setApplied] = useState(0); // the open page reloads after the Configurador applies changes
  const [scope, setScope] = useState<SkillScope>(() => (recall('qa-skill-scope') === 'global' ? 'global' : 'project'));
  // Settings is for the whole workspace: the tabs that work on one project (Agents, Skills, Templates)
  // choose it inside the tab; it starts on the project Settings was opened from.
  const target = project ?? projects[0] ?? null;

  const openSkills = (next: SkillDialogTab) => { setSkillsTab(next); onTab('skills'); };
  const groups = [
    { label: t('Your workspace'), items: [
      { id: 'agents', label: t('Agents'), icon: IconAgent },
      { id: 'activities', label: t('Activities'), icon: IconPlay },
      { id: 'skills', label: t('Skills'), icon: IconSkill },
      { id: 'operations', label: t('Operations'), icon: IconLanes },
    ] },
    { label: t('Connections'), items: [
      { id: 'ai', label: t('My AIs'), icon: IconTerminal },
      { id: 'mcp', label: t('MCP servers'), icon: IconMcp },
    ] },
    { label: t('Preferences'), items: [
      { id: 'routines', label: t('Routines and notifications'), icon: IconBell },
      { id: 'documents', label: t('Templates'), icon: IconPages },
      { id: 'themes', label: t('Themes'), icon: IconMoon },
    ] },
  ] as const;
  const navigate = (event: ReactKeyboardEvent<HTMLElement>) => {
    const items = groups.flatMap((group) => [...group.items]);
    const index = items.findIndex((item) => item.id === tab);
    const offset = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (!offset && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? items[0] : event.key === 'End' ? items.at(-1) : items[(index + offset + items.length) % items.length];
    if (next) { void changeTab(next.id).then(() => document.getElementById(`settings-tab-${next.id}`)?.focus()); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('[aria-modal="true"]')) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      void close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="settings">
      <aside className="settings-sidebar">
        <header className="settings-heading"><div><strong>{t('Settings')}</strong><span>{t('Your tools, your way.')}</span></div><button type="button" className="icon-btn" title={t('Close settings')} aria-label={t('Close settings')} onClick={() => { void close(); }}><IconX size={17} /></button></header>
        <nav className="settings-nav" role="tablist" aria-label={t('Settings')} aria-orientation="vertical" onKeyDown={navigate}>
          {groups.map((group) => <div key={group.label} className="settings-nav-group" role="presentation">
            <span className="settings-group-label">{group.label}</span>
            {group.items.map(({ id, label, icon: Icon }) => <button key={id} id={`settings-tab-${id}`} type="button" role="tab" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} aria-controls={`settings-panel-${id}`} title={label} className={`settings-nav-item${tab === id ? ' on' : ''}`} onClick={() => { void changeTab(id); }}><Icon size={18} /><span>{label}</span></button>)}
          </div>)}
        </nav>
        <div className="settings-configurator"><ConfiguratorButton open={configuring} onToggle={() => setConfiguring((v) => !v)} /><span>{t('Configure with AI')}</span></div>
        {onBack && <button type="button" className="btn btn-ghost btn-sm settings-return" onClick={onBack}>{backLabel}</button>}
      </aside>
      <div className="settings-body" role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`}>
        {configuring && <ConfiguratorPanel project={null} onApplied={() => { setApplied((n) => n + 1); api.projects().then(setProjects).catch(() => { /* keep */ }); }} onMyAis={() => { void changeTab('ai'); }} />}
        <Fragment key={applied}>
        {tab === 'routines' ? <RoutinesPage projects={projects} tools={tools} registerLeave={registerLeave} />
          : tab === 'themes' ? <ThemesPage />
          : tab === 'documents' ? <DocumentStyleForm />
          : tab === 'mcp' ? <McpManager key={target?.id ?? 'none'} project={target} projects={projects} />
          : tab === 'operations' ? <Operations tools={tools} />
          : tab === 'activities' ? <ActivitiesPage />
          : tab === 'ai' ? <AiToolsPage tools={tools} project={target} onToolsChanged={onToolsChanged} onTerminal={(terminal) => { if (target) onTerminal(terminal, target.id); }} />
          : tab === 'agents'
          ? (
            <Library
              embedded
              installedTick={installedTick}
              onBack={() => {}}
              backLabel=""
              onCreate={() => setCreatingAgent(true)}
              creating={creatingAgent}
              onBrowse={() => setCreatingAgent(false)}
              create={target ? (
                <>
                  <h1 className="library-create-title">{t('Create agent')}</h1>
                  <p className="muted">{t('Describe an agent in your own words and choose which installed skills it may use.')}</p>
                  <div className="field">
                    <span className="label">{t('Create for')}</span>
                    <div className="choice-grid scope-grid">
                      {([
                        ['project', target.repository ? t('This repository only') : t('This project only'), target.repository ? `${target.repository}/.claude/agents` : target.name],
                        ['global', t('All projects'), t('your user folder (~/.claude/agents)')],
                      ] as const).map(([id, title, hint]) => (
                        <label key={id} className={`choice${scope === id ? ' on' : ''}`}>
                          <input type="radio" name="agent-scope" checked={scope === id} onChange={() => { setScope(id); remember('qa-skill-scope', id); }} />
                          <span className="choice-title">{title}</span>
                          <span className="choice-hint">{hint}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <AgentForm key={`${target.id}:${scope}`} project={target} scope={scope} onCreated={() => setInstalledTick((n) => n + 1)} onFindSkills={() => { setCreatingAgent(false); openSkills('add'); }} />
                </>
              ) : <p className="muted">{t('Create a project before installing skills or agents.')}</p>}
            />
          )
          : (
            // Without a project the list still shows (the skills of Moki, the installed ones, the plugins); only adding needs one.
            <SkillsPage
              key={skillsTab}
              startOnAdd={skillsTab === 'add' && Boolean(target)}
              project={target}
              projects={projects}
              tools={tools}
              onTerminal={(terminal) => { if (target) onTerminal(terminal, target.id); }}
            />
          )}
        </Fragment>
      </div>
    </div>
  );
}
