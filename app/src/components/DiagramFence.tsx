// A mermaid or excalidraw fence stays one block in the formatted editor. The file
// keeps the fence; the block draws it. The JSON is not text the editor can rewrite.

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { Node, mergeAttributes, type MarkdownToken } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';
import { readFenceHeight, takeDiagramFence, type DiagramLang } from '../diagram-source';
import { t } from '../i18n';
import { bindDiagramZoom, failed, openDiagram, openDrawing, paintDiagram } from './Diagrams';
import { IconEdit } from './Icons';

const clampHeight = (value: number) => Math.min(1200, Math.max(120, Math.round(value)));

function DiagramFenceView({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const lang: DiagramLang = node.attrs.lang === 'excalidraw' ? 'excalidraw' : 'mermaid';
  const body = String(node.attrs.body ?? '');
  const stored = readFenceHeight(`height=${node.attrs.height ?? ''}`);
  const picture = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; h: number; next: number } | null>(null);
  const shown = stored ?? 240;

  useEffect(() => {
    const host = picture.current;
    if (!host) return;
    let gone = false;
    host.replaceChildren();
    void paintDiagram(host, lang, body).then(() => {
      if (gone) return;
      const svg = host.querySelector('svg');
      if (svg?.viewBox.baseVal.width) { svg.removeAttribute('width'); svg.removeAttribute('height'); }
    }).catch(() => {
      if (gone) return;
      const note = document.createElement('p');
      note.className = 'muted small';
      note.textContent = t('This diagram could not be drawn.');
      host.replaceChildren(note);
    });
    return () => { gone = true; };
  }, [lang, body]);

  useEffect(() => {
    const card = picture.current?.closest<HTMLElement>('.diagram');
    if (!card) return;
    return bindDiagramZoom(card);
  }, []);

  const edit = () => {
    const save = (next: string) => updateAttributes({ body: next });
    const run = lang === 'excalidraw' ? openDrawing(body, save) : openDiagram(body, save);
    void run.catch(() => { if (picture.current) failed(picture.current); });
  };
  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current = { y: event.clientY, h: shown, next: shown };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = drag.current;
    if (!start) return;
    start.next = clampHeight(start.h + event.clientY - start.y);
    if (picture.current) picture.current.style.height = `${start.next}px`;
  };
  const endResize = () => {
    const start = drag.current;
    drag.current = null;
    if (start && start.next !== start.h) updateAttributes({ height: start.next });
  };

  return (
    <NodeViewWrapper className={`diagram${selected ? ' on' : ''}`} data-diagram={lang} data-height={stored ?? undefined}>
      <div className="diagram-bar" contentEditable={false}
        onMouseDown={(event) => event.stopPropagation()}>
        <span className="diagram-kind">{lang === 'excalidraw' ? t('Drawing') : t('Diagram')}</span>
        <span className="diagram-actions">
          <button type="button" className="icon-btn diagram-edit" title={t(lang === 'excalidraw' ? 'Edit drawing' : 'Edit diagram')} aria-label={t(lang === 'excalidraw' ? 'Edit drawing' : 'Edit diagram')}
            onClick={edit}>
            <IconEdit size={16} />
          </button>
        </span>
      </div>
      <div className="diagram-picture" ref={picture} style={{ height: shown }} title={t('Hold Ctrl and scroll to zoom')} />
      <div className="diagram-resize" role="separator" aria-orientation="horizontal" aria-valuemin={120} aria-valuemax={1200} aria-valuenow={shown}
        tabIndex={0} title={t('Drag to change the height')} aria-label={t('Drag to change the height')}
        onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
          event.preventDefault();
          updateAttributes({ height: clampHeight(shown + (event.key === 'ArrowDown' ? 24 : -24)) });
        }} />
    </NodeViewWrapper>
  );
}

export const DiagramFence = Node.create({
  name: 'diagramFence',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      lang: { default: 'mermaid' },
      body: { default: '' },
      height: {
        default: null,
        parseHTML: (element) => readFenceHeight(`height=${element.getAttribute('data-height') ?? ''}`) ?? null,
        renderHTML: (attrs) => {
          const height = readFenceHeight(`height=${attrs.height ?? ''}`);
          return height ? { 'data-height': String(height) } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-diagram-fence]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-diagram-fence': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DiagramFenceView, {
      ignoreMutation: () => true,
      stopEvent: ({ event }) => {
        const target = event.target;
        if (!(target instanceof Element)) return false;
        if (target.closest('button, .diagram-resize')) return true;
        return event.type === 'wheel' && 'ctrlKey' in event && Boolean((event as WheelEvent).ctrlKey) && Boolean(target.closest('.diagram'));
      },
    });
  },

  markdownTokenName: 'diagramFence',

  markdownTokenizer: {
    name: 'diagramFence',
    level: 'block',
    start: (src) => src.search(/```(?:mermaid|excalidraw)(?:\s|\r|\n)/),
    tokenize: (src) => {
      const taken = takeDiagramFence(src);
      if (!taken) return undefined;
      return { type: 'diagramFence', raw: taken.raw, lang: taken.lang, text: taken.body, height: taken.height } as MarkdownToken;
    },
  },

  parseMarkdown(token) {
    const lang = token.lang === 'excalidraw' ? 'excalidraw' : 'mermaid';
    const height = readFenceHeight(`height=${(token as { height?: unknown }).height ?? ''}`);
    return { type: 'diagramFence', attrs: { lang, body: String(token.text ?? ''), ...(height ? { height } : {}) } };
  },

  renderMarkdown(node) {
    const lang = node.attrs?.lang === 'excalidraw' ? 'excalidraw' : 'mermaid';
    const body = String(node.attrs?.body ?? '').replace(/\s+$/, '');
    const height = readFenceHeight(`height=${node.attrs?.height ?? ''}`);
    return '```' + lang + (height ? ` height=${height}` : '') + '\n' + body + '\n```';
  },
});
