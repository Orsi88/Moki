// What the catalogs share (activities, agents, AI tools, operations): the dialog frame with its
// header and Esc, the search field, and the match rule of that search. One place, so every
// "choose one" list in the project panel looks and searches the same way.

import type { ReactNode } from 'react';
import { t } from '../i18n';
import { IconX } from './Icons';
import { Modal } from './Modal';

// A search matches when every typed word is somewhere in the given fields (no accents or case rules beyond lower case).
export const matchesQuery = (query: string, ...fields: string[]): boolean => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const text = fields.join(' ').toLowerCase();
  return words.every((w) => text.includes(w));
};

export function SearchField({ value, onChange, placeholder, autoFocus }: { value: string; onChange: (value: string) => void; placeholder: string; autoFocus?: boolean }) {
  return <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoFocus={autoFocus} />;
}

interface Props {
  titleId: string;
  title: string;
  hint?: string;
  onClose: () => void;
  search?: { value: string; onChange: (value: string) => void; placeholder: string };
  children: ReactNode;
}

export function CatalogModal({ titleId, title, hint, onClose, search, children }: Props) {
  return (
    <Modal className="catalog" labelledBy={titleId} onClose={onClose}>
        <header className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {hint && <p className="muted small">{hint}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title={t('Close (Esc)')}><IconX size={18} /></button>
        </header>
        <div className="modal-body">
          {search && <div className="catalog-search"><SearchField {...search} autoFocus /></div>}
          {children}
        </div>
    </Modal>
  );
}
