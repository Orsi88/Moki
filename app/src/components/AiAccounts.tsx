// The accounts Moki uses for each AI (desktop/ai-accounts.ts): Claude Code and Codex profiles, each with its e-mail,
// the one in use marked. Everything Moki starts afterwards uses the chosen one; a tool already running keeps its own.
// Settings › My AIs shows one block per installed AI with "Add account" (a new profile, then the AI opens in a
// terminal to sign in) and hiding an account from Moki (its folder stays); the status bar's Usage shows the quick
// switch for each AI with more than one account.

import { useEffect, useState, type FormEvent } from 'react';
import { api, type AiAccounts as Group } from '../api';
import { t } from '../i18n';
import { IconEyeOff, IconPlus } from './Icons';

interface Props {
  installed?: string[]; // the AI tools found on this computer: only their accounts show (all when not given)
  compact?: boolean; // the status bar's quick switch: only the choice, for AIs with more than one account
  onChanged?: () => void; // an account changed (the usage is read again)
  onSignIn?: (tool: string) => void; // a new account was made: open that AI so the person signs in
}

export function AiAccounts({ installed, compact, onChanged, onSignIn }: Props) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [adding, setAdding] = useState('');
  const [name, setName] = useState('');
  const [showHidden, setShowHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api.aiAccounts().then(setGroups).catch((e: Error) => setError(e.message)); }, []);

  const run = async (call: () => Promise<Group[]>, after?: () => void) => {
    setBusy(true); setError('');
    try { setGroups(await call()); onChanged?.(); after?.(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const add = (tool: string) => (e: FormEvent) => {
    e.preventDefault();
    void run(() => api.addAiAccount(tool, name), () => { setAdding(''); setName(''); onSignIn?.(tool); });
  };
  const cancel = () => { setAdding(''); setName(''); };
  const mine = (groups ?? []).filter((g) => !installed || installed.includes(g.tool));
  const failure = error ? <p className="error small" role="alert">{t(error)}</p> : null;

  if (compact) {
    const switchable = mine.map((g) => ({ ...g, accounts: g.accounts.filter((a) => !a.hidden) })).filter((g) => g.accounts.length > 1);
    if (!switchable.length) return null;
    return (
      <section className="usage-card">
        <div className="usage-card-title"><strong>{t('Accounts')}</strong></div>
        {switchable.map((g) => (
          <div key={g.tool} className="ai-accounts-quick">
            <span className="muted small">{g.label}</span>
            <div className="choice-grid ai-accounts compact" role="radiogroup" aria-label={t('{tool} account', { tool: g.label })}>
              {g.accounts.map((a) => (
                <label key={a.id} className={`choice${a.active ? ' on' : ''}`} title={a.id}>
                  <input type="radio" name={`account-quick-${g.tool}`} checked={a.active} disabled={busy} onChange={() => { void run(() => api.useAiAccount(g.tool, a.id)); }} />
                  <span className="choice-title">{a.name}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
        {failure}
      </section>
    );
  }

  if (!mine.length) return failure;
  return (
    <section className="ai-accounts-section">
      <h3>{t('Accounts')}</h3>
      <p className="muted small">{t('Everything Moki opens from now on uses the account chosen for each AI. An AI already running keeps the account it started with.')}</p>
      {mine.map((g) => {
        const hidden = g.accounts.filter((a) => a.hidden);
        const shown = showHidden.has(g.tool) ? g.accounts : g.accounts.filter((a) => !a.hidden);
        return (
          <div key={g.tool} className="ai-accounts-block">
            <h4>{g.label}</h4>
            <div className="choice-grid ai-accounts" role="radiogroup" aria-label={t('{tool} account', { tool: g.label })}>
              {shown.map((a) => (
                <div key={a.id} className={`ai-account${a.hidden ? ' is-hidden' : ''}`}>
                  <label className={`choice${a.active ? ' on' : ''}`} title={a.id}>
                    <input type="radio" name={`account-${g.tool}`} checked={a.active} disabled={busy} onChange={() => { void run(() => api.useAiAccount(g.tool, a.id)); }} />
                    <span className="choice-title">{a.name}</span>
                    <span className="choice-hint">{a.signedIn ? `~/${a.id}` : t('Not signed in yet: open the AI to sign in')}</span>
                  </label>
                  {!a.active && (
                    <button type="button" className="icon-btn ai-account-hide" disabled={busy} onClick={() => { void run(() => api.hideAiAccount(g.tool, a.id, !a.hidden)); }}
                      title={a.hidden ? t('Show in Moki again') : t('Hide from Moki (the account stays on this computer)')}
                      aria-label={a.hidden ? t('Show {account} in Moki again', { account: a.name }) : t('Hide {account} from Moki', { account: a.name })}>
                      <IconEyeOff size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="ai-accounts-actions">
              {adding === g.tool
                ? <form className="ai-account-add" onSubmit={add(g.tool)}>
                  <input autoFocus aria-label={t('Account name')} placeholder={t('Account name, e.g. work')} value={name} maxLength={40} disabled={busy}
                    onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }} />
                  <button className="btn btn-sm" type="submit" disabled={busy || !name.trim()}>{t('Create and sign in')}</button>
                  <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={cancel}>{t('Cancel')}</button>
                </form>
                : <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setAdding(g.tool); setName(''); }}>
                  <IconPlus size={14} />{t('Add {tool} account', { tool: g.label })}
                </button>}
              {hidden.length > 0 && adding !== g.tool && (
                <button type="button" className="link small" onClick={() => setShowHidden((s) => { const n = new Set(s); if (!n.delete(g.tool)) n.add(g.tool); return n; })}>
                  {showHidden.has(g.tool) ? t('Hide the hidden accounts') : t('Show hidden ({n})', { n: hidden.length })}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {failure}
    </section>
  );
}
