// The formatted editor of a .md file with its comments beside it, as in the reading view: select text and the
// Comment button floats by it; the cards sit in a column, joined to their text. The editor keeps the marks
// (md-comment-mark.ts); a comment added, answered, recolored or removed is the file's new text, saved at once
// (onCommit), unsaved edits included, as a comment made while reading.

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { api } from '../api';
import { colorComment, editComment, newId, readComments, replyComment, restoreComments, SWATCH, type CommentColor } from '../md-comments';
import { CommentColumn, CommentComposer, SelectionBubble, useBubbleLife, useCommentPlacement, type Bubble, type CommentActions } from './CommentColumn';
import { LazyTipTap } from './LazyTipTap';
import type { TipTapHandle } from './TipTapEditor';

interface Props {
  text: string; // the file's text (the tab's draft)
  path: string;
  onChange: (text: string) => void; // typing
  onCommit: (text: string) => void; // a comment changed: save the file with this text
  hidden?: boolean; // the column is closed: marks on the text's edge instead
  onShow?: () => void;
  saving?: boolean;
  onRewrite?: (kind: 'format' | 'loss') => void; // the editor would change this file (TipTapEditor)
  onLink?: (href: string) => void;
}

const markOf = (body: HTMLElement, id: string) => body.querySelector<HTMLElement>(`span[data-md-comment="${id}"]`);
const now = () => new Date().toISOString();

export function CommentedEditor({ text, path, onChange, onCommit, hidden = false, onShow, saving = false, onRewrite, onLink }: Props) {
  const comments = useMemo(() => readComments(text).comments, [text]);
  const editor = useRef<TipTapHandle>(null);
  const stage = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  // The editor's text area, once it is there (the editor loads on demand).
  const body = useMemo<RefObject<HTMLElement | null>>(() => ({ get current() { return stage.current?.querySelector<HTMLElement>('.tiptap-body') ?? null; } }), []);
  const placed = useCommentPlacement(stage, body, rail, comments, markOf);
  const [me, setMe] = useState('');
  const [active, setActive] = useState('');
  const [color, setColor] = useState<CommentColor>('yellow');
  const [bubble, setBubble] = useState<(Bubble & { from: number; to: number }) | null>(null);
  const [composer, setComposer] = useState<{ from: number; to: number; x: number; y: number } | null>(null);
  useEffect(() => { api.userName().then(setMe).catch(() => setMe('')); }, []);

  // A selection made with the mouse or with Shift and the arrows.
  const selected = () => {
    const box = stage.current;
    const found = editor.current?.selection();
    if (!box || !found) return;
    const origin = box.getBoundingClientRect();
    setBubble({ x: Math.max(8, found.rect.left - origin.left), y: found.rect.top - origin.top, below: found.rect.bottom - origin.top, why: found.why, from: found.from, to: found.to });
  };
  const inText = (target: EventTarget | null) => target instanceof Node && Boolean(body.current?.contains(target));
  const closeBubble = useCallback(() => setBubble(null), []);
  useBubbleLife(bubble, closeBubble, body);
  const openComposer = () => {
    if (!bubble || bubble.why) return;
    setComposer({ from: bubble.from, to: bubble.to, x: bubble.x, y: bubble.below + 8 });
    setBubble(null);
  };

  // The list changes, the text stays: the editor adopts the new file text, which is saved.
  const listChange = (change: (file: string) => string) => {
    const handle = editor.current;
    if (!handle) return;
    const next = change(handle.fileText());
    handle.adopt(next);
    onCommit(next);
  };
  const add = (value: string) => {
    const handle = editor.current;
    if (!handle || !composer) return;
    const id = newId(comments);
    handle.markComment(composer.from, composer.to, id);
    listChange((file) => {
      const read = readComments(file);
      return restoreComments(read.body, [...read.comments, { id, author: me, at: now(), text: value, replies: [], color }]);
    });
    setComposer(null);
  };
  const actions: CommentActions = {
    reply: (id, value) => listChange((file) => replyComment(file, id, { author: me, at: now(), text: value })),
    edit: (id, value) => listChange((file) => editComment(file, id, value)),
    color: (id, next) => listChange((file) => colorComment(file, id, next)),
    // Its marks leave the document; the editor drops a comment whose marks are gone.
    remove: (id) => {
      const handle = editor.current;
      if (!handle) return;
      handle.unmarkComment(id);
      onCommit(handle.fileText());
    },
  };

  // Each mark in its comment's color, the one under the pointer stronger. A style rule, not the nodes' own
  // style: the editor redraws its nodes and would drop what was set on them.
  const colors = comments.map((c) => `.commented-editor span[data-md-comment="${c.id}"]{--md-comment-color:${c.color ? SWATCH[c.color] : 'var(--accent)'}}`).join('')
    + (active ? `.commented-editor span[data-md-comment="${active}"]{background:color-mix(in srgb,var(--md-comment-color,var(--accent)) 50%,transparent)}` : '');
  const shown = !hidden && (comments.length > 0 || Boolean(composer));

  return (
    <div className={`md-commented commented-editor${shown ? ' with-rail' : ''}`} ref={stage}
      onMouseUp={(e) => { if (inText(e.target)) selected(); }}
      onKeyUp={(e) => { if (e.shiftKey && inText(e.target)) selected(); }}>
      <style>{colors}</style>
      <LazyTipTap ref={editor} text={text} path={path} onChange={onChange} onRewrite={onRewrite} onLink={onLink} />
      <CommentColumn path={path} comments={comments} placed={placed} rail={rail} shown={shown} hidden={hidden} onShow={onShow}
        active={active} onActive={setActive} saving={saving} actions={actions} />
      {bubble && <SelectionBubble bubble={bubble} onComment={openComposer} />}
      {composer && <CommentComposer x={composer.x} y={composer.y} saving={saving} color={color} onColor={setColor} onAdd={add} onCancel={() => setComposer(null)} />}
    </div>
  );
}
