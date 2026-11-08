// Pick an illustration from the cat library: a grid of every cat, with a filter.
import { useState } from 'react';
import { t } from '../i18n';
import { CATS } from '../icons/cats';
import { CatIcon } from './CatIcon';
import { IconX } from './Icons';
import { Modal } from './Modal';

interface Props {
  selected: string;
  title?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

export function CatPicker({ selected, title, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const list = q ? CATS.filter((c) => t(c.label).toLowerCase().includes(q) || c.id.includes(q)) : CATS;

  return (
    <Modal className="cat-picker" labelledBy="cat-picker-title" onClose={onClose}>
        <header className="modal-head">
          <div>
            <h2 id="cat-picker-title">{title ?? t('Choose an icon')}</h2>
            <p className="muted small">{t('{n} cats in the library', { n: CATS.length })}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title={t('Close (Esc)')}><IconX size={18} /></button>
        </header>
        <div className="modal-body">
          <input type="search" autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Filter: report, code, warning…')} aria-label={t('Filter')} />
          <ul className="cat-grid">
            {list.map((c) => (
              <li key={c.id}>
                <button type="button" className={`cat-cell${c.id === selected ? ' on' : ''}`} aria-pressed={c.id === selected} title={t(c.label)}
                  onClick={() => { onPick(c.id); onClose(); }}>
                  <CatIcon id={c.id} size={64} />
                  <span>{t(c.label)}</span>
                </button>
              </li>
            ))}
          </ul>
          {!list.length && <p className="muted small">{t('No icon matches.')}</p>}
        </div>
    </Modal>
  );
}
