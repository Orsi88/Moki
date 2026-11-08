// Tags of a project or a file: chips, and a field that adds a tag from the
// catalog or creates a new one. Tags share context between projects. On focus, before
// anything is typed, it suggests the tags added last and the projects worked on last.

import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { api, type Tag } from '../api';
import { t } from '../i18n';
import { IconX } from './Icons';
import { recentProjects, recentTags, touchRecentTag } from '../side-menu';

const SUGGESTED = 5;

interface Props {
  catalog: Tag[];
  value: string[];
  onChange: (ids: string[]) => void;
  onCatalog: (catalog: Tag[]) => void; // a tag was created
  compact?: boolean;
}

export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span className="tag-chip" style={{ '--tag': tag.color } as CSSProperties} title={tag.description || tag.name}>
      <span className="tag-dot" />{tag.name}
      {onRemove && <button type="button" className="tag-x" onClick={onRemove} title={t('Remove tag')} aria-label={t('Remove tag')}><IconX size={11} /></button>}
    </span>
  );
}

export function TagPicker({ catalog, value, onChange, onCatalog, compact = false }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const chosen = value.map((id) => catalog.find((tg) => tg.id === id)).filter((tg): tg is Tag => Boolean(tg));
  const query = text.trim().toLowerCase();
  const options = catalog.filter((tg) => !value.includes(tg.id) && (!query || tg.name.toLowerCase().includes(query))).slice(0, 8);

  const pick = (id: string) => { touchRecentTag(id); onChange([...value, id]); setText(''); };
  // Nothing typed: the recent tags, then the recent projects (when the catalog has project tags).
  const free = (id: string) => !value.includes(id) && catalog.some((tg) => tg.id === id);
  const lastTags = recentTags().filter((id) => !id.startsWith('project:') && free(id)).slice(0, SUGGESTED);
  // Projects linked last come first, then the ones opened or worked on last.
  const lastProjects = [...new Set([...recentTags().filter((id) => id.startsWith('project:')), ...recentProjects().map((id) => `project:${id}`)])]
    .filter(free).slice(0, SUGGESTED);
  const byId = (id: string) => catalog.find((tg) => tg.id === id)!;
  const others = lastTags.length || lastProjects.length ? [] : catalog.filter((tg) => !value.includes(tg.id)).slice(0, 8).map((tg) => tg.id);
  const groups = [
    { label: t('Recent tags'), ids: lastTags },
    { label: t('Recent projects'), ids: lastProjects },
    { label: '', ids: others },
  ].filter((g) => g.ids.length);
  const showing = open && (text ? true : groups.length > 0);
  const option = (id: string) => (
    <li key={id}><button type="button" role="option" aria-selected={false} onMouseDown={(e) => { e.preventDefault(); pick(id); }}><TagChip tag={byId(id)} /></button></li>
  );

  const add = async () => {
    if (!query) return;
    setError('');
    const known = catalog.find((tg) => tg.name.toLowerCase() === query);
    try {
      const tag = known ?? await api.saveTag({ name: text.trim() });
      if (!known) onCatalog(await api.tags());
      if (!value.includes(tag.id)) pick(tag.id); else setText('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') setOpen(true);
    if (e.key === 'Escape' && showing) { e.stopPropagation(); setOpen(false); }
    if (e.key === 'Enter') { e.preventDefault(); void add(); }
    if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
  };

  return (
    <div className={`tag-picker${compact ? ' compact' : ''}`}>
      {chosen.map((tg) => <TagChip key={tg.id} tag={tg} onRemove={() => onChange(value.filter((id) => id !== tg.id))} />)}
      <span className="tag-input">
        <input value={text} onChange={(e) => { setText(e.target.value); setOpen(true); }} onKeyDown={onKey}
          onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onBlur={() => setOpen(false)} placeholder={chosen.length ? t('+ tag') : t('Add a tag…')} maxLength={40}
          aria-label={t('Add a tag')} />
        {showing && !text && (
          <ul className="tag-options" role="listbox" aria-label={t('Suggested tags')}>
            {groups.map((g) => [
              g.label && <li key={g.label} className="tag-options-head" role="presentation">{g.label}</li>,
              ...g.ids.map(option),
            ])}
          </ul>
        )}
        {showing && text && (
          <ul className="tag-options" role="listbox">
            {options.map((tg) => option(tg.id))}
            {!catalog.some((tg) => tg.name.toLowerCase() === query) && (
              <li><button type="button" onMouseDown={(e) => { e.preventDefault(); void add(); }}>{t('Create tag "{name}"', { name: text.trim() })}</button></li>
            )}
          </ul>
        )}
      </span>
      {error && <span className="error small">{error}</span>}
    </div>
  );
}
