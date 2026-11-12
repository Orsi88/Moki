import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { t } from '../i18n';

// One conversion per file, even if the view mounts twice.
const pending = new Map<string, Promise<{ path: string; created: boolean }>>();
const convertOnce = (project: string, path: string) => {
  const key = `${project}\0${path}`;
  const current = pending.get(key);
  if (current) return current;
  const job = api.convertOffice(project, path).finally(() => pending.delete(key));
  pending.set(key, job);
  return job;
};

export function LegacyOffice({ project, path, onConverted }: { project: string; path: string; onConverted: (path: string, created: boolean) => void }) {
  const [busy, setBusy] = useState(true), [error, setError] = useState('');
  const done = useRef(onConverted);
  done.current = onConverted;
  useEffect(() => {
    let live = true;
    setBusy(true); setError('');
    convertOnce(project, path).then((result) => done.current(result.path, result.created)).catch((e: Error) => { if (live) setError(e.message); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [project, path]);
  return <div className="legacy-office">
    {busy && <p>{t('Converting…')}</p>}
    {error && <p role="alert" className="error">{t(error)}</p>}
  </div>;
}
