// A Markdown file read with its comments: select text in it and a small Comment button floats by the
// selection (nothing else moves, the focus stays, Ctrl+C still copies); each
// comment sits in a column beside the text, at the height of what it comments, joined to it
// by a thin line (as in a PDF), with reply, edit and delete. With the column hidden (the bar's
// comments button), a mark on the text's right edge shows each one and opens it. The comments live in the file
// itself (app/src/md-comments.ts), so each change is the file's new text, saved at once.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { api } from '../api';
import { t } from '../i18n';
import { addComment, colorComment, editComment, findInSource, readComments, removeComment, replyComment, SWATCH, type CommentColor } from '../md-comments';
import { stackCards } from '../pdf-quads';
import { IconChat } from './Icons';
import { CommentColors } from './CommentColors';
import { mountDiagrams } from './Diagrams';
import { replaceDiagram } from '../diagram-source';

interface Props {
  html: string; // the file rendered with its marks (markdownToHtml, comments: true)
  text: string; // the file's text
  onCommit: (text: string) => void; // saves the file with this text
  onClick: (e: MouseEvent<HTMLDivElement>) => void; // links inside the text
  hidden?: boolean; // the column is closed: marks on the text's edge instead
  onShow?: () => void; // a mark was clicked: open the column
  saving?: boolean;
}

const when = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); };

export function MarkdownComments({ html, text, onCommit, onClick, hidden = false, onShow, saving = false }: Props) {
  const { comments } = readComments(text);
  const [me, setMe] = useState('');
  const [composer, setComposer] = useState<{ range: [number, number]; x: number; y: number; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; mode: 'reply' | 'edit'; text: string } | null>(null);
  const [active, setActive] = useState('');
  const [color, setColor] = useState<CommentColor>('yellow');
  const [colorPicker, setColorPicker] = useState<string | null>(null);
  // The floating Comment button of a selection: the place found in the file, or why it cannot be commented.
  const [bubble, setBubble] = useState<{ x: number; y: number; below: number; range: [number, number] | null; why: string } | null>(null);
  const [placed, setPlaced] = useState<{ items: { id: string; ax: number; ay: number; edge: number; top: number }[]; rail: number; railTop: number; height: number }>({ items: [], rail: 0, railTop: 0, height: 0 });
  const stage = useRef<HTMLDivElement>(null);
  const doc = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);

  useEffect(() => { api.userName().then(setMe).catch(() => setMe('')); }, []);
  useEffect(() => {
    const el = doc.current;
    if (!el) return;
    void mountDiagrams(el, (index, lang, body) => onCommit(replaceDiagram(text, index, lang, body)));
  }, [html, text, onCommit]);

  // Each card beside the first mark of its comment, pushed down under the card above when they would overlap.
  const measure = useCallback(() => {
    const box = stage.current;
    const column = rail.current; // null while the column is hidden: only the marks on the text's edge
    const body = doc.current;
    if (!box || !body) return;
    const origin = box.getBoundingClientRect();
    const edge = body.getBoundingClientRect().right - origin.left;
    const heights = new Map([...(column?.querySelectorAll<HTMLElement>('[data-card]') ?? [])].map((el) => [el.dataset.card ?? '', el.offsetHeight]));
    const wanted = comments.flatMap((c) => {
      const mark = body.querySelector<HTMLElement>(`mark.md-comment[data-c="${c.id}"]`);
      if (!mark) return [];
      const r = mark.getBoundingClientRect();
      return [{ id: c.id, ax: r.right - origin.left, ay: r.top - origin.top + r.height / 2, edge }];
    });
    const tops = stackCards(wanted.map((w) => ({ id: w.id, top: w.ay - 18, height: heights.get(w.id) ?? 90 })), 10);
    const railBox = column?.getBoundingClientRect() ?? origin;
    const railTop = railBox.top - origin.top;
    const bottom = Math.max(0, ...wanted.map((w) => tops[w.id] + (heights.get(w.id) ?? 90)));
    const next = { items: wanted.map((w) => ({ ...w, top: Math.max(0, tops[w.id] - railTop) })), rail: railBox.left - origin.left, railTop, height: Math.max(body.offsetHeight, bottom) };
    setPlaced((cur) => (JSON.stringify(cur) === JSON.stringify(next) ? cur : next));
  }, [comments]);
  useLayoutEffect(() => { measure(); });
  useEffect(() => {
    const box = stage.current;
    if (!box) return undefined;
    const watch = new ResizeObserver(() => measure());
    watch.observe(box);
    return () => watch.disconnect();
  }, [measure]);
  // The mark of the card under the pointer lights up.
  useLayoutEffect(() => {
    const colors = new Map(comments.map((c) => [c.id, c.color]));
    doc.current?.querySelectorAll<HTMLElement>('mark.md-comment').forEach((mark) => {
      const id = mark.dataset.c ?? '';
      const value = colors.get(id);
      mark.classList.toggle('on', id === active);
      mark.style.setProperty('--md-comment-color', value ? SWATCH[value] : 'var(--accent)');
    });
  });

  // A selection shows the Comment button above it (below it at the very top). Selecting is often only
  // reading or copying, so the comment box opens on the button, never by itself. A selection that
  // cannot be commented (several paragraphs, formatting inside) gets the button disabled, with the reason.
  const onMouseUp = () => {
    const box = stage.current;
    const body = doc.current;
    const sel = window.getSelection();
    if (!box || !body || !sel || sel.isCollapsed || !sel.rangeCount || !body.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
    const range = sel.getRangeAt(0);
    const picked = sel.toString();
    if (!picked.trim()) return;
    const r = range.getBoundingClientRect();
    const origin = box.getBoundingClientRect();
    const place = { x: Math.max(8, r.left - origin.left), y: r.top - origin.top, below: r.bottom - origin.top };
    if (/\n/.test(picked.trim())) { setBubble({ ...place, range: null, why: t('Select text inside one paragraph to comment on it.') }); return; }
    const before = document.createRange();
    before.setStart(body, 0);
    before.setEnd(range.startContainer, range.startOffset);
    const prefix = before.toString();
    let nth = 0;
    for (let i = prefix.indexOf(picked); i >= 0; i = prefix.indexOf(picked, i + picked.length)) nth++;
    const found = findInSource(text, picked, nth);
    setBubble({ ...place, range: found, why: found ? '' : t('This text has formatting inside: comment a shorter piece, or comment it in Edit.') });
  };
  const openComposer = () => {
    if (!bubble?.range) return;
    setComposer({ range: bubble.range, x: bubble.x, y: bubble.below + 8, text: '' });
    setBubble(null);
  };
  // The button goes with its selection: cleared, moved elsewhere, Esc.
  useEffect(() => {
    if (!bubble) return undefined;
    const body = doc.current;
    const gone = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount || !body?.contains(sel.getRangeAt(0).commonAncestorContainer)) setBubble(null);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setBubble(null); };
    document.addEventListener('selectionchange', gone);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('selectionchange', gone); document.removeEventListener('keydown', esc); };
  }, [bubble]);

  const now = () => new Date().toISOString();
  const add = () => {
    if (!composer?.text.trim()) return;
    onCommit(addComment(text, composer.range[0], composer.range[1], { author: me, at: now(), text: composer.text.trim(), color }).text);
    setComposer(null);
    window.getSelection()?.removeAllRanges();
  };
  const finish = () => {
    if (!editing || !editing.text.trim()) return;
    onCommit(editing.mode === 'reply' ? replyComment(text, editing.id, { author: me, at: now(), text: editing.text.trim() }) : editComment(text, editing.id, editing.text.trim()));
    setEditing(null);
  };
  const remove = (id: string) => { if (window.confirm(t('Delete this comment?'))) onCommit(removeComment(text, id)); };

  // The same object while the text is the same: React 19 compares the object, and a new one rewrites the
  // whole document on every render (hovering a card, measuring), which clears a selection and makes it flicker.
  const inner = useMemo(() => ({ __html: html }), [html]);
  const where = new Map(placed.items.map((p) => [p.id, p]));
  const shown = !hidden && (comments.length > 0 || composer);

  return (
    <div className={`md-commented${shown ? ' with-rail' : ''}`} ref={stage}>
      <div ref={doc} className="markdown" onClick={onClick} onMouseUp={onMouseUp} dangerouslySetInnerHTML={inner} />
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
              <div key={c.id} data-card={c.id} className={`pdf-card md-card${active === c.id ? ' on' : ''}`} style={{ top: where.get(c.id)?.top ?? 0, borderLeftColor: c.color ? SWATCH[c.color] : undefined }}
                onMouseEnter={() => setActive(c.id)} onMouseLeave={() => setActive((a) => (a === c.id ? '' : a))}>
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
                    <button type="button" className="link-btn" onClick={() => setEditing({ id: c.id, mode: 'reply', text: '' })}>{t('Reply')}</button>
                    <button type="button" className="link-btn" onClick={() => setEditing({ id: c.id, mode: 'edit', text: c.text })}>{t('Edit')}</button>
                    <button type="button" className="link-btn" onClick={() => remove(c.id)}>{t('Delete')}</button>
                  </div>
                )}
                {colorPicker === c.id && <CommentColors value={c.color} disabled={saving} onChange={(next) => { onCommit(colorComment(text, c.id, next)); setColorPicker(null); }} />}
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
            onClick={() => { onShow?.(); setActive(p.id); }} />
        );
      })}
      {bubble && (
        // mousedown would clear the selection before the click: the text stays selected under the button.
        <div className={`md-select-bubble${bubble.y < 44 ? ' below' : ''}`} role="toolbar" aria-label={t('Selection')}
          style={{ left: bubble.x, top: bubble.y < 44 ? bubble.below + 6 : bubble.y - 6 }} onMouseDown={(e) => e.preventDefault()}>
          <button type="button" disabled={!bubble.range} aria-describedby={bubble.why ? 'md-select-why' : undefined} onClick={openComposer}>
            <IconChat size={15} /> {t('Comment on it')}
          </button>
          {bubble.why && <span id="md-select-why" className="md-select-why">{bubble.why}</span>}
        </div>
      )}
      {composer && (
        <div className="pdf-composer" style={{ left: composer.x, top: composer.y }} role="dialog" aria-label={t('Comment')}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setComposer(null); } }}>
          <textarea autoFocus rows={3} maxLength={4000} value={composer.text} placeholder={t('Your comment')}
            onChange={(e) => setComposer({ ...composer, text: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } }} />
          <CommentColors value={color} onChange={setColor} disabled={saving} />
          <div className="pdf-actions">
            <button type="button" className="btn btn-sm" disabled={saving || !composer.text.trim()} onClick={add}>{t('Add the comment')}</button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setComposer(null)}>{t('Cancel')}</button>
            <span className="muted small">{t('Ctrl+Enter')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
