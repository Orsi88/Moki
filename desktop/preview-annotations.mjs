// Serialized into the sandboxed HTML response: no imports, IPC, Node or parent DOM access.
function previewAnnotations() {
  let comments = [], active = '', pending = 0;
  const palette = { yellow: '#f5d90a', green: '#46c46a', blue: '#4a8ff0', pink: '#f06ab0', orange: '#f59b2a', red: '#e5484d', purple: '#9b6cf0' };
  const rectOf = (rect) => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  const nodes = () => {
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, { acceptNode: node => node.parentElement?.closest('script,style,noscript,textarea,select,[hidden]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const list = []; let length = 0;
    for (let node = walker.nextNode(); node && list.length < 50000 && length < 2000000; node = walker.nextNode()) { list.push(node); length += node.length; }
    return list;
  };
  const locate = (anchor, list, text) => {
    let at = -1, found = -1;
    while ((at = text.indexOf(anchor.quote, at + 1)) >= 0) {
      if (anchor.prefix && !text.slice(0, at).endsWith(anchor.prefix) || anchor.suffix && !text.slice(at + anchor.quote.length).startsWith(anchor.suffix)) continue;
      if (found >= 0) return null;
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
  const paint = (focus) => {
    if (!document.body) return;
    const list = nodes(), text = list.map(node => node.textContent).join(''), groups = new Map(), missing = [], anchors = [];
    let chosen = null;
    for (const comment of comments) {
      const range = locate(comment.anchor, list, text);
      if (!range) { missing.push(comment.id); continue; }
      const base = Object.hasOwn(palette, comment.color) ? comment.color : 'yellow';
      const color = base + (comment.id === active ? '-active' : '');
      groups.set(color, [...groups.get(color) || [], range]);
      if (comment.id === active) chosen = range;
      const rect = range.getClientRects()[0] || range.getBoundingClientRect();
      anchors.push({ id: comment.id, rect: rectOf(rect), visible: rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth });
    }
    if (globalThis.Highlight && globalThis.CSS?.highlights) {
      for (const key of Object.keys(palette).flatMap((color) => [color, color + '-active'])) {
        const ranges = groups.get(key);
        if (ranges?.length) CSS.highlights.set('moki-comments-' + key, new Highlight(...ranges));
        else CSS.highlights.delete('moki-comments-' + key);
      }
    }
    if (focus && chosen) chosen.startContainer.parentElement?.scrollIntoView({ block: 'center', inline: 'nearest' });
    parent.postMessage({ type: 'moki:comment-anchors', missing, anchors }, '*');
  };
  const schedule = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; paint(false); }); };
  const capture = () => {
    const selected = document.getSelection();
    if (!selected?.rangeCount || selected.isCollapsed) { parent.postMessage({ type: 'moki:selection', anchor: null }, '*'); return; }
    const range = selected.getRangeAt(0), quote = range.toString();
    if (!quote.trim() || quote.length > 4000) return;
    const list = nodes(), text = list.map(node => node.textContent).join(''); let start = 0;
    for (const node of list) { if (node === range.startContainer) { start += range.startOffset; break; } if (range.comparePoint(node, 0) >= 0) break; start += node.length; }
    if (text.slice(start, start + quote.length) !== quote) return;
    const anchor = { quote, prefix: text.slice(Math.max(0, start - 96), start), suffix: text.slice(start + quote.length, start + quote.length + 96) };
    parent.postMessage({ type: 'moki:selection', anchor, rect: rectOf(range.getBoundingClientRect()) }, '*');
  };
  document.addEventListener('mouseup', capture);
  document.addEventListener('keyup', capture);
  document.addEventListener('selectionchange', () => { if (document.getSelection()?.isCollapsed) capture(); });
  document.addEventListener('scroll', () => { schedule(); parent.postMessage({ type: 'moki:selection', anchor: null }, '*'); }, { passive: true, capture: true });
  addEventListener('resize', schedule);
  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(schedule, 200); }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
  if (document.body) new ResizeObserver(schedule).observe(document.body);
  document.fonts?.ready.then(schedule);
  addEventListener('message', event => {
    if (event.source !== parent) return;
    if (event.data?.type === 'moki:clear-selection') { document.getSelection()?.removeAllRanges(); return; }
    if (event.data?.type !== 'moki:comments' || !Array.isArray(event.data.comments)) return;
    comments = event.data.comments.slice(0, 500).filter(comment => comment && typeof comment.id === 'string' && comment.anchor && typeof comment.anchor.quote === 'string' && comment.anchor.quote.length > 0 && comment.anchor.quote.length <= 4000 && typeof comment.anchor.prefix === 'string' && comment.anchor.prefix.length <= 96 && typeof comment.anchor.suffix === 'string' && comment.anchor.suffix.length <= 96);
    active = typeof event.data.active === 'string' ? event.data.active : '';
    paint(event.data.focus === true);
  });
  const style = document.createElement('style');
  style.textContent = Object.entries(palette).map(([key, color]) => '::highlight(moki-comments-' + key + '){background-color:color-mix(in srgb,' + color + ' 28%,transparent);}::highlight(moki-comments-' + key + '-active){background-color:color-mix(in srgb,' + color + ' 50%,transparent);}').join('');
  document.documentElement.append(style);
  parent.postMessage({ type: 'moki:preview-ready' }, '*');
}
export const annotationScript = '<script>(' + previewAnnotations.toString() + ')();</script>';
