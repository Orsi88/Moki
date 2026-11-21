// A folder of the project in the middle of the screen, as a file browser: a list with name, date, type and size (sorted
// by a click on a column), or a grid with thumbnails for pictures. The tree keeps large folders to their subfolders
// (desktop/service.ts, LARGE_FOLDER_FILES); this is where their files are. Only the rows in view are drawn, so a folder
// of tens of thousands of files opens at once; thumbnails load as they come into view. Double click (or Enter) opens a
// file in Moki or goes into a subfolder; the path above goes back up.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type UIEvent } from 'react';
import { api, type TreeNode } from '../api';
import { t } from '../i18n';
import { recall, remember } from '../prefs';
import { FileIcon } from '../icons/file-icons';
import { IconExternal, IconFolder, IconGrid, IconList, IconPlay, IconSearch } from './Icons';
import { Lightbox, isMedia, isVideo, type MediaItem } from './Lightbox';
import './folder-view.css';

const ROW_H = 34; // list row height (px), the same in folder-view.css
const CELL_W = 152, CELL_H = 168; // grid cell (px), the same in folder-view.css
const OVERSCAN = 6;
const PICTURE = /\.(png|jpe?g|gif|webp|bmp)$/i;

type SortKey = 'name' | 'mtime' | 'type' | 'size';
type Mode = 'list' | 'grid';

interface Props {
  project: string;
  path: string; // the folder first shown
  version?: unknown; // changes when the project's files change: read the folder again
  onOpen: (path: string) => void; // a file, opened in Moki
  onTitle?: (name: string) => void; // the folder now shown (its tab's name)
}

const typeOf = (entry: TreeNode) => {
  if (entry.type === 'dir') return t('Folder');
  const dot = entry.name.lastIndexOf('.');
  return dot > 0 ? t('{ext} file', { ext: entry.name.slice(dot + 1).toUpperCase() }) : t('File');
};
const sizeOf = (bytes?: number) => (bytes === undefined ? '' : `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Math.max(1, Math.ceil(bytes / 1024)))} KB`);
const count = (n: number) => new Intl.NumberFormat().format(n);
const dateOf = (ms?: number) => (ms ? new Date(ms).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }) : '');

export function FolderView({ project, path, version, onOpen, onTitle }: Props) {
  const [current, setCurrent] = useState(path);
  const [entries, setEntries] = useState<TreeNode[]>([]);
  const [more, setMore] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; up: boolean }>({ key: 'name', up: true });
  const [chosen, setChosen] = useState<string | null>(null);
  const [seeing, setSeeing] = useState<{ items: MediaItem[]; start: number } | null>(null);
  const modeKey = `folder-view:${project}:${current}`;
  const [mode, setMode] = useState<Mode | null>(() => (recall(modeKey) as Mode | null));
  const scroller = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, height: 600, width: 800 });

  useEffect(() => { setCurrent(path); }, [path]);
  useEffect(() => { onTitle?.(current.split('/').pop() || current); }, [current]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    let gone = false;
    setLoading(true); setError('');
    api.folderEntries(project, current).then((r) => { if (!gone) { setEntries(r.entries); setMore(r.more); } })
      .catch((e: Error) => { if (!gone) { setEntries([]); setMore(0); setError(e.message); } })
      .finally(() => { if (!gone) setLoading(false); });
    return () => { gone = true; };
  }, [project, current, version]);
  // A new folder: back to the top, its own remembered mode, nothing chosen.
  useEffect(() => { setQuery(''); setChosen(null); setMode(recall(modeKey) as Mode | null); scroller.current?.scrollTo({ top: 0 }); }, [modeKey]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setView({ top: el.scrollTop, height: el.clientHeight, width: el.clientWidth });
    measure();
    const seen = new ResizeObserver(measure);
    seen.observe(el);
    return () => seen.disconnect();
  }, []);

  // Grid when most files are pictures, unless the person chose a mode for this folder.
  const files = entries.filter((e) => e.type === 'file');
  const shown: Mode = mode ?? (files.length && files.filter((f) => PICTURE.test(f.name)).length * 2 > files.length ? 'grid' : 'list');
  const choose = (next: Mode) => { setMode(next); remember(modeKey, next); };

  const list = useMemo(() => {
    const words = query.trim().toLocaleLowerCase();
    const found = words ? entries.filter((e) => e.name.toLocaleLowerCase().includes(words)) : entries;
    // Ties (same date, size or type) fall back to the name, in natural order (2 before 10).
    const byName = (a: TreeNode, b: TreeNode) => a.name.localeCompare(b.name, undefined, { numeric: true });
    const by = (a: TreeNode, b: TreeNode): number => {
      if (sort.key === 'mtime') return (a.mtime ?? 0) - (b.mtime ?? 0) || byName(a, b);
      if (sort.key === 'size') return (a.size ?? -1) - (b.size ?? -1) || byName(a, b);
      if (sort.key === 'type') return typeOf(a).localeCompare(typeOf(b)) || byName(a, b);
      return byName(a, b);
    };
    // Folders first, as in a file browser; then the chosen order.
    return [...found].sort((a, b) => Number(b.type === 'dir') - Number(a.type === 'dir') || (sort.up ? by(a, b) : by(b, a)));
  }, [entries, query, sort]);

  // A picture or a video opens large over the screen, with the others of the folder (as shown) to go through.
  const go = (entry: TreeNode) => {
    if (entry.type === 'dir') { setCurrent(entry.path); return; }
    if (!isMedia(entry.name)) { onOpen(entry.path); return; }
    const items = list.filter((e) => e.type === 'file' && isMedia(e.name)).map((e) => ({ path: e.path, name: e.name }));
    setSeeing({ items, start: Math.max(0, items.findIndex((i) => i.path === entry.path)) });
  };
  const onScroll = (e: UIEvent<HTMLDivElement>) => { const el = e.currentTarget; setView((v) => ({ ...v, top: el.scrollTop })); };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!list.length) return;
    const at = Math.max(0, list.findIndex((x) => x.path === chosen));
    const per = shown === 'grid' ? Math.max(1, Math.floor(view.width / CELL_W)) : 1;
    const step = e.key === 'ArrowDown' ? per : e.key === 'ArrowUp' ? -per : shown === 'grid' && e.key === 'ArrowRight' ? 1 : shown === 'grid' && e.key === 'ArrowLeft' ? -1 : 0;
    if (step) { e.preventDefault(); setChosen(list[Math.min(list.length - 1, Math.max(0, at + step))].path); }
    else if (e.key === 'Enter' && chosen) { e.preventDefault(); const entry = list.find((x) => x.path === chosen); if (entry) go(entry); }
  };
  // The chosen item stays in view when the keys move it.
  useEffect(() => {
    const el = scroller.current;
    const at = list.findIndex((x) => x.path === chosen);
    if (!el || at < 0) return;
    const per = shown === 'grid' ? Math.max(1, Math.floor(view.width / CELL_W)) : 1;
    const h = shown === 'grid' ? CELL_H : ROW_H;
    const head = shown === 'list' ? ROW_H : 0;
    const y = Math.floor(at / per) * h;
    if (y < el.scrollTop) el.scrollTop = y;
    else if (y + h + head > el.scrollTop + el.clientHeight) el.scrollTop = y + h + head - el.clientHeight;
  }, [chosen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only what is in view (plus a margin) is drawn.
  const per = shown === 'grid' ? Math.max(1, Math.floor(view.width / CELL_W)) : 1;
  const rowH = shown === 'grid' ? CELL_H : ROW_H;
  const rows = Math.ceil(list.length / per);
  const first = Math.max(0, Math.floor(view.top / rowH) - OVERSCAN);
  const last = Math.min(rows, Math.ceil((view.top + view.height) / rowH) + OVERSCAN);
  const visible = list.slice(first * per, last * per);

  const parts = current.split('/');
  const column = (key: SortKey, label: string) => (
    <button type="button" role="columnheader" aria-sort={sort.key === key ? (sort.up ? 'ascending' : 'descending') : 'none'}
      className={`folder-col folder-col-${key}${sort.key === key ? ' sorted' : ''}`} onClick={() => setSort((s) => ({ key, up: s.key === key ? !s.up : true }))}>
      {label}{sort.key === key && <span aria-hidden="true">{sort.up ? ' ↑' : ' ↓'}</span>}
    </button>
  );

  return (
    <div className="folder-view">
      <header className="folder-bar">
        <nav className="folder-crumbs" aria-label={t('Folder path')}>
          {parts.map((part, i) => {
            const to = parts.slice(0, i + 1).join('/');
            return <span key={to} className="folder-crumb">
              {i > 0 && <span className="folder-sep" aria-hidden="true">›</span>}
              {i === parts.length - 1 ? <span aria-current="page">{part === '@folder' ? t('Linked folder') : part}</span>
                : <button type="button" className="link" onClick={() => setCurrent(to)}>{part === '@folder' ? t('Linked folder') : part}</button>}
            </span>;
          })}
        </nav>
        <label className="folder-search">
          <IconSearch size={14} />
          <input type="search" value={query} placeholder={t('Search in {folder}', { folder: parts[parts.length - 1] })} aria-label={t('Search in {folder}', { folder: parts[parts.length - 1] })} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="folder-modes" role="group" aria-label={t('View as')}>
          <button type="button" className={`icon-btn${shown === 'list' ? ' on' : ''}`} aria-pressed={shown === 'list'} title={t('List')} aria-label={t('List')} onClick={() => choose('list')}><IconList size={16} /></button>
          <button type="button" className={`icon-btn${shown === 'grid' ? ' on' : ''}`} aria-pressed={shown === 'grid'} title={t('Grid')} aria-label={t('Grid')} onClick={() => choose('grid')}><IconGrid size={16} /></button>
        </div>
        <button type="button" className="icon-btn" title={t('Open in the file explorer')} aria-label={t('Open in the file explorer')} onClick={() => { void api.openFolder(project, current); }}><IconExternal size={16} /></button>
      </header>
      {error ? <p className="error folder-note" role="alert">{t(error)}</p> : null}
      <div className={`folder-body ${shown}`} ref={scroller} onScroll={onScroll} tabIndex={0} role={shown === 'list' ? 'grid' : 'listbox'}
        aria-label={parts[parts.length - 1]} aria-rowcount={shown === 'list' ? list.length + 1 : undefined} onKeyDown={onKey}>
        {shown === 'list' && <div className="folder-head" role="row">{column('name', t('Name'))}{column('mtime', t('Date modified'))}{column('type', t('File type'))}{column('size', t('Size'))}</div>}
        <div className="folder-space" style={{ height: rows * rowH }}>
          <div className="folder-window" style={{ transform: `translateY(${first * rowH}px)` }}>
            {visible.map((entry) => shown === 'list'
              ? <div key={entry.path} role="row" aria-selected={chosen === entry.path} className={`folder-row${chosen === entry.path ? ' chosen' : ''}`}
                onClick={() => setChosen(entry.path)} onDoubleClick={() => go(entry)} title={entry.name}>
                <span className="folder-cell folder-col-name" role="gridcell">
                  {entry.type === 'dir' ? <span className="folder-dir-icon"><IconFolder size={16} /></span> : <FileIcon name={entry.name} size={16} />}
                  <span className="folder-name">{entry.name}</span>
                </span>
                <span className="folder-cell folder-col-mtime muted" role="gridcell">{dateOf(entry.mtime)}</span>
                <span className="folder-cell folder-col-type muted" role="gridcell">{typeOf(entry)}</span>
                <span className="folder-cell folder-col-size muted" role="gridcell">{entry.type === 'file' ? sizeOf(entry.size) : ''}</span>
              </div>
              : <div key={entry.path} role="option" aria-selected={chosen === entry.path} className={`folder-cell-grid${chosen === entry.path ? ' chosen' : ''}`}
                onClick={() => setChosen(entry.path)} onDoubleClick={() => go(entry)} title={entry.name}>
                <Thumb project={project} entry={entry} />
                <span className="folder-name">{entry.name}</span>
              </div>)}
          </div>
        </div>
        {!loading && !error && !list.length && <p className="muted folder-note">{query ? t('No file matches this search.') : t('This folder is empty.')}</p>}
      </div>
      {seeing && <Lightbox project={project} items={seeing.items} start={seeing.start} onClose={() => setSeeing(null)} onOpenTab={onOpen} />}
      <footer className="folder-foot muted small" role="status">
        {loading ? t('Loading…') : query ? t('{shown} of {n} items', { shown: count(list.length), n: count(entries.length) }) : t('{n} items', { n: count(entries.length) })}
        {more > 0 && ` · ${t('{n} more not listed: open the folder in the file explorer', { n: count(more) })}`}
      </footer>
    </div>
  );
}

// A grid cell's picture: a thumbnail for an image (read when it is drawn, through the app's file protocol), the type's
// icon for anything else.
function Thumb({ project, entry }: { project: string; entry: TreeNode }) {
  const [url, setUrl] = useState('');
  const picture = entry.type === 'file' && PICTURE.test(entry.name);
  useEffect(() => {
    if (!picture) return;
    let gone = false;
    api.readFile(project, entry.path).then((c) => { if (!gone && c.kind === 'image') setUrl(c.url); }).catch(() => { /* the icon stays */ });
    return () => { gone = true; };
  }, [project, entry.path, picture]);
  if (url) return <span className="folder-thumb"><img src={url} alt="" loading="lazy" draggable={false} /></span>;
  return <span className="folder-thumb icon">{entry.type === 'dir' ? <span className="folder-dir-icon"><IconFolder size={40} /></span> : <FileIcon name={entry.name} size={40} />}
    {entry.type === 'file' && isVideo(entry.name) && <span className="folder-play" aria-hidden="true"><IconPlay size={14} /></span>}</span>;
}
