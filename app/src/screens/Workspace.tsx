// Project workspace, Obsidian-style: ribbon, file tree, tabs with documents
// (view and edit) and terminals (AI tools or a shell), and a side panel with
// the activity or project details. Tabs live in groups (one per terminal, where
// the deliverables of its runs open) and the main area splits into up to 4 views,
// each with a group and its own tabs (tab-groups.ts, components/TabGroups.tsx).

import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from 'react';
import { api, CHANGED_OUTSIDE, type FileContent, type LaunchPreset, type ProjectSummary, type Tag, type TerminalRef, type ToolInfo, type TreeNode } from '../api';
import { conversationLanguage, t } from '../i18n';
import { defaultTool, recall, remember } from '../prefs';
import { DocView, type DocMode, type MdWhy } from '../components/DocView';
import { FileTree, OTHER_FILES, canRename, friendlyName, groupTree, renameBlock } from '../components/FileTree';
import { NewMenu } from '../components/NewMenu';
import { LaunchDialog } from '../components/LaunchDialog';
import { HudsonDialog } from '../components/HudsonDialog';
import { NoteDialog } from '../components/NoteDialog';
import { OperationsPanel } from '../components/OperationsPanel';
import { OperationLaunch } from '../components/OperationLaunch';
import { ActivityRunView } from '../components/ActivityRunView';
import { OperationRunView } from '../components/OperationRunView';
import { SidePanel } from '../components/SidePanel';
import { SetupDialog } from '../components/SetupDialog';
import { TerminalView } from '../components/TerminalView';
import { UsageStatus } from '../components/UsageStatus';
import { TagPicker } from '../components/TagPicker';
import { SearchPanel } from '../components/SearchPanel';
import { IconBroom, IconCode, IconCopy, IconEdit, IconExternal, IconEyeOff, IconFile, IconFolder, IconGraph, IconMore, IconSliders, IconStar, IconTerminal, IconTrash, IconX } from '../components/Icons';
import { NewEntryDialog } from '../components/NewEntryDialog';
import { favoriteNotes, hideProject, isFavorite, renameRecentFile, retitleNote, setFavorite, touchRecentFile, touchRecentProject } from '../side-menu';
import { AddButton } from '../components/AddButton';
import { CraftDownloads } from '../components/CraftDownloads';
import { FileIcon } from '../icons';
import { Ribbon } from '../components/Ribbon';
import { Settings, type SettingsTab } from './Settings';
import { createDebouncer, flushEdits } from '../debounce';
import { needsReread, stampOf, type Stamp } from '../tab-refresh';
import { throttle } from '../throttle';
import { parseActivityLaunches, type ActivityLaunch, type ActivityLaunchPhase } from '../activity-launches';
import {
  GRAPH, addTerminal as boardTerminal, arrange, close as boardClose, colorGroup, dropGroup, fileKey, focus as focusPane, focusedKey, freshIn,
  groupOf, moveToGroup, moveToPane, newGroup, open as boardOpen, parseBoard, prune, rename as boardRename, renameGroup, setSplit, show, showGroup,
  tabsOfGroup, tabsOfPane, termKey, type Board, type TabKey,
} from '../tab-groups';
import { GroupMenu, LayoutButton, PaneHead, TabMenu, groupStyle, type PaneTab } from '../components/TabGroups';
import { readWorkspaceView, writeWorkspaceView } from '../workspace-view-state';
import { confirmDialog } from '../dialogs';
import { projectLink, resolveInternal, type Anchor, type LinkJump } from '../internal-links';

interface Props { workspaceId: string; project: ProjectSummary; tools: ToolInfo[]; onHome: () => void; onNewLooseNote: () => void; noteProjects?: { id: string; name: string }[]; settings: SettingsTab | null; onSettings: (tab: SettingsTab | null) => void; onProjectChanged: () => void; launchOnOpen?: boolean; startSetup?: boolean; startNotice?: string; pendingTerminal?: TerminalRef | null; onPendingTerminal?: () => void; pendingPath?: string | null; onPendingPath?: () => void; search?: boolean; onSearch?: () => void; onFound?: (project: string, path?: string) => void; onToolsChanged: () => void }

// seen: the tree's size/mtime of the file before the tab read it (see tab-refresh.ts).
// A .md file is edited and commented in the formatted editor ('edit'); its Markdown source ('source') is read and copied;
// it is shown for reading and comments ('preview') when it is large or the editor would lose parts of it (`why`, DocView).
// `quiet`: the note about the formatting was closed. It saves on its own: `conflict` when the file changed outside Moki
// meanwhile, `savedAt` for the bar.
interface Tab { path: string; content: FileContent; draft: string; mode: DocMode; saving: boolean; scrollTop: number; seen?: Stamp; why?: MdWhy; quiet?: boolean; conflict?: boolean; savedAt?: number; jump?: LinkJump }
interface TermTab extends TerminalRef { running: boolean }

// The picture above the project name when nothing is open.
const THINKING_CAT = `./${encodeURIComponent('Thoughtful Pixel Cat at Work.png')}`;

const textOf = (c: FileContent): string => (c.kind === 'markdown' || c.kind === 'text' ? c.text : '');
const findFile = (nodes: TreeNode[], path: string): TreeNode | null => {
  for (const n of nodes) {
    if (n.path === path) return n.type === 'file' ? n : null;
    const found = n.children && path.startsWith(`${n.path}/`) ? findFile(n.children, path) : null;
    if (found) return found;
  }
  return null;
};
// Above this a .md file opens for reading: the formatted editor is much heavier than the rendered page.
const LARGE_MD = 1024 * 1024;
const AUTOSAVE_MS = 700;
const autosaves = (t: Tab): boolean => t.content.kind === 'markdown' && t.content.editable;
const isDirty = (t: Tab): boolean => (t.content.kind === 'markdown' || t.content.kind === 'text') && t.content.editable && t.draft !== t.content.text;
const sidebarWidthWithinBounds = (width: number) => Math.max(180, Math.min(720, Math.round(width)));

// What linking a folder did, shown after "Choose my folder" or creating a project from a folder.
export const linkedNotice = (r: ProjectSummary & { backup?: string }): string => (r.backup
  ? t('Linked {folder}. Its AI settings were backed up to {backup}', { folder: r.repository, backup: r.backup })
  : t('Linked {folder}. It has no AI settings (.claude, AGENTS.md…) to back up.', { folder: r.repository }));

export function Workspace({ workspaceId, project, tools, onHome, onNewLooseNote, noteProjects = [], settings, onSettings, onProjectChanged, launchOnOpen = false, startSetup = false, startNotice = '', pendingTerminal = null, onPendingTerminal, pendingPath = null, onPendingPath, search = false, onSearch, onFound, onToolsChanged }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [tabs, setTabs] = useState<Tab[]>([]);
  // Where tabs show (groups, views); kept per project on this computer. "Active" is the focused view's tab.
  const boardKey = `qa-tab-board:${workspaceId}:${project.id}`;
  const [board, setBoard] = useState<Board>(() => parseBoard(recall(boardKey)));
  const apply = useCallback((fn: (b: Board) => Board) => setBoard((b) => fn(b)), []);
  useEffect(() => { remember(boardKey, JSON.stringify(board)); }, [boardKey, board]);
  const focusKey = focusedKey(board);
  const active = focusKey?.startsWith('file:') ? focusKey.slice(5) : null;
  const [groupMenu, setGroupMenu] = useState<{ id: string; left: number; top: number } | null>(null);
  const [tabMenu, setTabMenu] = useState<{ key: TabKey; left: number; top: number } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => recall('qa-sidebar') === 'closed');
  const [sidebarWidth, setSidebarWidth] = useState<number | null>(() => {
    const saved = recall('qa-sidebar-width');
    const width = saved === null ? NaN : Number(saved);
    return Number.isFinite(width) ? sidebarWidthWithinBounds(width) : null;
  });
  const sidebar = useRef<HTMLElement>(null);
  const resizeSidebar = useRef<{ startX: number; startWidth: number; width: number } | null>(null);
  const setSidebarOpen = (open: boolean) => { setSidebarCollapsed(!open); remember('qa-sidebar', open ? 'open' : 'closed'); };
  useEffect(() => { if (search) setSidebarOpen(true); }, [search]);
  useEffect(() => { touchRecentProject(project.id); }, [project.id]);
  useEffect(() => {
    // A note being written keeps its shortcuts (on top or in the main area).
    const onKey = (e: KeyboardEvent) => { if (!document.querySelector('[aria-modal="true"]') && !(document.activeElement as HTMLElement | null)?.closest('.note-dialog') && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') setSidebarOpen(true); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // The right panel is open or collapsed to a thin rail; the choice is remembered.
  const [panelRail, setPanelRail] = useState(() => recall('qa-panel') === 'rail');
  const togglePanel = () => setPanelRail((v) => { remember('qa-panel', v ? 'open' : 'rail'); return !v; });
  // A document with its own column on the right (a PDF's comments) takes the panel's place: one open at a time.
  const [docSide, setDocSide] = useState(false);
  useEffect(() => {
    const on = (e: Event) => setDocSide(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener('moki:doc-side', on);
    return () => window.removeEventListener('moki:doc-side', on);
  }, []);
  const toggleSide = () => {
    if (docSide) { window.dispatchEvent(new Event('moki:doc-side-close')); setPanelRail(false); return; }
    togglePanel();
  };
  const [launch, setLaunch] = useState<LaunchPreset | null>(startSetup && project.starter === 'blank' ? { activity: 'plan', startAtTool: true } : launchOnOpen ? { activity: 'open' } : null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(startNotice);
  // A notice about something done that shows on its own (a request pasted into the conversation): it goes away by itself.
  const flash = (message: string) => { setNotice(message); setTimeout(() => setNotice((cur) => (cur === message ? '' : cur)), 6000); };
  const [terms, setTerms] = useState<TermTab[]>([]);
  const termsRef = useRef(terms);
  termsRef.current = terms;
  const [termsReady, setTermsReady] = useState(false); // the terminals still running for this project came back
  const activeTerm = focusKey?.startsWith('term:') ? focusKey.slice(5) : null;
  const openCall = useCallback((preset: LaunchPreset = {}) => {
    const current = terms.find((term) => term.id === activeTerm && term.running && term.tool);
    setLaunch({ ...preset, ...(current ? { terminal: current } : {}) });
  }, [terms, activeTerm]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.key.toLowerCase() !== 'k' || launch || settings || document.querySelector('[aria-modal="true"]')) return;
      e.preventDefault(); e.stopPropagation(); openCall();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [openCall, launch, settings]);
  // Graph view is a placeholder tab. The rail button under the AI icon opens it.
  const graphFocus = focusKey === GRAPH;
  const openGraph = () => apply((b) => boardOpen(b, GRAPH));
  const closeGraph = () => apply((b) => boardClose(b, GRAPH));
  const toggleGraph = () => { if (graphFocus) closeGraph(); else openGraph(); };
  const openedTerm = useRef<string | null>(null);
  const [showSetup, setShowSetup] = useState(startSetup && project.starter !== 'blank'); // after creating the project or linking a folder
  const [note, setNote] = useState<{ path: string | null; loose?: boolean } | null>(null); // open note (main area); path null = new note; loose: of no project yet
  // A multi-agent operation in the main area: its start screen, or one of its runs.
  const [opView, setOpView] = useState<{ kind: 'launch' | 'run'; id: string } | null>(null);
  // An activity run, in the same place. The right panel stays on the project.
  const [activityView, setActivityView] = useState<string | null>(null);
  const showActivity = (id: string) => { setNote(null); setOpView(null); setActivityView(id); };
  const showOperationRun = (id: string) => { setNote(null); setActivityView(null); setOpView({ kind: 'run', id }); };
  // An activity of an operation: its start form, in place of the request.
  const startOperationForm = (id: string) => { setLaunch(null); setNote(null); setActivityView(null); setOpView({ kind: 'launch', id }); };
  const openListedRun = (id: string) => {
    setNote(null);
    void api.run(project.id, id).then((run) => {
      if (run.operation) showOperationRun(id); else showActivity(id);
    }).catch((e: Error) => setError(e.message));
  };
  const [opsTick, setOpsTick] = useState(0);
  const launchKey = `qa-activity-launches:${workspaceId}:${project.id}`;
  const [activityLaunches, setActivityLaunches] = useState<ActivityLaunch[]>(() => parseActivityLaunches(recall(launchKey)));
  const [activityLaunchTick, setActivityLaunchTick] = useState(0);
  useEffect(() => { remember(launchKey, JSON.stringify(activityLaunches)); }, [launchKey, activityLaunches]);
  const beginActivity = (activity: string, label: string): string | undefined => {
    if (activity === 'resume' || activity === 'talk') return undefined;
    const id = crypto.randomUUID().replace(/-/g, '');
    setActivityLaunches((items) => [{ id, activity, label, at: new Date().toISOString(), phase: 'sending' }, ...items]);
    setActivityLaunchTick((n) => n + 1);
    return id;
  };
  const updateActivity = (id: string | undefined, phase: ActivityLaunchPhase) => {
    if (id) setActivityLaunches((items) => items.map((item) => item.id === id ? { ...item, phase } : item));
  };
  const advanceRef = useRef<() => void>(() => {});
  const [termMenu, setTermMenu] = useState<{ left: number; top: number } | null>(null);
  const [craftOpen, setCraftOpen] = useState(false); // download of the ArtCraft apps
  // The tree item menu (right click or ⋯); path '' is the project folder. canCreate: a folder outside runs/.
  const [itemMenu, setItemMenu] = useState<{ path: string; canCreate: boolean; left: number; top: number } | null>(null);
  const [hudson, setHudson] = useState(false); // Hudson organizing the files the runs left (HudsonDialog)
  const [renaming, setRenaming] = useState<string | null>(null); // the tree item whose name is being typed over
  const [focusPath, setFocusPath] = useState<string | null>(null); // a renamed item: its row takes the focus when the tree shows it
  const [creating, setCreating] = useState<{ parent: string; kind: 'file' | 'folder'; ext?: string } | null>(null); // ext: from New › File, which also lets the folder be chosen
  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const [viewReady, setViewReady] = useState(false);
  const scrollPositions = useRef(new Map<string, number>());
  const latestView = useRef({ tabs, active, ready: viewReady });
  latestView.current = { tabs, active, ready: viewReady };
  const persistView = useMemo(() => createDebouncer(() => {
    const current = latestView.current;
    if (!current.ready) return;
    writeWorkspaceView(workspaceId, project.id, {
      version: 1,
      tabs: current.tabs.map(({ path, mode, scrollTop }) => ({
        path, mode, scrollTop: scrollPositions.current.get(path) ?? scrollTop,
      })),
      active: current.active,
    });
  }, 180), [workspaceId, project.id]);
  useEffect(() => {
    const flush = () => persistView.flush();
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      persistView.flush();
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [persistView]);
  useEffect(() => { if (viewReady) persistView.call(); }, [active, tabs, viewReady, persistView]);

  // Tags: the catalog, and the tags of this project's files (the tree marks them, the open file can change them).
  const [catalog, setCatalog] = useState<Tag[]>([]);
  const [fileTags, setFileTags] = useState<Record<string, string[]>>({});
  const [noteTitles, setNoteTitles] = useState<Record<string, string>>({});
  // Resolves to the tree just loaded (null when it failed): the change handler compares the open tabs against it.
  const treeRef = useRef<TreeNode[]>([]);
  const loadTree = useCallback((): Promise<TreeNode[] | null> => {
    const loaded = api.tree(project.id).then((nodes) => { treeRef.current = nodes; setTree(nodes); return nodes; }, (e: Error) => { setError(e.message); return null; });
    api.fileTags(project.id).then(setFileTags).catch(() => setFileTags({}));
    return loaded;
  }, [project.id]);
  useEffect(() => { api.tags().then(setCatalog).catch(() => setCatalog([])); }, []);
  const tagProject = (ids: string[]) => { api.setProjectTags(project.id, ids).then(onProjectChanged).catch((e: Error) => setError(e.message)); };
  const tagFile = (path: string, ids: string[]) => {
    api.setFileTags(project.id, path, ids).then((saved) => setFileTags((all) => {
      const next = { ...all };
      if (saved.length) next[path] = saved; else delete next[path];
      return next;
    })).catch((e: Error) => setError(e.message));
  };
  const colorsOf = (path: string) => (fileTags[path] ?? []).map((id) => catalog.find((tg) => tg.id === id)?.color).filter((c): c is string => Boolean(c));

  // Live updates: the AI tool writes files while the app is open.
  useEffect(() => {
    void api.watch(project.id);
    const summary = throttle(onProjectChanged, 5000);
    const off = api.onChanged((changed) => {
      if (changed !== project.id) return;
      flushEdits(); // a text typed a moment ago counts as an edit: the tab is dirty and is not read over
      setOpsTick((n) => n + 1);
      advanceRef.current(); // a step may have just delivered its work
      deliverRef.current(); // a run of a terminal may have listed a new deliverable
      const fresh = loadTree();
      setRefreshKey((k) => k + 1);
      summary(); // the project summary re-reads every project: at most once per 5 s while the files keep changing
      for (const t of tabsRef.current) {
        if (isDirty(t)) continue;
        // Read a tab again only when its file changed (size or mtime in the fresh tree, stamped before the read).
        void fresh.then((nodes) => {
          const node = nodes && findFile(nodes, t.path);
          if (!needsReread(stampOf(t.content, t.seen), node)) return;
          const treeStamp = node ? { size: node.size, mtime: node.mtime } : undefined;
          api.readFile(project.id, t.path)
            .then((content) => setTabs((all) => all.map((x) => (x.path === t.path && !isDirty(x) ? { ...x, content, draft: textOf(content), seen: stampOf(content, treeStamp) } : x))))
            .catch(() => { /* file removed: keep the tab as it was */ });
        });
      }
    });
    return () => { off(); summary.cancel(); void api.watch(null); };
  }, [project.id, loadTree, onProjectChanged]);

  // The first tree and saved tabs load together. Nothing is persisted before restoration finishes.
  useEffect(() => {
    const saved = readWorkspaceView(workspaceId, project.id);
    let cancelled = false;
    void loadTree().then(async (nodes) => {
      if (cancelled || nodes === null) return;
      const restored = await Promise.all(saved.tabs.map(async (item): Promise<Tab | null> => {
        const node = findFile(nodes, item.path);
        if (!node) return null;
        try {
          const content = await api.readFile(project.id, item.path);
          const large = content.kind === 'markdown' && content.text.length > LARGE_MD;
          const mode: DocMode = content.kind !== 'markdown' || !content.editable || large ? 'preview' : item.mode;
          return {
            path: item.path, content, draft: textOf(content), mode, saving: false,
            scrollTop: item.scrollTop,
            seen: stampOf(content, { size: node.size, mtime: node.mtime }),
            ...(large && content.editable ? { why: 'large' as const } : {}),
          };
        } catch {
          return null; // removed or no longer readable: restore the other tabs
        }
      }));
      if (cancelled) return;
      const valid = restored.filter((tab): tab is Tab => tab !== null);
      setTabs((current) => {
        const existing = new Set(current.map((tab) => tab.path));
        const next = [...valid.filter((tab) => !existing.has(tab.path)), ...current];
        tabsRef.current = next;
        return next;
      });
      // The saved active file comes back in front, unless something is already there.
      const front = valid.some((tab) => tab.path === saved.active) ? saved.active : valid[0]?.path ?? null;
      if (front) apply((b) => (focusedKey(b) ? b : b.tabs[fileKey(front)] ? show(b, fileKey(front)) : boardOpen(b, fileKey(front))));
      setViewReady(true);
    });
    return () => { cancelled = true; };
  }, [project.id, loadTree, workspaceId, apply]);

  const jumpToken = useRef(0);
  const openPath = useCallback((path: string, mode: Tab['mode'] = 'preview', anchor?: Anchor | null) => {
    setError('');
    setOpView(null);
    if (/^notes\/[^/]+\.md$/.test(path) && !anchor) { setNote({ path }); return; } // anchored notes use the document reader
    setNote(null);
    const jump = anchor ? { anchor, token: ++jumpToken.current } : undefined;
    if (tabsRef.current.some((t) => t.path === path)) {
      if (jump) { flushEdits(); setTabs((all) => all.map((tab) => tab.path === path ? { ...tab, mode: 'preview', jump } : tab)); }
      touchRecentFile(project.id, path); apply((b) => show(b, fileKey(path))); return;
    }
    const node = findFile(treeRef.current, path); // taken before the read: it can only be older than the content
    const treeStamp = node ? { size: node.size, mtime: node.mtime } : undefined;
    api.readFile(project.id, path).then((content) => {
      touchRecentFile(project.id, path);
      const large = content.kind === 'markdown' && content.text.length > LARGE_MD;
      const view: DocMode = content.kind !== 'markdown' || jump ? 'preview' : !content.editable || large ? 'preview' : mode === 'source' ? 'source' : 'edit';
      setTabs((all) => (all.some((x) => x.path === path) ? all.map((tab) => tab.path === path && jump ? { ...tab, mode: 'preview', jump } : tab) : [...all, { path, content, draft: textOf(content), mode: view, saving: false, scrollTop: 0, seen: stampOf(content, treeStamp), ...(large && content.editable ? { why: 'large' as const } : {}), ...(jump && { jump }) }]));
      apply((b) => boardOpen(b, fileKey(path)));
      // Reveal the file in the tree.
      setExpanded((s) => { const n = new Set(s); path.split('/').slice(0, -1).reduce((acc, seg) => { const p = acc ? `${acc}/${seg}` : seg; n.add(p); return p; }, ''); return n; });
    }).catch((e: Error) => setError(e.message));
  }, [project.id, apply]);

  // A deliverable an AI just wrote: it joins its terminal's group without taking the screen, marked new.
  const openInGroup = useCallback((path: string, group: string) => {
    if (tabsRef.current.some((t) => t.path === path)) return;
    const node = findFile(treeRef.current, path);
    const treeStamp = node ? { size: node.size, mtime: node.mtime } : undefined;
    api.readFile(project.id, path).then((content) => {
      const large = content.kind === 'markdown' && content.text.length > LARGE_MD;
      const view: DocMode = content.kind !== 'markdown' || !content.editable || large ? 'preview' : 'edit';
      setTabs((all) => (all.some((x) => x.path === path) ? all : [...all, { path, content, draft: textOf(content), mode: view, saving: false, scrollTop: 0, seen: stampOf(content, treeStamp), ...(large && content.editable ? { why: 'large' as const } : {}) }]));
      apply((b) => boardOpen(b, fileKey(path), { group, background: true }));
    }).catch(() => { /* not readable yet: the next change tries again */ });
  }, [project.id, apply]);
  // Each terminal's deliverables (the artifacts of the runs it created) open once in its group; a tab closed stays closed.
  const deliveredKey = `qa-delivered:${workspaceId}:${project.id}`;
  const openDeliverables = useCallback(() => {
    api.terminalDeliverables(project.id).then((byTerminal) => {
      let done: string[] = [];
      try { const v: unknown = JSON.parse(recall(deliveredKey) ?? '[]'); if (Array.isArray(v)) done = v.filter((x): x is string => typeof x === 'string'); } catch { /* start over */ }
      const known = new Set(done);
      const live = new Set(termsRef.current.map((x) => x.id));
      for (const [terminal, paths] of Object.entries(byTerminal)) {
        if (!live.has(terminal)) continue;
        for (const path of paths) { if (known.has(path)) continue; known.add(path); openInGroup(path, `g-${terminal}`); }
      }
      if (known.size !== done.length) remember(deliveredKey, JSON.stringify([...known].slice(-500)));
    }).catch(() => { /* nothing to open */ });
  }, [project.id, deliveredKey, openInGroup]);
  const deliverRef = useRef(openDeliverables);
  deliverRef.current = openDeliverables;

  // tabsRef follows at once: a visual editor's pending text is flushed (flushEdits) right before save/close read it.
  const update = (path: string, patch: Partial<Tab>) => {
    tabsRef.current = tabsRef.current.map((t) => (t.path === path ? { ...t, ...patch } : t));
    setTabs((all) => all.map((t) => (t.path === path ? { ...t, ...patch } : t)));
  };
  const rememberScroll = (path: string, top: number) => {
    scrollPositions.current.set(path, top);
    persistView.call();
  };
  const moveScroll = (from: string, to: string) => {
    const next = new Map<string, number>();
    for (const [path, top] of scrollPositions.current) {
      const moved = path === from ? to : path.startsWith(from + '/') ? to + path.slice(from.length) : path;
      next.set(moved, top);
    }
    scrollPositions.current = next;
  };
  const reloadFile = async (path: string) => {
    flushEdits();
    const current = tabsRef.current.find((item) => item.path === path);
    const name = path.split('/').pop() ?? path;
    if (current && isDirty(current) && !await confirmDialog(t('Reload {name}? Your unsaved edits in this file are dropped.', { name }), { danger: true })) return;
    api.readFile(project.id, path).then((content) => update(path, { content, draft: textOf(content), saving: false, seen: stampOf(content, current?.seen) })).catch((e: Error) => setError(e.message));
  };

  // "Open with": the program kept for a file type (by extension) is a preference of this computer; the system's default never changes.
  const [kept, setKept] = useState<Record<string, { id: string; name: string }>>(() => { try { return JSON.parse(recall('qa-open-with') ?? '{}'); } catch { return {}; } });
  const keep = (ext: string, app: { id: string; name: string } | null) => {
    const next = { ...kept };
    if (app) next[ext] = { id: app.id, name: app.name }; else delete next[ext];
    remember('qa-open-with', JSON.stringify(next));
    setKept(next);
  };
  const extOf = (path: string) => path.slice(path.lastIndexOf('.')).toLowerCase();
  const openExternal = (path: string) => {
    const system = () => { api.openExternal(project.id, path).catch((e: Error) => setError(e.message)); };
    const app = kept[extOf(path)];
    if (!app) { system(); return; }
    api.openWith(project.id, path, app.id).catch(() => {
      keep(extOf(path), null);
      setNotice(t('{name} is no longer offered for this file, so it opened with the default program.', { name: app.name }));
      system();
    });
  };

  // Writes a tab's text. A .md tab writes from the text it started from: if the file changed outside Moki meanwhile
  // (the AI writing it), nothing is overwritten and the tab shows the conflict. What was typed after this save started stays.
  const write = useCallback((path: string, text: string, base?: string) => {
    update(path, { saving: true });
    api.writeFile(project.id, path, text, base)
      .then((content) => {
        const now = tabsRef.current.find((t) => t.path === path);
        update(path, { content, draft: now && now.draft !== text ? now.draft : textOf(content), saving: false, conflict: false, savedAt: Date.now() });
      })
      .catch((e: Error) => {
        if (e.message === CHANGED_OUTSIDE) { update(path, { saving: false, conflict: true }); return; }
        update(path, { saving: false });
        setError(t(e.message));
      });
  }, [project.id]);
  const save = useCallback((path: string) => {
    flushEdits();
    const tab = tabsRef.current.find((t) => t.path === path);
    if (!tab || !isDirty(tab) || tab.saving || tab.conflict) return;
    write(path, tab.draft, autosaves(tab) && 'text' in tab.content ? tab.content.text : undefined);
  }, [write]);

  // A change made by Moki itself (a comment in a .md): the new text is saved at once, edits not saved yet included.
  const commit = useCallback((path: string, text: string) => {
    const tab = tabsRef.current.find((t) => t.path === path);
    update(path, { draft: text });
    if (tab?.conflict) return; // saved once the conflict is settled
    write(path, text, tab && 'text' in tab.content ? tab.content.text : undefined);
  }, [write]);

  // The .md tabs save on their own once the typing pauses (Ctrl+S still saves at once).
  const autosaveTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = autosaveTimers.current;
    for (const tab of tabs) {
      if (!autosaves(tab) || !isDirty(tab) || tab.saving || tab.conflict) continue;
      clearTimeout(timers.get(tab.path));
      timers.set(tab.path, setTimeout(() => { timers.delete(tab.path); save(tab.path); }, AUTOSAVE_MS));
    }
  }, [tabs, save]);
  useEffect(() => () => { for (const timer of autosaveTimers.current.values()) clearTimeout(timer); }, []);
  // A file about to move or get a new name: its automatic save waits, then goes to the new path (the tabs follow it).
  const holdSaves = (path: string) => {
    for (const [file, timer] of autosaveTimers.current) if (file === path || file.startsWith(`${path}/`)) { clearTimeout(timer); autosaveTimers.current.delete(file); }
  };
  // The file changed outside Moki while a .md tab had edits: see the new version (the edits go), or keep mine (written over it).
  const takeTheirs = (path: string) => {
    api.readFile(project.id, path).then((content) => update(path, { content, draft: textOf(content), conflict: false })).catch((e: Error) => setError(e.message));
  };
  const keepMine = (path: string) => {
    flushEdits();
    const tab = tabsRef.current.find((t) => t.path === path);
    if (tab) write(path, tab.draft);
  };

  const close = useCallback(async (path: string) => {
    flushEdits();
    const tab = tabsRef.current.find((t) => t.path === path);
    if (tab && isDirty(tab) && autosaves(tab) && !tab.conflict) save(path); // it saves on its own: closing saves now
    else if (tab && isDirty(tab) && !await confirmDialog(t('Discard unsaved changes in {file}?', { file: path.split('/').pop() ?? path }), { danger: true })) return;
    scrollPositions.current.delete(path);
    setTabs((all) => all.filter((t) => t.path !== path));
    apply((b) => boardClose(b, fileKey(path)));
  }, [save, apply]);

  // Every terminal opens its own group (its name, the next color), shown in the focused view.
  const addTerminal = useCallback((t: TerminalRef) => { setTerms((all) => (all.some((x) => x.id === t.id) ? all : [...all, { ...t, running: true }])); apply((b) => boardTerminal(b, t.id, t.title)); }, [apply]);

  // Terminals outlive the project's screen: the ones still running for it come back as tabs, with what they printed meanwhile.
  useEffect(() => {
    const listing = api.term()?.list?.(project.id);
    if (!listing) { setTermsReady(true); return; }
    void listing.then((running) => {
      setTerms((all) => [...all, ...running.filter((r) => !all.some((x) => x.id === r.id)).map((r) => ({ ...r, running: true }))]);
      // Their groups come back as they were (the saved board); a terminal the board does not know gets a new group.
      apply((b) => running.reduce((acc, r) => (acc.tabs[termKey(r.id)] ? acc : boardTerminal(acc, r.id, r.title)), b));
    }).catch(() => { /* no terminals to bring back */ }).finally(() => { setTermsReady(true); deliverRef.current(); });
  }, [project.id, apply]);

  // The board keeps only tabs that exist (a saved board, a terminal closed elsewhere) and knows every open one.
  useEffect(() => {
    if (!termsReady || !viewReady) return;
    const alive = new Set<TabKey>([...tabs.map((x) => fileKey(x.path)), ...terms.map((x) => termKey(x.id)), ...(board.tabs[GRAPH] ? [GRAPH] : [])]);
    const known = Object.keys(board.tabs);
    if (known.length === alive.size && known.every((k) => alive.has(k))) return;
    apply((b) => [...alive].filter((k) => !b.tabs[k]).reduce((acc, k) => {
      const opened = boardOpen(acc, k, { background: true });
      return { ...opened, tabs: { ...opened.tabs, [k]: { ...opened.tabs[k], fresh: false } } };
    }, prune(b, alive)));
  }, [tabs, terms, termsReady, viewReady, board.tabs, apply]);

  // Operations move on when a step's files are there: the next step starts in a terminal tab (or waits for approval).
  const advancing = useRef(false);
  const advanceOps = useCallback(() => {
    if (advancing.current) return;
    advancing.current = true;
    api.advanceOperations(project.id)
      .then((ready) => Promise.all(ready.map((r) => api.startOperationStep(project.id, r.run, r.step, conversationLanguage())
        .then((res) => { if (res.terminal) addTerminal(res.terminal); else if (!res.opened) setError(res.message ?? t('Could not open the tool.')); })
        .catch((e: Error) => setError(e.message)))))
      .catch(() => { /* shown in the run */ })
      .finally(() => { advancing.current = false; setOpsTick((n) => n + 1); });
  }, [project.id, addTerminal]);
  advanceRef.current = advanceOps;
  useEffect(() => { advanceOps(); }, [advanceOps]);

  // A skill draft started in Settings opens here, once, when this project comes back.
  useEffect(() => {
    if (!pendingTerminal || openedTerm.current === pendingTerminal.id) return;
    openedTerm.current = pendingTerminal.id;
    addTerminal(pendingTerminal);
    onPendingTerminal?.();
  }, [pendingTerminal, addTerminal, onPendingTerminal]);

  // A file a note window mentions (clicked in its reading view) opens here.
  useEffect(() => {
    if (!pendingPath) return;
    const target = resolveInternal('', pendingPath, project.id, (path) => Boolean(findFile(treeRef.current, path)));
    if (target) openPath(target.path, 'preview', target.anchor);
    onPendingPath?.();
  }, [pendingPath, openPath, onPendingPath, project.id]);

  // tool '' opens the user's shell; otherwise the AI tool starts right away in the tab.
  // An AI opened here starts with the project's defaults unless plain; its tab says which ("Claude Code · failure-analyst").
  const newTerminal = (tool: string, plain = false) => {
    setTermMenu(null);
    setError('');
    const bridge = api.term();
    if (!bridge) { setError(t('Terminals are only available in the desktop app.')); return; }
    bridge.create(tool, project.id, { plain, language: conversationLanguage() })
      .then((r) => {
        if (!r.terminal) { setError(r.error ?? t('Could not open the terminal.')); return; }
        const mode = r.start ? (r.start.several ? t('project defaults') : t(r.start.label)) : '';
        addTerminal(mode ? { ...r.terminal, title: `${r.terminal.title} · ${mode}` } : r.terminal);
      })
      .catch((e: Error) => setError(e.message));
  };
  const openTermMenu = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTermMenu({ left: r.left, top: r.bottom + 4 });
  };

  // Closing the tab stops what runs in it (leaving the project does not: the terminal comes back when it opens again).
  // When it ran a step of an operation, the main process tells the run.
  const closeTerm = async (id: string) => {
    if (terms.find((t) => t.id === id)?.running && !await confirmDialog(t('Close this terminal? What is running in it will stop.'), { danger: true })) return;
    api.term()?.kill(id);
    setTerms((all) => all.filter((t) => t.id !== id));
    // Its group stays while it still has files open.
    apply((b) => { const group = b.tabs[termKey(id)]?.group; const next = boardClose(b, termKey(id)); return group ? dropGroup(next, group) : next; });
  };

  // Where a tree item is on this computer: shown selected in the file manager, or its full path copied.
  const openItemMenu = (node: TreeNode | null, at: { left: number; top: number }) => {
    const path = node?.path ?? '';
    const canCreate = (!node || node.type === 'dir') && path !== 'runs' && !path.startsWith('runs/');
    const rename = canRename(path) ? 36 : renameBlock(path) ? 64 : 0; // a disabled Rename has its reason under it
    setItemMenu({ path, canCreate, left: Math.min(at.left, window.innerWidth - 220), top: Math.min(at.top, window.innerHeight - (canCreate ? 160 : 90) - rename) });
  };
  // Favorite notes of this project (the star in a note, or the note's menu here). Note windows tell when it changes.
  const [favTick, setFavTick] = useState(0);
  useEffect(() => {
    const refresh = () => { setFavTick((n) => n + 1); void api.noteTitles(project.id).then((items) => setNoteTitles(Object.fromEntries(items.map((item) => [item.path, item.title])))).catch((e: Error) => setError(e.message)); };
    refresh();
    return api.onNotesChanged(refresh);
  }, [project.id]);
  const favorites = useMemo(() => new Set(favoriteNotes().filter((n) => n.project === project.id).map((n) => n.path)), [favTick, project.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // The sidebar shows the tree in blocks (files on top, the Operations card, Project settings and MCPs at the bottom); each block is a FileTree with the same behavior.
  const groups = useMemo(() => groupTree(tree), [tree]);
  const folderLabel = (path: string) => friendlyName((path.split('/').pop() || path) || t('the project folder'));
  const dropOnFolder = (folder: string, e: DragEvent) => {
    dragDepth.current = 0;
    setDropping(false);
    const from = e.dataTransfer.getData('application/x-moki-move');
    if (from) {
      flushEdits(); // the tab is renamed below: its pending text must reach it under the old path
      holdSaves(from);
      api.moveEntry(project.id, from, folder).then((path) => {
        moveScroll(from, path);
        loadTree();
        setExpanded((s) => new Set(s).add(folder));
        setTabs((all) => all.map((tab) => (tab.path === from ? { ...tab, path, content: { ...tab.content, path } } : tab)));
        apply((b) => boardRename(b, fileKey(from), fileKey(path)));
        if (note?.path === from && !/^notes\/[^/]+\.md$/.test(path)) openPath(path);
        setNote((cur) => (cur?.path === from ? (/^notes\/[^/]+\.md$/.test(path) ? { path } : null) : cur));
        if (isFavorite({ project: project.id, path: from })) {
          setFavorite({ project: project.id, path: from }, false);
          if (/^notes\/[^/]+\.md$/.test(path)) setFavorite({ project: project.id, path }, true);
          setFavTick((n) => n + 1);
          window.qa?.notesChanged();
        }
        setNotice(t('Moved {name} to {folder}.', { name: path.split('/').pop() ?? path, folder: folderLabel(folder) }));
      }).catch((err: Error) => setError(err.message));
      return;
    }
    const paths = Array.from(e.dataTransfer.files).map((f) => window.qa?.filePath(f) ?? '').filter(Boolean);
    if (!paths.length) { setError(t('Drop files from your computer.')); return; }
    api.importFiles(project.id, paths, folder).then((r) => {
      loadTree();
      setExpanded((s) => new Set(s).add(folder));
      for (const p of r.saved.slice(0, 8)) openPath(p);
      const label = folderLabel(folder);
      setNotice(r.saved.length === 1
        ? t('Added {name} to {folder}. It stays in this project.', { name: r.saved[0].split('/').pop() ?? '', folder: label })
        : t('Added {n} files to {folder}. They stay in this project.', { n: r.saved.length, folder: label }));
      setError(r.skipped.length ? t('Skipped {names}. Only files are kept, not folders.', { names: r.skipped.join(', ') }) : '');
    }).catch((err: Error) => setError(t(err.message)));
  };
  const treeProps = {
    tagColors: colorsOf, activePath: activeTerm || graphFocus ? null : active, onOpen: openPath, expanded,
    onNewNote: () => setNote({ path: null }), onMenu: openItemMenu, favorites, onIde: openIde, noteTitles, onReceive: dropOnFolder,
    renaming, onRenameStart: startRename, onRename: renameItem, onRenameEnd: () => setRenaming(null), focusPath, onFocused: () => setFocusPath(null),
    onToggle: (p: string) => setExpanded((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; }),
  };
  // Where New › File may save: the project's own folders (not the activities), then its root.
  const folders = useMemo(() => [
    ...tree.filter((n) => n.type === 'dir' && !n.path.startsWith('.') && n.path !== 'runs').map((n) => ({ path: n.path, label: friendlyName(n.name) })),
    { path: '', label: t('the project folder') },
  ], [tree]);
  // "Open in the IDE" (the linked folder): straight in with one IDE installed, a menu with more (the default AI first).
  const [ideMenu, setIdeMenu] = useState<{ left: number; top: number } | null>(null);
  const editors = tools.filter((x) => x.kind === 'editor' && x.available).sort((a, b) => Number(b.id === defaultTool()) - Number(a.id === defaultTool()));
  const runIde = (tool: string) => {
    setIdeMenu(null);
    api.openInEditor(project.id, tool).catch((e: Error) => setError(e.message));
  };
  function openIde(at: { left: number; top: number }) {
    if (!editors.length) { setError(t('No IDE found on this computer: install VS Code or Cursor (Settings › My AIs).')); return; }
    if (editors.length === 1) runIde(editors[0].id); else setIdeMenu({ left: Math.min(at.left, window.innerWidth - 240), top: at.top });
  }
  const isNote = (path: string) => /^notes\/[^/]+\.md$/.test(path);
  const toggleFavorite = (path: string) => {
    setItemMenu(null);
    setFavorite({ project: project.id, path }, !isFavorite({ project: project.id, path }));
    setFavTick((n) => n + 1);
    window.qa?.notesChanged();
  };
  const startCreate = (parent: string, kind: 'file' | 'folder') => { setItemMenu(null); setCreating({ parent, kind }); };
  const FIXED = new Set(['context', 'inbox', 'notes', 'temporary', 'runs']);
  const removeItem = async (path: string) => {
    setItemMenu(null);
    const name = friendlyName(path.split('/').pop() ?? path);
    const ask = FIXED.has(path)
      ? t('Empty "{name}"? Everything inside goes to the trash. The folder stays.', { name })
      : t('Delete "{name}"? It goes to the trash.', { name });
    if (!await confirmDialog(ask, { danger: true })) return;
    api.deleteEntry(project.id, path).then(() => {
      for (const file of scrollPositions.current.keys()) if (file === path || file.startsWith(path + '/')) scrollPositions.current.delete(file);
      loadTree();
      setTabs((all) => all.filter((tab) => tab.path !== path && !tab.path.startsWith(`${path}/`)));
      apply((b) => b.order.filter((k) => k === fileKey(path) || k.startsWith(`${fileKey(path)}/`)).reduce(boardClose, b));
    }).catch((e: Error) => setError(e.message));
  };
  // The new file opens to be written; a new folder shows open in the tree.
  const created = (path: string, kind: 'file' | 'folder') => {
    setCreating(null);
    loadTree();
    setExpanded((s) => { const n = new Set(s); if (kind === 'file' && !path.includes('/')) n.add(OTHER_FILES); path.split('/').slice(0, kind === 'folder' ? undefined : -1).reduce((acc, seg) => { const p = acc ? `${acc}/${seg}` : seg; n.add(p); return p; }, ''); return n; });
    if (kind === 'file') openPath(path, /\.(md|txt)$/i.test(path) ? 'edit' : 'preview'); // a new spreadsheet or Word file is shown, not edited here
  };
  // Rename in place. A note gets a new title (its file, and the links to it, stay); a file or folder
  // gets a new name on disk, and what points at it here follows: tabs, the open folders, the recent files.
  // F2 on an item that keeps its name says why, instead of doing nothing.
  function startRename(path: string): void {
    const reason = renameBlock(path);
    if (reason) setNotice(reason); else if (canRename(path)) setRenaming(path);
  }
  async function renameItem(path: string, name: string): Promise<void> {
    if (isNote(path)) {
      await api.setNoteTitle(project.id, path, name);
      setNoteTitles((all) => ({ ...all, [path]: name }));
      retitleNote({ project: project.id, path }, name);
      window.qa?.notesChanged();
      return;
    }
    holdSaves(path);
    const to = await api.renameEntry(project.id, path, name);
    if (to === path) return;
    moveScroll(path, to);
    const moved = (p: string) => (p === path ? to : p.startsWith(`${path}/`) ? to + p.slice(path.length) : p);
    flushEdits(); // the tabs are renamed below: text typed a moment ago must reach them under the old path
    setTabs((all) => all.map((tab) => { const p = moved(tab.path); return p === tab.path ? tab : { ...tab, path: p, content: { ...tab.content, path: p } }; }));
    apply((b) => b.order.filter((k) => k.startsWith('file:')).reduce((acc, k) => boardRename(acc, k, fileKey(moved(k.slice(5)))), b));
    setExpanded((all) => new Set([...all].map(moved)));
    renameRecentFile(project.id, path, to);
    // The row comes back under its new name, with the focus, so F2 or the arrows go on from it.
    setFocusPath(to);
    loadTree();
  }
  const revealItem = (path: string) => {
    setItemMenu(null);
    api.revealPath(project.id, path).catch((e: Error) => setError(e.message));
  };
  const copyItemPath = (path: string) => {
    setItemMenu(null);
    api.copyPath(project.id, path).then((full) => setNotice(t('Path copied: {path}', { path: full }))).catch((e: Error) => setError(e.message));
  };

  // Leaving the workspace keeps its terminals running (they come back with it); only unsaved changes ask first.
  const canLeave = async () => {
    flushEdits();
    for (const tab of tabsRef.current) if (isDirty(tab) && autosaves(tab) && !tab.conflict) save(tab.path);
    return !tabsRef.current.some((tab) => isDirty(tab) && (!autosaves(tab) || tab.conflict)) || await confirmDialog(t('There are unsaved changes. Leave anyway?'), { danger: true });
  };

  const goHome = async () => { if (await canLeave()) onHome(); };
  const hideThis = async () => {
    if (!await confirmDialog(t('Hide {name} from Moki? The files stay on this computer. You can show it again under Hidden.', { name: project.name }))) return;
    if (!await canLeave()) return;
    hideProject(project.id);
    onHome();
  };

  const toggleSettings = async () => { if (settings) onSettings(null); else if (await canLeave()) onSettings('agents'); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !active || activeTerm || graphFocus || note || document.querySelector('[aria-modal="true"]') || (document.activeElement as HTMLElement | null)?.closest('.note-inline')) return; // note editors own their shortcuts
      const key = e.key.toLowerCase();
      if (key === 's') { e.preventDefault(); save(active); }
      if (key === 'w') { e.preventDefault(); close(active); }
      if (key === 'e') {
        e.preventDefault();
        setTabs((all) => all.map((t) => (t.path === active && t.content.kind === 'markdown'
          ? { ...t, mode: t.mode !== 'source' ? 'source' : t.content.editable && t.why !== 'large' && t.why !== 'loss' ? 'edit' : 'preview' }
          : t)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, activeTerm, graphFocus, note, save, close]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { flushEdits(); if (tabsRef.current.some(isDirty)) e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  // Links a folder of this machine (chosen in the native dialog). Its AI settings are backed up inside it (.moki-backup/).
  const linkFolder = () => {
    setError(''); setNotice('');
    api.linkRepository(project.id).then((r) => {
      if (!r) return;
      onProjectChanged(); loadTree();
      setNotice(linkedNotice(r));
      setShowSetup(true);
    }).catch((e: Error) => setError(e.message));
  };

  const tab = activeTerm || graphFocus ? null : tabs.find((t) => t.path === active) ?? null;
  const runId = active?.match(/^runs\/([^/]+)\//)?.[1] ?? null;
  const words = tab && tab.content.kind === 'markdown' ? tab.draft.split(/\s+/).filter(Boolean).length : null;

  const fileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
  const onDragEnter = (e: DragEvent) => {
    if (!fileDrag(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDropping(true);
  };
  const onDragOver = (e: DragEvent) => {
    if (!fileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (e: DragEvent) => {
    if (!fileDrag(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDropping(false);
  };
  // A drop copies the files into the project inbox. They stay in the tree after this.
  const onDrop = (e: DragEvent) => {
    if (!fileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDropping(false);
    const paths = Array.from(e.dataTransfer.files).map((f) => window.qa?.filePath(f) ?? '').filter(Boolean);
    if (!paths.length) { setError(t('Drop files from your computer.')); return; }
    api.importFiles(project.id, paths).then((r) => {
      loadTree();
      setExpanded((s) => new Set(s).add('inbox'));
      for (const p of r.saved.slice(0, 8)) openPath(p);
      setNotice(r.saved.length === 1
        ? t('Added {name} to the inbox. It stays in this project.', { name: r.saved[0].split('/').pop() ?? '' })
        : t('Added {n} files to the inbox. They stay in this project.', { n: r.saved.length }));
      setError(r.skipped.length ? t('Skipped {names}. Only files are kept, not folders.', { names: r.skipped.join(', ') }) : '');
    }).catch((err: Error) => setError(t(err.message)));
  };

  const resolveProjectLink = useCallback((from: string, href: string) => resolveInternal(from, href, project.id, (path) => Boolean(findFile(tree, path))), [tree, project.id]);
  const onLinkFrom = (from: string, href: string) => {
    if (/^https?:\/\//i.test(href)) { void api.openLink(href); return; }
    const target = resolveProjectLink(from, href);
    if (target) openPath(target.path, 'preview', target.anchor);
    else flash(t('This link does not point to a file in this project.'));
  };

  const renderDoc = (doc: Tab) => (
    <DocView
      key={doc.path}
      content={doc.content}
      tags={doc.path !== 'project.json' && doc.path !== 'tags.json' && !doc.path.startsWith('@folder') ? <TagPicker catalog={catalog} value={fileTags[doc.path] ?? []} onChange={(ids) => tagFile(doc.path, ids)} onCatalog={setCatalog} compact /> : undefined}
      project={project.id}
      mode={doc.mode}
      initialScrollTop={scrollPositions.current.get(doc.path) ?? doc.scrollTop}
      onScroll={(top) => rememberScroll(doc.path, top)}
      draft={doc.draft}
      dirty={isDirty(doc)}
      saving={doc.saving}
      onDraft={(draft) => update(doc.path, { draft })}
      onMode={(mode) => update(doc.path, { mode })}
      onQuiet={() => update(doc.path, { why: undefined, quiet: true })}
      why={doc.why}
      autosave={autosaves(doc)}
      savedAt={doc.savedAt}
      conflict={doc.conflict}
      onTakeTheirs={() => takeTheirs(doc.path)}
      onKeepMine={() => keepMine(doc.path)}
      onRewrite={doc.quiet ? undefined : (kind) => update(doc.path, kind === 'loss' ? { mode: 'preview', why: 'loss' } : { why: 'format' })}
      onSave={() => save(doc.path)}
      onCommit={(text) => commit(doc.path, text)}
      onOpenExternal={() => openExternal(doc.path)}
      onReload={() => reloadFile(doc.path)}
      onLink={(href) => onLinkFrom(doc.path, href)}
      resolveLink={resolveProjectLink}
      jump={doc.jump}
      onMissingAnchor={() => flash(t('The referenced section, comment or page was not found.'))}
      onPdfSaved={(path) => {
        if (path !== doc.path) { openPath(path); return; }
        api.readFile(project.id, path).then((content) => update(path, { content, draft: textOf(content), seen: stampOf(content, doc.seen) })).catch((e: Error) => setError(e.message));
      }}
      openWith={{
        kept: kept[extOf(doc.path)] ?? null,
        apps: () => api.openWithApps(project.id, doc.path).catch((e: Error) => { setError(e.message); return null; }),
        open: (app, always) => {
          if (app && always) keep(extOf(doc.path), app);
          api.openWith(project.id, doc.path, app?.id ?? '').catch((e: Error) => setError(e.message));
        },
        reset: () => keep(extOf(doc.path), null),
      }}
    />
  );
  // ---- groups and views
  const titleOf = (key: TabKey): PaneTab => {
    if (key.startsWith('term:')) {
      const term = terms.find((x) => x.id === key.slice(5));
      const title = term?.title ?? t('Terminal');
      return { key, term: true, label: title, title: term?.running === false ? t('{title} (finished)', { title }) : title, icon: <IconTerminal size={13} />, exited: term?.running === false };
    }
    if (key === GRAPH) return { key, label: t('Graph view'), title: t('Graph view'), icon: <IconGraph size={14} /> };
    const path = key.slice(5);
    const doc = tabs.find((x) => x.path === path);
    return { key, label: path.split('/').pop() ?? path, title: path, icon: <FileIcon name={path} size={14} />, dirty: doc ? isDirty(doc) : false, fresh: board.tabs[key]?.fresh };
  };
  const selectTab = (key: TabKey) => { if (key.startsWith('file:')) touchRecentFile(project.id, key.slice(5)); apply((b) => show(b, key)); };
  const closeTab = (key: TabKey) => { if (key.startsWith('term:')) closeTerm(key.slice(5)); else if (key === GRAPH) closeGraph(); else close(key.slice(5)); };
  const closeGroupFiles = (group: string) => {
    for (const key of tabsOfGroup(board, group)) if (key.startsWith('file:')) close(key.slice(5));
    apply((b) => dropGroup(b, group));
  };
  const newGroupFor = (key: TabKey, at: { left: number; top: number }) => {
    const made = newGroup(board, t('Group {n}', { n: board.groups.length }));
    setBoard(moveToGroup(made.board, key, made.id));
    setGroupMenu({ id: made.id, ...at }); // named and colored right away
  };
  // Dragging a divider: its position in % of the views' area.
  const panesBox = useRef<HTMLDivElement>(null);
  const dragSplit = (axis: 'x' | 'y') => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const r = panesBox.current?.getBoundingClientRect();
      if (!r) return;
      apply((b) => (axis === 'x' ? setSplit(b, ((ev.clientX - r.left) / r.width) * 100, b.split.y) : setSplit(b, b.split.x, ((ev.clientY - r.top) / r.height) * 100)));
    };
    const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
  };
  const views = board.panes.length;
  // The view at the top right holds the layout and New buttons.
  const TOP_RIGHT: Record<Board['arrangement'], number> = { 1: 0, 2: 1, '2r': 0, 3: 1, 4: 1 };

  return (
    <div
      className={`workspace${(panelRail || docSide) && !settings ? ' panel-rail' : ''}${sidebarCollapsed && !settings ? ' sidebar-collapsed' : ''}${settings ? ' is-settings' : ''}${dropping ? ' dropping' : ''}`}
      style={sidebarWidth === null ? undefined : { '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}
      onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      <Ribbon
        project={project}
        settingsOn={settings !== null}
        onHome={goHome}
        onNewNote={() => { if (settings) onNewLooseNote(); else { setOpView(null); setActivityView(null); setNote({ path: null, loose: true }); } }}
        onSettings={toggleSettings}
        onPlay={() => setLaunch({ activity: 'open' })}
        onTerminal={openTermMenu}
        onFolder={() => { void api.openFolder(project.id); }}
        onLink={linkFolder}
        onRefresh={() => { loadTree(); setRefreshKey((k) => k + 1); }}
        onPanel={() => setSidebarOpen(sidebarCollapsed)}
        sidebarCollapsed={sidebarCollapsed}
        searchOn={search}
        onSearch={onSearch ? () => { setSidebarOpen(true); onSearch(); } : undefined}
      />

      {settings ? (
        <main className="main">
          <Settings tab={settings} onTab={onSettings} onClose={() => onSettings(null)} project={project} projects={[project]} tools={tools} onTerminal={(term) => { onSettings(null); addTerminal(term); }} onToolsChanged={onToolsChanged} />
        </main>
      ) : <>
      <aside className="sidebar" ref={sidebar}>
        <div className="sidebar-resize" role="separator" aria-orientation="vertical" aria-label={t('Resize file sidebar')} aria-valuemin={180} aria-valuemax={720} aria-valuenow={sidebarWidth ?? 260} tabIndex={0}
          onPointerDown={(e) => { if (e.button !== 0) return; e.preventDefault(); const width = sidebar.current?.getBoundingClientRect().width ?? 260; resizeSidebar.current = { startX: e.clientX, startWidth: width, width }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { const drag = resizeSidebar.current; if (!drag) return; drag.width = sidebarWidthWithinBounds(drag.startWidth + e.clientX - drag.startX); setSidebarWidth(drag.width); }}
          onPointerUp={() => { const drag = resizeSidebar.current; if (drag) remember('qa-sidebar-width', String(drag.width)); resizeSidebar.current = null; }}
          onPointerCancel={() => { resizeSidebar.current = null; }}
          onKeyDown={(e) => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); const width = sidebarWidthWithinBounds((sidebar.current?.getBoundingClientRect().width ?? 260) + (e.key === 'ArrowRight' ? 20 : -20)); setSidebarWidth(width); remember('qa-sidebar-width', String(width)); }} />
        {search && onSearch && onFound ? <SearchPanel onOpenProject={(id) => onFound(id)} onOpenFile={onFound} onClose={onSearch} /> : <>
        <div className="sidebar-head">
          <button type="button" className="project-switch" onClick={goHome} title={t('Switch project')}>{project.name}</button>
          <button type="button" className="icon-btn sidebar-more" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); openItemMenu(null, { left: r.left, top: r.bottom + 2 }); }}
            title={t('Project folder options')} aria-label={t('Project folder options')} aria-haspopup="menu"><IconMore size={16} /></button>
          <button type="button" className="icon-btn sidebar-hide" onClick={hideThis} title={t('Hide from Moki')} aria-label={t('Hide from Moki')}><IconEyeOff size={16} /></button>
        </div>
        <div className="sidebar-tags" title={t('Projects and files with the same tag share their context with this project')}>
          <TagPicker catalog={catalog} value={project.tags} onChange={tagProject} onCatalog={setCatalog} compact />
        </div>
        <div className="sidebar-scroll" onContextMenu={(e) => { e.preventDefault(); openItemMenu(null, { left: e.clientX, top: e.clientY }); }}>
          <FileTree {...treeProps} nodes={groups.main} />
        </div>
        {/* Fixed at the bottom of the sidebar, whatever the scroll: Project settings and the MCP servers. */}
        <div className="sidebar-foot"><FileTree {...treeProps} nodes={groups.settings} /></div>
        </>}
      </aside>

      <main className="main">
        {(activityView || opView) && !note && (
          <div className="note-host ops-host">
            {activityView
              ? <ActivityRunView key={activityView} project={project.id} run={activityView} onClose={() => setActivityView(null)}
                  onResume={() => setLaunch({ activity: 'resume', run: activityView })}
                  onOpenFile={(path) => { setActivityView(null); openPath(path); }} />
              : opView?.kind === 'launch'
              ? <OperationLaunch key={opView.id} project={project.id} operation={opView.id} tools={tools} onClose={() => setOpView(null)}
                  onStarted={(run) => { setOpView({ kind: 'run', id: run.id }); advanceOps(); }} />
              : opView && <OperationRunView key={opView.id} project={project.id} run={opView.id} tick={opsTick} tools={tools}
                  hasTerminal={(id) => terms.some((x) => x.id === id)}
                  onTerminal={(term) => { setOpView(null); addTerminal(term); }}
                  onOpenFile={(path) => openPath(path)} onClose={() => setOpView(null)} onChanged={advanceOps} />}
          </div>
        )}
        {note && (
          <div className="note-host">
            <NoteDialog key={note.loose ? 'loose' : note.path ?? 'new'} embedded project={note.loose ? null : project.id} path={note.path} onMyAis={() => onSettings('ai')}
              onLink={note.loose ? undefined : (href) => onLinkFrom(note.path ?? 'notes/note.md', href)}
              projects={note.loose ? noteProjects : undefined}
              onSaved={(saved) => { if ('path' in saved && saved.path !== note.path) loadTree(); }}
              onClose={() => { const loose = note.loose; setNote(null); loadTree(); if (loose) document.querySelector<HTMLElement>('.ribbon .ribbon-note')?.focus(); }} />
          </div>
        )}
        {notice && <div className="error-bar info-bar" role="status">{notice}<button type="button" className="icon-btn" onClick={() => setNotice('')}><IconX size={14} /></button></div>}
        {error && <div className="error-bar">{error}<button type="button" className="icon-btn" onClick={() => setError('')}><IconX size={14} /></button></div>}
        <div ref={panesBox} className={`panes arr-${board.arrangement}`} style={{ '--split-x': `${board.split.x}%`, '--split-y': `${board.split.y}%` } as CSSProperties}>
          {board.panes.map((pane, i) => {
            const keys = tabsOfPane(board, i);
            const group = groupOf(board, pane.group);
            const doc = pane.active?.startsWith('file:') ? tabs.find((x) => x.path === pane.active!.slice(5)) : undefined;
            return (
              <section key={i} className={`pane pane-${i}${views > 1 && board.focus === i ? ' focused' : ''}`} style={groupStyle(group)} aria-label={t('View {n}', { n: i + 1 })}
                onMouseDownCapture={() => { if (board.focus !== i) apply((b) => focusPane(b, i)); }}>
                <PaneHead groups={board.groups} shown={pane.group} counts={(id) => tabsOfGroup(board, id).length} fresh={(id) => freshIn(board, id)}
                  tabs={keys.map(titleOf)} active={pane.active} onSelect={selectTab} onClose={closeTab}
                  onShowGroup={(id) => apply((b) => showGroup(b, id, i))} onGroupMenu={(id, at) => setGroupMenu({ id, ...at })}
                  onTabMenu={(key, at) => setTabMenu({ key, ...at })} onDropTab={(key) => apply((b) => moveToPane(b, key, i))}
                  actions={i === TOP_RIGHT[board.arrangement] ? <>
                    <LayoutButton arrangement={board.arrangement} onArrange={(a) => apply((b) => arrange(b, a))} />
                    <AddButton size="md" variant="ghost" title={t('New: terminal, AI or file')} onClick={openTermMenu} />
                  </> : undefined}
                />
                <div className="pane-body">
                  {terms.filter((x) => keys.includes(termKey(x.id))).map((x) => (
                    <TerminalView key={x.id} id={x.id} project={project.id} active={pane.active === termKey(x.id)} resolveLink={(href) => resolveProjectLink('', href)?.found ?? false} onLink={(href) => onLinkFrom('', href)} onExit={() => setTerms((all) => all.map((y) => (y.id === x.id ? { ...y, running: false } : y)))} />
                  ))}
                  {pane.active === GRAPH ? (
                    <div className="welcome">
                      <h1>{t('Graph view')}</h1>
                      <p className="muted">{t('Under construction.')}</p>
                    </div>
                  ) : doc ? renderDoc(doc) : pane.active?.startsWith('term:') ? null : i === 0 && keys.length === 0 ? (
                    <div className="welcome">
                      <img className="hero" src={THINKING_CAT} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      <h1>{project.name}</h1>
                      <p className="muted">{t('Open or drop a file to get started.')}</p>
                    </div>
                  ) : (
                    <div className="welcome pane-empty"><p className="muted">{t('Choose a group above, or drag a tab here.')}</p></div>
                  )}
                </div>
              </section>
            );
          })}
          {(board.arrangement === '2' || board.arrangement === '3' || board.arrangement === '4') && <div className="split split-x" role="separator" aria-orientation="vertical" aria-label={t('Resize the views')} onPointerDown={dragSplit('x')} />}
          {(board.arrangement === '2r' || board.arrangement === '3' || board.arrangement === '4') && <div className="split split-y" role="separator" aria-orientation="horizontal" aria-label={t('Resize the views')} onPointerDown={dragSplit('y')} />}
        </div>
      </main>

      <SidePanel project={project} runId={runId} refreshKey={refreshKey} tools={tools} onOpenPath={openPath} onLaunch={openCall} onOperationRun={showOperationRun} onOpenRun={openListedRun} onSetup={() => setShowSetup(true)} collapsed={panelRail || docSide} onToggle={toggleSide} graphOn={graphFocus} onGraph={toggleGraph} onMyAis={() => onSettings('ai')}
        operations={(
          <OperationsPanel project={project.id} tick={opsTick} active={activityView ?? opView?.id ?? null} launches={activityLaunches} activityLaunchTick={activityLaunchTick}
            onDismissLaunch={(id) => setActivityLaunches((items) => items.filter((item) => item.id !== id))} onActivityRun={showActivity}
            onResumeActivity={(id) => setLaunch({ activity: 'resume', run: id })}
            onRun={showOperationRun} />
        )} />
      </>}

      {dropping && <div className="drop-veil" role="status">{t('Drop to keep the files in this project')}</div>}

      <footer className="statusbar">
        <span>{project.name}</span>
        {tab && <span className="muted">{tab.path}</span>}
        {tab && isDirty(tab) && <span className="warn-text">{t('unsaved')}</span>}
        <span className="statusbar-spacer" />
        {words !== null && <span className="muted">{t('{n} words', { n: words })}</span>}
        <UsageStatus names={{ [project.id]: project.name }} terminals={terms} onTerminal={(id) => apply((b) => show(b, termKey(id)))} />
      </footer>

      {termMenu && (
        <NewMenu at={termMenu} tools={tools} onTerminal={newTerminal} withDefaults={project.defaults.some((d) => d.kind !== 'operation') || Boolean(project.startInstructions.trim())} onClose={() => setTermMenu(null)}
          onFile={(ext) => { setTermMenu(null); setCreating({ parent: tree.some((n) => n.path === 'inbox') ? 'inbox' : '', kind: 'file', ext }); }}
          onCraft={() => { setTermMenu(null); setCraftOpen(true); }} />
      )}
      {ideMenu && (
        <div className="menu-backdrop" onMouseDown={() => setIdeMenu(null)}>
          <ul className="term-menu" role="menu" aria-label={t('Open in the IDE')} style={ideMenu} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setIdeMenu(null); }}>
            {editors.map((ed, i) => (
              <li key={ed.id}><button type="button" role="menuitem" autoFocus={i === 0} onClick={() => runIde(ed.id)}><IconCode size={15} /> {ed.label.replace(/ \(.*\)$/, '')}</button></li>
            ))}
          </ul>
        </div>
      )}
      {craftOpen && <CraftDownloads onClose={() => setCraftOpen(false)} />}
      {groupMenu && groupOf(board, groupMenu.id) && (
        <GroupMenu group={groupOf(board, groupMenu.id)!} at={groupMenu} onClose={() => setGroupMenu(null)}
          onRename={(name) => apply((b) => renameGroup(b, groupMenu.id, name))} onColor={(c) => apply((b) => colorGroup(b, groupMenu.id, c))}
          onCloseFiles={() => closeGroupFiles(groupMenu.id)} />
      )}
      {tabMenu && board.tabs[tabMenu.key] && !tabMenu.key.startsWith('term:') && (
        <TabMenu at={tabMenu} groups={board.groups} current={board.tabs[tabMenu.key].group} onClose={() => setTabMenu(null)}
          onMove={(group) => apply((b) => moveToGroup(b, tabMenu.key, group))} onNewGroup={() => newGroupFor(tabMenu.key, tabMenu)} />
      )}
      {hudson && <HudsonDialog project={project.id} onClose={() => setHudson(false)} onDone={() => { void loadTree(); }} onMyAis={() => { setHudson(false); onSettings('ai'); }} />}
      {itemMenu && (
        <div className="menu-backdrop" onMouseDown={() => setItemMenu(null)} onContextMenu={(e) => { e.preventDefault(); setItemMenu(null); }}>
          <ul className="term-menu item-menu" role="menu" style={{ left: itemMenu.left, top: itemMenu.top }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setItemMenu(null); }}>
            {itemMenu.path === '' && <>
              <li><button type="button" role="menuitem" onClick={() => { setItemMenu(null); setShowSetup(true); }}><IconSliders size={15} /> {t('Project settings')}</button></li>
              <li className="ws-menu-sep" />
            </>}
            {itemMenu.path === 'runs' && <>
              <li><button type="button" role="menuitem" autoFocus onClick={() => { setItemMenu(null); setHudson(true); }}><IconBroom size={15} /> {t('Organize with Hudson')}</button></li>
              <li className="ws-menu-sep" />
            </>}
            {itemMenu.canCreate && <>
              <li><button type="button" role="menuitem" autoFocus onClick={() => startCreate(itemMenu.path, 'file')}><IconFile size={15} /> {t('New file')}</button></li>
              <li><button type="button" role="menuitem" onClick={() => startCreate(itemMenu.path, 'folder')}><IconFolder size={15} /> {t('New folder')}</button></li>
              <li className="ws-menu-sep" />
            </>}
            {isNote(itemMenu.path) && <>
              <li><button type="button" role="menuitem" autoFocus onClick={() => { const path = itemMenu.path; setItemMenu(null); void api.openNoteWindow({ project: project.id, path }); }}>
                <IconExternal size={15} /> {t('Open in the notebook')}
              </button></li>
              <li><button type="button" role="menuitem" onClick={() => toggleFavorite(itemMenu.path)}>
                <span className={`star-mark${favorites.has(itemMenu.path) ? '' : ' off'}`}><IconStar size={15} /></span> {favorites.has(itemMenu.path) ? t('Remove from favorites') : t('Add to favorites')}
              </button></li>
              <li className="ws-menu-sep" />
            </>}
            {canRename(itemMenu.path) && (
              <li><button type="button" role="menuitem" autoFocus={!itemMenu.canCreate && !isNote(itemMenu.path)} onClick={() => { const path = itemMenu.path; setItemMenu(null); setRenaming(path); }}>
                <IconEdit size={15} /> {t('Rename')}<kbd className="menu-key">F2</kbd>
              </button></li>
            )}
            {renameBlock(itemMenu.path) && (
              <li className="menu-blocked">
                <button type="button" role="menuitem" disabled aria-describedby="rename-blocked-why"><IconEdit size={15} /> {t('Rename')}</button>
                <span id="rename-blocked-why" className="menu-why">{renameBlock(itemMenu.path)}</span>
              </li>
            )}
            <li><button type="button" role="menuitem" autoFocus={!itemMenu.canCreate && !isNote(itemMenu.path) && !canRename(itemMenu.path)} onClick={() => revealItem(itemMenu.path)}><IconFolder size={15} /> {t('Show in folder')}</button></li>
            <li><button type="button" role="menuitem" onClick={() => copyItemPath(itemMenu.path)}><IconCopy size={15} /> {t('Copy path')}</button></li>
            {findFile(tree, itemMenu.path) && <li><button type="button" role="menuitem" onClick={() => {
              const path = itemMenu.path; setItemMenu(null);
              api.copyText(projectLink(path)).then(() => flash(t('Link copied.'))).catch((e: Error) => setError(e.message));
            }}><IconCopy size={15} /> {t('Copy link')}</button></li>}
            {itemMenu.path !== 'project.json' && itemMenu.path !== '@folder' && !itemMenu.path.startsWith('.') && (
              <li><button type="button" role="menuitem" className="danger" onClick={() => removeItem(itemMenu.path)}><IconTrash size={15} /> {t('Delete')}</button></li>
            )}
          </ul>
        </div>
      )}
      {creating && <NewEntryDialog project={project.id} parent={creating.parent} kind={creating.kind} ext={creating.ext} folders={creating.ext ? folders : undefined} onClose={() => setCreating(null)} onCreated={(path) => created(path, creating.kind)} />}
      {showSetup && <SetupDialog project={project} onClose={() => setShowSetup(false)}
        onSaved={(activity) => { setShowSetup(false); onProjectChanged(); if (activity) setLaunch({ activity }); }} />}
      {launch && <LaunchDialog project={project} tools={tools} preset={launch} onClose={() => setLaunch(null)} onTerminal={(t) => { setLaunch(null); addTerminal(t); }}
        onPrepared={(terminal) => {
          setLaunch(null); apply((b) => show(b, termKey(terminal.id)));
          flash(t('Request pasted. Add context and press Enter when ready.'));
          requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.term-pane:not([hidden]) textarea')?.focus());
        }} onActivityStart={beginActivity} onActivityUpdate={updateActivity} onOperation={startOperationForm} onMyAis={() => { setLaunch(null); onSettings('ai'); }} />}
    </div>
  );
}
