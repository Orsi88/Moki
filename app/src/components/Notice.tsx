// A notice above a document: a short title that says what is going on, one line of detail, the actions it offers
// and, when it is only information, a close button. 'warn' asks for attention (a conflict, a failure); 'info' explains.

import type { ReactNode } from 'react';
import { t } from '../i18n';
import { IconAlert, IconInfo, IconX } from './Icons';

interface Props {
  tone?: 'info' | 'warn';
  title: string;
  children?: ReactNode; // the detail
  actions?: ReactNode;
  onClose?: () => void;
  className?: string;
}

export function Notice({ tone = 'info', title, children, actions, onClose, className = '' }: Props) {
  return (
    <div className={`doc-notice doc-notice-${tone}${className ? ` ${className}` : ''}`} role={tone === 'warn' ? 'alert' : 'status'}>
      <span className="doc-notice-icon">{tone === 'warn' ? <IconAlert size={16} /> : <IconInfo size={16} />}</span>
      <div className="doc-notice-text">
        <strong>{title}</strong>
        {children && <span>{children}</span>}
      </div>
      {actions && <div className="doc-notice-actions">{actions}</div>}
      {onClose && <button type="button" className="icon-btn doc-notice-close" onClick={onClose} title={t('Close')} aria-label={t('Close')}><IconX size={14} /></button>}
    </div>
  );
}
