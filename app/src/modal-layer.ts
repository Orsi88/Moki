// One keyboard/focus stack for the app's modal surfaces, including nested catalogs and confirmations.

import { useLayoutEffect, useRef, type RefObject } from 'react';

interface Layer {
  element: HTMLElement;
  close: () => void;
  blockShortcuts: boolean;
}

const layers: Layer[] = [];
let installed = false;
let outsideFocus: HTMLElement | null = null;
const top = () => layers[layers.length - 1];
const focusable = (element: HTMLElement): HTMLElement[] => Array.from(element.querySelectorAll<HTMLElement>(
  'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
)).filter((item) => !item.closest('[hidden], [inert]') && item.getClientRects().length > 0);

function focusLayer(layer: Layer): void {
  const preferred = layer.element.querySelector<HTMLElement>('[data-dialog-focus], [autofocus]');
  (preferred ?? focusable(layer.element)[0] ?? layer.element).focus({ preventScroll: true });
}

export function isTopModal(element: HTMLElement | null): boolean {
  return !top() || Boolean(element && top()?.element === element);
}

export function installModalLayers(): void {
  if (installed) return;
  installed = true;
  // Installed before screens mount: legacy window handlers must not close a dialog underneath the top one.
  window.addEventListener('keydown', (event) => {
    const layer = top();
    if (!layer) return;
    if (event.key === 'Escape') {
      // An open menu handles its own Escape before the containing dialog is closed.
      if (!layer.blockShortcuts && Array.from(document.querySelectorAll<HTMLElement>('[role="menu"], [role="listbox"]')).some((menu) => menu.getClientRects().length > 0)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      layer.close();
      return;
    }
    if (layer.blockShortcuts && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusable(layer.element);
    const current = document.activeElement;
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) { event.preventDefault(); layer.element.focus(); return; }
    if (!layer.element.contains(current) || event.shiftKey && current === first || !event.shiftKey && current === last) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }, true);
  document.addEventListener('focusin', (event) => {
    const layer = top();
    const target = event.target;
    if (!layer && target instanceof HTMLElement && !target.closest('[role="menu"], [role="listbox"]')) outsideFocus = target;
    // Floating editor menus and file pickers are allowed to own focus while they are open.
    if (layer && target instanceof Element && !layer.element.contains(target)
      && !target.closest('[role="menu"], [role="listbox"], .tiptap-bubble, .image-bubble, .note-mention')) focusLayer(layer);
  });
}

export function useModalLayer(ref: RefObject<HTMLElement | null>, onClose: () => void, active = true, blockShortcuts = false): void {
  const close = useRef(onClose);
  close.current = onClose;
  // Capture before React's autoFocus moves into the new surface during the commit.
  const previous = useRef<HTMLElement | null>(null);
  const wasActive = useRef(false);
  if (active && !wasActive.current) previous.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  wasActive.current = active;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!active || !element) return;
    installModalLayers();
    const layer: Layer = { element, close: () => close.current(), blockShortcuts };
    layers.push(layer);
    const backdrop = element.closest<HTMLElement>('.modal-backdrop') ?? element;
    backdrop.style.setProperty('--dialog-layer', String(100 + layers.length * 10));
    if (!element.contains(document.activeElement) || element.querySelector('[data-dialog-focus]')) focusLayer(layer);
    return () => {
      const wasTop = top() === layer;
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      if (!wasTop) return;
      const remaining = top();
      const opener = previous.current;
      if (opener?.isConnected && (!remaining || remaining.element.contains(opener))) opener.focus({ preventScroll: true });
      else if (remaining) focusLayer(remaining);
      else if (outsideFocus?.isConnected) outsideFocus.focus({ preventScroll: true });
    };
  }, [ref, active, blockShortcuts]);
}
