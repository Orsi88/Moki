// A marker on a comment: its badge (icon and name, the meaning on hover) and the picker of the workspace's markers.
import { useState } from 'react';
import type { Marker } from '../api';
import { t } from '../i18n';
import { splitMarker, withMarker } from '../markers';

type Shown = Pick<Marker, 'icon' | 'name'> & Partial<Marker>;

export function MarkerBadge({ marker }: { marker: Shown }) {
  return <span className="marker-badge" title={marker.meaning || marker.name}><span aria-hidden="true">{marker.icon}</span>{marker.name}</span>;
}

// One button per marker, and "No marker" when one is set. The current one is pressed.
export function MarkerPicker({ markers, value, onPick, disabled = false }: { markers: Marker[]; value: Shown | null; onPick: (marker: Marker | null) => void; disabled?: boolean }) {
  return <div className="marker-picker" role="radiogroup" aria-label={t('Marker')}>
    {markers.map((m) => <button key={m.id} type="button" role="radio" aria-checked={value?.icon === m.icon} className={`marker-choice${value?.icon === m.icon ? ' on' : ''}`}
      title={m.meaning ? `${m.name}: ${m.meaning}` : m.name} aria-label={m.name} disabled={disabled} onClick={() => onPick(m)}>{m.icon}</button>)}
    {value && <button type="button" className="link-btn marker-none" disabled={disabled} onClick={() => onPick(null)}>{t('No marker')}</button>}
    {!markers.length && <span className="muted small">{t('No markers yet: add them in Settings › Markers.')}</span>}
  </div>;
}

// The menu of a marker's icon in the margin: another marker, a comment for a marker without one, or no marker (a marker
// without a comment then goes away). `text` is the comment's whole text; onText saves a new one.
export function MarkerMenu({ markers, text, left, top, disabled = false, onText, onRemove, onClose }: {
  markers: Marker[]; text: string; left: number; top: number; disabled?: boolean;
  onText: (text: string) => void; onRemove: () => void; onClose: () => void;
}) {
  const [writing, setWriting] = useState<string | null>(null);
  const { marker, body } = splitMarker(text, markers);
  const only = !body.trim();
  return <div className="marker-menu" role="dialog" aria-label={t('Marker')} style={{ left, top }} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
    <MarkerPicker markers={markers} value={marker} disabled={disabled} onPick={(next) => {
      if (!next) { if (only) onRemove(); else onText(body); }
      else onText(withMarker(text, next, markers));
      onClose();
    }} />
    {only && writing === null && <button type="button" className="link-btn" disabled={disabled} onClick={() => setWriting('')}>{t('Add a comment')}</button>}
    {only && writing !== null && <div className="pdf-edit">
      <textarea autoFocus rows={3} value={writing} placeholder={t('Your comment')} onChange={(e) => setWriting(e.target.value)} />
      <div className="pdf-actions">
        <button type="button" className="btn btn-sm" disabled={disabled || !writing.trim()} onClick={() => { onText(withMarker(writing.trim(), marker, markers)); onClose(); }}>{t('Save')}</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onClose}>{t('Cancel')}</button>
      </div>
    </div>}
  </div>;
}

// The right-click menu on a selection: one line per marker; a click marks the selection with it, no box to fill.
export function MarkerContextMenu({ markers, left, top, onPick, onClose, onComment }: { markers: Marker[]; left: number; top: number; onPick: (marker: Marker) => void; onClose: () => void; onComment?: () => void }) {
  return <div className="menu-backdrop marker-context-backdrop" onMouseDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
    <ul className="term-menu marker-context" role="menu" aria-label={t('Mark with')} style={{ left, top }} onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      {onComment && <li><button type="button" role="menuitem" autoFocus onClick={() => { onClose(); onComment(); }}><span className="marker-context-icon" aria-hidden="true">💬</span>{t('Comment…')}</button></li>}
      <li className="marker-context-title" role="presentation">{t('Mark with')}</li>
      {markers.map((m, i) => <li key={m.id}><button type="button" role="menuitem" autoFocus={!onComment && i === 0} onClick={() => { onPick(m); onClose(); }} title={m.meaning}>
        <span className="marker-context-icon" aria-hidden="true">{m.icon}</span>{m.name}</button></li>)}
      {!markers.length && <li className="muted small marker-context-title">{t('No markers yet: add them in Settings › Markers.')}</li>}
    </ul>
  </div>;
}
