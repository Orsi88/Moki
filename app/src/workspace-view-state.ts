// Persisted document-tab state for one workspace project. It stores view
// metadata only; file contents and unsaved drafts never enter localStorage.

import { recall, remember } from './prefs';

export type SavedDocMode = 'preview' | 'edit' | 'source';

export interface SavedDocTab {
  path: string;
  mode: SavedDocMode;
  scrollTop: number;
}

export interface WorkspaceViewState {
  version: 1;
  tabs: SavedDocTab[];
  active: string | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const isMode = (value: unknown): value is SavedDocMode => value === 'preview' || value === 'edit' || value === 'source';
const safePath = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 400
  && !/[\\:\x00]/.test(value) && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..');

const keyOf = (workspace: string, project: string): string => 'qa-workspace-view:' + encodeURIComponent(workspace) + ':' + encodeURIComponent(project);
const empty = (): WorkspaceViewState => ({ version: 1, tabs: [], active: null });

function normalize(value: unknown): WorkspaceViewState {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.tabs)) return empty();
  const seen = new Set<string>();
  const tabs: SavedDocTab[] = [];
  for (const item of value.tabs) {
    if (!isRecord(item) || !safePath(item.path) || seen.has(item.path) || !isMode(item.mode)) continue;
    const scrollTop = typeof item.scrollTop === 'number' && Number.isFinite(item.scrollTop) && item.scrollTop >= 0 ? Math.min(item.scrollTop, 1e7) : 0;
    seen.add(item.path);
    tabs.push({ path: item.path, mode: item.mode, scrollTop });
  }
  return { version: 1, tabs, active: safePath(value.active) && tabs.some((tab) => tab.path === value.active) ? value.active : tabs[0]?.path ?? null };
}

export function readWorkspaceView(workspace: string, project: string): WorkspaceViewState {
  try {
    const raw = recall(keyOf(workspace, project));
    return raw ? normalize(JSON.parse(raw) as unknown) : empty();
  } catch {
    return empty();
  }
}

export function writeWorkspaceView(workspace: string, project: string, state: WorkspaceViewState): void {
  remember(keyOf(workspace, project), JSON.stringify(normalize(state)));
}
