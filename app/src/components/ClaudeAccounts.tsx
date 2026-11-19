// The Claude account Moki uses (desktop/claude-profiles.ts): each Claude Code profile with its e-mail, the active one
// marked. Every Claude Moki starts afterwards uses it; one already running keeps its own. Settings › My AIs shows the
// full list with "Add account" (a new profile, then Claude opens in a terminal to sign in); the status bar's Usage
// shows the quick switch only when there is more than one account.

import { useEffect, useState, type FormEvent } from 'react';
import { api, type ClaudeProfile } from '../api';
import { t } from '../i18n';
import { IconPlus } from './Icons';

interface Props {
  compact?: boolean; // the status bar's quick switch: only the choice, and nothing with a single account
  onChanged?: () => void; // the account changed (the usage is read again)
  onSignIn?: () => void; // a new account was made: open Claude so the person signs in
}

export function ClaudeAccounts({ compact, onChanged, onSignIn }: Props) {
  const [profiles, setProfiles] = useState<ClaudeProfile[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api.claudeProfiles().then(setProfiles).catch((e: Error) => setError(e.message)); }, []);

  const run = async (call: () => Promise<ClaudeProfile[]>, after?: () => void) => {
    setBusy(true); setError('');
    try { setProfiles(await call()); onChanged?.(); after?.(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; }
    finally { setBusy(false); }
  };
  const use = (id: string) => { void run(() => api.useClaudeProfile(id)); };
  const add = (e: FormEvent) => {
    e.preventDefault();
    void run(() => api.addClaudeProfile(name), () => { setAdding(false); setName(''); onSignIn?.(); });
  };

  if (!profiles || (compact && profiles.length < 2)) return compact ? null : error ? <p className="error small" role="alert">{t(error)}</p> : null;
  const list = (
    <div className={`choice-grid claude-accounts${compact ? ' compact' : ''}`} role="radiogroup" aria-label={t('Claude account')}>
      {profiles.map((p) => (
        <label key={p.id} className={`choice${p.active ? ' on' : ''}`} title={p.id}>
          <input type="radio" name={compact ? 'claude-account-quick' : 'claude-account'} checked={p.active} disabled={busy} onChange={() => use(p.id)} />
          <span className="choice-title">{p.name}</span>
          {!compact && <span className="choice-hint">{p.signedIn ? `~/${p.id}` : t('Not signed in yet: open Claude to sign in')}</span>}
        </label>
      ))}
    </div>
  );
  if (compact) return <section className="usage-card"><div className="usage-card-title"><strong>{t('Claude account')}</strong></div>{list}{error && <p className="error small" role="alert">{t(error)}</p>}</section>;

  return (
    <section className="claude-accounts-section">
      <h3>{t('Claude account')}</h3>
      <p className="muted small">{t('Every Claude that Moki opens from now on uses this account. A Claude already running keeps the account it started with.')}</p>
      {list}
      {adding
        ? <form className="claude-account-add" onSubmit={add}>
          <input autoFocus aria-label={t('Account name')} placeholder={t('Account name, e.g. work')} value={name} maxLength={40} disabled={busy} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setAdding(false); setName(''); } }} />
          <button className="btn btn-sm" type="submit" disabled={busy || !name.trim()}>{t('Create and sign in')}</button>
          <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => { setAdding(false); setName(''); }}>{t('Cancel')}</button>
        </form>
        : <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAdding(true)}><IconPlus size={14} />{t('Add account')}</button>}
      {error && <p className="error small" role="alert">{t(error)}</p>}
    </section>
  );
}
