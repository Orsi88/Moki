import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolveInside } from './fs-guard.ts';
import { isHtmlAnchor, type HtmlAnchor, type HtmlComment } from '../scripts/lib/html-comments.ts';

const FILE = '.moki-html-comments.json';
interface Entry { html: string; comments: HtmlComment[] }
function read(directory: string): Entry[] {
  const file = resolveInside(directory, FILE);
  if (!existsSync(file)) return [];
  if (statSync(file).size > 4_000_000) throw new Error('HTML comments are too large.');
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(data) || data.length > 1000 || data.some((entry: Entry) => !entry || typeof entry.html !== 'string' || !Array.isArray(entry.comments) || entry.comments.length > 500 || entry.comments.some((c) => !c || typeof c.id !== 'string' || typeof c.text !== 'string' || c.text.length > 10000 || typeof c.author !== 'string' || typeof c.date !== 'string' || !isHtmlAnchor(c.anchor)))) throw new Error('Invalid HTML comments.');
  return data;
}
function write(directory: string, entries: Entry[]): void {
  const file = resolveInside(directory, FILE), temporary = resolveInside(directory, `${FILE}.${randomUUID()}.tmp`);
  if (entries.length > 1000) throw new Error('HTML comments are too large.');
  const data = JSON.stringify(entries, null, 2) + '\n';
  if (Buffer.byteLength(data) > 4_000_000) throw new Error('HTML comments are too large.');
  try { writeFileSync(temporary, data, { flag: 'wx' }); renameSync(temporary, file); }
  finally { if (existsSync(temporary)) rmSync(temporary); }
}
export const htmlComments = (directory: string, html: string): HtmlComment[] => read(directory).find((entry) => entry.html === html)?.comments ?? [];
export function addHtmlComment(directory: string, html: string, anchor: HtmlAnchor, text: string, author: string): HtmlComment[] {
  if (!isHtmlAnchor(anchor) || typeof text !== 'string' || !text.trim() || text.length > 10000) throw new Error('Select a passage and write a comment.');
  const entries = read(directory), entry = entries.find((entry) => entry.html === html) ?? { html, comments: [] };
  if (entry.comments.length >= 500) throw new Error('This page already has 500 comments.');
  if (!entries.includes(entry)) entries.push(entry);
  entry.comments.push({ id: randomUUID(), author, date: new Date().toISOString(), text: text.trim(), anchor: { quote: anchor.quote, prefix: anchor.prefix, suffix: anchor.suffix } });
  write(directory, entries); return entry.comments;
}
export function removeHtmlComment(directory: string, html: string, id: string): HtmlComment[] {
  const entries = read(directory), entry = entries.find((entry) => entry.html === html);
  if (!entry?.comments.some((comment) => comment.id === id)) throw new Error('Comment not found.');
  entry.comments = entry.comments.filter((comment) => comment.id !== id);
  write(directory, entries.filter((entry) => entry.comments.length)); return entry.comments;
}
export function moveHtmlComments(directory: string, from: string, to: string): void {
  const entries = read(directory);
  const moved = entries.filter((entry) => entry.html === from || entry.html.startsWith(from + '/'));
  if (!moved.length) return;
  for (const entry of moved) entry.html = to + entry.html.slice(from.length);
  write(directory, entries);
}
