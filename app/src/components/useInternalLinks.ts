// Reader-only links and one-shot anchor navigation. Neither operation edits a document's source.
import { useEffect, useRef, type RefObject } from 'react';
import { findPaths, type LinkJump, type Target } from '../internal-links';

export type LinkResolver = (href: string) => Target | null;

export function linkProjectPaths(root: HTMLElement, resolve?: LinkResolver): void {
  if (!resolve) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!node.parentElement?.closest('a,pre,button,textarea,[contenteditable="true"]')) nodes.push(node);
  }
  for (const node of nodes) {
    const matches = findPaths(node.data).filter((match) => resolve(match.text)?.found);
    if (!matches.length) continue;
    const fragment = document.createDocumentFragment();
    let at = 0;
    for (const match of matches) {
      fragment.append(document.createTextNode(node.data.slice(at, match.start)));
      const link = document.createElement('a');
      link.setAttribute('href', match.text);
      link.dataset.internalLink = 'true';
      link.textContent = match.text;
      fragment.append(link);
      at = match.end;
    }
    fragment.append(document.createTextNode(node.data.slice(at)));
    node.replaceWith(fragment);
  }
}

export function useAnchorJump(root: RefObject<HTMLElement | null>, jump: LinkJump | undefined, ready: boolean, onMissing?: () => void): void {
  const missing = useRef(onMissing);
  missing.current = onMissing;
  useEffect(() => {
    const host = root.current;
    if (!jump || !ready || !host) return;
    let frame = 0;
    let found: HTMLElement | null = null;
    let stopped = false;
    let settled: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      stopped = true; observer.disconnect(); size.disconnect(); cancelAnimationFrame(frame); clearTimeout(timeout); clearTimeout(settled);
    };
    const attempt = () => {
      if (stopped) return;
      const anchor = jump.anchor;
      const target = anchor.kind === 'heading'
        ? [...host.querySelectorAll<HTMLElement>('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')].find((el) => el.id === anchor.slug)
        : anchor.kind === 'page'
          ? [...host.querySelectorAll<HTMLElement>('.pdf-page[data-page]')].find((el) => Number(el.dataset.page) === anchor.page)
          : [...host.querySelectorAll<HTMLElement>('[data-comment-id],[data-card]')].find((el) => (el.dataset.commentId ?? el.dataset.card) === anchor.id);
      if (!target) return;
      // Comment cards first mount at top: 0; wait for their passage to be measured.
      if (anchor.kind === 'comment' && target.closest<HTMLElement>('[data-card]')?.dataset.positioned !== 'true') return;
      if (found !== target) {
        host.querySelectorAll<HTMLElement>('[data-link-target]').forEach((el) => el.removeAttribute('data-link-target'));
        target.dataset.linkTarget = 'true';
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
        found = target;
        size.observe(target);
      }
      target.scrollIntoView({ block: 'center' });
      // PDF fit/zoom and comment layout can change just after the target mounts.
      // Follow that layout until quiet, but give control back at the first user interaction.
      clearTimeout(settled);
      settled = setTimeout(stop, 1000);
    };
    const schedule = () => { if (!stopped) { cancelAnimationFrame(frame); frame = requestAnimationFrame(attempt); } };
    const observer = new MutationObserver(schedule);
    observer.observe(host, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-positioned', 'style'] });
    const size = new ResizeObserver(schedule);
    size.observe(host);
    if (host.firstElementChild) size.observe(host.firstElementChild);
    const timeout = setTimeout(() => { const absent = !found; stop(); if (absent) missing.current?.(); }, 5000);
    host.addEventListener('wheel', stop, { passive: true });
    host.addEventListener('pointerdown', stop);
    host.addEventListener('keydown', stop);
    schedule();
    return () => {
      stop();
      host.removeEventListener('wheel', stop); host.removeEventListener('pointerdown', stop); host.removeEventListener('keydown', stop);
    };
  }, [root, jump, ready]);
}
