// What was brought into the workspace from a project's settings ("Bring to this project"): which skill, agent or
// activity, from which project and when. The workspace's settings mark these items, so where they came from shows
// next to them. One file per workspace: <workspace>/library/uploads.json {"items": {"<kind>:<name>": {project, at}}}.
// Only a record: the items live where every other item of their kind lives, and work the same without it.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT, workspaceDir } from './repo.mjs';

export type UploadKind = 'skill' | 'agent' | 'activity';
export interface UploadRecord { project: string; at: string }

const file = (root: string) => join(workspaceDir(root), 'library', 'uploads.json');
const KEY = /^(skill|agent|activity):[a-z0-9][a-z0-9-]{0,63}$/;

export function listUploads(root = ROOT): Record<string, UploadRecord> {
  try {
    const items = (JSON.parse(readFileSync(file(root), 'utf8')) as { items?: unknown }).items;
    if (!items || typeof items !== 'object') return {};
    return Object.fromEntries(Object.entries(items as Record<string, Partial<UploadRecord>>)
      .filter(([k, v]) => KEY.test(k) && typeof v?.project === 'string' && typeof v?.at === 'string')
      .map(([k, v]) => [k, { project: v.project as string, at: v.at as string }]));
  } catch { return {}; }
}

export function recordUploads(items: { kind: UploadKind; name: string }[], project: string, root = ROOT, at = new Date().toISOString()): void {
  const all = listUploads(root);
  for (const i of items) all[`${i.kind}:${i.name}`] = { project, at };
  mkdirSync(dirname(file(root)), { recursive: true });
  writeFileSync(file(root), `${JSON.stringify({ items: all }, null, 2)}\n`);
}
