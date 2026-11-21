// A ```kpi or ```steps fence stays one block in the formatted editor and shows as the card it makes (the same card
// as the reading view and the chat, drawn by scripts/lib/md-blocks.mjs through the main process). Edit opens its
// lines as plain text; the file keeps the fence exactly as written.

import { useEffect, useRef, useState } from 'react';
import { Node, mergeAttributes, type MarkdownToken } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { api } from '../api';
import { t } from '../i18n';
import { IconCheck, IconEdit } from './Icons';

type CardLang = 'kpi' | 'steps';
const cardLang = (value: unknown): CardLang => (value === 'steps' ? 'steps' : 'kpi');
const fence = (lang: CardLang, body: string) => '```' + lang + '\n' + body.replace(/\s+$/, '') + '\n```';
const CARD_FENCE = /^```(kpi|steps)[^\n]*\r?\n([\s\S]*?)\r?\n```/;

function CardFenceView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const lang = cardLang(node.attrs.lang);
  const body = String(node.attrs.body ?? '');
  const [html, setHtml] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(body);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let gone = false;
    void api.renderMarkdown(fence(lang, body)).then((next) => { if (!gone) setHtml(next); }).catch(() => { if (!gone) setHtml(''); });
    return () => { gone = true; };
  }, [lang, body]);
  useEffect(() => { if (editing) box.current?.focus(); }, [editing]);

  const done = () => {
    setEditing(false);
    if (draft !== body) updateAttributes({ body: draft.replace(/\s+$/, '') });
  };
  const name = lang === 'kpi' ? t('Indicators') : t('Steps');

  return (
    <NodeViewWrapper className={`card-fence${selected ? ' on' : ''}${editing ? ' editing' : ''}`} data-card={lang}>
      <div className="card-fence-bar" contentEditable={false} onMouseDown={(event) => event.stopPropagation()}>
        <span className="card-fence-kind">{name}</span>
        {editing
          ? <button type="button" className="icon-btn" title={t('Done')} aria-label={t('Done')} onClick={done}><IconCheck size={16} /></button>
          : <button type="button" className="icon-btn" title={t('Edit')} aria-label={t('Edit')} onClick={() => { setDraft(body); setEditing(true); }}><IconEdit size={16} /></button>}
      </div>
      {editing
        ? <textarea ref={box} className="card-fence-source" aria-label={name} value={draft} spellCheck={false} rows={Math.min(14, Math.max(3, draft.split('\n').length + 1))}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) { event.preventDefault(); done(); } }} />
        // The main process escapes everything in the block (markdown.mjs), as in every other rendered Markdown.
        : <div className="card-fence-card" contentEditable={false} dangerouslySetInnerHTML={{ __html: html }} onDoubleClick={() => { setDraft(body); setEditing(true); }} />}
    </NodeViewWrapper>
  );
}

export const CardFence = Node.create({
  name: 'cardFence',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return { lang: { default: 'kpi' }, body: { default: '' } };
  },

  parseHTML() {
    return [{ tag: 'div[data-card-fence]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-card-fence': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardFenceView, {
      ignoreMutation: () => true,
      // Typing in the block's text and its buttons are the block's own, not the editor's.
      stopEvent: ({ event }) => event.target instanceof Element && Boolean(event.target.closest('button, textarea')),
    });
  },

  markdownTokenName: 'cardFence',

  markdownTokenizer: {
    name: 'cardFence',
    level: 'block',
    start: (src) => src.search(/```(?:kpi|steps)(?:\s|\r|\n)/),
    tokenize: (src) => {
      const match = CARD_FENCE.exec(src);
      if (!match) return undefined;
      return { type: 'cardFence', raw: match[0], lang: match[1], text: match[2].replace(/\s+$/, '') } as MarkdownToken;
    },
  },

  parseMarkdown(token) {
    return { type: 'cardFence', attrs: { lang: cardLang(token.lang), body: String(token.text ?? '') } };
  },

  renderMarkdown(node) {
    return fence(cardLang(node.attrs?.lang), String(node.attrs?.body ?? ''));
  },
});
