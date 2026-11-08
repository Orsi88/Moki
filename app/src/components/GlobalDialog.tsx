// Opened from the start screen: the skills and agents installed for all
// projects, without opening a project first.

import { t } from '../i18n';
import { GlobalPanel } from './GlobalPanel';
import { IconX } from './Icons';
import { Modal } from './Modal';

interface Props { onClose: () => void }

export function GlobalDialog({ onClose }: Props) {
  return (
    <Modal labelledBy="global-title" onClose={onClose}>
        <header className="modal-head">
          <div>
            <h2 id="global-title">{t('Skills & agents for all projects')}</h2>
            <p className="muted small">{t('Installed in your user folder: every project and AI tool on this computer can use them. Removing moves them to the trash.')}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} title={t('Close (Esc)')}><IconX size={18} /></button>
        </header>
        <div className="modal-body">
          <GlobalPanel />
        </div>
        <footer className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t('Close')}</button>
        </footer>
    </Modal>
  );
}
