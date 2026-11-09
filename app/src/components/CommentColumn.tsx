// The comments beside a Markdown text, shared by the reading view (MarkdownComments) and the formatted
// editor (CommentedEditor): each card sits at the height of what it comments, joined to it by a thin line,
// with reply, edit, color and delete; with the column hidden, a mark on the text's edge opens it. Also the
// floating Comment button of a selection and the box a new comment is written in. Where the comments live
// (the file's text) and how a change is saved belong to the caller.

import { useCallback, useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { t } from '../i18n';
import { SWATCH, type CommentColor, type MdComment } from '../md-comments';
import { stackCards } from '../pdf-quads';
import { IconChat } from './Icons';
import { CommentColors } from './CommentColors';
import { confirmDialog } from '../dialogs';
import { CopyCommentLink } from './CopyCommentLink';

export interface Placed { items: { id: string; ax: number; ay: number; edge: number; top: number }[]; rail: number; railTop: number; height: number }
export interface CommentActions {
  reply: (id: string, text: string) => void;
  edit: (id: string, text: string) => void;
  color: (id: string, color: CommentColor) => void;
  remove: (id: string) => void;
}
// The floating Comment button: where the selection is (relative to the stage) and, when it cannot be commented, why.
export interface Bubble { x: number; y: number; below: number; why: string }

const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };

// Each card beside the first mark of its comment, pushed down under the card above when they would overlap.
// `markOf` finds a comment's first mark in the text (the reading view and the editor draw them differently).
export function useCommentPlacement(stage: RefObject<HTMLElement | null>, body: RefObject<HTMLElement | null>, rail: RefObject<HTMLElement | null>,
  comments: MdComment[], markOf: (body: HTMLElement, id: string) => HTMLElement | null): Placed {
  const [placed, setPlaced] = useState<Placed>({ items: [], rail: 0, railTop: 0, height: 0 });
  const measure = useCallback(() => {
    const box = stage.current;
    const column = rail.current; // null while the column is hidden: only the marks on the text's edge
    const text = body.current;
    if (!box || !text) return;
    const origin = box.getBoundingClientRect();
    const edge = text.getBoundingClientRect().right - origin.left;
    const heights = new Map([...(column?.querySelectorAll<HTMLElement>('[data-card]') ?? [])].map((el) => [el.dataset.card ?? '', el.offsetHeight]));
    const wanted = comments.flatMap((c) => {
      const mark = markOf(text, c.id);
      if (!mark) return [];
      const r = mark.getBoundingClientRect();
      return [{ id: c.id, ax: r.right - origin.left, ay: r.top - origin.top + r.height / 2, edge }];
    });
    const tops = stackCards(wanted.map((w) => ({ id: w.id, top: w.ay - 18, height: heights.get(w.id) ?? 90 })), 10);
    const railBox = column?.getBoundingClientRect() ?? origin;
    const railTop = railBox.top - origin.top;
    const bottom = Math.max(0, ...wanted.map((w) => tops[w.id] + (heights.get(w.id) ?? 90)));
    const next = { items: wanted.map((w) => ({ ...w, top: Math.max(0, tops[w.id] - railTop) })), rail: railBox.left - origin.left, railTop, height: Math.max(text.offsetHeight, bottom) };
    setPlaced((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
  }, [comments, stage, body, rail, markOf]);
  useLayoutEffect(() => { measure(); });
  useEffect(() => {
    const box = stage.current;
    if (!box) return undefined;
    const watch = new ResizeObserver(() => measure());
    watch.observe(box);
    return () => watch.disconnect();
  }, [measure, stage]);
  return placed;
}

interface ColumnProps {
  path?: string;
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
}

export function CommentColumn({ path, comments, placed, rail, shown, hidden, onShow, active, onActive, saving, actions }: ColumnProps) {
  const [editing, setEditing] = useState<{ id: string; mode: 'reply' | 'edit'; text: string } | null>(null);
  const [colorPicker, setColorPicker] = useState<string | null>(null);
  const where = new Map(placed.items.map((p) => [p.id, p]));
  const finish = () => {
    if (!editing || !editing.text.trim()) return;
    if (editing.mode === 'reply') actions.reply(editing.id, editing.text.trim()); else actions.edit(editing.id, editing.text.trim());
    setEditing(null);
  };
  const remove = async (id: string) => { if (await confirmDialog(t('Delete this comment?'), { danger: true })) actions.remove(id); };
  return (
    <>
      {shown && (
        <>
          <svg className="md-links" width="100%" height={placed.height} aria-hidden="true">
            {placed.items.map((p) => {
              const cy = placed.railTop + p.top + 18;
              const mid = (p.ax + placed.rail) / 2;
              const value = comments.find((c) => c.id === p.id)?.color;
              return <path key={p.id} className={active === p.id ? 'on' : ''} style={{ stroke: value ? SWATCH[value] : undefined }} d={`M${p.ax} ${p.ay} C${mid} ${p.ay}, ${mid} ${cy}, ${placed.rail} ${cy}`} />;
            })}
          </svg>
          <div className="md-rail" ref={rail} style={{ height: placed.height }} aria-label={t('Comments')}>
            {comments.map((c) => (
              <div key={c.id} data-card={c.id} data-positioned={where.has(c.id)} className={`pdf-card md-card${active === c.id ? ' on' : ''}`} style={{ top: where.get(c.id)?.top ?? 0, borderLeftColor: c.color ? SWATCH[c.color] : undefined }}
                onMouseEnter={() => onActive(c.id)} onMouseLeave={() => onActive('')}>
                <div className="pdf-comment-head"><strong>{c.author || t('Unknown author')}</strong><span className="muted small">{when(c.at)}</span></div>
                {editing?.id === c.id && editing.mode === 'edit' ? null : <p className="pdf-comment-text">{c.text}</p>}
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
                      <button type="button" className="btn btn-sm" disabled={!editing.text.trim()} onClick={finish}>{t('Save')}</button>
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setEditing(null)}>{t('Cancel')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="pdf-actions">
                    <button type="button" className="icon-btn md-color-toggle" title={t('Change comment color')} aria-label={t('Change comment color')} aria-expanded={colorPicker === c.id} disabled={saving} onClick={() => setColorPicker(colorPicker === c.id ? null : c.id)}><span style={{ background: c.color ? SWATCH[c.color] : 'var(--accent)' }} /></button>
                    {path && <CopyCommentLink path={path} id={c.id} />}
                    <button type="button" className="link-btn" onClick={() => setEditing({ id: c.id, mode: 'reply', text: '' })}>{t('Reply')}</button>
                    <button type="button" className="link-btn" onClick={() => setEditing({ id: c.id, mode: 'edit', text: c.text })}>{t('Edit')}</button>
                    <button type="button" className="link-btn" onClick={() => remove(c.id)}>{t('Delete')}</button>
                  </div>
                )}
                {colorPicker === c.id && <CommentColors value={c.color} disabled={saving} onChange={(next) => { actions.color(c.id, next); setColorPicker(null); }} />}
              </div>
            ))}
          </div>
        </>
      )}
      {hidden && placed.items.map((p) => {
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
export function SelectionBubble({ bubble, onComment }: { bubble: Bubble; onComment: () => void }) {
  const below = bubble.y < 44;
  return (
    <div className={`md-select-bubble${below ? ' below' : ''}`} role="toolbar" aria-label={t('Selection')}
      style={{ left: bubble.x, top: below ? bubble.below + 6 : bubble.y - 6 }} onMouseDown={(e) => e.preventDefault()}>
      <button type="button" disabled={Boolean(bubble.why)} aria-describedby={bubble.why ? 'md-select-why' : undefined} onClick={onComment}>
        <IconChat size={15} /> {t('Comment on it')}
      </button>
      {bubble.why && <span id="md-select-why" className="md-select-why">{bubble.why}</span>}
    </div>
  );
}

interface ComposerProps { x: number; y: number; saving: boolean; color: CommentColor; onColor: (color: CommentColor) => void; onAdd: (text: string) => void; onCancel: () => void }

export function CommentComposer({ x, y, saving, color, onColor, onAdd, onCancel }: ComposerProps) {
  const [text, setText] = useState('');
  const add = () => { if (text.trim()) onAdd(text.trim()); };
  return (
    <div className="pdf-composer" style={{ left: x, top: y }} role="dialog" aria-label={t('Comment')}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCancel(); } }}>
      <textarea autoFocus rows={3} maxLength={4000} value={text} placeholder={t('Your comment')}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } }} />
      <CommentColors value={color} onChange={onColor} disabled={saving} />
      <div className="pdf-actions">
        <button type="button" className="btn btn-sm" disabled={saving || !text.trim()} onClick={add}>{t('Add the comment')}</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>{t('Cancel')}</button>
        <span className="muted small">{t('Ctrl+Enter')}</span>
      </div>
    </div>
  );
}
