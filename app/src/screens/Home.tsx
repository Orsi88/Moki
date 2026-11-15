// Start screen: pick a project (system under test) or create one — like
// Obsidian's vault switcher.

import { useEffect, useMemo, useRef, useState, type FormEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { api, type ProjectSummary, type Starter, type TerminalRef, type ToolInfo, type WorkspaceInfo } from '../api';
import { t } from '../i18n';
import { StartPrefs } from '../components/PrefsCorner';
import { AddButton } from '../components/AddButton';
import { SearchPanel } from '../components/SearchPanel';
import { DeleteProjectDialog } from '../components/DeleteProjectDialog';
import { IconCheck, IconChevron, IconEdit, IconExternal, IconEye, IconEyeOff, IconFolder, IconOpenProject, IconPause, IconPin, IconPlay, IconStar, IconTrash, IconX } from '../components/Icons';
import { NoteDialog } from '../components/NoteDialog';
import { RenameField } from '../components/RenameField';
import { favoriteLooseIds, favoriteNotes, forgetNote, forgetProject, hiddenIds, hideProject, looseNotes, type NoteRef, noteTitle, pinnedIds, recentNotes, removeLooseNote, retitleNote, setFavorite, showProject, togglePin } from '../side-menu';
import { Settings, type SettingsTab } from './Settings';
import { featuredWorkspaces, homeSectionLayout, recordWorkspaceUse, saveHomeSectionLayout } from '../prefs';
import { resizedWeights, type HomeSectionId, type HomeSectionLayout } from '../home-sections';
import { confirmDialog } from '../dialogs';
import { Modal } from '../components/Modal';

interface Props {
  newNote?: number; // the rail's New note was pressed (a counter): a new loose note opens in the main area
  projects: ProjectSummary[];
  tools: ToolInfo[];
  version: string;
  onOpen: (id: string) => void;
  onCreate: (name: string, starter: Starter, tags?: string[], setup?: boolean, folder?: string) => Promise<void>; // setup: open with "Set up"; folder: link it
  settings: SettingsTab | null;
  onSettings: (tab: SettingsTab | null) => void;
  onBack?: () => void;
  backLabel?: string;
  project: ProjectSummary | null;
  onTerminal: (terminal: TerminalRef, projectId: string) => void;
  workspace?: WorkspaceInfo | null; // the open workspace, switched at the bottom of the list
  onWorkspace?: (workspace: WorkspaceInfo | null) => void; // null: back to the workspace picker
  search?: boolean; // the search panel in place of the list
  onSearch?: () => void;
  onFound?: (project: string, path?: string) => void;
  onDeleted?: () => void; // a project was deleted for good: reload the list
  onRenamed?: () => void; // a project got a new name: reload the list
  onToolsChanged: () => void; // Settings › My AIs: read the AI tools again
}

const onboarding = (status: string): string => ({
  'not-started': t('Context not started'), partial: t('Context in progress'), complete: t('Context complete'),
} as Record<string, string>)[status] ?? status;

interface MenuItem { label: string; icon: ReactNode; run: () => void; danger?: boolean; shortcut?: string }

export function Home({ newNote = 0, projects, tools, version, onOpen, onCreate, settings, onSettings, onBack, backLabel, project, onTerminal, workspace, onWorkspace, search = false, onSearch, onFound, onDeleted, onRenamed, onToolsChanged }: Props) {
  const [switching, setSwitching] = useState<WorkspaceInfo[] | null>(null); // the workspace menu, open
  const switcherRef = useRef<HTMLDivElement>(null);
  const [switcherBox, setSwitcherBox] = useState<{ left: number; width: number; bottom: number } | null>(null);
  const closeSwitcher = () => { setSwitching(null); setSwitcherBox(null); };
  const openSwitcher = () => {
    const box = switcherRef.current?.getBoundingClientRect();
    if (box) setSwitcherBox({ left: box.left, width: box.width, bottom: window.innerHeight - box.top + 4 });
    api.workspaces().then((r) => setSwitching(featuredWorkspaces(r.list))).catch(() => setSwitching([]));
  };
  const switchTo = (w: WorkspaceInfo) => {
    closeSwitcher();
    if (w.id === workspace?.id) return;
    api.selectWorkspace(w.id).then((opened) => { recordWorkspaceUse(opened.id); onWorkspace?.(opened); }).catch((e: Error) => setError(e.message));
  };
  const [quick, setQuick] = useState(false); // "Create a new project": its name field, open
  const [name, setName] = useState('');
  const [folder, setFolder] = useState(''); // from "Open a project": the folder the new project links
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pins, setPins] = useState<string[]>(pinnedIds);
  const [hidden, setHidden] = useState<string[]>(hiddenIds);
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  // Suspended projects: their folder is out of the workspace's project list until resumed (saves machine resources).
  const [suspended, setSuspended] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => { api.suspendedProjects().then(setSuspended).catch(() => setSuspended([])); }, [projects]);
  // A saved note opened here, inside the app. New loose notes are created from the fixed icon rail.
  const [openNote, setOpenNote] = useState<NoteRef | { loose: null } | null>(null); // { loose: null }: a new loose note
  useEffect(() => { if (newNote) setOpenNote({ loose: null }); }, [newNote]);
  // The actions of a row (pin, hide, open in the notebook, delete…) show only on a right click.
  const [sections, setSections] = useState<HomeSectionLayout>(homeSectionLayout);
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const sideRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ above: HomeSectionId; below: HomeSectionId; startY: number; aboveH: number; belowH: number; base: Record<string, number> } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ left: number; top: number; items: MenuItem[] } | null>(null);
  const menuOn = (items: MenuItem[]) => (e: MouseEvent) => { e.preventDefault(); setRowMenu({ left: e.clientX, top: e.clientY, items }); };
  const notebookItem = (ref: NoteRef): MenuItem => ({ label: t('Open in the notebook'), icon: <IconExternal size={15} />, run: () => { void api.openNoteWindow(ref); } });
  // A loose note leaves this computer; a project note goes to the trash.
  const deleteNoteItem = (ref: NoteRef, title: string): MenuItem => ({
    label: t('Delete the note'), icon: <IconTrash size={15} />, danger: true,
    run: async () => {
      if (!await confirmDialog(t('Delete the note "{title}"?', { title }), { danger: true })) return;
      if ('loose' in ref) { removeLooseNote(ref.loose); setNoteTick((n) => n + 1); return; }
      api.deleteNote(ref.project, ref.path).then(() => { forgetNote(ref.project, ref.path); setNoteTick((n) => n + 1); }).catch((e: Error) => setError(e.message));
    },
  });
  const [noteTick, setNoteTick] = useState(0);
  // Rename in place (the menu's Rename, or F2 on a row). A row is "project:<id>", "note:<loose id | project/path>"
  // or, in Favorites, "fav:note:…" (the same note can be listed twice).
  const [renaming, setRenaming] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null); // the row that takes the focus back once renamed or cancelled
  useEffect(() => {
    if (!focusKey) return;
    document.querySelector<HTMLElement>(`[data-rename-key="${CSS.escape(focusKey)}"]`)?.focus();
    setFocusKey(null);
  });
  const noteKey = (ref: NoteRef) => ('loose' in ref ? `note:${ref.loose}` : `note:${ref.project}/${ref.path}`);
  // The row keeps the height it had: the field must not move the list (a name cut with … is a little taller than a plain one).
  const rowHeight = useRef(0);
  const startRename = (key: string) => {
    rowHeight.current = document.querySelector(`[data-rename-key="${CSS.escape(key)}"]`)?.getBoundingClientRect().height ?? 0;
    setRenaming(key);
  };
  const renameItem = (key: string): MenuItem => ({ label: t('Rename'), icon: <IconEdit size={15} />, shortcut: 'F2', run: () => startRename(key) });
  const onF2 = (key: string) => (e: ReactKeyboardEvent) => { if (e.key === 'F2') { e.preventDefault(); startRename(key); } };
  const endRename = (key: string) => { setRenaming(null); setFocusKey(key); };
  // A note gets a new title where it is listed; a project note's file stays, so links to it keep working.
  const renameNote = async (ref: NoteRef, title: string) => {
    if (!('loose' in ref)) await api.setNoteTitle(ref.project, ref.path, title);
    retitleNote(ref, title);
    if (!('loose' in ref)) window.qa?.notesChanged();
    setNoteTick((n) => n + 1);
  };
  // A project's name is only what is shown: its id and folder stay.
  const renameProject = async (p: ProjectSummary, name: string) => {
    await api.setProjectName(p.id, name);
    onRenamed?.();
  };
  const nameCell = (key: string, label: string, onRename: (name: string) => Promise<void>, meta: ReactNode) => (
    <div className="home-project renaming" style={rowHeight.current ? { height: rowHeight.current } : undefined}>
      <RenameField label={label} initial={label} onRename={onRename} onEnd={() => endRename(key)} />
      {meta}
      <IconChevron size={16} />
    </div>
  );
  useEffect(() => api.onNotesChanged(() => setNoteTick((n) => n + 1)), []);
  const notes = useMemo(() => recentNotes(), [noteTick]);
  const loose = useMemo(() => looseNotes(), [noteTick]);
  const installed = tools.filter((t) => t.command && t.available);
  const visible = projects.filter((p) => !hidden.includes(p.id));
  const hiddenProjects = projects.filter((p) => hidden.includes(p.id));
  const pinned = pins.map((id) => visible.find((p) => p.id === id)).filter((p): p is ProjectSummary => Boolean(p));
  const rest = visible.filter((p) => !pins.includes(p.id));
  // A note sent to a project lives in that project (and in Favorites, when starred). It no longer belongs here.
  const notesShown = [...loose].sort((a, b) => b.at - a.at).map((n) => ({ kind: 'loose' as const, id: n.id, title: n.title, at: n.at }));
  // Favorite notes (the star): loose ones and those of the projects listed, as starred.
  const favorites = useMemo(() => [
    ...favoriteLooseIds().flatMap((id) => { const n = loose.find((x) => x.id === id); return n ? [{ kind: 'loose' as const, id, title: n.title }] : []; }),
    ...favoriteNotes().filter((n) => visible.some((p) => p.id === n.project)).map((n) => ({ kind: 'project' as const, ...n, title: notes.find((recent) => recent.project === n.project && recent.path === n.path)?.title ?? noteTitle(n.path) })),
  ], [noteTick, loose, visible, notes]); // eslint-disable-line react-hooks/exhaustive-deps
  const unstar = (f: (typeof favorites)[number]) => {
    setFavorite(f.kind === 'loose' ? { loose: f.id } : { project: f.project, path: f.path }, false);
    setNoteTick((n) => n + 1);
  };

  const refOf = (n: { kind: 'loose'; id: string } | { kind: 'project'; project: string; path: string }): NoteRef => (n.kind === 'loose' ? { loose: n.id } : { project: n.project, path: n.path });
  const noteMeta = (n: { kind: 'loose' } | { kind: 'project'; project: string }) => (n.kind === 'project' ? <span className="home-project-meta">{projects.find((p) => p.id === n.project)?.name}</span> : null);

  const hide = async (p: ProjectSummary) => {
    if (!await confirmDialog(t('Hide {name} from Moki? The files stay on this computer. You can show it again under Hidden.', { name: p.name }))) return;
    setHidden(hideProject(p.id));
    setPins(pinnedIds());
  };

  const suspend = async (p: ProjectSummary) => {
    if (!await confirmDialog(t('Suspend {name}? Moki stops its routines, search and AI tools until you resume it. No file is lost.', { name: p.name }))) return;
    api.suspendProject(p.id).then(() => onDeleted?.()).catch((e: Error) => setError(e.message));
  };
  const resume = (id: string) => {
    api.resumeProject(id).then(() => onDeleted?.()).catch((e: Error) => setError(e.message));
  };

  const deleted = (id: string) => {
    forgetProject(id);
    setHidden(hiddenIds()); setPins(pinnedIds()); setNoteTick((n) => n + 1); setDeleting(null);
    onDeleted?.();
  };

  const projectMeta = (p: ProjectSummary) => (
    <span className="home-project-meta">
      {onboarding(p.onboardingStatus)} · {p.runs} {p.runs === 1 ? t('activity') : t('activities')}
      {p.openRuns > 0 && <span className="dot dot-warn" title={t('{n} open', { n: p.openRuns })} />}
    </span>
  );
  const projectRow = (p: ProjectSummary, pinnedRow: boolean) => (
    <li key={p.id} className="home-row" onContextMenu={menuOn([
      renameItem(`project:${p.id}`),
      { label: pinnedRow ? t('Unpin') : t('Pin'), icon: <IconPin size={15} />, run: () => setPins(togglePin(p.id)) },
      { label: t('Hide from Moki'), icon: <IconEyeOff size={15} />, run: () => hide(p) },
      { label: t('Suspend'), icon: <IconPause size={15} />, run: () => { void suspend(p); } },
      { label: t('Delete for good'), icon: <IconTrash size={15} />, danger: true, run: () => setDeleting(p) },
    ])}>
      {renaming === `project:${p.id}` ? nameCell(`project:${p.id}`, p.name, (name) => renameProject(p, name), projectMeta(p)) : (
        <button type="button" className="home-project" data-rename-key={`project:${p.id}`} onClick={() => onOpen(p.id)} onKeyDown={onF2(`project:${p.id}`)}>
          <span className="home-project-name">{p.name}</span>
          {projectMeta(p)}
          <IconChevron size={16} />
        </button>
      )}
    </li>
  );

  // Quick project: only the name; standard folders, no setup, straight in.
  const submitQuick = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await onCreate(name, 'minimal', [], false, folder || undefined); } catch (err) { setError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  };
  // A folder with a project opens it; a new folder asks the project's name, the folder's as a suggestion.
  const openFolder = () => {
    setError('');
    api.pickFolder().then((r) => {
      if (!r) return;
      if (r.project) { onOpen(r.project.id); return; }
      setFolder(r.folder); setName(r.name); setQuick(true);
    }).catch((err: Error) => setError(err.message));
  };
  const closeQuick = () => { setQuick(false); setName(''); setFolder(''); setError(''); };
  const collapsed = (id: HomeSectionId) => sections.collapsed.includes(id);
  const toggleSection = (id: HomeSectionId) => {
    const current = sectionsRef.current;
    const next = { ...current, collapsed: current.collapsed.includes(id) ? current.collapsed.filter((item) => item !== id) : [...current.collapsed, id] };
    sectionsRef.current = next;
    setSections(next);
    saveHomeSectionLayout(next);
  };
  const openHeights = () => {
    const heights: Record<string, number> = {};
    sideRef.current?.querySelectorAll<HTMLElement>('[data-section]').forEach((el) => {
      const id = el.dataset.section;
      if (id && !el.classList.contains('is-collapsed')) heights[id] = el.getBoundingClientRect().height;
    });
    return heights;
  };
  const weightOf = (id: HomeSectionId, open: HomeSectionId[]) => {
    const known = open.map((item) => sections.weights[item]).filter((value): value is number => typeof value === 'number' && value > 0);
    const own = sections.weights[id];
    if (typeof own === 'number' && own > 0) return own;
    return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : 1;
  };
  const applyWeights = (weights: HomeSectionLayout['weights']) => {
    const next = { ...sectionsRef.current, weights };
    sectionsRef.current = next;
    setSections(next);
    return next;
  };
  const shownIds: HomeSectionId[] = [
    ...(pinned.length > 0 ? ['pinned' as const] : []),
    'projects',
    ...(favorites.length > 0 ? ['favorites' as const] : []),
    'notes',
  ];
  const onSplitPointerDown = (above: HomeSectionId, below: HomeSectionId) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || collapsed(above) || collapsed(below)) return;
    const base = openHeights();
    const aboveH = base[above];
    const belowH = base[below];
    if (!aboveH || !belowH) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { above, below, startY: e.clientY, aboveH, belowH, base };
  };
  const onSplitPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    applyWeights(resizedWeights(drag.base, drag.above, drag.below, drag.aboveH, drag.belowH, e.clientY - drag.startY));
  };
  const onSplitPointerUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    saveHomeSectionLayout(sectionsRef.current);
  };
  const resetWeights = () => applyWeights({});
  const nudgeSplit = (above: HomeSectionId, below: HomeSectionId, e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const base = openHeights();
    const aboveH = base[above];
    const belowH = base[below];
    if (!aboveH || !belowH) return;
    const next = applyWeights(resizedWeights(base, above, below, aboveH, belowH, e.key === 'ArrowDown' ? 24 : -24));
    saveHomeSectionLayout(next);
  };
  const split = (above: HomeSectionId, below: HomeSectionId) => {
    const live = !collapsed(above) && !collapsed(below);
    return (
      <div className={`home-block-split${live ? '' : ' is-idle'}`} role={live ? 'separator' : undefined} aria-orientation={live ? 'horizontal' : undefined}
        aria-label={live ? t('Resize the sections') : undefined} tabIndex={live ? 0 : undefined}
        onPointerDown={live ? onSplitPointerDown(above, below) : undefined} onPointerMove={onSplitPointerMove} onPointerUp={onSplitPointerUp}
        onDoubleClick={live ? () => { dragRef.current = null; const next = resetWeights(); saveHomeSectionLayout(next); } : undefined}
        onKeyDown={live ? (e) => nudgeSplit(above, below, e) : undefined} />
    );
  };
  const block = (id: HomeSectionId, title: string, body: ReactNode, action?: ReactNode) => (
    <section className={`home-block${collapsed(id) ? ' is-collapsed' : ''}`} data-section={id} style={collapsed(id) ? undefined : { flexGrow: weightOf(id, shownIds.filter((item) => !sections.collapsed.includes(item))) }}>
      <div className="home-list-head with-action">
        <button type="button" className="home-block-toggle" aria-expanded={!collapsed(id)} title={collapsed(id) ? t('Expand') : t('Collapse')} onClick={() => toggleSection(id)}>
          <IconChevron size={12} /><span>{title}</span>
        </button>
        {action}
      </div>
      {!collapsed(id) && <div className="home-block-scroll">{body}</div>}
    </section>
  );

  return (
    <div className={`home${settings ? ' is-settings' : ''}`}>
      {!settings && !openNote && <StartPrefs />}
      {!settings && search && onSearch && onFound && (
        <aside className="home-list home-side">
          <SearchPanel onOpenProject={(id) => onFound(id)} onOpenFile={onFound} onClose={onSearch} />
        </aside>
      )}
      {!settings && !(search && onSearch && onFound) && <aside className="home-list home-side" ref={sideRef}>
        {pinned.length > 0 && block('pinned', t('Pinned'), <ul>{pinned.map((p) => projectRow(p, true))}</ul>)}
        {pinned.length > 0 && split('pinned', 'projects')}
        {block('projects', t('Projects'), <>
          {projects.length === 0 && <p className="muted small home-empty">{t('No projects yet.')}</p>}
          <ul>{rest.map((p) => projectRow(p, false))}</ul>
          {hiddenProjects.length > 0 && (
            <details className="home-hidden">
              <summary className="home-list-head">{t('Hidden ({n})', { n: hiddenProjects.length })}</summary>
              <ul>
                {hiddenProjects.map((p) => (
                  <li key={p.id} className="home-row" onContextMenu={menuOn([
                    { label: t('Show in the list'), icon: <IconEye size={15} />, run: () => setHidden(showProject(p.id)) },
                    { label: t('Delete for good'), icon: <IconTrash size={15} />, danger: true, run: () => setDeleting(p) },
                  ])}>
                    <button type="button" className="home-project" onClick={() => { setHidden(showProject(p.id)); onOpen(p.id); }}>
                      <span className="home-project-name">{p.name}</span>
                      <span className="home-project-meta">
                        {onboarding(p.onboardingStatus)} · {p.runs} {p.runs === 1 ? t('activity') : t('activities')}
                      </span>
                      <IconChevron size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {suspended.length > 0 && (
            <details className="home-hidden">
              <summary className="home-list-head">{t('Suspended ({n})', { n: suspended.length })}</summary>
              <ul>
                {suspended.map((p) => (
                  <li key={p.id} className="home-row">
                    <button type="button" className="home-project" onClick={() => resume(p.id)} title={t('Resume')}>
                      <span className="home-project-name">{p.name}</span>
                      <span className="home-project-meta">{t('Suspended')}</span>
                      <IconPlay size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>)}
        {favorites.length > 0 && split('projects', 'favorites')}
        {favorites.length > 0 && block('favorites', t('Favorites'), <ul className="home-favorites">
          {favorites.map((f) => (
            <li key={f.kind === 'loose' ? f.id : `${f.project}:${f.path}`} className="home-row" onContextMenu={menuOn([
              notebookItem(refOf(f)),
              renameItem(`fav:${noteKey(refOf(f))}`),
              { label: t('Remove from favorites'), icon: <IconStar size={15} />, run: () => unstar(f) },
            ])}>
              {renaming === `fav:${noteKey(refOf(f))}` ? nameCell(`fav:${noteKey(refOf(f))}`, f.title, (title) => renameNote(refOf(f), title), noteMeta(f)) : (
                <button type="button" className="home-project" data-rename-key={`fav:${noteKey(refOf(f))}`} onClick={() => setOpenNote(refOf(f))} onKeyDown={onF2(`fav:${noteKey(refOf(f))}`)}>
                  <span className="home-project-name">{f.title}</span>
                  {noteMeta(f)}
                  <IconChevron size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>)}
        {split(favorites.length > 0 ? 'favorites' : 'projects', 'notes')}
        {block('notes', t('Loose notes'), <>
          {notesShown.length === 0 && <p className="muted small home-empty">{t('No loose notes yet.')}</p>}
          <ul>
            {notesShown.map((n) => (
              <li key={n.id} className="home-row" onContextMenu={menuOn([
                notebookItem(refOf(n)),
                renameItem(noteKey(refOf(n))),
                deleteNoteItem(refOf(n), n.title),
              ])}>
                {renaming === noteKey(refOf(n)) ? nameCell(noteKey(refOf(n)), n.title, (title) => renameNote(refOf(n), title), noteMeta(n)) : (
                  <button type="button" className="home-project" data-rename-key={noteKey(refOf(n))} onClick={() => setOpenNote(refOf(n))} onKeyDown={onF2(noteKey(refOf(n)))}>
                    <span className="home-project-name">{n.title}</span>
                    {noteMeta(n)}
                    <IconChevron size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>)}
        {rowMenu && (
          <div className="menu-backdrop" onMouseDown={() => setRowMenu(null)} onContextMenu={(e) => { e.preventDefault(); setRowMenu(null); }}>
            <ul className="term-menu item-menu" role="menu" style={{ left: rowMenu.left, top: rowMenu.top }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setRowMenu(null); }}>
              {rowMenu.items.map((item, i) => (
                <li key={item.label}>
                  <button type="button" role="menuitem" autoFocus={i === 0} className={item.danger ? 'danger' : ''} onClick={() => { setRowMenu(null); item.run(); }}>{item.icon} {item.label}{item.shortcut && <kbd className="menu-key">{item.shortcut}</kbd>}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {workspace && onWorkspace && (
          <div className="ws-switch" ref={switcherRef}>
            {switching && (
              <div className="menu-backdrop" onMouseDown={closeSwitcher}>
                <ul className="ws-menu" role="menu" style={switcherBox ?? undefined} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') closeSwitcher(); }}>
                  {switching.map((w) => (
                    <li key={w.id}>
                      <button type="button" role="menuitem" disabled={w.missing} onClick={() => switchTo(w)} title={w.path}>
                        <span className="ws-menu-name">{w.name}</span>
                        {w.id === workspace.id && <IconCheck size={14} />}
                      </button>
                    </li>
                  ))}
                  <li className="ws-menu-sep" />
                  <li><button type="button" role="menuitem" autoFocus onClick={() => { closeSwitcher(); onWorkspace(null); }}>{t('Go to Workspaces')}</button></li>
                </ul>
              </div>
            )}
            <button type="button" className="ws-switch-btn" onClick={openSwitcher} aria-haspopup="menu" title={`${t('Switch workspace')}
${workspace.path}`}>
              <span className="ws-switch-name">{workspace.name}</span>
              <span className="ws-switch-caret"><IconChevron size={14} /></span>
            </button>
          </div>
        )}
      </aside>}
      {deleting && <DeleteProjectDialog project={deleting} onClose={() => setDeleting(null)} onDeleted={() => deleted(deleting.id)} />}

      {settings ? (
        <Settings tab={settings} onTab={onSettings} onClose={() => onSettings(null)} onBack={onBack} backLabel={backLabel} project={project} projects={projects} tools={tools} onTerminal={onTerminal} onToolsChanged={onToolsChanged} />
      ) : openNote ? (
      <main className="home-main home-note">
        <NoteDialog
          key={'loose' in openNote ? `loose:${openNote.loose}` : `${openNote.project}:${openNote.path}`}
          embedded
          project={'path' in openNote ? openNote.project : null}
          path={'path' in openNote ? openNote.path : null}
          looseId={'loose' in openNote ? openNote.loose : null}
          projects={visible.map((p) => ({ id: p.id, name: p.name }))}
          onSaved={() => setNoteTick((n) => n + 1)}
          onClose={() => { const fresh = 'loose' in openNote && openNote.loose === null; setOpenNote(null); setNoteTick((n) => n + 1); if (fresh) document.querySelector<HTMLElement>('.ribbon .ribbon-note')?.focus(); }}
        />
      </main>
      ) : (
      <main className="home-main">
        <img className="hero" src="./hero.png" alt="" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = './favicon.svg'; e.currentTarget.className = 'hero fallback'; }} />
        <h1>Moki</h1>
        <p className="muted">{t('Version {version}', { version })}</p>

        <div className="home-actions">
            <div className="home-action">
              <div>
                <strong>{t('Create a new project')}</strong>
                <p className="muted small">{t('Its files, context and history stay on this computer.')}</p>
              </div>
              <AddButton size="lg" title={t('Create')} onClick={() => { setQuick(true); setError(''); }} />
            </div>
          <div className="home-action">
            <div>
              <strong>{t('Open a project')}</strong>
              <p className="muted small">{t('Choose one on the left, or pick a folder: it opens as a project.')}</p>
            </div>
            <button type="button" className="home-action-icon" onClick={openFolder} title={t('Open a project')} aria-label={t('Open a project')}><IconOpenProject size={20} /></button>
          </div>
        </div>
        {!quick && error && <p className="error small home-error">{error}</p>}
        {quick && (
          <Modal as="form" className="quick-project project-create-dialog" labelledBy="quick-project-title" busy={busy} onClose={closeQuick} onSubmit={(e) => { void submitQuick(e); }}>
              <header className="modal-head">
                <div className="project-create-heading">
                  <span className="project-create-icon" aria-hidden="true"><IconFolder size={23} /></span>
                  <div>
                  <h2 id="quick-project-title">{t('Create a new project')}</h2>
                  <p className="muted small">{t('Its files, context and history stay on this computer.')}</p>
                  </div>
                </div>
                <button type="button" className="icon-btn" onClick={closeQuick} disabled={busy} title={t('Close (Esc)')}><IconX size={18} /></button>
              </header>
              <div className="modal-body">
                <label className="field">
                  <strong>{t('Project name')}</strong>
                  <input autoFocus onFocus={(e) => e.currentTarget.select()} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') closeQuick(); }} maxLength={80} />
                </label>
                {folder && (
                  <div className="field">
                    <span className="label">{t('Folder')}</span>
                    <code className="small quick-project-folder">{folder}</code>
                    <span className="muted small">{t('Its files stay where they are and show in the project. Its AI settings (.claude, AGENTS.md…) are backed up inside it, in .moki-backup/.')}</span>
                  </div>
                )}
                {error && <p className="error small">{error}</p>}
              </div>
              <footer className="modal-foot">
                <button type="button" className="btn btn-ghost" onClick={closeQuick} disabled={busy}>{t('Cancel')}</button>
                <button type="submit" className="btn" disabled={busy || !name.trim()}>{busy ? t('Creating…') : t('Create project')}</button>
              </footer>
          </Modal>
        )}

        <p className="muted small home-tools">
          {installed.length
            ? <>{t('AI tools found:')} {installed.map((ai) => ai.label.replace(/ \(.*\)$/, '')).join(' · ')}</>
            : t('No AI tool found on this computer. Install Claude Code, Codex, Cursor or another supported tool.')}
        </p>
      </main>
      )}
    </div>
  );
}
