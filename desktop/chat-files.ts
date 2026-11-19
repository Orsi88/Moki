// Files named in a chat: the paths an AI writes in its answer (a Windows path, workspace/projects/<id>/..., a path
// relative to the project, a Markdown link or image) and the attachments a person adds, resolved against the
// conversation's project. A file of another project, or outside the projects, is never offered: the conversation
// has no access to it. A file that was there and is gone (moved, removed) is reported as such.

import { existsSync, realpathSync, statSync } from 'node:fs';
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export type ChatFileStatus = 'ok' | 'missing' | 'other-project' | 'outside';
export interface ChatFile { ref: string; path: string; name: string; status: ChatFileStatus; image: boolean }

export const CHAT_IMAGE = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
// Files worth a card in an answer: documents, data, images, pages, diagrams (not source code nor folders).
const SHOWN = new Set([...CHAT_IMAGE, '.pdf', '.md', '.txt', '.csv', '.xlsx', '.xls', '.docx', '.pptx', '.json', '.html', '.svg', '.mmd', '.drawio', '.excalidraw']);
const EXT = [...SHOWN].map((e) => e.slice(1)).join('|');
const MAX_REFS = 20;

// The file references of an answer, in order, without repeats: Markdown links and images, `code` spans and bare
// paths that end in one of the shown extensions. Web addresses are not files.
export function chatFileRefs(text: string): string[] {
  const found: string[] = [];
  const add = (raw: string) => {
    const ref = raw.trim().replace(/^<|>$/g, '').replace(/[.,;:)]+$/, '');
    if (!ref || /^[a-z][a-z0-9+.-]*:\/\//i.test(ref) && !/^file:\/\//i.test(ref) || /^(mailto|data):/i.test(ref)) return;
    if (!new RegExp(`\\.(${EXT})$`, 'i').test(ref.split(/[?#]/)[0])) return;
    if (!found.includes(ref)) found.push(ref);
  };
  const link = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const code = /`([^`\n]+)`/g;
  for (const m of text.matchAll(link)) { try { add(decodeURI(m[1])); } catch { add(m[1]); } }
  for (const m of text.matchAll(code)) add(m[1]);
  // Bare paths in the rest of the text (links and code already read).
  for (const m of text.replace(link, ' ').replace(code, ' ').matchAll(new RegExp(`(?:[A-Za-z]:[\\\\/]|\\.{0,2}/|(?:workspace|projects|runs|inbox|notes|context|temporary)[\\\\/])[^\\s\`'"<>()\\[\\]]*\\.(?:${EXT})\\b`, 'gi'))) add(m[0]);
  return found.slice(0, MAX_REFS);
}

const real = (p: string) => { try { return realpathSync(p); } catch { return resolve(p); } };
const same = (a: string, b: string) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
const within = (dir: string, p: string) => { const r = relative(dir, p); return r === '' || (!r.startsWith('..') && !isAbsolute(r)); };

// `projects`: the workspace's projects folder; `label`: how the workspace is written in paths (workspace, or the
// workspace folder's name). The path returned is relative to the project, with forward slashes.
export function resolveChatFile(projects: string, project: string, label: string, ref: string): ChatFile {
  let raw = ref.trim();
  if (/^file:\/\//i.test(raw)) { try { raw = decodeURIComponent(new URL(raw).pathname).replace(/^\/([A-Za-z]:)/, '$1'); } catch { /* as written */ } }
  const slashed = raw.replace(/\\/g, '/');
  const name = basename(slashed);
  const image = CHAT_IMAGE.has(extname(name).toLowerCase());
  const dir = join(projects, project);
  const result = (status: ChatFileStatus, path = ''): ChatFile => ({ ref, path, name, status, image });
  let full: string;
  if (isAbsolute(raw) || /^[A-Za-z]:\//.test(slashed)) full = resolve(raw);
  else {
    // workspace/projects/<id>/... or projects/<id>/...: the project is named in the path.
    const named = new RegExp(`^(?:(?:${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|workspace)/)?projects/([^/]+)/(.+)$`).exec(slashed.replace(/^\.\//, ''));
    if (named && !same(named[1], project)) return result('other-project');
    full = resolve(dir, named ? named[2] : slashed.replace(/^\.\//, ''));
  }
  const target = real(full);
  const home = real(dir);
  if (!within(home, target)) return result(within(real(projects), target) ? 'other-project' : 'outside');
  const path = relative(home, target).split(sep).join('/');
  if (!path || path.split('/').includes('..')) return result('outside');
  try { return result(statSync(target).isFile() ? 'ok' : 'missing', path); } catch { return result(existsSync(target) ? 'ok' : 'missing', path); }
}
