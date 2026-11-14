// A marker on a comment: its badge (icon and name, the meaning on hover) and the picker of the workspace's markers.
import type { Marker } from '../api';
import { t } from '../i18n';

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
