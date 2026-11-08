import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type ReactElement } from 'react';
import { describeRun, statusLabel, type TreeNode } from '../api';
import { t } from '../i18n';
import { IconChevron, IconCode, IconFolder, IconLink, IconList, IconMcp, IconMore, IconPlus, IconSliders, IconStar } from './Icons';
import { FileIcon, SectionIcon, isSectionIconName } from '../icons';
import { RenameField, tooLong } from './RenameField';

interface Props {
  nodes: TreeNode[];
  activePath: string | null;
  onOpen: (path: string) => void;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onNewNote: () => void;
  tagColors?: (path: string) => string[]; // colors of the file's tags
  onMenu?: (node: TreeNode, at: { left: number; top: number }) => void; // the item's menu: right click or its ⋯ button
  favorites?: Set<string>; // favorite notes: a star, and first in the notes folder
  noteTitles?: Record<string, string>;
  onIde?: (at: { left: number; top: number }) => void; // "Open in the IDE" on the linked folder's row
  onReceive?: (folder: string, event: ReactDragEvent) => void; // a file dropped on this folder
  renaming?: string | null; // the item whose name is being edited in place
  onRenameStart?: (path: string) => void; // F2 on a row (the screen says why when the item keeps its name)
  onRename?: (path: string, name: string) => Promise<void>; // rejects with the reason the name was refused
  onRenameEnd?: () => void;
  onSetup?: () => void; // the Project settings group ends with a row that opens them
  focusPath?: string | null; // a row to take the focus once it is shown (a file just renamed comes back under its new path)
  onFocused?: () => void;
}

export const friendlyName = (name: string): string => ({
  context: t('Context'), inbox: t('Inbox'), runs: t('Execution files'), notes: t('Notes'), temporary: t('Temporary'),
  'proposed-updates.md': t('Proposed updates'), 'activity-log.md': t('Activity log'),
} as Record<string, string>)[name] ?? name;

// The sidebar's file blocks: the folders, then groups that exist only here - Tracking (the two
// files Moki keeps up to date: proposed updates and the activity log) and Other files (what the
// user left loose in the project root) - and, below Operations, Project settings (README.md,
// project.json) and the MCP servers. Display only: nothing moves on disk. A group's path starts
// with "." (never a real entry: the tree skips dot files).
const TRACKING = ['proposed-updates.md', 'activity-log.md'];
const SETTINGS = ['README.md', 'project.json'];
export const OTHER_FILES = '.other';
// Project settings uses sliders: a gear would read as Moki's own Settings.
const GROUP_ICONS: Record<string, (p: { size?: number }) => ReactElement> = { '@folder': IconLink, '.tracking': IconList, [OTHER_FILES]: IconFolder, '.settings': IconSliders, '.mcps': IconMcp };

export function groupTree(nodes: TreeNode[]): { main: TreeNode[]; settings: TreeNode[] } {
  const mcps = nodes.find((n) => n.path === '.mcps');
  const files = nodes.filter((n) => n !== mcps);
  const pick = (names: string[]) => names.flatMap((name) => files.filter((n) => n.type === 'file' && n.name === name));
  const group = (name: string, path: string, children: TreeNode[]): TreeNode[] => (children.length ? [{ name, path, type: 'dir', children }] : []);
  const other = files.filter((n) => n.type === 'file' && !TRACKING.includes(n.name) && !SETTINGS.includes(n.name));
  return {
    main: [
      ...files.filter((n) => n.type === 'dir'),
      ...group(t('Tracking'), '.tracking', pick(TRACKING)),
      ...group(t('Other files'), OTHER_FILES, other),
    ],
    settings: [...group(t('Project settings'), '.settings', pick(SETTINGS)), ...(mcps ? [mcps] : [])],
  };
}

// One indent step = the caret (14px) + the row gap (6px), so a folder's children
// line up under the folder's own icon.
const INDENT = 20;

const statusClass = (s: string): string => (s === 'completed' ? 'dot-ok' : s === 'cancelled' ? 'dot-muted' : s === 'blocked' ? 'dot-err' : 'dot-warn');

export function FileTree(props: Props) {
  return <ul className="tree" role="tree">{props.nodes.map((n) => <Node key={n.path} node={n} depth={0} {...props} />)}</ul>;
}

const canMove = (path: string) => !path.startsWith('.') && path !== 'project.json' && path !== 'tags.json' && !path.startsWith('runs/') && !path.startsWith('@folder');
// Why a tree item keeps its name ('' = it can be renamed). Mirrors the service's renameEntry, which
// has the last word. The menu still shows Rename for these, disabled, with this reason under it.
const FIXED_FOLDERS = new Set(['context', 'inbox', 'runs', 'notes', 'temporary']);
const MOKI_FILES = new Set(['project.json', 'tags.json', 'README.md', 'activity-log.md', 'proposed-updates.md']);
export const renameBlock = (path: string): string => {
  if (FIXED_FOLDERS.has(path)) return t('The project’s fixed folders keep their names.');
  if (path.startsWith('runs/')) return t('The activity uses these names to continue and to check what it delivered.');
  if (MOKI_FILES.has(path)) return t('Moki finds this file by its name.');
  if (path === '@folder') return t('This is your own folder: rename it on your computer.');
  return '';
};
// Sidebar groups (".tracking"…) and the project folder itself have no Rename at all.
export const canRename = (path: string): boolean => Boolean(path) && !path.startsWith('.') && !renameBlock(path);
const isNotePath = (path: string) => /^notes\/[^/]+\.md$/.test(path);
const extOf = (name: string) => { const dot = name.lastIndexOf('.'); return dot > 0 ? name.slice(dot) : ''; };
// Same rule as the service: a file or folder name every system accepts.
const fileNameProblem = (value: string): string => tooLong(value)
  || (/[<>:"/\\|?*\u0000-\u001f]/.test(value) || value.startsWith('.') || /[. ]$/.test(value) || /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(value)
    ? t('Use a name without / \\ : * ? " < > |, not starting or ending with a dot.') : '');

const canReceive = (path: string) => !path.startsWith('.') && path !== 'runs' && !path.startsWith('runs/') && path !== '@folder' && !path.startsWith('@folder/');

function Node(props: Props & { node: TreeNode; depth: number }) {
  const { node, depth, activePath, onOpen, expanded, onToggle, onNewNote, tagColors, onMenu, favorites, onIde, noteTitles, onReceive, renaming, onRenameStart, onRename, onRenameEnd, focusPath, onFocused } = props;
  const [hover, setHover] = useState(false);
  const [dropOn, setDropOn] = useState(false);
  const editing = renaming === node.path && Boolean(onRename);
  const note = isNotePath(node.path);
  const ext = node.type === 'file' && !note ? extOf(node.name) : '';
  // Back from typing a name (Esc, or a note's new title): the focus returns to the row.
  const row = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => { if (wasEditing.current && !editing) row.current?.focus(); wasEditing.current = editing; }, [editing]);
  useEffect(() => { if (focusPath === node.path && row.current) { row.current.focus(); onFocused?.(); } }, [focusPath, node.path]); // eslint-disable-line react-hooks/exhaustive-deps
  const isDir = node.type === 'dir';
  const open = expanded.has(node.path);
  const run = node.run ? describeRun(node.name) : null;
  if (node.mcp) {
    return <li role="treeitem"><div className="tree-row" style={{ paddingLeft: 8 + depth * INDENT }} title={`${node.name}\n${node.mcp}`}>
      <span className="tree-icon"><IconMcp size={14} /></span><span className="tree-label">{node.name}</span><span className="tree-meta">{node.mcp}</span>
    </div></li>;
  }
  const section = depth === 0 && isDir && isSectionIconName(node.name) ? node.name : null;
  const origin = node.run?.activity ? t(node.run.activity.label) : '';
  // A run's folder: the tree is narrow, so its row says what tells it apart (the scenario); the whole name
  // (activity · scenario, as in the Requests card) is in its tooltip.
  const runName = !run ? '' : origin ? (node.run?.scenario ? `${origin} · ${node.run.scenario}` : origin) : node.run?.scenario || run.title;
  const label = run ? node.run?.scenario || runName : depth === 0 || !node.path.includes('/') ? friendlyName(node.name) : node.path.startsWith('notes/') ? noteTitles?.[node.path] ?? node.name.replace(/\.md$/, '') : node.name;
  const menu = node.path.startsWith('.') ? undefined : onMenu; // a group of the sidebar, not a folder: nothing to create, reveal or copy
  const noteDrag = !isDir && /^notes\/[^/]+\.md$/.test(node.path);
  const movable = !isDir && canMove(node.path);
  const receive = isDir && canReceive(node.path) && Boolean(onReceive);
  const accepts = (e: ReactDragEvent) => {
    const types = Array.from(e.dataTransfer.types);
    return types.includes('Files') || types.includes('application/x-moki-move');
  };

  const icons = <>
    {isDir ? <span className={`tree-caret${open ? ' open' : ''}`}><IconChevron size={14} /></span> : <span className="tree-icon"><FileIcon name={node.name} size={16} /></span>}
    {section && <span className="tree-section-icon"><SectionIcon name={section} size={16} /></span>}
    {!section && node.path in GROUP_ICONS && <span className="tree-section-icon tree-group-icon">{GROUP_ICONS[node.path]({ size: 16 })}</span>}
  </>;

  return (
    <li role="treeitem" aria-expanded={isDir ? open : undefined}>
      <div className="tree-line">
      {editing ? (
        <div className={`tree-row renaming${activePath === node.path ? ' active' : ''}${depth === 0 && isDir ? ' top' : ''}`} style={{ paddingLeft: 8 + depth * INDENT }}>
          {icons}
          <RenameField label={label} initial={note ? label : ext ? node.name.slice(0, -ext.length) : node.name} suffix={ext || undefined}
            check={note ? tooLong : fileNameProblem} onRename={(name) => onRename!(node.path, name)} onEnd={() => onRenameEnd?.()} />
        </div>
      ) : (
      <button
        ref={row}
        type="button"
        className={`tree-row${activePath === node.path ? ' active' : ''}${depth === 0 && isDir ? ' top' : ''}${dropOn ? ' drop-on' : ''}`}
        style={{ paddingLeft: 8 + depth * INDENT }}
        draggable={noteDrag || movable}
        onDragStart={(e) => {
          if (noteDrag) e.dataTransfer.setData('application/x-moki-note', JSON.stringify({ path: node.path }));
          if (movable) e.dataTransfer.setData('application/x-moki-move', node.path);
          e.dataTransfer.effectAllowed = noteDrag && movable ? 'copyMove' : noteDrag ? 'copy' : 'move';
        }}
        onDragOver={receive ? (e) => { if (!accepts(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = Array.from(e.dataTransfer.types).includes('Files') ? 'copy' : 'move'; setDropOn(true); } : undefined}
        onDragLeave={receive ? () => setDropOn(false) : undefined}
        onDrop={receive ? (e) => { if (!accepts(e)) return; e.preventDefault(); e.stopPropagation(); setDropOn(false); onReceive?.(node.path, e); } : undefined}
        onClick={() => (isDir ? onToggle(node.path) : onOpen(node.path))}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onKeyDown={onRenameStart && menu ? (e) => { if (e.key === 'F2') { e.preventDefault(); onRenameStart(node.path); } } : undefined}
        onContextMenu={menu ? (e) => { e.preventDefault(); e.stopPropagation(); menu(node, { left: e.clientX, top: e.clientY }); } : undefined}
        title={node.run ? `${runName}\n${node.name}\n${statusLabel(node.run.status)}${node.run.currentStep ? ` · ${node.run.currentStep}` : ''}` : node.linked ?? node.path}
      >
        {icons}
        <span className="tree-label">{label}</span>
        {favorites?.has(node.path) && <span className="star-mark" title={t('Favorite')}><IconStar size={13} /></span>}
        {!isDir && tagColors && tagColors(node.path).length > 0 && (
          <span className="tree-tags">{tagColors(node.path).map((c, i) => <span key={i} className="dot" style={{ background: c }} />)}</span>
        )}
        {node.run && <span className={`dot ${statusClass(node.run.status)}`} />}
        {run && !hover && <span className="tree-meta">{run.date}</span>}
        {isDir && (depth === 0 || node.path === '.mcps') && !node.linked && node.children && <span className="tree-meta">{node.children.length}</span>}
      </button>
      )}
      {node.linked && onIde && (
        <button type="button" className="tree-ide" title={t('Open in the IDE')} aria-label={t('Open in the IDE')} aria-haspopup="menu"
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); onIde({ left: r.left, top: r.bottom + 2 }); }}>
          <IconCode size={14} />
        </button>
      )}
      {menu && !editing && (
        <button type="button" className="tree-more" title={t('More options')} aria-label={t('More options')} aria-haspopup="menu"
          onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); menu(node, { left: r.left, top: r.bottom + 2 }); }}>
          <IconMore size={14} />
        </button>
      )}
      </div>
      {isDir && open && node.children && (
        <ul role="group">
          {(node.path === 'notes' && favorites ? [...node.children].sort((a, b) => Number(favorites.has(b.path)) - Number(favorites.has(a.path))) : node.children)
            .map((c) => <Node {...props} key={c.path} node={c} depth={depth + 1} />)}
          {node.path === '.settings' && props.onSetup && (
            <li><button type="button" className="tree-row tree-new" style={{ paddingLeft: 8 + (depth + 1) * INDENT }} onClick={props.onSetup}><span className="tree-icon"><IconSliders size={14} /></span><span className="tree-label">{t('Project settings…')}</span></button></li>
          )}
          {node.path === 'notes' && (
            <li><button type="button" className="tree-row tree-new" style={{ paddingLeft: 8 + (depth + 1) * INDENT }} onClick={onNewNote}><span className="tree-icon"><IconPlus size={14} /></span><span className="tree-label">{t('New note')}</span></button></li>
          )}
          {node.children.length === 0 && node.path !== 'notes' && <li className="tree-empty" style={{ paddingLeft: 8 + (depth + 1) * INDENT }}>{t('empty')}</li>}
        </ul>
      )}
    </li>
  );
}
