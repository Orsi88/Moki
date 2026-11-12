// The formatted editor's code fence: the same card as the reading view (language, copy,
// then the text). The language is the fence info, so the file stays Markdown.

import { useLayoutEffect, useRef, useState } from 'react';
import { CodeBlock } from '@tiptap/extension-code-block';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { CODE_LANGS } from '../code-embed';
import { highlightParts } from '../code-highlight';
import { t } from '../i18n';
import { IconCopy } from './Icons';

// Colors stay on while the block is edited: the document keeps the plain text, the view paints the words.
function codeColors(): Plugin {
  return new Plugin({
    key: new PluginKey('mokiCodeColors'),
    props: {
      decorations(state) {
        const marks: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (node.type.name !== 'codeBlock') return;
          const lang = typeof node.attrs.language === 'string' ? node.attrs.language : '';
          const from = pos + 1;
          const end = pos + node.nodeSize - 1;
          let at = from;
          for (const token of highlightParts(node.textContent, lang)) {
            const next = at + token.text.length;
            if (next > end) break;
            if (token.kind) marks.push(Decoration.inline(at, next, { class: `tok-${token.kind}` }));
            at = next;
          }
        });
        return DecorationSet.create(state.doc, marks);
      },
    },
  });
}

function CodeBlockCardView({ node, updateAttributes }: ReactNodeViewProps) {
  const lang = typeof node.attrs.language === 'string' ? node.attrs.language : '';
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // The editor spellchecks the whole note. Inside code that draws a red line under every word.
  useLayoutEffect(() => {
    const content = box.current?.querySelector<HTMLElement>('[data-node-view-content-react]');
    if (!content) return;
    content.spellcheck = false;
    content.setAttribute('autocorrect', 'off');
    content.setAttribute('autocapitalize', 'off');
  });
  const known = CODE_LANGS.some(([value]) => value === lang);
  const copy = () => {
    const written = navigator.clipboard?.writeText(node.textContent);
    void Promise.resolve(written).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  };
  return (
    <NodeViewWrapper ref={box} className="code-embed">
      <div className="code-embed-bar" contentEditable={false}>
        <select className="code-lang" aria-label={t('Code')} value={lang}
          onChange={(event) => updateAttributes({ language: event.target.value || null })}>
          <option value="">{t('Text')}</option>
          {!known && lang && <option value={lang}>{lang}</option>}
          {CODE_LANGS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button type="button" className="icon-btn" title={copied ? t('Copied') : t('Copy')} aria-label={copied ? t('Copied') : t('Copy')} onClick={copy}>
          <IconCopy size={15} />
        </button>
      </div>
      <pre><NodeViewContent className="code-embed-body" /></pre>
    </NodeViewWrapper>
  );
}

export const MokiCodeBlock = CodeBlock.extend({
  addProseMirrorPlugins() {
    return [...(this.parent?.() ?? []), codeColors()];
  },
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockCardView, {
      stopEvent: ({ event }) => {
        const target = event.target;
        return target instanceof Element && Boolean(target.closest('.code-embed-bar'));
      },
    });
  },
});
