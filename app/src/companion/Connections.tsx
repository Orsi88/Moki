// Connection details are shown on demand; the main activity form keeps a single start action.
import { useEffect, useRef, useState } from 'react';
import type { McpProbe } from '../api';
import type { IdeConnections } from '../../../ide/companion-types';
import { t } from '../i18n';
import { call } from './bridge';

function configurationLabel(value: IdeConnections['configuration']): string {
  switch (value) {
    case 'automatic': return t('Registered with VS Code');
    case 'current': return t('Configuration up to date');
    case 'missing': return t('Connection needed');
    case 'outdated': return t('Update connection');
    case 'invalid': return t('Configuration could not be read');
  }
}

export function Connections({ value, onChange, onClose }: { value: IdeConnections; onChange: (value: IdeConnections) => void; onClose: () => void }) {
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [results, setResults] = useState<Record<string, McpProbe>>({});
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const perform = async (key: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(key); setNotice('');
    try { await work(); } catch (e) { if (live.current) setNotice(e instanceof Error ? e.message : String(e)); }
    finally { if (live.current) setBusy(''); }
  };
  const connect = () => perform('connect', async () => {
    if (!value.ai || value.ai === 'copilot') return;
    const result = await call<{ cancelled: boolean; skipped?: string[] }>('connectTool', value.ai);
    if (!live.current || result.cancelled) return;
    const next = await call<IdeConnections>('connections');
    if (!live.current) return;
    onChange(next);
    setNotice(result.skipped?.length ? t('Some settings are not supported: {list}', { list: result.skipped.join(', ') }) : t('Connection settings updated. Authenticate in the AI if requested.'));
  });
  const test = (id: string) => perform(id, async () => {
    const result = await call<McpProbe>('testMcp', id);
    if (live.current) setResults((old) => ({ ...old, [id]: result }));
  });
  return <section className="mk-connections" aria-label={t('Connections')}>
    <div className="mk-connection-head"><strong>{t('Connections')}</strong><button type="button" className="link" onClick={onClose}>{t('Done')}</button></div>
    <p className="muted small">{value.workspace} · {value.folder || t('No workspace folder selected')}</p>
    {value.ai && <p className="small">{configurationLabel(value.configuration)}</p>}
    <div className="mk-connection-actions">
      <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(busy)} onClick={() => { void perform('folder', async () => {
        const next = await call<IdeConnections>('chooseFolder'); if (live.current) onChange(next);
      }); }}>{t('Choose folder')}</button>
      {value.ai && value.ai !== 'copilot' && <button type="button" className="btn btn-ghost btn-sm" disabled={Boolean(busy)} onClick={() => { void connect(); }}>{t('Connect MCPs')}</button>}
    </div>
    {notice && <p className="small" role="status">{t(notice)}</p>}
    <p className="muted small">{t('These checks test the server. Availability and sign-in in your AI are managed by that AI.')}</p>
    <ul className="mk-server-list">{value.servers.map((server) => <li key={server.id}>
      <div className="mk-server-head"><strong>{server.name}</strong><button type="button" className="link" disabled={Boolean(busy)} onClick={() => { void test(server.id); }}>{busy === server.id ? t('Testing…') : t('Test')}</button></div>
      {server.authentication && <span className="small">{t('Sign in through the selected AI.')}</span>}
      {server.issues.map((issue) => <p className="small mk-issue" key={issue}>{t(issue)}</p>)}
      {results[server.id] && <p className={`small${results[server.id].ok ? '' : ' mk-issue'}`} role="status">{results[server.id].ok
        ? t('Server responded: {n} tools · {time}', { n: results[server.id].tools.length, time: new Date(results[server.id].at).toLocaleTimeString() })
        : results[server.id].error}</p>}
    </li>)}</ul>
  </section>;
}
