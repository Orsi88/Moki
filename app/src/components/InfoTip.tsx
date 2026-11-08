// A small ⓘ that explains something on hover or keyboard focus, without taking room on the screen.

import { useId } from 'react';
import { IconInfo } from './Icons';

export function InfoTip({ text, label }: { text: string; label?: string }) {
  const id = useId();
  return (
    <span className="info-tip" tabIndex={0} role="button" aria-label={label ?? text} aria-describedby={id}>
      <IconInfo size={14} />
      <span className="info-tip-text" role="tooltip" id={id}>{text}</span>
    </span>
  );
}
