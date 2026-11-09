// A Markdown file read with its comments (the reading view): select text in it and a small Comment button
// floats by the selection (nothing else moves, the focus stays, Ctrl+C still copies); the comments sit in a
// column beside the text (CommentColumn). They live in the file itself (app/src/md-comments.ts), so each
// change is the file's new text, saved at once.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { api } from '../api';
import { t } from '../i18n';
import { addComment, colorComment, editComment, findInSource, readComments, removeComment, replyComment, SWATCH, type CommentColor } from '../md-comments';
import { CommentColumn, CommentComposer, SelectionBubble, useBubbleLife, useCommentPlacement, type Bubble, type CommentActions } from './CommentColumn';
import { mountDiagrams } from './Diagrams';
import { replaceDiagram } from '../diagram-source';
import { linkProjectPaths, type LinkResolver } from './useInternalLinks';

interface Props {
  html: string; // the file rendered with its marks (markdownToHtml, comments: true)
  text: string; // the file's text
  onCommit: (text: string) => void; // saves the file with this text
  onClick: (e: MouseEvent<HTMLDivElement>) => void; // links inside the text
  hidden?: boolean; // the column is closed: marks on the text's edge instead
  onShow?: () => void; // a mark was clicked: open the column
  saving?: boolean;
  resolveLink?: LinkResolver;
}

const markOf = (body: HTMLElement, id: string) => body.querySelector<HTMLElement>(`mark.md-comment[data-c="${id}"]`);
const now = () => new Date().toISOString();

export function MarkdownComments({ html, text, onCommit, onClick, hidden = false, onShow, saving = false, resolveLink }: Props) {
  const comments = useMemo(() => readComments(text).comments, [text]);
  const [me, setMe] = useState('');
  const [composer, setComposer] = useState<{ range: [number, number]; x: number; y: number } | null>(null);
  const [active, setActive] = useState('');
  const [color, setColor] = useState<CommentColor>('yellow');
  // The floating Comment button of a selection, with the place found in the file when it can be commented.
  const [bubble, setBubble] = useState<(Bubble & { range: [number, number] | null }) | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const doc = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const placed = useCommentPlacement(stage, doc, rail, comments, markOf);

  useEffect(() => { api.userName().then(setMe).catch(() => setMe('')); }, []);
  useEffect(() => {
    const el = doc.current;
    if (!el) return;
    linkProjectPaths(el, resolveLink);
    void mountDiagrams(el, (index, lang, body) => onCommit(replaceDiagram(text, index, lang, body)));
  }, [html, text, onCommit, resolveLink]);
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

  // A selection that cannot be commented (several paragraphs, formatting inside) gets the button disabled, with the reason.
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
  const closeBubble = useCallback(() => setBubble(null), []);
  useBubbleLife(bubble, closeBubble, doc);
  const openComposer = () => {
    if (!bubble?.range) return;
    setComposer({ range: bubble.range, x: bubble.x, y: bubble.below + 8 });
    setBubble(null);
  };
  const add = (value: string) => {
    if (!composer) return;
    onCommit(addComment(text, composer.range[0], composer.range[1], { author: me, at: now(), text: value, color }).text);
    setComposer(null);
    window.getSelection()?.removeAllRanges();
  };
  const actions: CommentActions = {
    reply: (id, value) => onCommit(replyComment(text, id, { author: me, at: now(), text: value })),
    edit: (id, value) => onCommit(editComment(text, id, value)),
    color: (id, next) => onCommit(colorComment(text, id, next)),
    remove: (id) => onCommit(removeComment(text, id)),
  };

  // The same object while the text is the same: React 19 compares the object, and a new one rewrites the
  // whole document on every render (hovering a card, measuring), which clears a selection and makes it flicker.
  const inner = useMemo(() => ({ __html: html }), [html]);
  const shown = !hidden && (comments.length > 0 || Boolean(composer));

  return (
    <div className={`md-commented${shown ? ' with-rail' : ''}`} ref={stage}>
      <div ref={doc} className="markdown" onClick={onClick} onMouseUp={onMouseUp} dangerouslySetInnerHTML={inner} />
      <CommentColumn comments={comments} placed={placed} rail={rail} shown={shown} hidden={hidden} onShow={onShow}
        active={active} onActive={setActive} saving={saving} actions={actions} />
      {bubble && <SelectionBubble bubble={bubble} onComment={openComposer} />}
      {composer && <CommentComposer x={composer.x} y={composer.y} saving={saving} color={color} onColor={setColor} onAdd={add} onCancel={() => setComposer(null)} />}
    </div>
  );
}
