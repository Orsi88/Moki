import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { api, type FileContent, type OpenWithApps } from '../api';
import { t } from '../i18n';
import { IconChat, IconCheck, IconChevron, IconCode, IconCopy, IconExternal, IconEye, IconMore, IconRefresh, IconTag, IconX } from './Icons';
import { FileIcon } from '../icons';
import { PdfDoc } from './PdfDoc';
import { MarkdownBody } from './MarkdownBody';
import { MarkdownComments } from './MarkdownComments';
import { readComments } from '../md-comments';
import { recall, remember } from '../prefs';
import { LazyTipTap } from './LazyTipTap';
import { CommentedEditor } from './CommentedEditor';
import { useAnchorJump, type LinkResolver } from './useInternalLinks';
import type { LinkJump } from '../internal-links';
import '../internal-links.css';

// A .md file: the formatted editor ('edit', comments beside it) is where it is edited and commented; its Markdown
// source ('source') is read and copied; the reading view ('preview', comments too) is for a file the editor would lose
// parts of, or too large for it. Any other file is shown ('preview').
export type DocMode = 'preview' | 'edit' | 'source';
// format: the editor rewrites the formatting (tables, list marks, emphasis) but keeps every word; loss: it would drop
// parts of the file (HTML, syntax it does not know); large: too big for the editor.
export type MdWhy = 'large' | 'format' | 'loss';

interface Props {
  content: FileContent;
  project?: string; // lets the preview of unsaved edits show the file's relative images
  mode: DocMode;
  initialScrollTop?: number;
  onScroll?: (scrollTop: number) => void;
  draft: string;
  dirty: boolean;
  saving: boolean;
  onDraft: (text: string) => void;
  onMode: (mode: DocMode) => void;
  why?: MdWhy; // what the bar says about a .md file the editor would change, or does not edit
  onQuiet?: () => void; // the note about the formatting is closed
  autosave?: boolean; // the file saves on its own: the bar shows the state instead of Save
  savedAt?: number;
  conflict?: boolean; // the file changed outside Moki while this tab had edits
  onTakeTheirs?: () => void;
  onKeepMine?: () => void;
  onRewrite?: (kind: 'format' | 'loss') => void; // the formatted editor would change this file (TipTapEditor)
  onSave: () => void;
  onOpenExternal: () => void;
  onReload: () => void;
  onLink: (href: string) => void;
  resolveLink?: (from: string, href: string) => ReturnType<LinkResolver>;
  jump?: LinkJump;
  onMissingAnchor?: () => void;
  onPdfSaved?: (path: string) => void; // a PDF change was saved, to this file (the same one, or its -edited copy)
  onCommit?: (text: string) => void; // a .md file's new text, saved at once (its comments: MarkdownComments)
  tags?: ReactNode;
  // "Open with": the programs the system offers, and the one kept in Moki for this type (null = the system's default).
  openWith?: { kept: { id: string; name: string } | null; apps: () => Promise<OpenWithApps | null>; open: (app: OpenWithApps['apps'][number] | null, keep: boolean) => void; reset: () => void };
}

// Excel, Word and PDF files get "Open with" (OPEN_WITH_TYPES in desktop/fs-guard.ts).
const OPEN_WITH = /\.(xlsx|xls|docx|doc|pdf)$/i;

const colName = (i: number): string => (i >= 26 ? colName(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26));

type Sheet = Extract<FileContent, { kind: 'xlsx' }>['sheets'][number];

// Read-only grid of a spreadsheet, sheets as tabs at the bottom like Excel/LibreOffice.
function SheetView({ sheets }: { sheets: Sheet[] }) {
  const [current, setCurrent] = useState(Math.max(0, sheets.findIndex((s) => !s.hidden)));
  const sheet = sheets[current];
  const rows = sheet?.rows ?? [];
  // A merged area is drawn as its first cell spanning the area; the cells it covers are not drawn.
  const spans = new Map<string, { rowSpan: number; colSpan: number }>();
  const covered = new Set<string>();
  for (const [r1, c1, r2, c2] of sheet?.merges ?? []) {
    spans.set(`${r1}:${c1}`, { rowSpan: r2 - r1 + 1, colSpan: c2 - c1 + 1 });
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) if (r !== r1 || c !== c1) covered.add(`${r}:${c}`);
  }
  const used = Math.max(rows.reduce((n, r) => Math.max(n, r.length), 0), ...(sheet?.merges ?? []).map((m) => m[3] + 1));
  // Hidden rows and columns are shown dimmed, so their content can be checked without mistaking it for what users see.
  const hiddenRows = new Set(sheet?.hiddenRows);
  const hiddenCols = new Set(sheet?.hiddenCols);
  const widths = Array.from({ length: used }, (_, c) => sheet?.widths[c] ?? 64);
  // Like a spreadsheet, empty columns go on to the right (text can spill into them).
  while (used && widths.reduce((a, b) => a + b, 0) < 1200) widths.push(64);
  const cols = widths.length;
  const notes = [
    sheet?.truncated && t('only the first {n} rows and 200 columns are shown', { n: rows.length }),
    sheet?.hidden && t('this sheet is hidden in the spreadsheet program'),
    sheet?.drawing && t('it has images or charts, not shown here'),
  ].filter(Boolean);
  return (
    <div className="sheet">
      <p className="notice-bar">{t('Spreadsheet — values preview')}{notes.length ? `; ${notes.join('; ')}` : ''}. {t('Open it in your spreadsheet program to edit or see formatting.')}</p>
      <div className="sheet-grid">
        {cols === 0 ? <p className="muted sheet-empty">{t('This sheet is empty.')}</p> : (
          <table style={{ width: 44 + widths.reduce((a, b) => a + b, 0) }}>
            <colgroup><col style={{ width: 44 }} />{widths.map((w, c) => <col key={c} style={{ width: w }} />)}</colgroup>
            <thead><tr><th />{Array.from({ length: cols }, (_, c) => (
              <th key={c} className={hiddenCols.has(c) ? 'hidden-rc' : undefined} title={hiddenCols.has(c) ? t('Hidden column') : undefined}>{colName(c)}</th>
            ))}</tr></thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={n}>
                  <th className={hiddenRows.has(n) ? 'hidden-rc' : undefined} title={hiddenRows.has(n) ? t('Hidden row') : undefined}>{n + 1}</th>
                  {Array.from({ length: cols }, (_, c) => {
                    if (covered.has(`${n}:${c}`)) return null;
                    const v = r[c] ?? '';
                    const a = sheet?.align[`${n}:${c}`];
                    const span = spans.get(`${n}:${c}`);
                    // Like Excel, left-aligned text spills over the empty cells on its right instead of being cut.
                    // ponytail: text width estimated at 7px per character; measure with canvas if it misjudges.
                    let spill = 1;
                    if (typeof v === 'string' && v && !span && !a?.wrap && (a?.h ?? 'left') === 'left' && !v.includes('\n')) {
                      for (let w = widths[c]; w < v.length * 7 + 8 && c + spill < cols && !r[c + spill]
                        && !covered.has(`${n}:${c + spill}`) && !spans.has(`${n}:${c + spill}`); spill++) w += widths[c + spill];
                      for (let k = 1; k < spill; k++) covered.add(`${n}:${c + k}`);
                    }
                    const props = {
                      ...span, ...(spill > 1 ? { colSpan: spill } : {}),
                      className: [typeof v === 'object' && 'num', (hiddenRows.has(n) || hiddenCols.has(c)) && 'hidden-rc'].filter(Boolean).join(' ') || undefined,
                      style: a && { textAlign: a.h as CSSProperties['textAlign'], verticalAlign: a.v, whiteSpace: a.wrap ? 'pre-wrap' as const : undefined },
                    };
                    return typeof v === 'object' ? <td key={c} {...props}>{v.n}</td> : <td key={c} title={v || undefined} {...props}>{v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="sheet-tabs" role="tablist">
        {sheets.map((s, i) => (
          <button type="button" key={s.name} role="tab" aria-selected={i === current} className={`${i === current ? 'active' : ''}${s.hidden ? ' hidden-sheet' : ''}`}
            title={s.hidden ? t('Hidden sheet') : undefined} onClick={() => setCurrent(i)}>{s.name}</button>
        ))}
      </div>
    </div>
  );
}

// Chromium's own PDF viewer (pages, zoom, search, print), in a frame with no access to the app, from the file's URL.
function PdfView({ url, title }: { url: string; title: string }) {
  return <iframe className="pdf-view" src={url} title={title} />;
}

// An image from its moki-file:// URL: the file is read by the page, never copied into it.
function ImageView({ url, alt }: { url: string; alt: string }) {
  return <div className="image-view"><img src={url} alt={alt} /></div>;
}

// The page rendered by Chromium in a sandboxed frame: no scripts, forms or navigation, its own origin.
function HtmlView({ text, title }: { text: string; title: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const next = URL.createObjectURL(new Blob([text], { type: 'text/html' }));
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [text]);
  return url ? <iframe className="pdf-view" sandbox="" src={url} title={title} /> : null;
}

const formatSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);

const clock = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export function DocView({ content, project, mode, initialScrollTop = 0, onScroll, draft, dirty, saving, onDraft, onMode, why, autosave = false, savedAt, conflict = false, onTakeTheirs, onKeepMine, onRewrite, onQuiet, onSave, onOpenExternal, onReload, onLink, resolveLink, jump, onMissingAnchor, onPdfSaved, onCommit, openWith, tags }: Props) {
  const resolveCurrent = useCallback((href: string) => resolveLink?.(content.path, href) ?? null, [resolveLink, content.path]);
  const editable = (content.kind === 'markdown' || content.kind === 'text') && content.editable;
  const crumbs = content.path.split('/');
  const savedHtml = content.kind === 'markdown' ? content.html : '';
  const [html, setHtml] = useState(savedHtml);
  const [menu, setMenu] = useState<(OpenWithApps & { right: number; top: number }) | null>(null);
  const [keep, setKeep] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const body = useRef<HTMLDivElement>(null);
  const scrollCallback = useRef(onScroll);
  scrollCallback.current = onScroll;
  const sourceMode = mode === 'source';
  // Where the source button goes back to: the editor, or the reading view of a file the editor does not edit.
  const home: DocMode = content.kind === 'markdown' && content.editable && why !== 'large' && why !== 'loss' ? 'edit' : 'preview';
  const [copied, setCopied] = useState(false);
  useEffect(() => { setTagsOpen(false); }, [content.path]);
  useLayoutEffect(() => {
    const host = body.current;
    if (!host || !scrollCallback.current) return;
    // Editors/PDF pages can arrive after the tab mounts. Wait for their layout, and
    // stop restoring as soon as the reader starts interacting with the document.
    const selector = mode === 'source' || content.kind === 'text' && content.editable
      ? 'textarea.editor' : content.kind === 'xlsx' ? '.sheet-grid' : content.kind === 'pdf' ? '.pdf-scroll' : '';
    const scroller = (): HTMLElement | null => selector ? host.querySelector<HTMLElement>(selector) : host;
    let restoring = true;
    let frame = 0;
    let observed: Element | null = null;
    const capture = () => {
      const target = scroller();
      if (!restoring && target) scrollCallback.current?.(target.scrollTop);
    };
    const restore = () => {
      const target = scroller();
      if (!target || !restoring) return;
      target.scrollTop = initialScrollTop;
      if (Math.abs(target.scrollTop - initialScrollTop) < 1) restoring = false;
      const child = target.firstElementChild;
      if (child !== observed) {
        if (observed) size.unobserve(observed);
        observed = child;
        if (child) size.observe(child);
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(restore); };
    const interact = () => { restoring = false; };
    const size = new ResizeObserver(schedule);
    size.observe(host);
    const mutations = new MutationObserver(schedule);
    mutations.observe(host, { childList: true, subtree: true });
    const scroll = (event: Event) => { if (event.target === scroller()) capture(); };
    host.addEventListener('scroll', scroll, true);
    host.addEventListener('load', schedule, true);
    host.addEventListener('wheel', interact, { passive: true });
    host.addEventListener('pointerdown', interact);
    host.addEventListener('keydown', interact);
    restore();
    return () => {
      capture();
      cancelAnimationFrame(frame);
      size.disconnect();
      mutations.disconnect();
      host.removeEventListener('scroll', scroll, true);
      host.removeEventListener('load', schedule, true);
      host.removeEventListener('wheel', interact);
      host.removeEventListener('pointerdown', interact);
      host.removeEventListener('keydown', interact);
    };
  }, [content.path, mode]); // scroll updates must never pull the reader back to the saved position
  // The comment column of a .md file, opened or closed from the bar (remembered), as for a PDF.
  const [commentsOff, setCommentsOffState] = useState(() => recall('qa-md-comments') === 'closed');
  const setCommentsOff = (off: boolean) => { setCommentsOffState(off); remember('qa-md-comments', off ? 'closed' : 'open'); };
  useEffect(() => { if (jump?.anchor.kind === 'comment') setCommentsOff(false); }, [jump]);
  useAnchorJump(body, jump, content.kind === 'markdown' && mode === 'preview', onMissingAnchor);
  // The reading view and the formatted editor show the comments; the Markdown source does not (no count read there on every change).
  const canComment = Boolean(onCommit);
  const withComments = !sourceMode;
  const commentCount = useMemo(() => (content.kind === 'markdown' && canComment && withComments ? readComments(draft).comments.length : 0), [content.kind, canComment, withComments, draft]);
  const renewPdf = useCallback(() => (project
    ? api.readFile(project, content.path).then((c) => { if (c.kind !== 'pdf') throw new Error(content.path); return c.url; })
    : Promise.reject(new Error(content.path))), [project, content.path]);
  const kept = openWith?.kept ?? null;
  const ext = content.path.slice(content.path.lastIndexOf('.')).toLowerCase();
  const openTitle = kept ? t('Open with {tool}', { tool: kept.name }) : t('Open with the default program');

  const showOpenWith = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    void openWith?.apps().then((list) => { if (list) { setKeep(false); setMenu({ ...list, right: window.innerWidth - r.right, top: r.bottom + 4 }); } });
  };
  const choose = (app: OpenWithApps['apps'][number] | null) => { setMenu(null); openWith?.open(app, keep); };

  // The formatted view follows the text on screen, including edits not saved yet.
  useEffect(() => {
    if (content.kind !== 'markdown' || mode !== 'preview') return;
    if (draft === content.text) { setHtml(content.html); return; }
    let cancel = false;
    api.renderMarkdown(draft, project, content.path).then((next) => { if (!cancel) setHtml(next); }).catch(() => { if (!cancel) setHtml(content.html); });
    return () => { cancel = true; };
  }, [content, draft, mode, project]);

  // Links inside rendered Markdown never navigate the window.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href') ?? '';
    if (href) onLink(href);
  };

  return (
    <div className="doc">
      <div className="doc-bar">
        <div className="crumbs" title={content.path}>
          {(tagsOpen ? crumbs : crumbs.slice(-1)).map((c, i) => <span key={`${c}-${i}`} className={i === (tagsOpen ? crumbs.length : 1) - 1 ? 'crumb-last' : ''}>{c}</span>)}
        </div>
        <div className="doc-actions">
          {content.kind === 'markdown' && content.editable && home === 'edit' && <button type="button" className={`icon-btn${mode === 'preview' ? ' on' : ''}`} title={t('Reading view')} aria-label={t('Reading view')} aria-pressed={mode === 'preview'} onClick={() => onMode(mode === 'preview' ? 'edit' : 'preview')}><IconEye size={16} /></button>}
          {tags && <button type="button" className={`icon-btn${tagsOpen ? ' on' : ''}`} title={t('Tags')} aria-label={t('Tags')} aria-expanded={tagsOpen} onClick={() => setTagsOpen((v) => !v)}><IconTag size={16} /></button>}
          {content.kind === 'markdown' && <button type="button" className={`icon-btn${sourceMode ? ' on' : ''}`}
            title={sourceMode ? t('Back to the document (Ctrl+E)') : t('Markdown source, to read and copy (Ctrl+E)')} aria-label={t('Markdown source')} aria-pressed={sourceMode}
            onClick={() => onMode(sourceMode ? home : 'source')}><IconCode size={16} /></button>}
          {content.kind === 'markdown' && sourceMode && (
            // An icon like the bar's others (same size); a check for a moment once copied.
            <button type="button" className="icon-btn" title={copied ? t('Copied') : t('Copy all')} aria-label={copied ? t('Copied') : t('Copy all')}
              onClick={() => { api.copyText(draft).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => setCopied(false)); }}>
              {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
            </button>
          )}
          {commentCount > 0 && withComments && (
            <button type="button" className={`btn btn-ghost btn-sm pdf-rail-toggle${commentsOff ? '' : ' on'}`} aria-pressed={!commentsOff}
              title={commentsOff ? t('Show the comments beside the text') : t('Hide the comments: the text gets the room')} aria-label={`${t('Comments')} (${commentCount})`}
              onClick={() => setCommentsOff(!commentsOff)}><IconChat size={14} /><span className="pdf-rail-count">{commentCount}</span></button>
          )}
          {editable && autosave && !conflict && (dirty || saving || savedAt) && (
            <span className="doc-saved muted small" role="status">{dirty || saving ? t('Saving…') : t('Saved at {time}', { time: clock(savedAt ?? Date.now()) })}</span>
          )}
          {editable && !autosave && (dirty || saving) && (
            <button type="button" className="btn btn-sm" onClick={onSave} disabled={saving}>{saving ? t('Saving…') : t('Save')}</button>
          )}
          <button type="button" className="icon-btn" onClick={onReload} title={t('Reload this file')} aria-label={t('Reload this file')}><IconRefresh size={16} /></button>
          <button type="button" className="icon-btn" onClick={onOpenExternal} title={openTitle}><IconExternal size={17} /></button>
          {openWith && OPEN_WITH.test(content.path) && (
            <button type="button" className="icon-btn" onClick={showOpenWith} title={t('Open with…')} aria-label={t('Open with…')} aria-haspopup="menu"><IconMore size={17} /></button>
          )}
          {tags && <button type="button" className={`icon-btn doc-details${tagsOpen ? ' open' : ''}`} title={tagsOpen ? t('Hide file details') : t('Show file details')} aria-label={tagsOpen ? t('Hide file details') : t('Show file details')} aria-expanded={tagsOpen} onClick={() => setTagsOpen((v) => !v)}><IconChevron size={15} /></button>}
        </div>
      </div>
      {tags && tagsOpen && <div className="file-tags-bar"><span className="label">{t('Tags')}</span>{tags}</div>}
      {conflict && (
        <div className="notice-bar doc-conflict" role="alert">
          <span>{t('This file changed outside Moki (by the AI, for example) while you were editing it. Nothing was overwritten.')}</span>
          <button type="button" className="btn btn-sm" onClick={onTakeTheirs}>{t('See the new version')}</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onKeepMine}>{t('Keep mine')}</button>
        </div>
      )}
      {content.kind === 'markdown' && content.editable && why === 'format' && mode === 'edit' && (
        <div className="notice-bar doc-why" role="status">
          <span>{t('When you change this file, the editor writes its formatting its own way (tables, list marks, emphasis). The words stay the same.')}</span>
          <button type="button" className="icon-btn" onClick={onQuiet} title={t('Close')} aria-label={t('Close')}><IconX size={14} /></button>
        </div>
      )}
      {content.kind === 'markdown' && content.editable && (why === 'large' || why === 'loss') && mode === 'preview' && (
        <div className="notice-bar doc-why" role="status">
          <span>{why === 'large'
            ? t('This file is large, so here it is for reading and comments. To edit it, open it in your program.')
            : t('The editor would lose parts of this file (HTML, for example), so here it is for reading and comments. To edit it, open it in your program.')}</span>
          <button type="button" className="btn btn-sm" onClick={onOpenExternal}>{t('Open in your program')}</button>
        </div>
      )}

      <div ref={body} className="doc-body">
        {content.kind === 'markdown' && mode === 'source' && !(content.editable && home === 'edit') && (
          <textarea className="editor md-source" readOnly spellCheck={false} value={draft} aria-label={t('Markdown source')} />
        )}
        {content.kind === 'markdown' && mode === 'preview' && (
          // HTML comes from the main process renderer, which escapes all markup from the file.
          onCommit && content.editable
            ? <MarkdownComments path={content.path} html={html} text={draft} onCommit={onCommit} onClick={onClick} resolveLink={resolveCurrent} hidden={commentsOff} onShow={() => setCommentsOff(false)} saving={saving} />
            : <MarkdownBody className="markdown" html={html} text={draft} onChange={content.editable && onCommit ? onCommit : undefined} onClick={onClick} resolveLink={resolveCurrent} />
        )}
        {content.kind === 'markdown' && mode !== 'preview' && content.editable && home === 'edit' && (content.editable
          ? sourceMode ? <textarea className="editor md-source" readOnly spellCheck={false} value={draft} aria-label={t('Markdown source')} />
            : onCommit
              ? <CommentedEditor key={content.path} text={draft} path={content.path} onChange={onDraft} onCommit={onCommit} onLink={onLink} hidden={commentsOff} onShow={() => setCommentsOff(false)} saving={saving} onRewrite={onRewrite} />
              : <LazyTipTap key={content.path} text={draft} path={content.path} onChange={onDraft} onRewrite={onRewrite} onLink={onLink} />
          : <pre className="plain">{content.text}</pre>)}
        {content.kind === 'text' && (content.editable
          ? <textarea className="editor" spellCheck value={draft} onChange={(e) => onDraft(e.target.value)} />
          : <pre className="plain">{content.text}</pre>)}
        {content.kind === 'json' && <pre className="plain code-view">{content.text}</pre>}
        {content.kind === 'docx' && (
          <>
            <p className="notice-bar">{t('Word document — text preview. Open it in your word processor to see images and formatting.')}</p>
            <div className="markdown" onClick={onClick} dangerouslySetInnerHTML={{ __html: content.html }} />
          </>
        )}
        {content.kind === 'xlsx' && <SheetView key={content.path} sheets={content.sheets} />}
        {content.kind === 'pdf' && (project && onPdfSaved
          ? <PdfDoc key={content.path} project={project} path={content.path} url={content.url} renew={renewPdf} native={<PdfView url={content.url} title={content.path} />} onSaved={onPdfSaved} jump={jump} onMissingAnchor={onMissingAnchor} />
          : <PdfView url={content.url} title={content.path} />)}
        {content.kind === 'html' && <HtmlView text={content.text} title={content.path} />}
        {content.kind === 'image' && <ImageView url={content.url} alt={content.path} />}
        {content.kind === 'binary' && (
          <div className="binary-view">
            <FileIcon name={content.path} size={40} />
            <strong>{crumbs[crumbs.length - 1]}</strong>
            <span className="muted small">{formatSize(content.size)}{content.reason ? ` · ${content.reason}` : ''}</span>
            {content.openable
              ? <button type="button" className="btn" onClick={onOpenExternal}><IconExternal size={16} /> {openTitle}</button>
              : <span className="muted small">{t('This type of file is not opened from Moki.')}</span>}
          </div>
        )}
      </div>

      {menu && (
        <div className="menu-backdrop" onMouseDown={() => setMenu(null)}>
          <ul className="term-menu" role="menu" style={{ right: menu.right, top: menu.top }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setMenu(null); }}>
            {menu.apps.map((app, i) => (
              <li key={app.id}>
                <button type="button" role="menuitem" autoFocus={i === 0} onClick={() => choose(app)}>
                  {app.name}
                  {kept?.id === app.id ? <span className="muted small">{t('default in Moki')}</span> : app.isDefault && <span className="muted small">{t('system default')}</span>}
                </button>
              </li>
            ))}
            {menu.dialog && <li><button type="button" role="menuitem" autoFocus onClick={() => choose(null)}>{t('Choose another program…')}</button></li>}
            {!menu.dialog && !menu.apps.length && <li className="menu-note muted">{t('No programs for this file were found on this computer.')}</li>}
            {kept && <li><button type="button" role="menuitem" onClick={() => { setMenu(null); openWith?.reset(); }}>{t('Back to the system default')}</button></li>}
            {menu.apps.length > 0 && (
              <li className="menu-note"><label><input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /> {t('Always open {ext} files with the chosen program', { ext })}</label></li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
