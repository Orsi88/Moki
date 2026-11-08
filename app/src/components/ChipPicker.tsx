// A field that collects items as chips: a click lists what can still be added (typing filters it), a choice joins
// the field. A chip can carry a star (a default of the project) and a lock (it cannot be removed here, with why).
// The project settings use one per kind, so every kind looks and works the same.

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '../i18n';
import { IconLock, IconStar, IconX } from './Icons';

export interface PickOption { id: string; name: string; hint?: string; group?: string }
export interface PickChip {
  id: string; name: string;
  star?: boolean; // undefined: no star on this chip
  locked?: string; // why it cannot be removed here
  marked?: string; // a short note shown on hover (e.g. suggested by the AI)
}

interface Props {
  label: string;
  chips: PickChip[];
  options: PickOption[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onStar?: (id: string) => void;
  empty?: string; // placeholder when nothing is chosen
}

export function ChipPicker({ label, chips, options, onAdd, onRemove, onStar, empty }: Props) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const listId = useId();
  const query = text.trim().toLowerCase();
  const shown = useMemo(() => options.filter((o) => !query || o.name.toLowerCase().includes(query) || (o.hint ?? '').toLowerCase().includes(query)), [options, query]);
  const add = (id: string) => { onAdd(id); setText(''); };
  // The list opens below the field; in a scrolling dialog, scroll just enough for all of it to show.
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => { if (open) listRef.current?.scrollIntoView({ block: 'nearest' }); }, [open]);
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') setOpen(true);
    if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); }
    if (e.key === 'Enter') { e.preventDefault(); if (shown[0]) add(shown[0].id); }
  };
  let group: string | undefined;

  return (
    <div className="chip-picker" onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus(); setOpen(true); } }}>
      {chips.length > 0 && (
        <ul className="chip-picker-chips" aria-label={label}>
          {chips.map((c) => (
            <li key={c.id} className={`chip-picker-chip${c.star ? ' starred' : ''}${c.marked ? ' marked' : ''}`} title={c.locked ?? c.marked}>
              {c.star !== undefined && onStar && (
                <button type="button" className="chip-picker-star" aria-pressed={c.star} onClick={() => onStar(c.id)}
                  title={c.star ? t('Default of this project: click to remove') : t('Make it a default of this project')} aria-label={`${t('Default')}: ${c.name}`}><IconStar size={12} /></button>
              )}
              <span className="chip-picker-name">{c.name}</span>
              {c.locked
                ? <span className="chip-picker-lock" aria-label={c.locked}><IconLock size={11} /></span>
                : <button type="button" className="chip-picker-x" onClick={() => onRemove(c.id)} title={t('Remove')} aria-label={`${t('Remove')} ${c.name}`}><IconX size={11} /></button>}
            </li>
          ))}
        </ul>
      )}
      <span className="chip-picker-input">
        <input value={text} role="combobox" aria-expanded={open && shown.length > 0} aria-controls={listId} aria-label={label}
          placeholder={chips.length ? t('Add…') : empty ?? t('Add…')}
          onChange={(e) => { setText(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey} />
        {open && (
          <ul ref={listRef} className="chip-picker-options" role="listbox" id={listId} aria-label={label}>
            {shown.length === 0 && <li className="chip-picker-none" role="presentation">{options.length ? t('Nothing matches.') : t('Everything is already here.')}</li>}
            {shown.map((o) => {
              const head = o.group && o.group !== group ? o.group : '';
              group = o.group;
              return [
                head && <li key={`g-${head}`} className="chip-picker-head" role="presentation">{head}</li>,
                <li key={o.id}>
                  <button type="button" role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); add(o.id); }}>
                    <span className="chip-picker-option-name">{o.name}</span>
                    {o.hint && <span className="chip-picker-option-hint">{o.hint}</span>}
                  </button>
                </li>,
              ];
            })}
          </ul>
        )}
      </span>
    </div>
  );
}
