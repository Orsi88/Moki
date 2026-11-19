// An agent's, skill's or activity's evolution (Mycroft, scripts/lib/evolution.ts), on its page in Settings: the
// change Mycroft proposes (what changes, why, in the person's words) with Approve and Decline; what the person
// taught it; its history - every version, the difference between two, "Go back to this version" and "Restore the
// original". Only a click here changes which version is in use: no AI can.

import { useCallback, useEffect, useState } from 'react';
import { api, type DiffLine, type Evolution, type EvolutionKind, type VersionEntry } from '../api';
import { t } from '../i18n';

interface Props { kind: EvolutionKind; name: string; project?: string }

export function EvolutionPanel({ kind, name, project }: Props) {
  const [data, setData] = useState<Evolution | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [diff, setDiff] = useState<{ title: string; lines: DiffLine[] } | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null); // the version a "go back" waits to be confirmed for
  const [lesson, setLesson] = useState('');
  const load = useCallback(() => { api.evolution(kind, name, project).then(setData).catch((e: Error) => setError(e.message)); }, [kind, name, project]);
  useEffect(load, [load]);
  // After each change the bell recounts what waits for the person.
  const act = async (work: () => Promise<Evolution>) => {
    setBusy(true); setError('');
    try { setData(await work()); setConfirm(null); setDiff(null); window.dispatchEvent(new Event('qa:notifications-read')); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  if (!data) return error ? <p className="error small" role="alert">{t(error)}</p> : null;

  const when = (at: string) => new Date(at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  const versions = [...new Set(data.entries.map((e) => e.version))];
  const describe = (e: VersionEntry) => e.event === 'restore' ? t('Original restored')
    : e.event === 'revert' ? t('Back to version {n}', { n: e.from ?? 0 })
    : e.proposedBy === 'mycroft' ? t('Proposed by Mycroft') : t('Your change');
  const showDiff = async (from: number, to: number, title: string) => {
    try { setDiff({ title, lines: await api.evolutionDiff(kind, name, from, to) }); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <section className="agent-card evolution-card" aria-label={t('Evolution')}>
      <div className="agent-card-head">
        <h2>{t('Evolution')}</h2>
        <span className={`chip${data.active ? ' chip-accent' : ''}`}>{data.active ? t('Version {n} in use', { n: data.active }) : t('Original in use')}</span>
      </div>
      <p className="muted small">{t('Mycroft turns what you teach into new versions you approve here. Every version stays in the history, and the original can always be restored.')}</p>
      {error && <p className="error small" role="alert">{t(error)}</p>}

      {data.originalChanged && (
        <p className="result warn evolution-note" role="status">{t('Moki brought a newer version of this item. Your changes are over the earlier one: ask Mycroft to carry them over to the new version.')}</p>
      )}

      {data.proposal && (
        <div className="evolution-proposal">
          <h3>{t('Waiting for you: a change proposed by Mycroft')}</h3>
          <p>{data.proposal.reason}</p>
          {data.proposal.learnings.length > 0 && <ul className="evolution-quotes">{data.proposal.learnings.map((q) => <li key={q}>“{q}”</li>)}</ul>}
          <Diff lines={data.proposal.diff} />
          <div className="evolution-actions">
            <button type="button" className="btn" disabled={busy} onClick={() => { void act(() => api.approveVersion(kind, name, data.proposal!.id, project)); }}>{t('Approve')}</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => { void act(() => api.declineVersion(kind, name, data.proposal!.id)); }}>{t('Decline')}</button>
          </div>
        </div>
      )}

      <div className="evolution-block">
        <h3>{t('What you taught it')}</h3>
        {data.learnings.length > 0
          ? <ul className="evolution-learnings">{data.learnings.map((l) => (
            <li key={l.id}><span>“{l.text}”{l.scope === 'project' && <span className="muted small"> · {t('only this project')}</span>}</span>
              <button type="button" className="link small" disabled={busy} onClick={() => { void act(() => api.dismissTeaching(kind, name, l.id, project)); }}>{t('Dismiss')}</button></li>
          ))}</ul>
          : <p className="muted small">{t('Nothing waiting. Say it in a conversation ("next time, do it like this") or write it here.')}</p>}
        <form className="evolution-teach" onSubmit={(e) => { e.preventDefault(); if (lesson.trim()) void act(() => api.teach(kind, name, lesson, project)).then(() => setLesson('')); }}>
          <input value={lesson} maxLength={2000} disabled={busy} aria-label={t('Teach this item something')} placeholder={t('Teach this item something…')} onChange={(e) => setLesson(e.target.value)} />
          <button type="submit" className="btn btn-ghost btn-sm" disabled={busy || !lesson.trim()}>{project ? t('Teach (this project)') : t('Teach')}</button>
        </form>
      </div>

      {data.entries.length > 0 && (
        <div className="evolution-block">
          <h3>{t('History')}</h3>
          <ol className="evolution-history" reversed>
            {[...data.entries].reverse().map((e, i) => {
              const inUse = e.version === data.active && i === 0;
              const before = e.event === 'revert' || e.event === 'restore' ? null : Math.max(0, ...versions.filter((v) => v < e.version));
              return (
                <li key={`${e.version}-${e.at}`} className={inUse ? 'in-use' : ''}>
                  <div className="evolution-entry">
                    <strong>{e.version ? t('Version {n}', { n: e.version }) : t('Original')}</strong>
                    <span className="muted small">{describe(e)} · {when(e.at)}{inUse && ` · ${t('in use')}`}</span>
                  </div>
                  {e.reason && <p className="small">{e.reason}</p>}
                  <div className="evolution-actions">
                    {before !== null && e.version > 0 && <button type="button" className="link small" onClick={() => { void showDiff(before, e.version, t('Version {n}: what changed', { n: e.version })); }}>{t('View the difference')}</button>}
                    {!inUse && e.version > 0 && e.version !== data.active && (confirm === e.version
                      ? <><button type="button" className="btn btn-sm" disabled={busy} onClick={() => { void act(() => api.revertVersion(kind, name, e.version, project)); }}>{t('Confirm: use version {n}', { n: e.version })}</button>
                        <button type="button" className="link small" onClick={() => setConfirm(null)}>{t('Cancel')}</button></>
                      : <button type="button" className="link small" disabled={busy} onClick={() => setConfirm(e.version)}>{t('Go back to this version')}</button>)}
                  </div>
                </li>
              );
            })}
          </ol>
          {data.active > 0 && (
            <div className="evolution-actions">
              {confirm === 0
                ? <><button type="button" className="btn btn-sm" disabled={busy} onClick={() => { void act(() => api.revertVersion(kind, name, 0, project)); }}>{t('Confirm: restore the original')}</button>
                  <button type="button" className="link small" onClick={() => setConfirm(null)}>{t('Cancel')}</button></>
                : <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirm(0)}
                  title={data.builtin ? t("Use Moki's own version again; your versions stay in the history.") : t('Bring back its text from before the first change; your versions stay in the history.')}>{t('Restore the original')}</button>}
              <button type="button" className="link small" onClick={() => { void showDiff(0, data.active, t('In use compared with the original')); }}>{t('Compare with the original')}</button>
            </div>
          )}
        </div>
      )}

      {diff && (
        <div className="evolution-block">
          <div className="evolution-entry"><h3>{diff.title}</h3><button type="button" className="link small" onClick={() => setDiff(null)}>{t('Close')}</button></div>
          <Diff lines={diff.lines} />
        </div>
      )}
    </section>
  );
}

// What changes, line by line: removed in red, added in green, a few unchanged lines around each change.
function Diff({ lines }: { lines: DiffLine[] }) {
  const near = new Set<number>();
  lines.forEach((l, i) => { if (l.kind !== 'same') for (let k = i - 2; k <= i + 2; k++) near.add(k); });
  const shown = lines.map((l, i) => ({ ...l, i })).filter((l) => near.has(l.i));
  return (
    <pre className="evolution-diff" aria-label={t('Difference')}>
      {shown.map((l, n) => (
        <span key={l.i} className={`diff-${l.kind}`}>
          {n > 0 && shown[n - 1].i !== l.i - 1 && <span className="diff-gap">…{'\n'}</span>}
          {l.kind === 'added' ? '+ ' : l.kind === 'removed' ? '− ' : '  '}{l.text}{'\n'}
        </span>
      ))}
    </pre>
  );
}
