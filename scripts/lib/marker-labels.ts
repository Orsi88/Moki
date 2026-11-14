// Markers: icons the person puts on comments and passages of a document (⭐ Important, 🔍 To review…), each with a
// name and a meaning. The set is the workspace's (workspace/markers.json, read and written by markers.ts).
//
// A comment carries its marker as a prefix of its own text, "[🔍 To review] the value needs checking": it travels
// with the comment in every format (Markdown, Word, spreadsheets, PDF, HTML, diagrams), Word shows it as written,
// and an AI reads it without being told where to look. The app draws the prefix as a badge. Pure: the app uses it.

// color: one of the comment colors (yellow, green, blue, pink, orange, red, purple); a marked passage takes it.
export const MARKER_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange', 'red', 'purple'] as const;
export type MarkerColor = typeof MARKER_COLORS[number];
export interface Marker { id: string; icon: string; name: string; meaning: string; color?: MarkerColor }

// ---- The prefix on a comment's text ----

const PREFIX = /^\[([^\s\]]{1,16}) ([^\]\n]{1,40})\] ?/;
export const markerLabel = (m: Pick<Marker, 'icon' | 'name'>): string => `[${m.icon} ${m.name}]`;

// The marker a comment's text starts with (matched to the set by its icon, or by its name when the icon changed),
// and the text without it. A prefix of a marker no longer in the set still shows, as written.
export function splitMarker(text: string, markers: Marker[]): { marker: Pick<Marker, 'icon' | 'name'> & Partial<Marker> | null; body: string } {
  const m = PREFIX.exec(text);
  if (!m) return { marker: null, body: text };
  const [, icon, name] = m;
  const known = markers.find((x) => x.icon === icon) ?? markers.find((x) => x.name.toLowerCase() === name.trim().toLowerCase());
  return { marker: known ?? { icon, name: name.trim() }, body: text.slice(m[0].length) };
}

// The comment's text with this marker (or none) in front, whatever marker it had.
export function withMarker(text: string, marker: Pick<Marker, 'icon' | 'name'> | null, markers: Marker[]): string {
  const { body } = splitMarker(text, markers);
  return marker ? `${markerLabel(marker)} ${body}` : body;
}

// A passage marked without a comment: a comment whose text is only the marker. The app shows it as a marker.
export function markerOnly(text: string, markers: Marker[]): boolean {
  const { marker, body } = splitMarker(text, markers);
  return Boolean(marker) && !body.trim();
}

// What an AI is told about markers, in plain ASCII (Windows command lines would otherwise send the request through a
// file): where the set is and how a marked comment or passage reads. The icons and meanings are in that file.
export function markersForAi(file: string): string {
  return `I mark comments and passages with markers, listed with their meaning in ${file}: a comment whose text starts with "[icon name]" carries that marker, and a comment whose text is only that label marks its passage without commenting on it. Keep markers as they are when you edit a document; act on them when I ask.`;
}
