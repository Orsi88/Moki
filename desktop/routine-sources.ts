// Routine sources resolve project files, folders or read-only MCP query results.
// Query inputs belong to the source; a routine never invents a provider's arguments.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, sep } from 'node:path';
import { OPENABLE_EXTENSIONS, resolveInside } from './fs-guard.ts';
import { enabledServers, type McpServer } from '../scripts/lib/mcp.ts';
import { contentHash, RoutineError, routineProjectDir, snapshotsOf, toolPayload, type RoutineResource, type Snapshot } from '../scripts/lib/routines.ts';

const MAX_FILES = 5000;
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_ITEMS = 10000;
const MAX_PAGES = 100;
const ITEM_BATCH_SIZE = 50;
const INTERNAL = new Set(['runs', 'routines', 'temporary', 'backups']);
const keyOf = (path: string) => path.replace(/\\/g, '/');

export interface SourceResult { sourceId: string; snapshots: Snapshot[]; records: unknown[]; files: string[] }
type SourceCall = (server: McpServer, tool: string, args: Record<string, unknown>) => Promise<unknown>;
type QueryReader = (payload: unknown, args: Record<string, unknown>, server: McpServer, call: SourceCall, assertCurrent: () => void) => Promise<unknown[] | null>;
const QUERY_READERS: Readonly<Partial<Record<string, QueryReader>>> = { wit_query: readAzureQuery };

export function sourcePath(path: string): string {
  const clean = keyOf(path).trim().replace(/^\.\//, '');
  const parts = clean.split('/');
  if (!clean || isAbsolute(clean) || /^[A-Za-z]:/.test(clean) || parts.some((part) => part === '..' || part.startsWith('.')) || INTERNAL.has(parts[0])) throw new RoutineError('Choose a file or folder inside this project, outside its execution and hidden folders.');
  return clean;
}

function field(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').reduce<unknown>((current, name) => {
    if (['__proto__', 'prototype', 'constructor'].includes(name)) throw new RoutineError('Invalid result field.');
    return current && typeof current === 'object' ? (current as Record<string, unknown>)[name] : undefined;
  }, value);
}

export function sourceArguments(value: unknown, project: { id: string; name: string }): unknown {
  if (typeof value === 'string') return value.replace(/\{\{project\.(id|name)\}\}/g, (_, key: 'id' | 'name') => project[key]);
  if (Array.isArray(value)) return value.map((item) => sourceArguments(item, project));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sourceArguments(item, project)]));
  return value;
}

export async function readSource(root: string, project: { id: string; name: string }, source: RoutineResource, call: SourceCall, assertCurrent: () => void): Promise<SourceResult> {
  if (source.kind === 'files' || source.kind === 'folder') return readFiles(root, project.id, source);
  const server = enabledServers(project.id, root).find((entry) => entry.id === source.serverId);
  if (!server || server.access !== 'read') throw new RoutineError('Choose a read-only MCP server enabled for this project.');
  const args = sourceArguments(source.arguments, project) as Record<string, unknown>;
  const sourceId = `query:${server.id}/${source.tool}/${contentHash({ args, recordsPath: source.recordsPath, idPath: source.idPath }).slice(0, 16)}`;
  const records: unknown[] = [];
  const seen = new Set<string>();
  let cursor: unknown;
  for (let page = 0; page < MAX_PAGES; page++) {
    const pageArgs = { ...args, ...(cursor !== undefined && source.pagination?.cursorArgument ? { [source.pagination.cursorArgument]: cursor } : {}) };
    const payload = toolPayload(await call(server, source.tool, pageArgs));
    assertCurrent();
    const body = source.recordsPath ? field(payload, source.recordsPath) : payload;
    const reader = !source.recordsPath && !source.idPath ? QUERY_READERS[source.tool] : undefined;
    const rows = reader ? await reader(body, pageArgs, server, call, assertCurrent) ?? rowsOf(body) : rowsOf(body);
    if (!rows) throw new RoutineError('The query did not return a list. Set the result list field for this source.');
    records.push(...rows);
    assertResultSize(records);
    const next = source.pagination?.nextCursorPath ? field(payload, source.pagination.nextCursorPath) : undefined;
    if (next === undefined || next === null || next === '') {
      const more = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
      if (!source.pagination?.nextCursorPath && (more.hasMore === true || more.nextCursor || more.nextPageToken || more.continuationToken || more.nextLink)) throw new RoutineError('This query has more pages. Configure its cursor fields so every result can be checked.');
      const snapshots = records.map((record) => {
        const row = record && typeof record === 'object' ? record as Record<string, unknown> : {};
        const id = String(source.idPath ? field(record, source.idPath) ?? '' : row.id ?? row.key ?? (row.fields as Record<string, unknown> | undefined)?.['System.Id'] ?? '');
        if (!id || id.length > 512 || seen.has(`item:${id}`)) throw new RoutineError('Every query result needs a stable, unique identifier. Set its identifier field.');
        seen.add(`item:${id}`);
        const snapshot = snapshotsOf([{ ...row, id }])[0];
        return { ...snapshot, resourceId: id, hash: contentHash(record) };
      });
      return { sourceId, snapshots, records, files: [] };
    }
    const token = JSON.stringify(next);
    if (seen.has(token)) throw new RoutineError('The query repeated its pagination cursor. No partial result was accepted.');
    seen.add(token);
    cursor = next;
  }
  throw new RoutineError('The query exceeded the page limit. Narrow its filter before running it again.');
}

function assertResultSize(records: unknown[]): void {
  if (records.length > MAX_ITEMS || JSON.stringify(records).length > MAX_BYTES) throw new RoutineError('The query result is too large. Narrow its filter before running it again.');
}

// Linked queries return references rather than revisions. Read their unique items from the same read-only server.
async function readAzureQuery(payload: unknown, args: Record<string, unknown>, server: McpServer, call: SourceCall, assertCurrent: () => void): Promise<unknown[] | null> {
  if (!payload || typeof payload !== 'object' || !['get_results', 'wiql'].includes(String(args.action))) return null;
  const relations = (payload as Record<string, unknown>).workItemRelations;
  if (!Array.isArray(relations)) return null;
  assertResultSize(relations);
  if (typeof args.project !== 'string' || !args.project.trim()) throw new RoutineError('Set the Azure DevOps project in the query parameters before reading its items.');
  const ids = new Set<number>();
  for (const relation of relations) {
    if (!relation || typeof relation !== 'object') throw new RoutineError('The query returned an invalid work item reference. No partial result was accepted.');
    const link = relation as Record<string, unknown>;
    let endpoints = 0;
    for (const reference of [link.source, link.target]) {
      if (reference === null || reference === undefined) continue;
      const id = typeof reference === 'object' ? (reference as Record<string, unknown>).id : undefined;
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) throw new RoutineError('The query returned an invalid work item reference. No partial result was accepted.');
      ids.add(id);
      endpoints++;
    }
    if (!endpoints) throw new RoutineError('The query returned an invalid work item reference. No partial result was accepted.');
  }
  assertResultSize([...ids]);
  const top = args.top ?? 50;
  if (typeof top !== 'number' || !Number.isSafeInteger(top) || top < 1) throw new RoutineError('Set a positive integer top parameter for this Azure DevOps query.');
  // The MCP query defaults to 50 and has no continuation cursor. A full limit cannot prove a complete result.
  if (ids.size >= top) throw new RoutineError('The query reached its result limit. Increase its top parameter or narrow its filter before running it again.');
  const ordered = [...ids].sort((a, b) => a - b);
  const items = new Map<number, Record<string, unknown>>();
  for (let at = 0; at < ordered.length; at += ITEM_BATCH_SIZE) {
    const batch = ordered.slice(at, at + ITEM_BATCH_SIZE);
    const result = toolPayload(await call(server, 'wit_work_item', { action: 'get_batch', project: args.project, ids: batch }));
    assertCurrent();
    const rows = rowsOf(result);
    if (!rows || rows.length !== batch.length) throw new RoutineError('The item batch was incomplete or invalid. No partial result was accepted.');
    for (const row of rows) {
      const item = row && typeof row === 'object' ? row as Record<string, unknown> : {};
      const fields = item.fields && typeof item.fields === 'object' && !Array.isArray(item.fields) ? item.fields as Record<string, unknown> : null;
      const revision = item.rev ?? fields?.['System.Rev'];
      if (typeof item.id !== 'number' || !batch.includes(item.id) || items.has(item.id) || !fields || typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 1) throw new RoutineError('The item batch was incomplete or invalid. No partial result was accepted.');
      items.set(item.id, item);
    }
    assertResultSize([...items.values()]);
  }
  return [...items.values()].sort((a, b) => Number(a.id) - Number(b.id));
}

function rowsOf(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return null;
  const object = value as Record<string, unknown>;
  for (const key of ['value', 'items', 'workItems', 'issues', 'results', 'records']) if (Array.isArray(object[key])) return object[key] as unknown[];
  // A tool that reads one item answers with that item.
  if ('id' in object || 'key' in object || 'fields' in object) return [object];
  return null;
}

function readFiles(root: string, projectId: string, source: RoutineResource): SourceResult {
  const base = routineProjectDir(root, projectId);
  const paths = source.kind === 'folder' ? [sourcePath(source.path)] : source.paths.map(sourcePath);
  const files = new Set<string>();
  const missing: string[] = [];
  const add = (path: string) => {
    if (!OPENABLE_EXTENSIONS.has(extname(path).toLowerCase())) return;
    files.add(path);
    if (files.size > MAX_FILES) throw new RoutineError('This folder has too many files. Choose a smaller folder.');
  };
  const walk = (path: string) => {
    const folder = resolveInside(base, path);
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const child = keyOf(`${path}/${entry.name}`);
      if (entry.isFile()) add(child);
      else if (entry.isDirectory() && source.recursive !== false) walk(child);
    }
  };
  for (const path of paths) {
    const file = resolveInside(base, path);
    if (!existsSync(file)) { missing.push(path); continue; }
    const stat = statSync(file);
    if (source.kind === 'folder') {
      if (!stat.isDirectory()) throw new RoutineError('Choose a folder for this source.');
      walk(path);
    } else {
      if (!stat.isFile() || !OPENABLE_EXTENSIONS.has(extname(path).toLowerCase())) throw new RoutineError('Choose a supported document file for this source.');
      add(path);
    }
  }
  let bytes = 0;
  const snapshots = [...files].sort().map((path) => {
    const file = resolveInside(base, path);
    const stat = statSync(file);
    bytes += stat.size;
    if (bytes > MAX_BYTES) throw new RoutineError('The monitored files exceed the reading limit. Choose a smaller source.');
    const content = readFileSync(file);
    const relativePath = keyOf(relative(base, file));
    if (relativePath === '..' || relativePath.startsWith(`..${sep}`)) throw new RoutineError('Path outside the project folder.');
    return { resourceId: path, version: '', updatedAt: stat.mtime.toISOString(), hash: contentHash(content.toString('base64')) };
  });
  const sourceId = `${source.kind}:${contentHash({ paths, recursive: source.recursive !== false }).slice(0, 16)}`;
  return { sourceId, snapshots, records: snapshots.map((snapshot) => ({ ...snapshot, kind: 'file' })), files: [...files], ...(!snapshots.length && missing.length ? { records: missing.map((path) => ({ path, missing: true })) } : {}) };
}
