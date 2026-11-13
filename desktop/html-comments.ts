// One project-local review store for HTML passages and diagram regions, independent of source bytes.
import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolveInside } from './fs-guard.ts';
import { isHtmlAnchor, isHtmlColor, isHtmlCommentChange, type HtmlAnchor, type HtmlComment, type HtmlCommentChange, type HtmlReply } from '../scripts/lib/html-comments.ts';
import { isDiagramAnchor, isDiagramCommentChange, isDiagramViewState, type DiagramAnchor, type DiagramComment, type DiagramCommentChange, type DiagramViewState } from '../scripts/lib/diagram-types.ts';

const FILE = '.moki-html-comments.json';
type Comment = HtmlComment | DiagramComment;
// Keep the historical file name and path key so existing reviews need no migration.
interface Entry { html: string; comments: Comment[]; view?: DiagramViewState }
const isHtmlComment = (comment: Comment): comment is HtmlComment => isHtmlAnchor(comment.anchor);
const isDiagramComment = (comment: Comment): comment is DiagramComment => isDiagramAnchor(comment.anchor);
const isReply = (value: unknown): value is HtmlReply => Boolean(value && typeof value === 'object'
  && typeof (value as HtmlReply).author === 'string' && typeof (value as HtmlReply).at === 'string'
  && typeof (value as HtmlReply).text === 'string' && (value as HtmlReply).text.length <= 10000);
function read(directory: string): Entry[] {
  const file = resolveInside(directory, FILE);
  if (!existsSync(file)) return [];
  if (statSync(file).size > 4_000_000) throw new Error('HTML comments are too large.');
  const data: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(data) || data.length > 1000 || data.some((entry: Entry) => !entry || typeof entry.html !== 'string' || !Array.isArray(entry.comments) || entry.comments.length > 500 || entry.comments.some((c) => !c || typeof c.id !== 'string' || typeof c.text !== 'string' || c.text.length > 10000 || typeof c.author !== 'string' || typeof c.date !== 'string' || !isHtmlAnchor(c.anchor) && !isDiagramAnchor(c.anchor)))) throw new Error('Invalid HTML comments.');
  for (const entry of data as Entry[]) {
    if (entry.view !== undefined && !isDiagramViewState(entry.view)) throw new Error('Invalid diagram view.');
    for (const comment of entry.comments) {
      if (comment.color !== undefined && !isHtmlColor(comment.color) || comment.replies !== undefined && (!Array.isArray(comment.replies) || comment.replies.length > 50 || !comment.replies.every(isReply))
        || isDiagramComment(comment) && comment.resolved !== undefined && typeof comment.resolved !== 'boolean') throw new Error('Invalid HTML comments.');
    }
  }
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
export const htmlComments = (directory: string, html: string): HtmlComment[] => (read(directory).find((entry) => entry.html === html)?.comments ?? []).filter(isHtmlComment);
export function addHtmlComment(directory: string, html: string, anchor: HtmlAnchor, text: string, author: string, color?: string): HtmlComment[] {
  if (!isHtmlAnchor(anchor) || typeof text !== 'string' || !text.trim() || text.length > 10000) throw new Error('Select a passage and write a comment.');
  if (color !== undefined && !isHtmlColor(color)) throw new Error('Invalid comment color.');
  const entries = read(directory), entry = entries.find((entry) => entry.html === html) ?? { html, comments: [] };
  if (entry.comments.length >= 500) throw new Error('This page already has 500 comments.');
  if (!entries.includes(entry)) entries.push(entry);
  entry.comments.push({ id: randomUUID(), author, date: new Date().toISOString(), text: text.trim(), anchor: { quote: anchor.quote, prefix: anchor.prefix, suffix: anchor.suffix }, ...(color ? { color } : {}) });
  write(directory, entries); return entry.comments.filter(isHtmlComment);
}
function changeComment(directory: string, html: string, change: DiagramCommentChange, author: string, accepts: (comment: Comment) => boolean): Comment[] {
  const entries = read(directory), entry = entries.find((entry) => entry.html === html);
  const comment = entry?.comments.find((comment) => comment.id === change.id && accepts(comment));
  if (!entry || !comment) throw new Error('Comment not found.');
  if (change.op === 'resolve') {
    if (!isDiagramComment(comment)) throw new Error('Invalid diagram comment.');
    comment.resolved = change.resolved;
  } else if (change.op === 'color') comment.color = change.color;
  else if (change.op === 'edit') comment.text = change.text.trim();
  else {
    if ((comment.replies?.length ?? 0) >= 50) throw new Error('Invalid HTML comments.');
    comment.replies = [...comment.replies ?? [], { author, at: new Date().toISOString(), text: change.text.trim() }];
  }
  write(directory, entries); return entry.comments;
}
export function changeHtmlComment(directory: string, html: string, change: HtmlCommentChange, author: string): HtmlComment[] {
  if (!isHtmlCommentChange(change)) throw new Error('Invalid HTML comments.');
  return changeComment(directory, html, change, author, isHtmlComment).filter(isHtmlComment);
}
function removeComment(directory: string, html: string, id: string, accepts: (comment: Comment) => boolean): Comment[] {
  const entries = read(directory), entry = entries.find((entry) => entry.html === html);
  if (!entry?.comments.some((comment) => comment.id === id && accepts(comment))) throw new Error('Comment not found.');
  entry.comments = entry.comments.filter((comment) => comment.id !== id || !accepts(comment));
  write(directory, entries.filter((entry) => entry.comments.length || entry.view)); return entry.comments;
}
export function removeHtmlComment(directory: string, html: string, id: string): HtmlComment[] {
  return removeComment(directory, html, id, isHtmlComment).filter(isHtmlComment);
}

export const diagramComments = (directory: string, path: string): DiagramComment[] => (read(directory).find((entry) => entry.html === path)?.comments ?? []).filter(isDiagramComment);

export function addDiagramComment(directory: string, path: string, anchor: DiagramAnchor, text: string, author: string, color?: string): DiagramComment[] {
  if (!isDiagramAnchor(anchor) || typeof text !== 'string' || !text.trim() || text.length > 10000) throw new Error('Select a diagram region and write a comment.');
  if (color !== undefined && !isHtmlColor(color)) throw new Error('Invalid comment color.');
  const entries = read(directory), entry = entries.find((entry) => entry.html === path) ?? { html: path, comments: [] };
  if (entry.comments.length >= 500) throw new Error('This diagram already has 500 comments.');
  if (!entries.includes(entry)) entries.push(entry);
  entry.comments.push({ id: randomUUID(), author, date: new Date().toISOString(), text: text.trim(),
    anchor: { kind: 'diagram', x: anchor.x, y: anchor.y, width: anchor.width, height: anchor.height, sourceHash: anchor.sourceHash,
      ...(anchor.elementId !== undefined ? { elementId: anchor.elementId } : {}), ...(anchor.elementLabel !== undefined ? { elementLabel: anchor.elementLabel } : {}) }, ...(color ? { color } : {}) });
  write(directory, entries); return entry.comments.filter(isDiagramComment);
}

export function changeDiagramComment(directory: string, path: string, change: DiagramCommentChange, author: string): DiagramComment[] {
  if (!isDiagramCommentChange(change)) throw new Error('Invalid diagram comment.');
  return changeComment(directory, path, change, author, isDiagramComment).filter(isDiagramComment);
}

export function removeDiagramComment(directory: string, path: string, id: string): DiagramComment[] {
  return removeComment(directory, path, id, isDiagramComment).filter(isDiagramComment);
}

export const readDiagramView = (directory: string, path: string): DiagramViewState | null => read(directory).find((entry) => entry.html === path)?.view ?? null;

export function saveDiagramView(directory: string, path: string, view: DiagramViewState): DiagramViewState {
  if (!isDiagramViewState(view)) throw new Error('Invalid diagram view.');
  const entries = read(directory), entry = entries.find((entry) => entry.html === path) ?? { html: path, comments: [] };
  if (!entries.includes(entry)) entries.push(entry);
  entry.view = { sourceHash: view.sourceHash, zoom: view.zoom, scrollLeft: view.scrollLeft, scrollTop: view.scrollTop, mode: view.mode, ...(typeof view.commentsOpen === 'boolean' ? { commentsOpen: view.commentsOpen } : {}) };
  write(directory, entries); return entry.view;
}
export function moveHtmlComments(directory: string, from: string, to: string): void {
  const entries = read(directory);
  const moved = entries.filter((entry) => entry.html === from || entry.html.startsWith(from + '/'));
  if (!moved.length) return;
  for (const entry of moved) entry.html = to + entry.html.slice(from.length);
  write(directory, entries);
}
