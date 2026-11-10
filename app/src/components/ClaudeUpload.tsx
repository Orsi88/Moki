// Upload of skills, agents and activities: a .claude folder (or a project that contains one, a skills/, agents/
// or activities/ folder, a single skill) or the same in a .zip, or one agent or activity (.md); chosen or dragged
// in. Choosing reads and previews only, sorted by kind; nothing is written until the user marks items and confirms.
// The destination is the project (its linked folder's .claude, or the project folder), every project (your user
// folder), or "bring": a project's settings offer "All projects" (everything for every project and also linked to
// this one: skills in the user folder, agents and activities in the workspace, no tag; the workspace's settings
// show it too) or this project only. Used by Settings › Skills › Add a skill, by the project settings ("Bring to
// this project") and by the start screen.

import { useLayoutEffect, useState, type DragEvent } from 'react';
import { api, type ProjectSummary, type UploadBlock, type UploadItem, type UploadPreview, type UploadTarget } from '../api';
import { t } from '../i18n';
import { confirmDialog } from '../dialogs';
import { IconCheck, IconUpload } from './Icons';
import { allMarked, toggleMarked, uploadKey as key } from '../upload-select';

export interface UploadDone { installed: { kind: string; name: string; folders: string[] }[]; backup?: string }

interface Props {
  project: ProjectSummary | null; // none: only every project can be chosen
  scopes: UploadTarget[]; // the destinations offered; the first is the starting one
  onInstalled?: (done: UploadDone, scope: UploadTarget) => void;
  onBusyChange?: (busy: boolean) => void;
}

const KINDS: UploadItem['kind'][] = ['skill', 'agent', 'activity'];

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// Blocking reasons come from the main process as codes; the texts are translated here.
const reasonText = (i: UploadItem): string => {
  const b = i.blocked;
  if (!b) return '';
  const map: Record<UploadBlock, string> = {
    'invalid-name': t('Invalid name: use lowercase letters, numbers and hyphens.'),
    'no-skill-md': t('The folder has no SKILL.md.'),
    'no-description': t('It has no description in its header: add a "description:" line to the file header and upload again.'),
    secret: t('A secret was found ({kind} in {file}). The value is not shown; remove it from the file to import.', { kind: b.detail ?? '', file: b.file ?? '' }),
    'moki-name': t('Same name as a skill or agent that comes with Moki.'),
    'invalid-activity': t('Not a valid activity: {problem}.', { problem: b.detail ?? '' }),
    installed: t('Already installed here: it is not replaced.'),
    duplicate: t('Same name as another item in this upload ({where}): only that one is offered.', { where: b.detail ?? '' }),
  };
  return map[b.reason];
};
const ignoredText = (reason: 'config' | 'symlink' | 'other'): string => ({
  config: t('Not imported: settings, hooks, commands and MCP files can run commands or change the AI tool.'),
  symlink: t('Symbolic link: not followed.'),
  other: t('Not part of a skill, an agent or an activity.'),
})[reason];

// What an agent kept in a subfolder of agents/ is grouped by: the loose ones first, then each folder.
const groupsOf = (kind: UploadItem['kind'], items: UploadItem[]): { from: string; items: UploadItem[] }[] => {
  if (kind !== 'agent') return [{ from: '', items }];
  const folders = [...new Set(items.map((i) => i.from ?? ''))].sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));
  return folders.map((from) => ({ from, items: items.filter((i) => (i.from ?? '') === from) }));
};

const kindTitle = (k: UploadItem['kind']): string => ({ skill: t('Skills'), agent: t('Agents'), activity: t('Activities') })[k];

export function ClaudeUpload({ project, scopes, onInstalled, onBusyChange }: Props) {
  const [scope, setScope] = useState<UploadTarget>(scopes[0]);
  const [over, setOver] = useState(false); // something is dragged over the drop area
  const [view, setView] = useState<UploadPreview | null>(null);
  const [marked, setMarked] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  useLayoutEffect(() => {
    onBusyChange?.(Boolean(busy));
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  const [error, setError] = useState('');
  const [done, setDone] = useState<UploadDone | null>(null);
  const bring = scope === 'bring';
  const id = project?.id ?? '';

  const show = (v: UploadPreview) => { setView(v); setMarked(v.items.filter((i) => !i.blocked).map(key)); };

  const pick = async (source: 'folder' | 'file') => {
    setBusy('pick'); setError(''); setDone(null);
    try { const v = await api.claudeUploadPick(source, id, scope); if (v) show(v); } catch (e) { setError(message(e)); } finally { setBusy(''); }
  };
  // A folder or file dragged in: the window gives its path; only the first one is read.
  const drop = async (e: DragEvent) => {
    e.preventDefault(); setOver(false);
    const file = e.dataTransfer.files[0];
    const path = file ? window.qa?.filePath(file) ?? '' : '';
    if (!path || busy) return;
    setBusy('pick'); setError(''); setDone(null);
    try { show(await api.claudeUploadPath(path, id, scope)); } catch (err) { setError(message(err)); } finally { setBusy(''); }
  };
  const changeScope = async (next: UploadTarget) => {
    setScope(next); setDone(null);
    if (!view) return;
    try { show(await api.claudeUploadPreview(id, next)); } catch (e) { setError(message(e)); }
  };

  const install = async () => {
    if (!view || !marked.length) return;
    const repo = scope === 'project' ? view.linked : '';
    const where = bring ? t('all projects (also linked to this project)')
      : scope === 'global' ? t('all projects (your user folder)')
      : repo ? t("the repository {folder}. This CHANGES {folder}/.claude (the current .claude is backed up to the project's backups/ first)", { folder: repo })
      : t('the project {name}', { name: project?.name ?? '' });
    if (!await confirmDialog(`${t('Install {n} item(s) for {where}?', { n: marked.length, where })}\n\n${t('A skill can instruct the AI to run commands — review what you upload before using it.')}`)) return;
    setBusy('apply'); setError('');
    try {
      const result = await api.claudeUploadApply(id, scope, marked, Boolean(repo));
      setDone(result);
      setView(null); setMarked([]);
      onInstalled?.(result, scope);
    } catch (e) { setError(message(e)); } finally { setBusy(''); }
  };

  const flip = (k: string) => setMarked((m) => (m.includes(k) ? m.filter((x) => x !== k) : [...m, k]));
  const hasAgents = view?.items.some((i) => i.kind === 'agent') ?? false;

  return (
    <div className="claude-upload">
      <p className="muted small">{t('Upload a .claude folder, a project that contains one, a skills, agents or activities folder, a single skill, agent or activity, or the same in a .zip. Nothing is installed until you choose the items and confirm.')}</p>

      {scopes.length > 1 && (
        <div className="field inline">
          <span className="label">{t('Install for')}</span>
          <div className="choice-grid scope-grid">
            {scopes.map((s) => (
              <label key={s} className={`choice${scope === s ? ' on' : ''}`}>
                <input type="radio" name="upload-scope" checked={scope === s} disabled={Boolean(busy)} onChange={() => { void changeScope(s); }} />
                <span className="choice-title">{s === 'project' ? (project?.repository ? t('This repository only') : t('This project only')) : t('All projects')}</span>
                <span className="choice-hint">{s === 'project' ? (project?.repository ? `${project.repository}/.claude` : project?.name) : s === 'bring' ? t('skills in your user folder, agents and activities in the workspace') : t('your user folder, every AI tool')}</span>
              </label>
            ))}
          </div>
        </div>
      )}
      {scope === 'global' && <p className="muted small">{t('Skills for all projects appear in a project’s requests after you link them in Set up project.')}</p>}

      <div className={`upload-drop${over ? ' over' : ''}`} role="group" aria-label={t('Drop area')}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { void drop(e); }}>
        <IconUpload size={22} />
        <span>{busy === 'pick' ? t('Reading…') : t('Drag a folder, a .zip or a .md here')}</span>
        <div className="row-actions">
          <button type="button" className="btn btn-sm" disabled={Boolean(busy)} onClick={() => { void pick('folder'); }}>{t('Choose a folder')}</button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(busy)} onClick={() => { void pick('file'); }}>{t('Choose a file (.zip or .md)')}</button>
        </div>
      </div>

      {error && <div className="result warn" role="status"><p className="result-title">{error}</p></div>}
      {done && (
        <div className="result" role="status">
          <p className="result-title"><IconCheck size={17} /> {t('Installed {n} item(s)', { n: done.installed.length })}</p>
          <ul className="small upload-list">{done.installed.flatMap((i) => i.folders.map((f) => <li key={f}><code>{f}</code></li>))}</ul>
          {done.backup && <p className="small">{t('Backup of the previous .claude:')} <code>{done.backup}</code></p>}
        </div>
      )}

      {view && (
        <>
          {view.items.length === 0 ? <p className="muted small">{t('No skills, agents or activities found in what you chose.')}</p> : KINDS.filter((k) => view.items.some((i) => i.kind === k)).map((k) => {
            const items = view.items.filter((i) => i.kind === k);
            const markAll = (group: UploadItem[]) => group.filter((i) => !i.blocked).length > 1 && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(busy)} onClick={() => setMarked((m) => toggleMarked(m, group))}>
                {allMarked(marked, group) ? t('Clear selection') : t('Select all')}
              </button>
            );
            return (
              <section key={k} className="upload-kind" aria-label={kindTitle(k)}>
                <h3 className="upload-kind-head">{kindTitle(k)} <span className="muted">{items.length}</span> {markAll(items)}</h3>
                {groupsOf(k, items).map((g) => (
                  <div key={g.from} className="upload-group">
                    {g.from && <h4 className="upload-group-head"><code>{g.from}</code> <span className="muted">({g.items.length})</span> {markAll(g.items)}</h4>}
                    <ul className="skill-list">
                      {g.items.map((i) => (
                        <li key={`${key(i)}|${i.from ?? ''}`} className="skill-card">
                          <label className="check-row skill-card-head">
                            <input type="checkbox" checked={!i.blocked && marked.includes(key(i))} disabled={Boolean(i.blocked) || Boolean(busy)} onChange={() => flip(key(i))} />
                            <span className="choice-title">{i.name || t('(no name)')}</span>
                            <span className="muted small">{t('{n} file(s)', { n: i.files })}</span>
                          </label>
                          {i.description && <p className="skill-desc small">{i.description}</p>}
                          {i.blocked && <p className="small warn-text">{t('Cannot be installed:')} {reasonText(i)}</p>}
                          {i.discarded.length > 0 && <p className="small warn-text">{t('Left out for safety (secrets and local settings):')} {i.discarded.join(', ')}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            );
          })}
          {hasAgents && !bring && <p className="muted small">{t('An uploaded agent only finds skills of the same destination: upload the skills it uses together with it.')}</p>}
          {view.ignored.length > 0 && (
            <details className="small">
              <summary>{t('{n} item(s) not imported', { n: view.ignored.length })}</summary>
              <ul className="upload-list">{view.ignored.map((g) => <li key={g.path}><code>{g.path}</code> — {ignoredText(g.reason)}</li>)}</ul>
            </details>
          )}
          <div className="row-actions">
            <button type="button" className="btn" disabled={!marked.length || Boolean(busy)} onClick={() => { void install(); }}>{busy === 'apply' ? t('Installing…') : t('Install the chosen items')}</button>
          </div>
        </>
      )}
    </div>
  );
}
