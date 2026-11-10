// Editors for native Office files. Changes are queued against the last committed version; the service owns package writes.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { api, type FileContent, type WordChange, type SheetChange, type WordDocument } from '../api';
import type { OfficeComment } from '../../../scripts/lib/office-types';
import { createDebouncer, onFlushEdits } from '../debounce';
import { t } from '../i18n';
import { IconChat, IconExternal, IconPlus, IconRefresh, IconTrash, IconX } from './Icons';
import { Notice } from './Notice';

type Content = Extract<FileContent, { kind: 'docx' | 'xlsx' }>;
type Change = WordChange | SheetChange;
const changeKey = (change: Change) => change.op === 'text' ? `p:${change.paragraph}` : change.op === 'cell' ? `c:${change.sheet}:${change.ref}` : `${Date.now()}:${Math.random()}`;
const colName = (n: number): string => (n >= 26 ? colName(Math.floor(n / 26) - 1) : '') + String.fromCharCode(65 + n % 26);

function useOfficeEdits(content: Content, project: string) {
  const [current, setCurrent] = useState(content), [busy, setBusy] = useState(false), [dirty, setDirty] = useState(false), [error, setError] = useState('');
  const committed = useRef(content), pending = useRef(new Map<string, Change>()), working = useRef(false), failed = useRef(false);
  const drain = useRef<() => void>(() => {});
  drain.current = () => {
    if (working.current || failed.current || !pending.current.size) return;
    working.current = true; setBusy(true);
    void (async () => {
      while (pending.current.size) {
        const entry = pending.current.entries().next().value;
        if (!entry) break;
        const [key, change] = entry; pending.current.delete(key);
        try {
          const base = committed.current;
          const result = await api.editOffice(project, base.path, base.version ?? '', change);
          if (result.kind !== 'docx' && result.kind !== 'xlsx') throw new Error(t('The Office document could not be read after saving.'));
          committed.current = result; setCurrent(result); setError('');
        } catch (e) {
          // Keep the newest local edit of this paragraph/cell when another was queued during the save.
          if (!pending.current.has(key)) pending.current.set(key, change);
          failed.current = true; setError((e as Error).message); break;
        }
      }
    })().finally(() => { working.current = false; setBusy(false); setDirty(Boolean(pending.current.size)); });
  };
  const debounce = useMemo(() => createDebouncer(() => drain.current(), 650), []);
  useEffect(() => {
    const off = onFlushEdits(() => { debounce.flush(); drain.current(); });
    return () => { off(); debounce.flush(); drain.current(); };
  }, [debounce]);
  useEffect(() => {
    if (content.version === committed.current.version) return;
    if (working.current || pending.current.size) return; // a stale write is refused by the service; local text is kept
    committed.current = content; setCurrent(content); failed.current = false; setError('');
  }, [content]);
  const edit = (change: Change, now = false) => {
    pending.current.set(changeKey(change), change); setDirty(true);
    if (now) { debounce.flush(); drain.current(); } else debounce.call();
  };
  return { current, busy, dirty, error, edit, flush: () => { debounce.flush(); drain.current(); }, retry: () => { failed.current = false; drain.current(); } };
}

function Comments({ comments, anchor, onComment, onDelete, readOnly, onClose, onNavigate, anchorLabel }: { comments: OfficeComment[]; anchor: string | null; onComment: (text: string) => void; onDelete: (id: string) => void; readOnly?: boolean; onClose: () => void; onNavigate: (anchor: string) => void; anchorLabel: (anchor: string) => string }) {
  const [draft, setDraft] = useState('');
  return <aside className="office-comments" aria-label={t('Comments')}>
    <h3><IconChat size={15} />{t('Comments')} <span className="muted">({comments.length})</span><span className="statusbar-spacer" /><button type="button" className="icon-btn" title={t('Close comments')} aria-label={t('Close comments')} onClick={onClose}><IconX size={14} /></button></h3>
    {comments.map((comment) => <article key={comment.id} className={comment.anchor === anchor ? 'selected' : ''} onClick={(event) => { if (!(event.target as Element).closest('button')) onNavigate(comment.anchor); }}>
      <div className="office-comment-head"><strong>{comment.author}</strong><span className="statusbar-spacer" /><span className="muted small">{anchorLabel(comment.anchor)}</span></div>
      <p>{comment.text}</p>
      <div className="comment-actions"><button type="button" className="icon-btn" title={t('Go to the commented location')} aria-label={t('Go to the commented location')} disabled={!comment.anchor} onClick={() => onNavigate(comment.anchor)}><IconExternal size={15} /></button><button type="button" className="icon-btn" title={t('Delete comment')} aria-label={t('Delete comment')} disabled={readOnly} onClick={() => onDelete(comment.id)}><IconTrash size={15} /></button></div>
    </article>)}
    <label className="field"><span className="label">{t('Add a comment')}</span><textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={10000} rows={3} placeholder={anchor === null ? t('Select a paragraph or cell first.') : t('Write a comment…')} disabled={anchor === null} /></label>
    <div className="comment-actions"><button type="button" className="icon-btn office-add-comment" title={t('Add comment')} aria-label={t('Add comment')} disabled={anchor === null || !draft.trim()} onClick={() => { onComment(draft.trim()); setDraft(''); }}><IconPlus size={17} /></button></div>
  </aside>;
}

function WordEditor({ document, edit, flush, enabled, commentsOn, onCloseComments, zoom }: { document: WordDocument; edit: (change: Change, now?: boolean) => void; flush: () => void; enabled: boolean; commentsOn: boolean; onCloseComments: () => void; zoom: number }) {
  const host = useRef<HTMLDivElement>(null), [selected, setSelected] = useState<string | null>(null);
  useLayoutEffect(() => {
    const element = host.current; if (!element) return;
    // A save must not move the caret or replace text typed while its request was in flight.
    if (!element.contains(window.document.activeElement)) element.innerHTML = document.html;
    for (const paragraph of element.querySelectorAll<HTMLElement>('[data-word-paragraph]')) {
      const editable = enabled && paragraph.dataset.editable === 'true';
      paragraph.contentEditable = editable ? 'plaintext-only' : 'false';
      paragraph.setAttribute('role', 'textbox');
      paragraph.setAttribute('aria-readonly', String(!editable));
      paragraph.setAttribute('aria-label', t('Paragraph {n}', { n: String(Number(paragraph.dataset.wordParagraph) + 1) }));
      paragraph.tabIndex = 0;
      paragraph.classList.toggle('has-comment', document.comments.some((c) => c.anchor === paragraph.dataset.wordParagraph));
    }
  }, [document, enabled]);
  const select = (target: EventTarget | null) => {
    const paragraph = target instanceof Element ? target.closest<HTMLElement>('[data-word-paragraph]') : null;
    if (paragraph?.dataset.wordParagraph !== undefined) setSelected(paragraph.dataset.wordParagraph);
    return paragraph;
  };
  return <div className={`office-layout${commentsOn ? ' with-comments' : ''}`}>
    <div className="office-word-scroll"><div ref={host} className="office-word-paper" style={{ zoom: zoom / 100 }} onFocusCapture={(e) => select(e.target)} onClick={(e) => {
      select(e.target);
      const link = (e.target as Element).closest('a'); if (link) { e.preventDefault(); if (e.ctrlKey || e.metaKey) void api.openLink(link.getAttribute('href') ?? ''); }
    }} onInput={(e) => {
      const paragraph = select(e.target), id = paragraph?.dataset.wordParagraph;
      if (paragraph && id !== undefined) edit({ op: 'text', paragraph: id, text: paragraph.innerText.replace(/\r/g, '') });
    }} onBlurCapture={flush} onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); flush(); } }} /></div>
    {commentsOn && <Comments onNavigate={(anchor) => { const paragraph = host.current?.querySelector<HTMLElement>(`[data-word-paragraph="${CSS.escape(anchor)}"]`); if (paragraph) { setSelected(anchor); paragraph.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }); paragraph.focus({ preventScroll: true }); } }} anchorLabel={(anchor) => /^\d+$/.test(anchor) ? t('Paragraph {n}', { n: String(Number(anchor) + 1) }) : ''} onClose={onCloseComments} readOnly={!enabled} comments={document.comments} anchor={enabled ? selected : null} onComment={(text) => { if (selected !== null) edit({ op: 'comment', paragraph: selected, author: '', text }, true); }} onDelete={(id) => edit({ op: 'delete-comment', id }, true)} />}
  </div>;
}

function SpreadsheetEditor({ content, edit, enabled, commentsOn, onCloseComments, zoom }: { content: Extract<Content, { kind: 'xlsx' }>; edit: (change: Change, now?: boolean) => void; enabled: boolean; commentsOn: boolean; onCloseComments: () => void; zoom: number }) {
  const [sheetIndex, setSheetIndex] = useState(Math.max(0, content.sheets.findIndex((sheet) => !sheet.hidden)));
  const [selected, setSelected] = useState('A1'), [draft, setDraft] = useState(''), [editing, setEditing] = useState(false), [inCell, setInCell] = useState(false), [shown, setShown] = useState(200);
  const grid = useRef<HTMLDivElement>(null);
  const [navigation, setNavigation] = useState<{ ref: string } | null>(null);
  const [navigationError, setNavigationError] = useState('');
  useLayoutEffect(() => { if (!navigation) return; const cell = grid.current?.querySelector<HTMLElement>(`[data-cell="${CSS.escape(navigation.ref)}"]`); cell?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); cell?.focus({ preventScroll: true }); }, [navigation]);
  const info = content.workbook?.sheets[sheetIndex], sheet = content.sheets[sheetIndex];
  const cell = info?.cells[selected], locked = !enabled || Boolean(info?.protected);
  useEffect(() => { if (!editing) setDraft(cell?.formula ?? cell?.value ?? ''); }, [cell, selected, sheetIndex, editing]);
  const save = () => {
    if (!locked && draft !== (cell?.formula ?? cell?.value ?? '')) edit({ op: 'cell', sheet: sheetIndex, ref: selected, value: draft }, true);
    setEditing(false);
    setInCell(false);
  };
  const rows = Math.min(shown, Math.max(20, sheet?.rows.length ?? 0)), cols = Math.min(200, Math.max(8, ...(sheet?.rows ?? []).map((row) => row.length)));
  const spans = new Map<string, { rowSpan: number; colSpan: number }>(), covered = new Set<string>();
  for (const [r, c, r2, c2] of sheet?.merges ?? []) {
    spans.set(`${r}:${c}`, { rowSpan: r2 - r + 1, colSpan: c2 - c + 1 });
    for (let row = r; row <= r2; row++) for (let col = c; col <= c2; col++) if (row !== r || col !== c) covered.add(`${row}:${col}`);
  }
  return <div className={`office-layout${commentsOn ? ' with-comments' : ''}`}>
    <div className="office-sheet">
      <div className="office-formula"><strong>{selected}</strong><span className="muted">fx</span><input aria-label={t('Cell value or formula')} value={draft} readOnly={locked} maxLength={32000} onFocus={() => setEditing(true)} onChange={(e) => setDraft(e.target.value)} onBlur={save} onKeyDown={(e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); e.currentTarget.blur(); }
        if (e.key === 'Escape') { e.stopPropagation(); setDraft(cell?.formula ?? cell?.value ?? ''); setEditing(false); }
      }} /></div>
      {navigationError && <p role="status" className="muted small office-sheet-note">{navigationError}</p>}
      {info?.protected && <p className="muted small office-sheet-note">{t('This worksheet is protected.')}</p>}
      <div ref={grid} className="sheet-grid office-sheet-grid" onScroll={(event) => { const element = event.currentTarget; if (element.scrollHeight - element.scrollTop - element.clientHeight < 250) setShown((count) => Math.min(count + 100, Math.max(20, sheet?.rows.length ?? 0))); }}><table style={{ zoom: zoom / 100 }}>
        <colgroup><col style={{ width: 42 }} />{Array.from({ length: cols }, (_, c) => <col key={c} style={{ width: Math.max(40, sheet?.widths[c] ?? 90) }} />)}</colgroup>
        <thead><tr><th />{Array.from({ length: cols }, (_, c) => <th key={c}>{colName(c)}</th>)}</tr></thead>
        <tbody>{Array.from({ length: rows }, (_, r) => <tr key={r}><th>{r + 1}</th>{Array.from({ length: cols }, (_, c) => {
          if (covered.has(`${r}:${c}`)) return null;
          const ref = `${colName(c)}${r + 1}`, value = sheet?.rows[r]?.[c] ?? '', data = info?.cells[ref];
          const comment = info?.comments.find((note) => note.anchor === ref);
          return <td key={c} {...spans.get(`${r}:${c}`)} tabIndex={ref === selected ? 0 : -1} data-cell={ref} aria-label={ref} aria-selected={ref === selected} className={comment ? 'has-comment' : ''}
            style={data?.style as CSSProperties} title={comment?.text} onClick={() => { setSelected(ref); setEditing(false); setInCell(false); }} onDoubleClick={() => { setSelected(ref); setEditing(true); setInCell(true); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setEditing(true); setInCell(true); } }}>
            {ref === selected && editing && inCell && !locked ? <input autoFocus aria-label={t('Edit cell {cell}', { cell: ref })} value={draft} maxLength={32000} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onChange={(e) => setDraft(e.target.value)} onBlur={save} onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); save(); }
              if (e.key === 'Escape') { e.stopPropagation(); setDraft(cell?.formula ?? cell?.value ?? ''); setEditing(false); }
            }} /> : typeof value === 'object' ? value.n : value}
          </td>;
        })}</tr>)}</tbody>
      </table></div>
      <div className="sheet-tabs" role="tablist">{content.sheets.map((entry, index) => <button type="button" key={index} role="tab" aria-selected={sheetIndex === index} className={sheetIndex === index ? 'active' : ''} onClick={() => { save(); setSheetIndex(index); setSelected('A1'); setEditing(false); }}>{entry.name}</button>)}</div>
    </div>
    {commentsOn && <Comments onNavigate={(ref) => { const match = /^([A-Z]+)([1-9]\d*)$/.exec(ref); if (!match) return; const row = Number(match[2]), column = [...match[1]].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0); if (row > 2000 || column > 200) { setNavigationError(t('This cell is outside the preview. Open it in your spreadsheet program.')); return; } setNavigationError(''); setEditing(false); setInCell(false); setShown((count) => Math.max(count, row + 10)); setSelected(ref); setNavigation({ ref }); }} anchorLabel={(ref) => ref} onClose={onCloseComments} readOnly={locked} comments={info?.comments ?? []} anchor={locked ? null : selected} onComment={(text) => edit({ op: 'comment', sheet: sheetIndex, ref: selected, author: '', text }, true)} onDelete={(ref) => edit({ op: 'delete-comment', sheet: sheetIndex, ref }, true)} />}
  </div>;
}

export function OfficeEditor({ content, project, onReload, commentsOn, onCloseComments, zoom, onZoom, onStatus }: { content: Content; project: string; onReload: () => void; commentsOn: boolean; onCloseComments: () => void; zoom: number; onZoom: (zoom: number) => void; onStatus: (status: { busy: boolean; dirty: boolean; comments: number }) => void }) {
  const edits = useOfficeEdits(content, project);
  const container = useRef<HTMLElement>(null);
  const commentCount = edits.current.kind === 'docx' ? edits.current.document?.comments.length ?? 0 : edits.current.workbook?.sheets.reduce((total, sheet) => total + sheet.comments.length, 0) ?? 0;
  useEffect(() => { onStatus({ busy: edits.busy, dirty: edits.dirty, comments: commentCount }); }, [edits.busy, edits.dirty, commentCount, onStatus]);
  useEffect(() => {
    const element = container.current; if (!element) return;
    const wheel = (event: WheelEvent) => { if ((event.ctrlKey || event.metaKey) && event.deltaY !== 0) { event.preventDefault(); event.stopPropagation(); onZoom(Math.max(50, Math.min(200, zoom + (event.deltaY < 0 ? 10 : -10)))); } };
    element.addEventListener('wheel', wheel, { passive: false }); return () => element.removeEventListener('wheel', wheel);
  }, [zoom, onZoom]);
  const restricted = edits.current.kind === 'docx' ? edits.current.document?.readOnly : edits.current.workbook?.readOnly;
  const editable = /\.(docx|xlsx)$/i.test(content.path) && !restricted;
  return <section ref={container} className="office-editor" aria-label={t('Office editor')}>
    {restricted && <Notice title={t('This Office file is protected or digitally signed.')} />}
    {edits.error && <Notice tone="warn" title={t(edits.error)} actions={<><button type="button" className="btn btn-sm" onClick={edits.retry}>{t('Try again')}</button><button type="button" className="btn btn-sm btn-ghost" onClick={onReload}><IconRefresh size={14} />{t('Reload this file')}</button></>} />}
    {edits.current.kind === 'docx' && edits.current.document && <WordEditor document={edits.current.document} edit={edits.edit} flush={edits.flush} enabled={editable} commentsOn={commentsOn} onCloseComments={onCloseComments} zoom={zoom} />}
    {edits.current.kind === 'xlsx' && <SpreadsheetEditor content={edits.current} edit={edits.edit} enabled={editable} commentsOn={commentsOn} onCloseComments={onCloseComments} zoom={zoom} />}
  </section>;
}
