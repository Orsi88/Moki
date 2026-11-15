// Comments beside a document, shared by Markdown, Word, spreadsheets and sandboxed HTML:
// each card sits at the height of what it comments, joined to it by a thin line,
// with reply, edit, color and delete; with the column hidden, a mark on the text's edge opens it. Also the
// floating Comment button of a selection and the box a new comment is written in. Where the comments live
// (the file's text) and how a change is saved belong to the caller.

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { t } from '../i18n';
import { SWATCH, type CommentColor, type MdComment } from '../md-comments';
import { stackCards } from '../pdf-quads';
import { IconChat, IconFlag } from './Icons';
import { MarkerBadge, MarkerPicker } from './Markers';
import { markerColor, markerOnly, splitMarker, useMarkers, withMarker } from '../markers';
import type { Marker } from '../api';
import { CommentColors } from './CommentColors';
import { confirmDialog } from '../dialogs';

// areas: a marker over several paragraphs, drawn as one block around them (stage coordinates).
export interface MarkedArea { id: string; left: number; top: number; width: number; height: number; icon: string; color: string }
// corners: the icon of a marker at the start of its marked text. styles: CSS for the marked text, by comment id.
// Nothing is written into the text's own nodes: an editor (ProseMirror) redraws them and drops what it did not set.
export interface MarkedCorner { id: string; left: number; top: number; icon: string; color: string }
export interface Placed { items: { id: string; ax: number; ay: number; edge: number; top: number; anchored?: boolean }[]; rail: number; railTop: number; height: number; railScroll?: number; areas?: MarkedArea[]; corners?: MarkedCorner[]; styles?: string }
export interface CommentActions {
  reply: (id: string, text: string) => void;
  edit: (id: string, text: string) => void;
  color: (id: string, color: CommentColor) => void;
  remove: (id: string) => void;
  resolve?: (id: string, resolved: boolean) => void;
}
// The floating Comment button: where the selection is (relative to the stage) and, when it cannot be commented, why.
export interface Bubble { x: number; y: number; below: number; why: string }

// The pieces of a comment's marks in the text (Markdown and Word mark their text with the id), and the paragraphs,
// items, headings or cells they sit in.
const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, pre';
const piecesOf = (text: HTMLElement, id: string) => [...text.querySelectorAll<HTMLElement>(`[data-md-comment="${CSS.escape(id)}"], [data-comment-id="${CSS.escape(id)}"]`)];
const blocksOf = (pieces: HTMLElement[]) => [...new Set(pieces.map((el) => el.closest<HTMLElement>(BLOCKS) ?? el))];

const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };

// Each card beside the first mark of its comment, pushed down under the card above when they would overlap.
// `markOf` finds a comment's first mark in the text (the reading view and the editor draw them differently).
export function useCommentPlacement(stage: RefObject<HTMLElement | null>, body: RefObject<HTMLElement | null>, rail: RefObject<HTMLElement | null>,
  comments: MdComment[], markOf: (body: HTMLElement, id: string) => Pick<Range, 'getBoundingClientRect'> | null): Placed {
  const [placed, setPlaced] = useState<Placed>({ items: [], rail: 0, railTop: 0, height: 0 });
  const markers = useMarkers();
  const measure = useCallback(() => {
    const box = stage.current;
    const column = rail.current; // null while the column is hidden: only the marks on the text's edge
    const text = body.current;
    if (!box || !text) return;
    const origin = box.getBoundingClientRect();
    // The stage may be the scroller. Absolute lines are drawn in its content, so the scroll offset belongs in the measure.
    const scrollX = box.scrollLeft, scrollY = box.scrollTop;
    const edge = text.getBoundingClientRect().right - origin.left + scrollX;
    const heights = new Map([...(column?.querySelectorAll<HTMLElement>('[data-card]') ?? [])].map((el) => [el.dataset.card ?? '', el.offsetHeight]));
    const wanted = comments.map((c) => {
      const mark = markOf(text, c.id);
      if (!mark) return { id: c.id, ax: edge, ay: 18 + scrollY, edge, anchored: false };
      const r = mark.getBoundingClientRect();
      return { id: c.id, ax: r.right - origin.left + scrollX, ay: r.top - origin.top + r.height / 2 + scrollY, edge, anchored: true };
    });
    const tops = stackCards(wanted.map((w) => ({ id: w.id, top: w.ay - 18, height: heights.get(w.id) ?? 90 })), 10);
    const railBox = column?.getBoundingClientRect() ?? origin;
    const railTop = railBox.top - origin.top + scrollY;
    const bottom = Math.max(0, ...wanted.map((w) => tops[w.id] + (heights.get(w.id) ?? 90)));
    // A marker over one paragraph: its text is the area (a CSS rule by id), its icon in a corner drawn over it.
    // Over several paragraphs: one area around them, the text inside without boxes of its own.
    const areas: MarkedArea[] = [], corners: MarkedCorner[] = [], rules: string[] = [];
    for (const c of comments) {
      const marker = splitMarker(c.text, markers).marker;
      if (!marker) continue;
      const pieces = piecesOf(text, c.id);
      const blocks = blocksOf(pieces);
      const tone = markerColor(markers.find((m) => m.icon === marker.icon) ?? marker);
      const select = `[data-md-comment="${c.id.replace(/"/g, '')}"],[data-comment-id="${c.id.replace(/"/g, '')}"]`;
      if (blocks.length < 2) {
        rules.push(`:is(${select}){--marker-color:${SWATCH[tone]}}`, `.tiptap-wrap .ProseMirror span:is(${select}),.markdown mark:is(${select}),:is(${select}).marker-area-host{padding:1px 3px;border:1.5px solid color-mix(in srgb,var(--marker-color) 75%,transparent);border-radius:6px;background:color-mix(in srgb,var(--marker-color) 18%,transparent)!important;box-decoration-break:clone;-webkit-box-decoration-break:clone}`);
        const first = pieces[0]?.getBoundingClientRect();
        if (first) corners.push({ id: c.id, left: first.left - origin.left + scrollX - 9, top: first.top - origin.top + scrollY - 10, icon: marker.icon, color: tone });
        continue;
      }
      rules.push(`.tiptap-wrap .ProseMirror span:is(${select}),.markdown mark:is(${select}){background:transparent!important;border-bottom-color:transparent!important}`);
      const rects = blocks.map((el) => el.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left)), right = Math.max(...rects.map((r) => r.right));
      const top = Math.min(...rects.map((r) => r.top)), lowest = Math.max(...rects.map((r) => r.bottom));
      areas.push({ id: c.id, left: left - origin.left + scrollX - 8, top: top - origin.top + scrollY - 6, width: right - left + 16, height: lowest - top + 12,
        icon: marker.icon, color: tone });
    }
    const next = { items: wanted.map((w) => ({ ...w, top: Math.max(0, tops[w.id] - railTop) })), rail: railBox.left - origin.left + scrollX, railTop, height: Math.max(text.getBoundingClientRect().height, bottom), railScroll: column?.scrollTop ?? 0, areas, corners, styles: rules.join('') };
    setPlaced((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
  }, [comments, stage, body, rail, markOf, markers]);
  useLayoutEffect(() => { measure(); });
  // The editor redraws its nodes when the text changes: the corners and areas follow (a measure writes nothing to them).
  useEffect(() => {
    const text = body.current;
    if (!text) return undefined;
    const redrawn = new MutationObserver(() => measure());
    redrawn.observe(text, { childList: true, subtree: true, characterData: true });
    return () => redrawn.disconnect();
  }, [body, body.current, measure]);
  useEffect(() => {
    const box = stage.current;
    if (!box) return undefined;
    const watch = new ResizeObserver(() => measure());
    watch.observe(box);
    if (body.current) watch.observe(body.current);
    rail.current?.querySelectorAll('[data-card]').forEach((card) => watch.observe(card));
    box.addEventListener('scroll', measure, { passive: true, capture: true });
    window.addEventListener('resize', measure);
    return () => { watch.disconnect(); box.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure); };
  }, [measure, stage, body, rail, rail.current]);
  return placed;
}

interface ColumnProps {
  comments: MdComment[];
  placed: Placed;
  rail: RefObject<HTMLDivElement | null>;
  shown: boolean; // the column is open and has something to show
  hidden: boolean; // the column is closed: marks on the text's edge instead
  onShow?: () => void;
  active: string;
  onActive: (id: string) => void;
  saving: boolean;
  actions: CommentActions;
  readOnly?: boolean;
  describe?: (id: string) => ReactNode;
  onJump?: (id: string) => void;
  empty?: ReactNode;
}

export function CommentColumn({ comments, placed, rail, shown, hidden, onShow, active, onActive, saving, actions, readOnly = false, describe, onJump, empty }: ColumnProps) {
  const [editing, setEditing] = useState<{ id: string; mode: 'reply' | 'edit'; text: string } | null>(null);
  const [colorPicker, setColorPicker] = useState<string | null>(null);
  const [markerPicker, setMarkerPicker] = useState<string | null>(null);
  const markers = useMarkers();
  const where = new Map(placed.items.map((p) => [p.id, p]));
  // A comment's marker is the prefix of its text: shown as a badge, kept when the text is edited.
  const markerOf = (id: string) => splitMarker(comments.find((c) => c.id === id)?.text ?? '', markers).marker;
  const finish = () => {
    if (!editing || saving || readOnly) return;
    // A marker without a comment may stay without one; anything else needs some text.
    if (!editing.text.trim() && !(editing.mode === 'edit' && markerOf(editing.id))) return;
    if (editing.mode === 'reply') actions.reply(editing.id, editing.text.trim()); else actions.edit(editing.id, withMarker(editing.text.trim(), markerOf(editing.id), markers));
    setEditing(null);
  };
  const remove = async (id: string) => {
    const only = markerOnly(comments.find((c) => c.id === id)?.text ?? '', markers);
    if (await confirmDialog(only ? t('Remove this marker?') : t('Delete this comment?'), { danger: true })) actions.remove(id);
  };
  return (
    <>
      {placed.styles ? <style>{placed.styles}</style> : null}
      {placed.corners?.map((c) => <span key={`corner-${c.id}`} className="marker-corner" data-marker-color={c.color} style={{ left: c.left, top: c.top }} aria-hidden="true">{c.icon}</span>)}
      {placed.areas?.map((a) => (
        <div key={`area-${a.id}`} className={`marker-block${active === a.id ? ' on' : ''}`} data-marker-color={a.color} style={{ left: a.left, top: a.top, width: a.width, height: a.height }} aria-hidden="true">
          <span className="marker-block-icon">{a.icon}</span>
        </div>
      ))}
      {shown && (
        <>
          <svg className="md-links" width="100%" height={placed.height} aria-hidden="true">
            {placed.items.filter((p) => p.anchored !== false).map((p) => {
              const cy = placed.railTop + p.top + 18 - (placed.railScroll ?? 0);
              const mid = (p.ax + placed.rail) / 2;
              const value = comments.find((c) => c.id === p.id)?.color;
              return <path key={p.id} className={active === p.id ? 'on' : ''} style={{ stroke: value ? SWATCH[value] : undefined }} d={`M${p.ax} ${p.ay} C${mid} ${p.ay}, ${mid} ${cy}, ${placed.rail} ${cy}`} />;
            })}
          </svg>
          <div className="md-rail" ref={rail} style={{ height: Math.max(0, placed.height - placed.railTop) }} aria-label={t('Comments')}>
            {comments.length === 0 && (empty ?? <p className="muted small pdf-rail-empty">{t('No comments yet.')}</p>)}
            {comments.map((c) => { const { marker, body } = splitMarker(c.text, markers); return (
              <div key={c.id} data-card={c.id} data-positioned={where.has(c.id)} className={`pdf-card md-card${active === c.id ? ' on' : ''}${c.resolved ? ' resolved' : ''}${markerOnly(c.text, markers) ? ' marker-only' : ''}`} style={{ top: where.get(c.id)?.top ?? 0, borderLeftColor: c.color ? SWATCH[c.color] : undefined }}
                tabIndex={onJump ? 0 : undefined} onClick={(e) => { if (!(e.target as HTMLElement).closest('button, textarea, a, input')) onJump?.(c.id); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget && onJump) { e.preventDefault(); onJump(c.id); } }}
                onMouseEnter={() => onActive(c.id)} onMouseLeave={() => onActive('')} onFocus={() => onActive(c.id)}>
                {describe?.(c.id)}
                <div className="pdf-comment-head"><strong>{c.author || t('Unknown author')}</strong><span className="muted small">{when(c.at)}</span></div>
                {marker && <MarkerBadge marker={marker} />}
                {editing?.id === c.id && editing.mode === 'edit' ? null : body.trim() ? <p className="pdf-comment-text">{body}</p> : null}
                {c.replies.length > 0 && (
                  <div className="pdf-replies">
                    {c.replies.map((r, i) => (
                      <div key={i} className="pdf-reply">
                        <div className="pdf-comment-head"><strong>{r.author || t('Unknown author')}</strong><span className="muted small">{when(r.at)}</span></div>
                        <p className="pdf-comment-text">{r.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                {editing?.id === c.id ? (
                  <div className="pdf-edit">
                    <textarea value={editing.text} autoFocus rows={3} placeholder={editing.mode === 'reply' ? t('Your reply') : t('Comment')}
                      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); finish(); } }} />
                    <div className="pdf-actions">
                      <button type="button" className="btn btn-sm" disabled={saving || readOnly || (!editing.text.trim() && !(editing.mode === 'edit' && markerOf(editing.id)))} onClick={finish}>{t('Save')}</button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>{t('Cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="pdf-actions">
                    <button type="button" className="icon-btn md-color-toggle" title={t('Change comment color')} aria-label={t('Change comment color')} aria-expanded={colorPicker === c.id} disabled={saving || readOnly} onClick={() => setColorPicker(colorPicker === c.id ? null : c.id)}><span style={{ background: c.color ? SWATCH[c.color] : 'var(--accent)' }} /></button>
                    {body.trim() ? <button type="button" className="link-btn" disabled={saving || readOnly} onClick={() => setEditing({ id: c.id, mode: 'reply', text: '' })}>{t('Reply')}</button> : null}
                    <button type="button" className={`icon-btn marker-toggle${marker ? ' on' : ''}`} title={t('Marker')} aria-label={t('Marker')} aria-expanded={markerPicker === c.id} disabled={saving || readOnly} onClick={() => setMarkerPicker(markerPicker === c.id ? null : c.id)}>{marker ? <span aria-hidden="true">{marker.icon}</span> : <IconFlag size={14} />}</button>
                    <button type="button" className="link-btn" disabled={saving || readOnly} onClick={() => setEditing({ id: c.id, mode: 'edit', text: body })}>{body.trim() ? t('Edit') : t('Add a comment')}</button>
                    {actions.resolve && <button type="button" className="link-btn" disabled={saving || readOnly} onClick={() => actions.resolve?.(c.id, !c.resolved)}>{c.resolved ? t('Reopen comment') : t('Resolve comment')}</button>}
                    <button type="button" className="link-btn" disabled={saving || readOnly} onClick={() => remove(c.id)}>{t('Delete')}</button>
                  </div>
                )}
                {colorPicker === c.id && <CommentColors value={c.color} disabled={saving || readOnly} onChange={(next) => { actions.color(c.id, next); setColorPicker(null); }} />}
                {markerPicker === c.id && <MarkerPicker markers={markers} value={marker} disabled={saving || readOnly} onPick={(next) => { actions.edit(c.id, withMarker(c.text, next, markers)); setMarkerPicker(null); }} />}
              </div>
            ); })}
          </div>
        </>
      )}
      {hidden && placed.items.filter((p) => p.anchored !== false).map((p) => {
        const c = comments.find((x) => x.id === p.id);
        return (
          <button key={p.id} type="button" className="pdf-marker md-marker" style={{ left: p.edge + 6, top: p.ay - 9, background: c?.color ? SWATCH[c.color] : undefined }}
            title={c?.text} aria-label={t('Open the comment: {text}', { text: c?.text ?? '' })}
            onClick={() => { onShow?.(); onActive(p.id); }} />
        );
      })}
    </>
  );
}

// The button goes with its selection: cleared, moved out of `inside`, Esc.
export function useBubbleLife(bubble: Bubble | null, close: () => void, inside: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (!bubble) return undefined;
    const gone = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !inside.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) close();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('selectionchange', gone);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('selectionchange', gone); document.removeEventListener('keydown', esc); };
  }, [bubble, close, inside]);
}

// Selecting is often only reading or copying, so the comment box opens from this button, never by itself.
// Above the selection (below it at the very top); mousedown would clear the selection before the click.
// "Mark" opens the same box in marker mode (a marker, the comment optional): every editor's box, with no change to it.
let nextMode: 'comment' | 'marker' = 'comment';
export function SelectionBubble({ bubble, onComment }: { bubble: Bubble; onComment: () => void }) {
  const below = bubble.y < 44;
  return (
    <div className={`md-select-bubble${below ? ' below' : ''}`} role="toolbar" aria-label={t('Selection')}
      style={{ left: bubble.x, top: below ? bubble.below + 6 : bubble.y - 6 }} onMouseDown={(e) => e.preventDefault()}>
      <button type="button" disabled={Boolean(bubble.why)} aria-describedby={bubble.why ? 'md-select-why' : undefined} onClick={onComment}>
        <IconChat size={15} /> {t('Comment on it')}
      </button>
      <button type="button" disabled={Boolean(bubble.why)} onClick={() => { nextMode = 'marker'; onComment(); }}>
        <IconFlag size={15} /> {t('Mark')}
      </button>
      {bubble.why && <span id="md-select-why" className="md-select-why">{bubble.why}</span>}
    </div>
  );
}

interface ComposerProps { x: number; y: number; saving: boolean; color: CommentColor; onColor: (color: CommentColor) => void; onAdd: (text: string) => void; onCancel: () => void }

export function CommentComposer({ x, y, saving, color, onColor, onAdd, onCancel }: ComposerProps) {
  const [text, setText] = useState('');
  const markers = useMarkers();
  const [marker, setMarker] = useState<Marker | null>(null);
  const [mode] = useState(() => { const m = nextMode; nextMode = 'comment'; return m; });
  // A marker alone marks the passage; with text it is a comment carrying that marker.
  const ready = Boolean(text.trim()) || Boolean(marker);
  const add = () => { if (!saving && ready) onAdd(text.trim() ? withMarker(text.trim(), marker, markers) : withMarker('', marker, markers).trim()); };
  return (
    <div className={`pdf-composer${mode === 'marker' ? ' marking' : ''}`} style={{ left: x, top: y }} role="dialog" aria-label={mode === 'marker' ? t('Mark') : t('Comment')}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}>
      {mode === 'marker' && <MarkerPicker markers={markers} value={marker} onPick={(m) => { setMarker(m); if (m) onColor(markerColor(m)); }} disabled={saving} />}
      <textarea autoFocus={mode !== 'marker'} rows={mode === 'marker' ? 2 : 3} maxLength={4000} value={text} placeholder={mode === 'marker' ? t('Comment (optional)') : t('Your comment')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } }} />
      <CommentColors value={color} onChange={onColor} disabled={saving} />
      {mode !== 'marker' && markers.length > 0 && <MarkerPicker markers={markers} value={marker} onPick={(m) => { setMarker(m); if (m) onColor(markerColor(m)); }} disabled={saving} />}
      <div className="pdf-actions">
        <button type="button" className="btn btn-sm" disabled={saving || !ready} onClick={add}>{text.trim() ? t('Add the comment') : t('Mark')}</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>{t('Cancel')}</button>
        <span className="muted small">{t('Ctrl+Enter')}</span>
      </div>
    </div>
  );
}
