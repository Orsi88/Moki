// The name typed over a row (Rename or F2), in the project tree and on the start screen.
// Enter or leaving the field keeps it, Esc goes back. A fixed suffix (a file's extension) sits
// inside the box, after the name. A refused name keeps the field open, with the reason under it.
import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

interface Props {
  initial: string; // the text shown, all selected
  label: string; // what is renamed, for "New name for {name}"
  suffix?: string; // shown after the name, not editable (".md")
  check?: (name: string) => string; // the reason a name is refused while it is typed ('' = fine)
  onRename: (name: string) => Promise<void>; // rejects with the reason the name was refused
  onEnd: () => void; // renamed or cancelled: the row is shown again
}

// Short enough for a list and a title bar.
export const MAX_NAME = 120;
export const tooLong = (name: string): string => (name.length > MAX_NAME ? t('Use at most 120 characters.') : '');

export function RenameField({ initial, label, suffix, check = tooLong, onRename, onEnd }: Props) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const closed = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const close = () => { closed.current = true; onEnd(); };
  const commit = async () => {
    if (closed.current || busy.current) return;
    const name = value.trim();
    if (!name || name === initial) { close(); return; }
    const problem = check(name);
    if (problem) { setError(problem); return; }
    busy.current = true;
    try { await onRename(name); close(); } catch (e) { setError(t(e instanceof Error ? e.message : String(e))); } finally { busy.current = false; }
  };
  const errorId = useRef(`rename-error-${Math.random().toString(36).slice(2)}`).current;
  return (
    <span className={`rename-box${error ? ' invalid' : ''}`} onMouseDown={(e) => { if (e.target !== input.current) { e.preventDefault(); input.current?.focus(); } }}>
      <input ref={input} className="rename-input" value={value} spellCheck={false}
        aria-label={t('New name for {name}', { name: label })} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}
        onChange={(e) => { setValue(e.target.value); setError(check(e.target.value.trim())); }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); void commit(); }
          if (e.key === 'Escape') { e.preventDefault(); close(); }
        }}
        onBlur={() => { void commit(); }}
        onClick={(e) => e.stopPropagation()} />
      {suffix && <span className="rename-suffix" aria-hidden="true">{suffix}</span>}
      {error && <span id={errorId} className="rename-error" role="alert">{error}</span>}
    </span>
  );
}
