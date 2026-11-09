// Copying a reference never edits a comment; failures and successful copies are visible beside it.
import { useState } from 'react';
import { api } from '../api';
import { projectLink } from '../internal-links';
import { t } from '../i18n';
import { IconCopy } from './Icons';

export function CopyCommentLink({ path, id }: { path: string; id: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const copy = () => {
    setError('');
    api.copyText(projectLink(path, { kind: 'comment', id })).then(() => setCopied(true)).catch((e: Error) => setError(e.message));
  };
  return <>
    <button type="button" className="link-btn" title={t('Copy link to comment')} aria-label={t('Copy link to comment')} onClick={copy} onBlur={() => setCopied(false)}>
      <IconCopy size={13} /> {copied ? t('Copied') : t('Copy link')}
    </button>
    {error && <span role="alert" className="small">{t(error)}</span>}
  </>;
}
