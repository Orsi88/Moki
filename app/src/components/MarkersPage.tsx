// Settings › Markers: the workspace's markers, the icons put on comments and passages of documents, each with a name
// and what it means (the AIs read the meanings too). Added, edited, reordered and removed here; saved together.
import { useEffect, useState } from 'react';
import { api, type Marker } from '../api';
import { t } from '../i18n';
import { confirmDialog } from '../dialogs';
import { markersChanged, useMarkers } from '../markers';
import { IconX } from './Icons';

const SUGGESTED = ['⭐', '🔍', '➕', '⚠️', '✅', '❓', '📌', '🔥', '💡', '🧪', '🐞', '📝', '🚧', '❌', '👀', '🎯'];

export function MarkersPage() {
  const saved = useMarkers();
  const [draft, setDraft] = useState<Marker[]>(saved);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(saved); }, [saved]);
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const edit = (i: number, patch: Partial<Marker>) => { setNotice(''); setDraft((d) => d.map((m, j) => (j === i ? { ...m, ...patch } : m))); };
  const move = (i: number, by: -1 | 1) => setDraft((d) => { const next = [...d]; const [m] = next.splice(i, 1); next.splice(i + by, 0, m); return next; });
  const add = () => { const used = new Set(draft.map((m) => m.icon)); setNotice(''); setDraft((d) => [...d, { id: '', icon: SUGGESTED.find((s) => !used.has(s)) ?? '🏷️', name: '', meaning: '' }]); };
  const remove = async (i: number) => {
    if (!await confirmDialog(t('Remove the marker "{name}"? Comments that already carry it keep it in their text.', { name: draft[i].name || draft[i].icon }), { danger: true })) return;
    setNotice(''); setDraft((d) => d.filter((_, j) => j !== i));
  };
  const save = async () => {
    if (draft.some((m) => !m.icon.trim() || !m.name.trim())) { setError(t('Every marker needs an icon and a name.')); return; }
    if (new Set(draft.map((m) => m.icon.trim())).size !== draft.length) { setError(t('Two markers cannot share the same icon.')); return; }
    setBusy(true); setError('');
    try { markersChanged(await api.saveMarkers(draft)); setNotice(t('Markers saved.')); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <div className="settings-markers">
      <h1>{t('Markers')}</h1>
      <p className="muted">{t('Icons you put on comments and passages of your documents. The AIs read what each one means, so you can ask them to act on what you marked.')}</p>
      {error && <p className="result warn" role="alert">{error}</p>}
      {notice && <p className="result" role="status">{notice}</p>}
      <ol className="marker-rows">
        {draft.map((m, i) => (
          <li key={i} className="marker-row">
            <input className="marker-icon-field" value={m.icon} maxLength={16} aria-label={t('Icon')} list="marker-icons" onChange={(e) => edit(i, { icon: e.target.value.trim() })} />
            <label className="marker-field"><span>{t('Name')}</span><input value={m.name} maxLength={40} placeholder={t('For example: To review')} onChange={(e) => edit(i, { name: e.target.value })} /></label>
            <label className="marker-field wide"><span>{t('What it means')}</span><input value={m.meaning} maxLength={200} placeholder={t('For example: needs to be checked before it is relied on')} onChange={(e) => edit(i, { meaning: e.target.value })} /></label>
            <div className="marker-row-actions">
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title={t('Move up')} aria-label={t('Move {name} up', { name: m.name || m.icon })}>↑</button>
              <button type="button" className="icon-btn" disabled={i === draft.length - 1} onClick={() => move(i, 1)} title={t('Move down')} aria-label={t('Move {name} down', { name: m.name || m.icon })}>↓</button>
              <button type="button" className="icon-btn" onClick={() => { void remove(i); }} title={t('Remove')} aria-label={t('Remove {name}', { name: m.name || m.icon })}><IconX size={15} /></button>
            </div>
          </li>
        ))}
      </ol>
      <datalist id="marker-icons">{SUGGESTED.map((s) => <option key={s} value={s} />)}</datalist>
      <div className="marker-footer">
        <button type="button" className="btn btn-ghost" disabled={draft.length >= 30} onClick={add}>{t('Add a marker')}</button>
        <span className="muted small">{changed ? t('Unsaved changes') : t('All changes saved')}</span>
        <button type="button" className="btn" disabled={busy || !changed} onClick={() => { void save(); }}>{busy ? t('Saving…') : t('Save markers')}</button>
      </div>
    </div>
  );
}
