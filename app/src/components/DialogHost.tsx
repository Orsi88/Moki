// Shared, queued confirmations and notices. Cancel receives initial focus, especially for destructive actions.

import { useId, useSyncExternalStore } from 'react';
import { currentDialog, resolveDialog, subscribeDialogs } from '../dialogs';
import { t, useLang } from '../i18n';
import { IconInfo, IconX } from './Icons';
import { Modal } from './Modal';

export function DialogHost() {
  useLang();
  const dialog = useSyncExternalStore(subscribeDialogs, currentDialog, () => null);
  const titleId = useId();
  const messageId = useId();
  if (!dialog) return null;
  const { id, kind, message, options } = dialog;
  const close = () => resolveDialog(id, false);
  return (
    <Modal key={id} size="compact" className={`message-dialog${options.danger ? ' message-danger' : ''}`} role="alertdialog"
      labelledBy={titleId} describedBy={messageId} onClose={close} blockShortcuts>
      <header className="modal-head">
        <span className="dialog-symbol" aria-hidden="true"><IconInfo size={21} /></span>
        <h2 id={titleId}>{options.title ?? (kind === 'confirm' ? t('Confirm action') : t('Notice'))}</h2>
        <button type="button" className="icon-btn" onClick={close} title={t('Close (Esc)')} aria-label={t('Close (Esc)')}><IconX size={18} /></button>
      </header>
      <div className="modal-body"><p id={messageId} className="dialog-message">{message}</p></div>
      <footer className="modal-foot">
        {kind === 'confirm' && <button type="button" className="btn btn-ghost" data-dialog-focus onClick={close}>{options.cancelLabel ?? t('Cancel')}</button>}
        <button type="button" className={`btn${options.danger ? ' btn-danger' : ''}`} data-dialog-focus={kind === 'alert' ? true : undefined}
          onClick={() => resolveDialog(id, true)}>{options.confirmLabel ?? (kind === 'confirm' ? t('Continue') : t('Close'))}</button>
      </footer>
    </Modal>
  );
}
