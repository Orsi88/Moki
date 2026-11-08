// The common modal shell: a themed surface, responsive frame, focus trap and one topmost dismissal.

import { useRef, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useModalLayer } from '../modal-layer';

interface Props {
  children: ReactNode;
  onClose: () => void;
  className?: string;
  labelledBy?: string;
  describedBy?: string;
  label?: string;
  size?: 'compact' | 'medium' | 'wide';
  busy?: boolean;
  as?: 'div' | 'form';
  onSubmit?: (event: FormEvent) => void;
  role?: 'dialog' | 'alertdialog';
  blockShortcuts?: boolean;
}

export function Modal({ children, onClose, className = '', labelledBy, describedBy, label, size, busy = false, as = 'div', onSubmit, role = 'dialog', blockShortcuts = false }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const dismiss = () => { if (!busy) onClose(); };
  useModalLayer(ref, dismiss, true, blockShortcuts);
  const Surface = as;
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}>
      <Surface ref={(element: HTMLDivElement | HTMLFormElement | null) => { ref.current = element; }} className={`modal${size ? ` modal-${size}` : ''}${className ? ` ${className}` : ''}`} role={role}
        aria-modal="true" aria-labelledby={labelledBy} aria-describedby={describedBy} aria-label={label} aria-busy={busy || undefined}
        tabIndex={-1} onSubmit={onSubmit}>
        {children}
      </Surface>
    </div>, document.body,
  );
}
