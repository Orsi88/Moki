// What the formatted editor cannot draw stays in the file exactly as written. Without these, @tiptap/markdown drops
// HTML (or turns it into escaped text), reference definitions, front matter, footnote marks and callout marks, and
// saving would rewrite or lose them, so the editor had to refuse such files. Now:
// - a block it cannot draw (HTML, a reference definition, the front matter, or any block that would lose words) is a
//   raw block: a card with the block's own text, edited as text;
// - an inline piece (an HTML tag or comment, [^1], [!NOTE]) is a raw chip that moves and deletes with the text;
//   <br> draws as a line break.
// Both write back their text unchanged. Pure apart from the node views, which only run in the browser.

import { Extension, Node, type MarkdownToken } from '@tiptap/core';
import { Marked } from 'marked';
import { wordsOf } from './md-preserve.ts';

export type RawKind = 'html' | 'properties' | 'reference' | 'kept';

// A block shielded before parsing (front matter, a block the editor would lose words of) travels as one line of
// private-use characters and base64, which no Markdown syntax touches: OPEN kind ':' base64 CLOSE.
const OPEN = '';
const CLOSE = '';
const SHIELD = new RegExp(`^${OPEN}([a-z]+):([A-Za-z0-9+/=]*)${CLOSE}[ \\t]*(?:\\n+|$)`);

const toBase64 = (text: string): string => {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
};
const fromBase64 = (data: string): string => new TextDecoder().decode(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
const shield = (kind: RawKind, text: string): string => `${OPEN}${kind}:${toBase64(text)}${CLOSE}`;
const isKind = (value: unknown): value is RawKind => value === 'html' || value === 'properties' || value === 'reference' || value === 'kept';

// The front matter (a YAML block between --- lines at the very top) would be read as a rule and a heading.
const FRONT_MATTER = /^---[ \t]*\r?\n[\s\S]*?\r?\n(?:---|\.\.\.)[ \t]*(?=\r?\n|$)/;
export function shieldFrontMatter(body: string): string {
  const found = FRONT_MATTER.exec(body);
  return found ? shield('properties', found[0]) + body.slice(found[0].length) : body;
}

// A lexer of its own, so the editor's tokenizers on the shared `marked` do not change how blocks are cut.
const plain = new Marked();

// The top-level blocks whose words the editor would lose (`roundTrip`: what the editor writes for a piece of
// Markdown) become raw blocks; every other block is left as it is. The last resort that keeps any file editable.
export function shieldLosses(body: string, roundTrip: (markdown: string) => string): string {
  let out = '';
  for (const token of plain.lexer(body.replace(/\r\n/g, '\n'))) {
    const raw = token.raw;
    if (token.type === 'space' || raw.startsWith(OPEN)) { out += raw; continue; }
    let kept = true;
    try { kept = wordsOf(roundTrip(raw)) === wordsOf(raw); } catch { kept = false; }
    if (kept) { out += raw; continue; }
    const text = raw.replace(/\n+$/, '');
    out += shield('kept', text) + raw.slice(text.length);
  }
  return out;
}

// Inline pieces the editor would drop or escape. Tried before marked's own inline rules (extensions go first).
const INLINE = /^(?:<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*?)?\/?>|\[\^[^\]\s]+\]|\[![A-Za-z]+\])/;
const INLINE_START = /<!--|<\/?[A-Za-z]|\[\^|\[!/;
const isBreak = (raw: string) => /^<br\s*\/?>$/i.test(raw);

// The words on the card, in the interface language: the editor sets them (i18n reads the page, so it is not imported here).
export const rawWords: { kind: (kind: RawKind) => string; hint: string } = { kind: (kind) => kind, hint: '' };

export const RawBlock = Node.create({
  name: 'rawBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return { raw: { default: '' }, kind: { default: 'html' } };
  },

  parseHTML() {
    return [{ tag: 'div[data-raw-block]', getAttrs: (el) => ({ raw: el.getAttribute('data-raw') ?? '', kind: el.getAttribute('data-raw-block') || 'html' }) }];
  },

  renderHTML({ node }) {
    return ['div', { 'data-raw-block': node.attrs.kind, 'data-raw': node.attrs.raw }, ['pre', {}, String(node.attrs.raw ?? '')]];
  },

  // A card: what kind of block it is, and its text in a box that grows with it. Typing changes the node's text.
  addNodeView() {
    return ({ node, getPos, editor }) => {
      let current = node;
      const page = editor.view.dom.ownerDocument;
      const dom = page.createElement('div');
      dom.className = 'md-raw';
      dom.contentEditable = 'false';
      const bar = page.createElement('div');
      bar.className = 'md-raw-bar';
      const kind = page.createElement('span');
      kind.className = 'md-raw-kind';
      bar.append(kind);
      const area = page.createElement('textarea');
      area.className = 'md-raw-text';
      area.spellcheck = false;
      area.rows = 1;
      const fit = () => { area.style.height = 'auto'; area.style.height = `${area.scrollHeight + 2}px`; };
      const show = (next: typeof node) => {
        const k: RawKind = isKind(next.attrs.kind) ? next.attrs.kind : 'html';
        dom.dataset.kind = k;
        kind.textContent = rawWords.kind(k);
        kind.title = rawWords.hint;
        if (area.value !== next.attrs.raw) { area.value = String(next.attrs.raw ?? ''); page.defaultView?.requestAnimationFrame(fit); }
      };
      area.addEventListener('input', () => {
        fit();
        const pos = typeof getPos === 'function' ? getPos() : undefined;
        if (typeof pos !== 'number') return;
        editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, raw: area.value }));
      });
      dom.append(bar, area);
      show(node);
      return {
        dom,
        update: (next) => {
          if (next.type !== current.type) return false;
          current = next;
          if (page.activeElement !== area) show(next);
          return true;
        },
        stopEvent: (event) => event.target === area,
        ignoreMutation: () => true,
      };
    };
  },

  // A block of HTML (marked's 'html' token). Reference definitions and shielded blocks come through RawSources.
  markdownTokenName: 'html',

  parseMarkdown(token) {
    return { type: 'rawBlock', attrs: { raw: String(token.raw ?? token.text ?? '').replace(/\s+$/, ''), kind: 'html' } };
  },

  renderMarkdown(node) {
    return String(node.attrs?.raw ?? '');
  },
});

// Reference definitions ([id]: url) and shielded blocks, both drawn as raw blocks.
export const RawSources = [
  Extension.create({
    name: 'rawReference',
    markdownTokenName: 'def',
    parseMarkdown: (token: MarkdownToken) => ({ type: 'rawBlock', attrs: { raw: String(token.raw ?? '').replace(/\s+$/, ''), kind: 'reference' } }),
  }),
  Extension.create({
    name: 'rawShield',
    markdownTokenName: 'rawShield',
    markdownTokenizer: {
      name: 'rawShield',
      level: 'block',
      start: (src: string) => src.indexOf(OPEN),
      tokenize: (src: string) => {
        const found = SHIELD.exec(src);
        if (!found || !isKind(found[1])) return undefined;
        return { type: 'rawShield', raw: found[0], kind: found[1], text: fromBase64(found[2]) } as MarkdownToken;
      },
    },
    parseMarkdown: (token: MarkdownToken) => ({ type: 'rawBlock', attrs: { raw: String(token.text ?? ''), kind: token.kind } }),
  }),
];

export const RawInline = Node.create({
  name: 'rawInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return { raw: { default: '' } };
  },

  parseHTML() {
    return [{ tag: 'span[data-raw-inline]', getAttrs: (el) => ({ raw: el.getAttribute('data-raw-inline') ?? '' }) }];
  },

  renderHTML({ node }) {
    const raw = String(node.attrs.raw ?? '');
    if (isBreak(raw)) return ['span', { 'data-raw-inline': raw, class: 'md-raw-br' }, ['br']];
    const shown = raw.length > 40 ? `${raw.slice(0, 39)}…` : raw;
    return ['span', { 'data-raw-inline': raw, class: 'md-raw-inline', title: raw }, shown];
  },

  markdownTokenName: 'rawInline',

  markdownTokenizer: {
    name: 'rawInline',
    level: 'inline',
    start: (src) => src.search(INLINE_START),
    tokenize: (src) => {
      const found = INLINE.exec(src);
      return found ? ({ type: 'rawInline', raw: found[0], text: found[0] } as MarkdownToken) : undefined;
    },
  },

  parseMarkdown(token) {
    return { type: 'rawInline', attrs: { raw: String(token.raw ?? '') } };
  },

  renderMarkdown(node) {
    return String(node.attrs?.raw ?? '');
  },
});

export const RawMarkdown = [RawBlock, RawInline, ...RawSources];
