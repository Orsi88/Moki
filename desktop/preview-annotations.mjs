// Serialized into the sandboxed HTML response: no imports, IPC, Node or parent DOM access.
function previewAnnotations() {
  let comments = [], active = '', pending = 0, areaMode = false, drag = null, draft = null;
  const layer = document.createElement('div');
  layer.setAttribute('data-moki-areas', '');
  layer.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;pointer-events:none;z-index:2147483646;';
  const palette = { yellow: '#f5d90a', green: '#46c46a', blue: '#4a8ff0', pink: '#f06ab0', orange: '#f59b2a', red: '#e5484d', purple: '#9b6cf0' };
  const rectOf = (rect) => ({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  // An area holds on to the element at its top-left: the indexes of the element children from <body> down to it.
  const pathOf = (el) => { const out = []; while (el && el !== document.body && el.parentElement && out.length < 60) { out.unshift([...el.parentElement.children].indexOf(el)); el = el.parentElement; } return el === document.body ? out : null; };
  const atPath = (path) => { let el = document.body; for (const i of path || []) { el = el?.children[i]; if (!el) return null; } return el; };
  const areaAt = (a) => { const el = a.path ? atPath(a.path) : null; if (!el) return { x: a.x, y: a.y }; const r = el.getBoundingClientRect(); return { x: r.left + scrollX + (a.dx || 0), y: r.top + scrollY + (a.dy || 0) }; };
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
    layer.replaceChildren();
    if (!layer.isConnected) document.documentElement.append(layer);
    for (const comment of comments) {
      if (comment.anchor.kind === 'area') {
        const a = comment.anchor, base = Object.hasOwn(palette, comment.color) ? palette[comment.color] : palette.yellow;
        const box = document.createElement('div');
        const at = areaAt(a);
        box.style.cssText = 'position:absolute;box-sizing:border-box;border-radius:8px;left:' + at.x + 'px;top:' + at.y + 'px;width:' + a.width + 'px;height:' + a.height + 'px;border:1.5px solid color-mix(in srgb,' + base + ' 75%,transparent);background:color-mix(in srgb,' + base + ' ' + (comment.id === active ? 26 : 14) + '%,transparent);';
        layer.append(box);
        const rect = box.getBoundingClientRect();
        if (comment.id === active && focus) box.scrollIntoView({ block: 'center', inline: 'nearest' });
        anchors.push({ id: comment.id, rect: rectOf(rect), visible: rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth });
        continue;
      }
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
    if (areaMode) return;
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
  // "Mark an area": the parent turns it on; a rectangle dragged on the page goes back to it, in document pixels.
  document.addEventListener('pointerdown', (e) => {
    if (!areaMode || e.button !== 0) return;
    e.preventDefault();
    drag = { x: e.clientX, y: e.clientY };
    draft = document.createElement('div');
    draft.style.cssText = 'position:fixed;z-index:2147483647;border:1.5px dashed #c99a22;border-radius:6px;background:rgba(201,154,34,.12);pointer-events:none;';
    document.documentElement.append(draft);
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!drag || !draft) return;
    draft.style.left = Math.min(drag.x, e.clientX) + 'px'; draft.style.top = Math.min(drag.y, e.clientY) + 'px';
    draft.style.width = Math.abs(e.clientX - drag.x) + 'px'; draft.style.height = Math.abs(e.clientY - drag.y) + 'px';
  }, true);
  document.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const left = Math.min(drag.x, e.clientX), top = Math.min(drag.y, e.clientY), width = Math.abs(e.clientX - drag.x), height = Math.abs(e.clientY - drag.y);
    drag = null; draft?.remove(); draft = null;
    if (width < 6 || height < 6) return;
    const anchor = { kind: 'area', x: Math.round(left + scrollX), y: Math.round(top + scrollY), width: Math.round(width), height: Math.round(height) };
    layer.style.display = 'none';
    const hit = document.elementFromPoint(left + 2, top + 2);
    layer.style.display = '';
    const path = hit && hit !== document.documentElement && hit !== document.body ? pathOf(hit) : null;
    if (path && path.length) { const r = hit.getBoundingClientRect(); Object.assign(anchor, { path, dx: Math.round(left - r.left), dy: Math.round(top - r.top) }); }
    parent.postMessage({ type: 'moki:area', anchor, rect: { left, top, width, height } }, '*');
  }, true);
  // A right-click on selected text: the parent shows its markers there.
  document.addEventListener('contextmenu', (e) => {
    const selected = document.getSelection();
    if (areaMode || !selected?.rangeCount || selected.isCollapsed) return;
    const range = selected.getRangeAt(0), quote = range.toString();
    if (!quote.trim() || quote.length > 4000) return;
    const list = nodes(), text = list.map(node => node.textContent).join(''); let start = 0;
    for (const node of list) { if (node === range.startContainer) { start += range.startOffset; break; } if (range.comparePoint(node, 0) >= 0) break; start += node.length; }
    if (text.slice(start, start + quote.length) !== quote) return;
    e.preventDefault();
    const anchor = { quote, prefix: text.slice(Math.max(0, start - 96), start), suffix: text.slice(start + quote.length, start + quote.length + 96) };
    parent.postMessage({ type: 'moki:context', anchor, point: { x: e.clientX, y: e.clientY } }, '*');
  });
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
    if (event.data?.type === 'moki:area-mode') { areaMode = event.data.on === true; document.documentElement.style.cursor = areaMode ? 'crosshair' : ''; document.documentElement.style.userSelect = areaMode ? 'none' : ''; return; }
    if (event.data?.type !== 'moki:comments' || !Array.isArray(event.data.comments)) return;
    const area = (a) => a && a.kind === 'area' && [a.x, a.y, a.width, a.height].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1000000) && (a.path === undefined || Array.isArray(a.path) && a.path.length <= 60);
    comments = event.data.comments.slice(0, 500).filter(comment => comment && typeof comment.id === 'string' && comment.anchor && (area(comment.anchor) || typeof comment.anchor.quote === 'string' && comment.anchor.quote.length > 0 && comment.anchor.quote.length <= 4000 && typeof comment.anchor.prefix === 'string' && comment.anchor.prefix.length <= 96 && typeof comment.anchor.suffix === 'string' && comment.anchor.suffix.length <= 96));
    active = typeof event.data.active === 'string' ? event.data.active : '';
    paint(event.data.focus === true);
  });
  const style = document.createElement('style');
  // The page's scrollbars as Moki's own: thin, shown while the pointer is over the page.
  const scrollbars = '::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-thumb{background:transparent;border-radius:6px;border:2px solid transparent;background-clip:padding-box}:hover::-webkit-scrollbar-thumb{background-color:rgba(128,128,128,.28)}::-webkit-scrollbar-thumb:hover{background-color:rgba(128,128,128,.5)}::-webkit-scrollbar-track,::-webkit-scrollbar-corner{background:transparent}::-webkit-scrollbar-button{display:none;width:0;height:0}';
  style.textContent = scrollbars + Object.entries(palette).map(([key, color]) => '::highlight(moki-comments-' + key + '){background-color:color-mix(in srgb,' + color + ' 28%,transparent);}::highlight(moki-comments-' + key + '-active){background-color:color-mix(in srgb,' + color + ' 50%,transparent);}').join('');
  document.documentElement.append(style);
  parent.postMessage({ type: 'moki:preview-ready' }, '*');
}
export const annotationScript = '<script>(' + previewAnnotations.toString() + ')();</script>';
