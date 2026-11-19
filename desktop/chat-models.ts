// Model choices for the project chat: Claude's aliases and the active Codex profile's cached catalog.
// An explicit identifier is also accepted, so a missing or older catalog never blocks a supported model.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatTool } from './chat.ts';

export interface ChatModel { id: string; label: string }
export const isChatModel = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:/@+\[\]-]{0,199}$/.test(value);
export function chatModel(value: unknown): string {
  if (value === '' || isChatModel(value)) return value;
  throw new Error('Invalid model identifier.');
}

export function chatModels(tool: ChatTool, home: string, env: NodeJS.ProcessEnv = process.env): ChatModel[] {
  if (tool === 'claude') return ['opus', 'sonnet', 'haiku'].map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }));
  const file = join(env.CODEX_HOME || join(home, '.codex'), 'models_cache.json');
  try {
    if (statSync(file).size > 5_000_000) return [];
    const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const models = data && typeof data === 'object' ? (data as { models?: unknown }).models : undefined;
    if (!Array.isArray(models)) return [];
    const seen = new Set<string>();
    return models.flatMap((model: unknown): ChatModel[] => {
      if (!model || typeof model !== 'object') return [];
      const { slug, display_name, visibility } = model as Record<string, unknown>;
      if (!isChatModel(slug) || visibility !== 'list' || seen.has(slug)) return [];
      seen.add(slug);
      const label = typeof display_name === 'string' && display_name.length <= 200 && !/[\x00-\x1f]/.test(display_name) ? display_name : slug;
      return [{ id: slug, label }];
    }).slice(0, 100);
  } catch { return []; } // The CLI may not have fetched a catalog yet; default and custom identifiers still work.
}
