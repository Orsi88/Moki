// Editors for native Office files. Changes are queued against the last committed version; the service owns package writes.
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { api, type FileContent, type WordChange, type SheetChange, type WordDocument } from '../api';
import type { OfficeComment } from '../../../scripts/lib/office-types';
import { createDebouncer, onFlushEdits } from '../debounce';
import { t } from '../i18n';
import { COLORS, isCommentColor, SWATCH, type CommentColor, type MdComment } from '../md-comments';
import { IconRefresh } from './Icons';
import { Notice } from './Notice';
import { CommentColumn, CommentComposer, SelectionBubble, useBubbleLife, useCommentPlacement, type Bubble, type CommentActions } from './CommentColumn';

type Content = Extract<FileContent, { kind: 'docx' | 'xlsx' }>;
type Change = WordChange | SheetChange;
const changeKey = (change: Change) => change.op === 'text' ? `p:${change.paragraph}` : change.op === 'cell' ? `c:${change.sheet}:${change.ref}` : `${change.op}:${Date.now()}:${Math.random()}`;
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

const asCard = (comment: OfficeComment): MdComment => ({
  id: comment.id, author: comment.author, at: comment.date, text: comment.text, replies: comment.replies ?? [],
  ...(isCommentColor(comment.color) ? { color: comment.color } : {}),
});

// Text offsets include Word's explicit line breaks, which Range.toString() omits.
function wordPieces(root: Node) {
  const walker = window.document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const pieces: { node: Node; text: string }[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE) pieces.push({ node, text: node.textContent ?? '' });
    else if (node.nodeName === 'BR') pieces.push({ node, text: '\n' });
  }
  return pieces;
}

function wordRange(body: HTMLElement, comment: Pick<OfficeComment, 'anchor' | 'range'>): Range | null {
  const paragraph = body.querySelector<HTMLElement>('[data-word-paragraph="' + CSS.escape(comment.anchor) + '"]');
  if (!paragraph) return null;
  const range = window.document.createRange();
  if (!comment.range) { range.selectNodeContents(paragraph); return range; }
  let offset = 0, started = false;
  for (const { node, text } of wordPieces(paragraph)) {
    const end = offset + text.length;
    if (!started && comment.range.start >= offset && comment.range.start < end) {
      if (node.nodeType === Node.TEXT_NODE) range.setStart(node, comment.range.start - offset); else range.setStartBefore(node);
      started = true;
    }
    if (started && comment.range.end > offset && comment.range.end <= end) {
      if (node.nodeType === Node.TEXT_NODE) range.setEnd(node, comment.range.end - offset); else range.setEndAfter(node);
      return range;
    }
    offset = end;
  }
  return null;
}

function bubbleAt(stage: HTMLElement, rect: DOMRect): Bubble {
  const origin = stage.getBoundingClientRect();
  return { x: Math.max(8, Math.min(rect.left - origin.left, stage.clientWidth - 300)) + stage.scrollLeft,
    y: rect.top - origin.top + stage.scrollTop, below: rect.bottom - origin.top + stage.scrollTop, why: '' };
}

interface OfficeViewProps { edit: (change: Change, now?: boolean) => void; enabled: boolean; commentsOn: boolean; saving: boolean; zoom: number; onShow: () => void }

function WordEditor({ document: doc, edit, flush, enabled, commentsOn, saving, zoom, onShow }: OfficeViewProps & { document: WordDocument; flush: () => void }) {
  const host = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), rail = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null), pendingFocus = useRef<{ id: string; count: number } | null>(null);
  const [active, setActive] = useState(''), [color, setColor] = useState<CommentColor>('yellow');
  const [bubble, setBubble] = useState<(Bubble & { anchor: string; range: { start: number; end: number } }) | null>(null);
  const [composer, setComposer] = useState<typeof bubble>(null);
  const prefix = 'word-comment-' + useId().replace(/[^a-z0-9]/gi, '');
  const comments = useMemo(() => doc.comments.map(asCard), [doc.comments]);
  const canFormat = enabled && doc.paragraphs.some((paragraph) => paragraph.id === selected && paragraph.editable);
  useLayoutEffect(() => {
    const element = host.current; if (!element) return;
    const jump = pendingFocus.current && doc.paragraphs.length >= pendingFocus.current.count ? pendingFocus.current.id : null;
    // A save must not move the caret or replace text typed while its request was in flight.
    if (jump || !element.contains(window.document.activeElement)) element.innerHTML = doc.html;
    if (jump) pendingFocus.current = null;
    for (const paragraph of element.querySelectorAll<HTMLElement>('[data-word-paragraph]')) {
      const editable = enabled && paragraph.dataset.editable === 'true';
      paragraph.contentEditable = editable ? 'plaintext-only' : 'false';
      paragraph.setAttribute('role', 'textbox');
      paragraph.setAttribute('aria-readonly', String(!editable));
      paragraph.setAttribute('aria-label', t('Paragraph {n}', { n: String(Number(paragraph.dataset.wordParagraph) + 1) }));
      paragraph.tabIndex = 0;
    }
    if (jump) element.querySelector<HTMLElement>('[data-word-paragraph="' + CSS.escape(jump) + '"]')?.focus();
  }, [doc, enabled]);
  useLayoutEffect(() => {
    if (!host.current || !CSS.highlights || typeof Highlight === 'undefined') return;
    const groups = new Map<string, Range[]>();
    for (const comment of doc.comments) {
      const range = wordRange(host.current, comment);
      if (!range) continue;
      const base = isCommentColor(comment.color) ? comment.color : 'yellow';
      const key = base + (comment.id === active ? '-active' : '');
      groups.set(key, [...groups.get(key) ?? [], range]);
    }
    if (composer) {
      const range = wordRange(host.current, composer);
      if (range) groups.set('selection', [range]);
    }
    for (const [key, ranges] of groups) CSS.highlights.set(prefix + '-' + key, new Highlight(...ranges));
    return () => { for (const key of groups.keys()) CSS.highlights.delete(prefix + '-' + key); };
  });
  const markOf = useCallback((body: HTMLElement, id: string) => {
    const comment = doc.comments.find((c) => c.id === id);
    return comment ? wordRange(body, comment) : null;
  }, [doc.comments]);
  const placed = useCommentPlacement(stage, host, rail, comments, markOf);
  const closeBubble = useCallback(() => setBubble(null), []);
  useBubbleLife(bubble, closeBubble, host);
  const select = (target: EventTarget | null) => {
    const paragraph = target instanceof Element ? target.closest<HTMLElement>('[data-word-paragraph]') : null;
    if (paragraph?.dataset.wordParagraph !== undefined) setSelected(paragraph.dataset.wordParagraph);
    return paragraph;
  };
  const capture = () => {
    const selection = window.getSelection(), box = stage.current, body = host.current;
    if (!box || !body || !selection?.rangeCount || selection.isCollapsed) { setBubble(null); return; }
    const range = selection.getRangeAt(0);
    if (!body.contains(range.commonAncestorContainer) || !range.toString().trim()) return;
    const parent = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
    const paragraph = parent?.closest<HTMLElement>('[data-word-paragraph]');
    if (!paragraph || !paragraph.contains(range.endContainer) || paragraph.dataset.wordParagraph === undefined) {
      setBubble({ ...bubbleAt(box, range.getBoundingClientRect()), anchor: '', range: { start: 0, end: 0 }, why: t('Select text inside one paragraph to comment on it.') }); return;
    }
    const before = range.cloneRange(); before.selectNodeContents(paragraph); before.setEnd(range.startContainer, range.startOffset);
    const start = wordPieces(before.cloneContents()).reduce((n, piece) => n + piece.text.length, 0);
    const length = wordPieces(range.cloneContents()).reduce((n, piece) => n + piece.text.length, 0);
    setBubble({ ...bubbleAt(box, range.getBoundingClientRect()), anchor: paragraph.dataset.wordParagraph, range: { start, end: start + length },
      why: !enabled ? t('This Office file is protected or digitally signed.') : paragraph.dataset.editable !== 'true' ? t('This paragraph must be edited in a Word processor.') : '' });
  };
  const jump = (id: string) => {
    const comment = doc.comments.find((c) => c.id === id);
    if (!comment || !host.current) return;
    setActive(id); setSelected(comment.anchor); onShow();
    wordRange(host.current, comment)?.startContainer.parentElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
  };
  const format = (mark: 'b' | 'i' | 'u') => { if (selected !== null && canFormat) edit({ op: 'format', paragraph: selected, mark }, true); };
  const actions: CommentActions = {
    reply: (id, text) => edit({ op: 'reply', id, author: '', text }, true),
    edit: (id, text) => edit({ op: 'edit-comment', id, text }, true),
    color: (id, next) => edit({ op: 'color', id, color: next }, true),
    remove: (id) => edit({ op: 'delete-comment', id }, true),
  };
  const highlightStyles = COLORS.map((key) => '::highlight(' + prefix + '-' + key + '){background:color-mix(in srgb,' + SWATCH[key] + ' 28%,transparent);}::highlight(' + prefix + '-' + key + '-active){background:color-mix(in srgb,' + SWATCH[key] + ' 50%,transparent);}')
    .join('') + '::highlight(' + prefix + '-selection){background:rgb(0 90 255 / .3);}';
  return <div className="office-word">
    <style>{highlightStyles}</style>
    <div className="office-word-tools">
      <button type="button" title={t('Bold')} aria-label={t('Bold')} disabled={!canFormat} onMouseDown={(e) => e.preventDefault()} onClick={() => format('b')}><b>B</b></button>
      <button type="button" className="italic" title={t('Italic')} aria-label={t('Italic')} disabled={!canFormat} onMouseDown={(e) => e.preventDefault()} onClick={() => format('i')}><i>I</i></button>
      <button type="button" className="underline" title={t('Underline')} aria-label={t('Underline')} disabled={!canFormat} onMouseDown={(e) => e.preventDefault()} onClick={() => format('u')}><u>U</u></button>
    </div>
    <div className="office-word-scroll">
      <div ref={stage} className={'office-commented office-word-stage' + (commentsOn ? ' with-rail' : '')}>
        <div ref={host} className="office-word-paper" style={{ zoom: zoom / 100 }} onFocusCapture={(e) => select(e.target)} onMouseUp={capture} onKeyUp={(e) => { if (e.shiftKey) capture(); }} onClick={(e) => {
          select(e.target);
          const link = (e.target as Element).closest('a'); if (link) { e.preventDefault(); if (e.ctrlKey || e.metaKey) void api.openLink(link.getAttribute('href') ?? ''); }
        }} onInput={(e) => {
          const paragraph = select(e.target), id = paragraph?.dataset.wordParagraph;
          if (paragraph && id !== undefined) edit({ op: 'text', paragraph: id, text: paragraph.innerText.replace(/\r/g, '') });
        }} onBlurCapture={flush} onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); flush(); }
          if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            const paragraph = select(e.target), id = paragraph?.dataset.wordParagraph;
            if (!paragraph || paragraph.dataset.editable !== 'true' || id === undefined) return;
            e.preventDefault();
            pendingFocus.current = { id: String(Number(id) + 1), count: doc.paragraphs.length + 1 };
            edit({ op: 'insert', after: id, text: '' }, true);
          }
        }} />
        <CommentColumn comments={comments} placed={placed} rail={rail} shown={commentsOn} hidden={!commentsOn} onShow={onShow}
          active={active} onActive={setActive} saving={saving} readOnly={!enabled} actions={actions} onJump={jump}
          describe={(id) => { const c = doc.comments.find((note) => note.id === id); return <button type="button" className="office-comment-where" onClick={() => jump(id)}>{t('Paragraph {n}', { n: Number(c?.anchor ?? 0) + 1 })}</button>; }} />
        {bubble && <SelectionBubble bubble={bubble} onComment={() => { if (!bubble.why) { setComposer(bubble); setBubble(null); } }} />}
        {composer && <CommentComposer x={composer.x} y={composer.below + 8} saving={saving} color={color} onColor={setColor}
          onAdd={(text) => { edit({ op: 'comment', paragraph: composer.anchor, range: composer.range, author: '', text, color }, true); setComposer(null); window.getSelection()?.removeAllRanges(); onShow(); }}
          onCancel={() => setComposer(null)} />}
      </div>
    </div>
  </div>;
}

function SpreadsheetEditor({ content, edit, enabled, commentsOn, saving, zoom, onShow }: OfficeViewProps & { content: Extract<Content, { kind: 'xlsx' }> }) {
  const [sheetIndex, setSheetIndex] = useState(Math.max(0, content.sheets.findIndex((sheet) => !sheet.hidden)));
  const [selected, setSelected] = useState('A1'), [draft, setDraft] = useState(''), [editing, setEditing] = useState(false), [inCell, setInCell] = useState(false), [shown, setShown] = useState(200);
  const [active, setActive] = useState(''), [color, setColor] = useState<CommentColor>('yellow');
  const [bubble, setBubble] = useState<(Bubble & { ref: string }) | null>(null), [composer, setComposer] = useState<typeof bubble>(null);
  const stage = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null), rail = useRef<HTMLDivElement>(null);
  const [navigation, setNavigation] = useState<{ ref: string } | null>(null), [navigationError, setNavigationError] = useState('');
  const info = content.workbook?.sheets[sheetIndex], sheet = content.sheets[sheetIndex];
  const cell = info?.cells[selected], locked = !enabled || Boolean(info?.protected);
  const comments = useMemo(() => (info?.comments ?? []).map(asCard), [info]);
  const markOf = useCallback((element: HTMLElement, id: string) => {
    const cell = element.querySelector<HTMLElement>('[data-cell="' + CSS.escape(id) + '"]');
    if (!cell) return null;
    const rect = cell.getBoundingClientRect(), viewport = element.getBoundingClientRect();
    const left = Math.max(viewport.left, Math.min(rect.left, viewport.right)), right = Math.max(left, Math.min(rect.right, viewport.right));
    return { getBoundingClientRect: () => DOMRect.fromRect({ x: left, y: rect.top, width: right - left, height: rect.height }) };
  }, []);
  const placed = useCommentPlacement(stage, body, rail, comments, markOf);
  useLayoutEffect(() => {
    if (!navigation) return;
    const cell = body.current?.querySelector<HTMLElement>('[data-cell="' + CSS.escape(navigation.ref) + '"]');
    if (cell) { cell.scrollIntoView({ block: 'center', inline: 'nearest' }); cell.focus({ preventScroll: true }); }
  }, [navigation, shown]);
  const positions = (info?.comments ?? []).map((note) => /^([A-Z]+)([1-9]\d*)$/.exec(note.anchor)).filter((match) => match !== null);
  const commentRows = Math.max(0, ...positions.map((match) => Number(match[2])));
  const commentCols = Math.max(0, ...positions.map((match) => [...match[1]].reduce((n, char) => n * 26 + char.charCodeAt(0) - 64, 0)));
  const maxRows = Math.min(2000, Math.max(20, sheet?.rows.length ?? 0, commentRows));
  useEffect(() => { setShown((count) => Math.max(count, Math.min(commentRows + 5, 2000))); }, [commentRows]);
  useEffect(() => { if (!editing) setDraft(cell?.formula ?? cell?.value ?? ''); }, [cell, selected, sheetIndex, editing]);
  const save = () => {
    if (!locked && draft !== (cell?.formula ?? cell?.value ?? '')) edit({ op: 'cell', sheet: sheetIndex, ref: selected, value: draft }, true);
    setEditing(false); setInCell(false);
  };
  const rows = Math.min(shown, maxRows), cols = Math.min(200, Math.max(8, commentCols, ...(sheet?.rows ?? []).map((row) => row.length)));
  const spans = new Map<string, { rowSpan: number; colSpan: number }>(), covered = new Set<string>();
  for (const [r, c, r2, c2] of sheet?.merges ?? []) {
    spans.set(r + ':' + c, { rowSpan: r2 - r + 1, colSpan: c2 - c + 1 });
    for (let row = r; row <= r2; row++) for (let col = c; col <= c2; col++) if (row !== r || col !== c) covered.add(row + ':' + col);
  }
  const actions: CommentActions = {
    reply: (id, text) => edit({ op: 'reply', sheet: sheetIndex, ref: id, author: '', text }, true),
    edit: (id, text) => edit({ op: 'comment', sheet: sheetIndex, ref: id, author: '', text }, true),
    color: (id, next) => edit({ op: 'color', sheet: sheetIndex, ref: id, color: next }, true),
    remove: (id) => edit({ op: 'delete-comment', sheet: sheetIndex, ref: id }, true),
  };
  const jump = (ref: string) => {
    const match = /^([A-Z]+)([1-9]\d*)$/.exec(ref);
    if (!match) return;
    const row = Number(match[2]), column = [...match[1]].reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0);
    if (row > 2000 || column > 200) { setNavigationError(t('This cell is outside the preview. Open it in your spreadsheet program.')); return; }
    setNavigationError(''); setShown((count) => Math.max(count, Math.min(row + 10, 2000))); setSelected(ref); setActive(ref); setNavigation({ ref }); setBubble(null); onShow();
  };
  const pick = (element: HTMLTableCellElement, ref: string) => {
    setSelected(ref); setActive(info?.comments.find((c) => c.anchor === ref)?.id ?? ''); setEditing(false); setInCell(false); setComposer(null);
    if (stage.current) setBubble({ ...bubbleAt(stage.current, element.getBoundingClientRect()), ref,
      why: locked ? t('This worksheet is protected.') : info?.comments.some((c) => c.anchor === ref) ? t('This cell already has a comment. Reply on its card.') : '' });
  };
  return <div className="office-sheet">
    <div className="office-formula"><strong>{selected}</strong><span className="muted">fx</span><input aria-label={t('Cell value or formula')} value={draft} readOnly={locked} maxLength={32000} onFocus={() => { setEditing(true); setBubble(null); }} onChange={(e) => setDraft(e.target.value)} onBlur={save} onKeyDown={(e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); e.currentTarget.blur(); }
      if (e.key === 'Escape') { e.stopPropagation(); setDraft(cell?.formula ?? cell?.value ?? ''); setEditing(false); }
    }} /></div>
    {navigationError && <p role="status" className="muted small office-sheet-note">{navigationError}</p>}
    {info?.protected && <p className="muted small office-sheet-note">{t('This worksheet is protected.')}</p>}
    <div ref={stage} className={'office-commented office-sheet-stage' + (commentsOn ? ' with-rail' : '')}
      onKeyDown={(e) => { if (e.key === 'Escape') setBubble(null); }}
      onScroll={(event) => { setBubble(null); const element = event.currentTarget; if (element.scrollHeight - element.scrollTop - element.clientHeight < 250) setShown((count) => Math.min(count + 100, maxRows)); }}>
      <div ref={body} className="office-sheet-x"><div className="sheet-grid office-sheet-grid"><table style={{ zoom: zoom / 100 }}>
        <colgroup><col style={{ width: 42 }} />{Array.from({ length: cols }, (_, c) => <col key={c} style={{ width: Math.max(40, sheet?.widths[c] ?? 90) }} />)}</colgroup>
        <thead><tr><th />{Array.from({ length: cols }, (_, c) => <th key={c}>{colName(c)}</th>)}</tr></thead>
        <tbody>{Array.from({ length: rows }, (_, r) => <tr key={r}><th>{r + 1}</th>{Array.from({ length: cols }, (_, c) => {
          if (covered.has(r + ':' + c)) return null;
          const ref = colName(c) + (r + 1), value = sheet?.rows[r]?.[c] ?? '', data = info?.cells[ref];
          const comment = info?.comments.find((note) => note.anchor === ref);
          const tint = comment && isCommentColor(comment.color) ? SWATCH[comment.color] : undefined;
          return <td key={c} {...spans.get(r + ':' + c)} tabIndex={ref === selected ? 0 : -1} data-cell={ref} aria-label={ref} aria-selected={ref === selected} className={[comment ? 'has-comment' : '', active === ref ? 'comment-on' : ''].filter(Boolean).join(' ')}
            style={{ ...data?.style, ...(tint ? { ['--comment-color' as string]: tint } : {}) } as CSSProperties} title={comment?.text} onClick={(e) => pick(e.currentTarget, ref)} onDoubleClick={() => { setBubble(null); setSelected(ref); setEditing(true); setInCell(true); }} onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); setBubble(null); setEditing(true); setInCell(true); }
              if (e.key === 'F10' && e.shiftKey) { e.preventDefault(); pick(e.currentTarget, ref); }
            }}>
            {ref === selected && editing && inCell && !locked ? <input autoFocus aria-label={t('Edit cell {cell}', { cell: ref })} value={draft} maxLength={32000} onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} onChange={(e) => setDraft(e.target.value)} onBlur={save} onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); save(); }
              if (e.key === 'Escape') { e.stopPropagation(); setDraft(cell?.formula ?? cell?.value ?? ''); setEditing(false); }
            }} /> : typeof value === 'object' ? value.n : value}
          </td>;
        })}</tr>)}</tbody>
      </table></div></div>
      <CommentColumn comments={comments} placed={placed} rail={rail} shown={commentsOn} hidden={!commentsOn} onShow={onShow}
        active={active} onActive={setActive} saving={saving} readOnly={locked} actions={actions} onJump={jump}
        describe={(id) => <button type="button" className="office-comment-where" onClick={() => jump(id)}>{id}</button>} />
      {bubble && <SelectionBubble bubble={bubble} onComment={() => { if (!bubble.why) { setComposer(bubble); setBubble(null); } }} />}
      {composer && <CommentComposer x={composer.x} y={composer.below + 8} saving={saving} color={color} onColor={setColor}
        onAdd={(text) => { edit({ op: 'comment', sheet: sheetIndex, ref: composer.ref, author: '', text, color }, true); setComposer(null); onShow(); }}
        onCancel={() => setComposer(null)} />}
    </div>
    <div className="sheet-tabs" role="tablist">{content.sheets.map((entry, index) => <button type="button" key={index} role="tab" aria-selected={sheetIndex === index} className={sheetIndex === index ? 'active' : ''} onClick={() => { save(); setSheetIndex(index); setSelected('A1'); setActive(''); setBubble(null); setComposer(null); setEditing(false); }}>{entry.name}</button>)}</div>
  </div>;
}

export function OfficeEditor({ content, project, onReload, commentsOn, onShowComments, zoom, onZoom, onStatus }: { content: Content; project: string; onReload: () => void; commentsOn: boolean; onShowComments: () => void; zoom: number; onZoom: (zoom: number) => void; onStatus: (status: { busy: boolean; dirty: boolean; comments: number }) => void }) {
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
    {edits.current.kind === 'docx' && edits.current.document && <WordEditor document={edits.current.document} edit={edits.edit} flush={edits.flush} enabled={editable} commentsOn={commentsOn} onShow={onShowComments} saving={edits.busy} zoom={zoom} />}
    {edits.current.kind === 'xlsx' && <SpreadsheetEditor content={edits.current} edit={edits.edit} enabled={editable} commentsOn={commentsOn} onShow={onShowComments} saving={edits.busy} zoom={zoom} />}
  </section>;
}
