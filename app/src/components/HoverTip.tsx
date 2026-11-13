// The short description of an agent, skill or activity, shown above the row on hover or focus.
// Portaled so a scrolling list does not clip it. The surface is the same opaque card with the accent edge used by the menus.

import { cloneElement, isValidElement, useState, type FocusEvent, type HTMLAttributes, type MouseEvent, type ReactElement } from 'react';
import { createPortal } from 'react-dom';

type El = ReactElement<HTMLAttributes<HTMLElement>>;

export function HoverTip({ text, children }: { text?: string; children: El }) {
  const [place, setPlace] = useState<{ left: number; top: number; below: boolean } | null>(null);
  if (!text?.trim() || !isValidElement(children)) return children;
  const show = (el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const below = r.top < 88;
    setPlace({
      left: Math.min(Math.max(8, r.left), window.innerWidth - 328),
      top: below ? r.bottom : r.top,
      below,
    });
  };
  const hide = () => setPlace(null);
  const pass = (own: ((e: MouseEvent<HTMLElement>) => void) | undefined, next: (e: MouseEvent<HTMLElement>) => void) =>
    (e: MouseEvent<HTMLElement>) => { own?.(e); next(e); };
  const passFocus = (own: ((e: FocusEvent<HTMLElement>) => void) | undefined, next: (e: FocusEvent<HTMLElement>) => void) =>
    (e: FocusEvent<HTMLElement>) => { own?.(e); next(e); };
  return (
    <>
      {cloneElement(children, {
        onMouseEnter: pass(children.props.onMouseEnter, (e) => show(e.currentTarget)),
        onMouseLeave: pass(children.props.onMouseLeave, hide),
        onFocus: passFocus(children.props.onFocus, (e) => show(e.currentTarget)),
        onBlur: passFocus(children.props.onBlur, hide),
      })}
      {place && createPortal(
        <span className={`hover-tip-bubble${place.below ? ' below' : ''}`} role="tooltip" style={{ left: place.left, top: place.top }}>{text}</span>,
        document.body,
      )}
    </>
  );
}
