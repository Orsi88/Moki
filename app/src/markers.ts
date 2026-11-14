// The workspace's markers in the app: loaded once, shared by every comment column and the PDF, and reloaded when
// Settings › Markers saves them. The prefix rules are in scripts/lib/marker-labels.ts.
import { useEffect, useState } from 'react';
import { api, type Marker } from './api';
import { t } from './i18n';
export { markerLabel, markerOnly, splitMarker, withMarker } from '../../scripts/lib/marker-labels.ts';

const CHANGED = 'qa:markers-changed';
let cache: Marker[] | null = null;
let loading: Promise<Marker[]> | null = null;

// The starting set, in the person's language: written once, the first time the workspace's markers are read.
export const defaultMarkers = (): Marker[] => [
  { id: 'important', icon: '⭐', name: t('Important'), meaning: t('Matters most: read it first.') },
  { id: 'review', icon: '🔍', name: t('To review'), meaning: t('Needs to be checked before it is relied on.') },
  { id: 'complete', icon: '➕', name: t('To complete'), meaning: t('Something is missing here and has to be added.') },
  { id: 'attention', icon: '⚠️', name: t('Attention'), meaning: t('A risk, a doubt or a point that may be wrong.') },
  // A key of its own: "Done" alone is already a button's verb in the dictionaries.
  { id: 'done', icon: '✅', name: t('Done (marker)') === 'Done (marker)' ? 'Done' : t('Done (marker)'), meaning: t('Checked and settled.') },
];

function load(): Promise<Marker[]> {
  loading ??= api.markers(defaultMarkers()).then((list) => { cache = list; return list; }).catch(() => { cache = []; return []; }).finally(() => { loading = null; });
  return loading;
}

export function markersChanged(list: Marker[]): void {
  cache = list;
  window.dispatchEvent(new CustomEvent<Marker[]>(CHANGED, { detail: list }));
}

export function useMarkers(): Marker[] {
  const [list, setList] = useState<Marker[]>(cache ?? []);
  useEffect(() => {
    let live = true;
    if (!cache) void load().then((l) => { if (live) setList(l); });
    const follow = (e: Event) => setList((e as CustomEvent<Marker[]>).detail);
    window.addEventListener(CHANGED, follow);
    return () => { live = false; window.removeEventListener(CHANGED, follow); };
  }, []);
  return list;
}
