// Claude artifacts (presentations, spreadsheets, pages) opened from a project chat answer. The address is checked
// here; desktop/artifact-viewer-host.ts shows it in an isolated browser view with the person's claude.ai sign-in.
// The chat itself always runs locally with project access (desktop/chat.ts): this is only a viewer for its links.

import { isArtifactUrl } from '../scripts/lib/artifact-links.ts';

// Pages the viewer may show: Claude and its sign-in (Google sign-in included). Anything else opens in the browser.
const HOSTS = ['claude.ai', 'claude.com', 'anthropic.com', 'accounts.google.com'];

export interface ViewerBounds { x: number; y: number; width: number; height: number }
export interface ViewerStatus { url: string; loading: boolean; error: string }

const parse = (value: unknown): URL | null => {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') ? url : null;
  } catch { return null; }
};

// A page the viewer may navigate to (sign-in included).
export function isViewerUrl(value: unknown): boolean {
  const url = parse(value);
  return Boolean(url && HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)));
}

// A link the chat opens in the viewer (the same rule the window uses).
export { isArtifactUrl };

export function viewerBounds(value: unknown): ViewerBounds {
  if (!value || typeof value !== 'object') throw new Error('Invalid viewer area.');
  const b = value as Record<string, unknown>;
  if (!['x', 'y', 'width', 'height'].every((k) => typeof b[k] === 'number' && Number.isFinite(b[k]) && Number(b[k]) >= 0 && Number(b[k]) <= 20000)
    || Number(b.width) < 1 || Number(b.height) < 1) throw new Error('Invalid viewer area.');
  return { x: Math.round(Number(b.x)), y: Math.round(Number(b.y)), width: Math.round(Number(b.width)), height: Math.round(Number(b.height)) };
}
