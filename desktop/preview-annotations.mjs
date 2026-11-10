// This function is serialized into the sandboxed HTML response. It has no imports, IPC, Node or parent DOM access.
function previewAnnotations() {
  let comments = [], active = '', selection = null;
  const nodes = () => {
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, { acceptNode: node => node.parentElement?.closest('script,style,noscript,textarea,select,[hidden]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const list = []; let length = 0;
    for (let node = walker.nextNode(); node && list.length < 50000 && length < 2000000; node = walker.nextNode()) { list.push(node); length += node.length; }
    return list;
  };
  const locate = (anchor, list) => {
    const text = list.map(node => node.textContent).join('');
    let at = -1, found = -1;
    while ((at = text.indexOf(anchor.quote, at + 1)) >= 0) {
      if (anchor.prefix && !text.slice(0, at).endsWith(anchor.prefix) || anchor.suffix && !text.slice(at + anchor.quote.length).startsWith(anchor.suffix)) continue;
      if (found >= 0) return null; // ambiguous: never point to the wrong occurrence
      found = at;
    }
    if (found < 0) return null;
    const range = document.createRange(); let offset = 0, started = false;
    for (const node of list) {
      if (!started && offset + node.length > found) { range.setStart(node, found - offset); started = true; }
      if (started && offset + node.length >= found + anchor.quote.length) { range.setEnd(node, found + anchor.quote.length - offset); return range; }
      offset += node.length;
    }
    return null;
  };
  const paint = () => {
    if (!document.body) return;
    if (!comments.length) { globalThis.CSS?.highlights?.delete('moki-comments'); parent.postMessage({ type: 'moki:comment-anchors', missing: [] }, '*'); return; }
    const list = nodes(), ranges = [], missing = [];
    for (const comment of comments) {
      const range = locate(comment.anchor, list);
      if (!range) missing.push(comment.id); else { ranges.push(range); if (comment.id === active) range.startContainer.parentElement?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
    if (globalThis.Highlight && globalThis.CSS?.highlights) CSS.highlights.set('moki-comments', new Highlight(...ranges));
    parent.postMessage({ type: 'moki:comment-anchors', missing }, '*');
  };
  const capture = () => {
    const selected = document.getSelection();
    if (!selected?.rangeCount || selected.isCollapsed) return;
    const range = selected.getRangeAt(0), quote = range.toString();
    if (!quote.trim() || quote.length > 4000) return;
    const list = nodes(), text = list.map(node => node.textContent).join(''); let start = 0;
    for (const node of list) { if (node === range.startContainer) { start += range.startOffset; break; } if (range.comparePoint(node, 0) >= 0) break; start += node.length; }
    if (text.slice(start, start + quote.length) !== quote) return;
    selection = { quote, prefix: text.slice(Math.max(0, start - 96), start), suffix: text.slice(start + quote.length, start + quote.length + 96) };
    parent.postMessage({ type: 'moki:selection', anchor: selection }, '*');
  };
  document.addEventListener('mouseup', capture); document.addEventListener('keyup', capture);
  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(paint, 200); }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'moki:comments' || !Array.isArray(event.data.comments)) return;
    comments = event.data.comments.slice(0, 500).filter(comment => comment && typeof comment.id === 'string' && comment.anchor && typeof comment.anchor.quote === 'string' && typeof comment.anchor.prefix === 'string' && typeof comment.anchor.suffix === 'string');
    active = typeof event.data.active === 'string' ? event.data.active : ''; paint();
  });
  const style = document.createElement('style'); style.textContent = '::highlight(moki-comments) { background-color: #f3d77d; color: #111; }';
  document.documentElement.append(style);
  parent.postMessage({ type: 'moki:preview-ready' }, '*');
}
export const annotationScript = `<script>(${previewAnnotations.toString()})();</script>`;
