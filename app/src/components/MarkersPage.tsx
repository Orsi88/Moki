// Settings › Markers: the workspace's markers, the icons put on comments and passages of documents, each with a name
// and what it means (the AIs read the meanings too). Added, edited, reordered and removed here; saved together.
import { useEffect, useState } from 'react';
import { api, type Marker } from '../api';
import { t } from '../i18n';
import { confirmDialog } from '../dialogs';
import { markerColor, markersChanged, useMarkers } from '../markers';
import { MARKER_COLORS } from '../../../scripts/lib/marker-labels.ts';
import { SWATCH } from '../md-comments';
import { colorName } from './CommentColors';
import { IconX } from './Icons';
import { EmojiPicker } from './EmojiPicker';

const SUGGESTED = ['⭐', '🔍', '➕', '⚠️', '✅', '❓', '📌', '🔥', '💡', '🧪', '🐞', '📝', '🚧', '❌', '👀', '🎯'];

// The field keeps one icon: the emoji just chosen or typed (the last one in the field), never two side by side.
function lastEmoji(value: string, previous: string): string {
  const parts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value.trim())].map((p) => p.segment);
  if (!parts.length) return '';
  const fresh = parts.filter((p) => p !== previous);
  return (fresh.length ? fresh[fresh.length - 1] : parts[parts.length - 1]).slice(0, 16);
}

export function MarkersPage() {
  const saved = useMarkers();
  const [draft, setDraft] = useState<Marker[]>(saved);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState<number | null>(null); // the row whose emoji picker is open
  useEffect(() => { setDraft(saved); }, [saved]);
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const edit = (i: number, patch: Partial<Marker>) => { setNotice(''); setDraft((d) => d.map((m, j) => (j === i ? { ...m, ...patch } : m))); };
  const move = (i: number, by: -1 | 1) => setDraft((d) => { const next = [...d]; const [m] = next.splice(i, 1); next.splice(i + by, 0, m); return next; });
  const add = () => { const used = new Set(draft.map((m) => m.icon)); const colors = new Set(draft.map((m) => markerColor(m))); setNotice(''); setDraft((d) => [...d, { id: '', icon: SUGGESTED.find((s) => !used.has(s)) ?? '🏷️', name: '', meaning: '', color: MARKER_COLORS.find((c) => !colors.has(c)) ?? 'yellow' }]); };
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
            {/* A click opens Moki's emoji picker (emojis only, with search); typing or pasting an emoji works too. */}
            <span className="marker-icon-wrap">
              <input className="marker-icon-field" value={m.icon} aria-label={t('Icon')} title={t('Click to choose an emoji')}
                onClick={() => setPicking(picking === i ? null : i)}
                onChange={(e) => edit(i, { icon: lastEmoji(e.target.value, m.icon) })} />
              {picking === i && <EmojiPicker onPick={(emoji) => { edit(i, { icon: emoji }); setPicking(null); }} onClose={() => setPicking(null)} />}
            </span>
            <label className="marker-field"><span>{t('Name')}</span><input value={m.name} maxLength={40} placeholder={t('For example: To review')} onChange={(e) => edit(i, { name: e.target.value })} /></label>
            <div className="marker-field marker-colors"><span>{t('Color')}</span>
              <div className="pdf-colors" role="radiogroup" aria-label={t('Color of {name}', { name: m.name || m.icon })}>
                {MARKER_COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={markerColor(m) === c} className={`pdf-color${markerColor(m) === c ? ' on' : ''}`} title={colorName(c)} aria-label={colorName(c)} style={{ background: SWATCH[c] }} onClick={() => edit(i, { color: c })} />)}
              </div>
            </div>
            <label className="marker-field wide"><span>{t('What it means')}</span><input value={m.meaning} maxLength={200} placeholder={t('For example: needs to be checked before it is relied on')} onChange={(e) => edit(i, { meaning: e.target.value })} /></label>
            <div className="marker-row-actions">
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title={t('Move up')} aria-label={t('Move {name} up', { name: m.name || m.icon })}>↑</button>
              <button type="button" className="icon-btn" disabled={i === draft.length - 1} onClick={() => move(i, 1)} title={t('Move down')} aria-label={t('Move {name} down', { name: m.name || m.icon })}>↓</button>
              <button type="button" className="icon-btn" onClick={() => { void remove(i); }} title={t('Remove')} aria-label={t('Remove {name}', { name: m.name || m.icon })}><IconX size={15} /></button>
            </div>
          </li>
        ))}
      </ol>
      <div className="marker-footer">
        <button type="button" className="btn btn-ghost" disabled={draft.length >= 30} onClick={add}>{t('Add a marker')}</button>
        <span className="muted small">{changed ? t('Unsaved changes') : t('All changes saved')}</span>
        <button type="button" className="btn" disabled={busy || !changed} onClick={() => { void save(); }}>{busy ? t('Saving…') : t('Save markers')}</button>
      </div>
    </div>
  );
}
