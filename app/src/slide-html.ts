// The text of a slide, cleaned for the page: the parser builds HTML from the .pptx, an untrusted file, so it is rebuilt
// here from an allow list (text tags, the style attribute through cleanStyle) and nothing of the file can run.
import { cleanStyle, inheritedBullet } from './slides';

const TAGS = new Set(['P', 'SPAN', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SUB', 'SUP', 'UL', 'OL', 'LI', 'DIV', 'A']);
const SAFE_LINK = /^(https?:|mailto:)/i;

// The slide's text HTML, rebuilt from the allow list. Links become <span data-href> (opened by the app, never navigated).
export function sanitizeSlideHtml(html: string, bullets = false): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out = document.createElement('div');
  const copy = (from: Node, to: Node) => {
    from.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) { to.appendChild(document.createTextNode(node.textContent ?? '')); return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      if (!TAGS.has(el.tagName)) { copy(el, to); return; } // unknown tag: keep its text, drop the tag
      const clean = document.createElement(el.tagName === 'A' ? 'span' : el.tagName.toLowerCase());
      const style = cleanStyle(el.getAttribute('style') ?? '');
      if (style) clean.setAttribute('style', style);
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') ?? '';
        clean.className = 'slide-link';
        if (SAFE_LINK.test(href)) clean.setAttribute('data-href', href);
      }
      const hang = bullets && el.tagName === 'P' && el.parentElement?.tagName !== 'LI' && (el.textContent ?? '').trim() ? inheritedBullet(style) : 0;
      if (hang) {
        // The bullet takes the hanging indent and the look of the first run of text.
        const run = cleanStyle(el.querySelector('span')?.getAttribute('style') ?? '').split('; ').filter((d) => /^(color|font-size|font-family):/.test(d)).join('; ');
        const mark = document.createElement('span');
        mark.className = 'slide-bullet';
        mark.textContent = '•';
        mark.setAttribute('style', `${run ? `${run}; ` : ''}width: ${hang}pt`);
        clean.appendChild(mark);
      }
      copy(el, clean);
      to.appendChild(clean);
    });
  };
  copy(doc.body, out);
  return out.innerHTML;
}
