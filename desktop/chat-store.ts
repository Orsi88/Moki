// The conversations of a project's chat (desktop/chat.ts), one JSON file each in the project's .chats/ folder:
// they travel with the project (copy, suspend, other workspace) and, as a hidden folder, stay out of the file tree,
// the search and the organizing of files. A conversation is written at the end of each answer.

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { isChatTool, type ChatTool } from './chat.ts';
import { isChatModel } from './chat-models.ts';
import { resolveInside } from './fs-guard.ts';

export const CHATS_DIR = '.chats';
const ID = /^\d{4}-\d{2}-\d{2}-\d{4}-[a-z0-9]{4}$/;
const TITLE_LIMIT = 80;
const TRANSCRIPT_LIMIT = 60_000; // characters of the conversation carried into a new session (the latest kept)

export interface ChatToolCall { name: string; summary: string; ok?: boolean }
// label: a request Moki wrote (Call… › In the chat), named by what was called; the chat shows it folded under the label.
// attachments: files of the project (paths in it) the person added to the message, shown with it.
export interface ChatMessage { role: 'user' | 'assistant'; text: string; at: string; tools?: ChatToolCall[]; error?: string; label?: string; attachments?: string[] }
export interface ChatRecord { id: string; tool: ChatTool; model?: string; sessionId?: string; title: string; created: string; updated: string; messages: ChatMessage[] }
export interface ChatSummary { id: string; tool: ChatTool; title: string; updated: string }

export const isChatId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);

function chatFile(projectDir: string, id: unknown): string {
  if (!isChatId(id)) throw new Error('Unknown conversation.');
  const dir = resolveInside(projectDir, CHATS_DIR);
  const file = resolveInside(projectDir, `${CHATS_DIR}/${id}.json`);
  if (lstatSync(join(projectDir, CHATS_DIR), { throwIfNoEntry: false })?.isSymbolicLink()
    || lstatSync(join(dir, `${id}.json`), { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Conversation links are not allowed.');
  return file;
}

// Images kept with a conversation, hidden from the file tree and carried with the project.
export function chatAssetsDir(projectDir: string, id: unknown): string {
  const dir = join(dirname(chatFile(projectDir, id)), id as string);
  if (lstatSync(dir, { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Conversation links are not allowed.');
  return resolveInside(projectDir, `${CHATS_DIR}/${id}`);
}

// A new id: the local date and time, then 4 random characters (sorts by creation).
export function newChatId(now = new Date(), random = randomBytes(4)): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const tail = Array.from(random, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}-${tail}`;
}

// The title of a conversation: the first line of its first message, shortened.
export function chatTitle(text: string): string {
  const line = text.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return line.length > TITLE_LIMIT ? `${line.slice(0, TITLE_LIMIT - 1)}…` : line;
}

export function newChat(tool: ChatTool, now = new Date()): ChatRecord {
  const at = now.toISOString();
  return { id: newChatId(now), tool, title: '', created: at, updated: at, messages: [] };
}

function valid(data: unknown, id: string): ChatRecord | null {
  const r = data as Partial<ChatRecord> | null;
  if (!r || typeof r !== 'object' || r.id !== id || !isChatTool(r.tool) || !Array.isArray(r.messages)
    || typeof r.title !== 'string' || typeof r.created !== 'string' || typeof r.updated !== 'string'
    || r.model !== undefined && !isChatModel(r.model)) return null;
  if (!r.messages.every((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string' && typeof m.at === 'string'
    && (m.error === undefined || typeof m.error === 'string') && (m.label === undefined || typeof m.label === 'string') && (m.attachments === undefined || Array.isArray(m.attachments) && m.attachments.every((a) => typeof a === 'string')) && (m.tools === undefined || Array.isArray(m.tools)
      && m.tools.every((t) => t && typeof t.name === 'string' && typeof t.summary === 'string' && (t.ok === undefined || typeof t.ok === 'boolean'))))) return null;
  const messages = r.messages;
  return { id, tool: r.tool, ...(r.model ? { model: r.model } : {}), ...(typeof r.sessionId === 'string' && r.sessionId ? { sessionId: r.sessionId } : {}), title: String(r.title ?? ''),
    created: String(r.created ?? ''), updated: String(r.updated ?? ''), messages };
}

export function readChat(projectDir: string, id: unknown): ChatRecord {
  const file = chatFile(projectDir, id);
  let data: unknown;
  try { data = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error('Unknown conversation.'); }
  const record = valid(data, id as string);
  if (!record) throw new Error('This conversation file is damaged.');
  return record;
}

// Written whole through a temporary file, so a crash never leaves half a conversation.
export function saveChat(projectDir: string, record: ChatRecord): void {
  if (!valid(record, record.id)) throw new Error('This conversation file is damaged.');
  const file = chatFile(projectDir, record.id);
  mkdirSync(join(projectDir, CHATS_DIR), { recursive: true });
  const title = record.title || chatTitle(record.messages.find((m) => m.role === 'user')?.text ?? '');
  const tmp = `${file}.${randomBytes(8).toString('hex')}.tmp`;
  let written = false;
  try {
    writeFileSync(tmp, `${JSON.stringify({ ...record, title }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    written = true;
    renameSync(tmp, file);
  } finally { if (written && existsSync(tmp)) rmSync(tmp); }
}

// The project's conversations, the latest first. Damaged files are left out.
export function listChats(projectDir: string): ChatSummary[] {
  const dir = resolveInside(projectDir, CHATS_DIR);
  if (lstatSync(join(projectDir, CHATS_DIR), { throwIfNoEntry: false })?.isSymbolicLink()) throw new Error('Conversation links are not allowed.');
  if (!existsSync(dir)) return [];
  const out: ChatSummary[] = [];
  for (const name of readdirSync(dir)) {
    const id = name.replace(/\.json$/, '');
    if (!name.endsWith('.json') || !isChatId(id)) continue;
    try {
      const r = readChat(projectDir, id);
      out.push({ id, tool: r.tool, title: r.title, updated: r.updated });
    } catch { /* damaged: not listed */ }
  }
  return out.sort((a, b) => b.updated.localeCompare(a.updated) || b.id.localeCompare(a.id));
}

export function removeChat(projectDir: string, id: unknown): void {
  const file = chatFile(projectDir, id);
  const assets = chatAssetsDir(projectDir, id); // validate both paths before removing either
  rmSync(assets, { recursive: true, force: true });
  rmSync(file, { force: true });
}

// The conversation so far as text, for a new session when the old one is gone. The latest messages are kept.
export function chatTranscript(record: ChatRecord, limit = TRANSCRIPT_LIMIT): string {
  const parts: string[] = [];
  let size = 0;
  for (const m of [...record.messages].reverse()) {
    const prefix = `${m.role === 'user' ? 'Person' : 'AI'}: `;
    const remaining = limit - size - (parts.length ? 2 : 0);
    if (remaining <= prefix.length + 1) break;
    const whole = `${prefix}${m.text.trim()}`;
    const text = whole.length <= remaining ? whole : `${prefix}…${m.text.trim().slice(-(remaining - prefix.length - 1))}`;
    parts.unshift(text);
    size += text.length + (parts.length > 1 ? 2 : 0);
    if (text !== whole) break;
  }
  return parts.join('\n\n');
}
