import { useState } from 'react';
import { api } from '../api';
import { t } from '../i18n';

export function LegacyOffice({ project, path, onConverted }: { project: string; path: string; onConverted: (path: string) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <div className="legacy-office">
    <p>{t('Convert to an editable copy with Microsoft Office or LibreOffice. The original file is kept.')}</p>
    <button type="button" className="btn" disabled={busy} onClick={() => {
      setBusy(true); setError('');
      api.convertOffice(project, path).then(onConverted).catch((e: Error) => setError(e.message)).finally(() => setBusy(false));
    }}>{busy ? t('Converting…') : t('Convert and edit a copy')}</button>
    {error && <p role="alert" className="error">{t(error)}</p>}
  </div>;
}
