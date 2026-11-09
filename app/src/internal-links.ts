// Internal links: how a place inside a project is written in a document and found again. Pure.
//
// The format is plain Markdown, so the same link works on GitHub or in an editor: a path relative to the
// document ([US-12](../../inbox/US-12.md)) or to the project (/inbox/US-12.md), with an optional anchor:
//   #some-heading   a heading of a .md (the slug: lowercase, spaces as -, punctuation dropped)
//   #comment-<id>   a comment of a .md (its <!--c:id--> mark) or of a PDF (its NM)
//   #page=<n>       a page of a PDF
// Moki also accepts what AIs tend to write: a path from the repository or the computer that goes through
// this project's folder (workspace/projects/<id>/inbox/x.md), and a project path written relative to a
// document that is not at the root (a note's [@x](inbox/x.pdf)).

export { headingSlugs, slugify } from '../../scripts/lib/heading-anchors.ts';
export type Anchor = { kind: 'heading'; slug: string } | { kind: 'comment'; id: string } | { kind: 'page'; page: number };
export interface LinkJump { anchor: Anchor; token: number }
export interface Target { path: string; anchor: Anchor | null; found: boolean }

const decode = (s: string): string => { try { return decodeURIComponent(s); } catch { return s; } };

export function parseAnchor(fragment: string): Anchor | null {
  const f = decode(fragment).trim();
  if (!f) return null;
  const comment = /^comment-([\w.:-]+)$/.exec(f);
  if (f.startsWith('comment-')) return { kind: 'comment', id: comment ? comment[1] : f.slice(8) };
  const page = /^page=(\d{1,6})$/.exec(f);
  if (page) return Number(page[1]) > 0 ? { kind: 'page', page: Number(page[1]) } : null;
  return { kind: 'heading', slug: f.toLowerCase() };
}

export function anchorFragment(anchor: Anchor): string {
  if (anchor.kind === 'comment') return `comment-${encodeURIComponent(anchor.id)}`;
  if (anchor.kind === 'page') return `page=${anchor.page}`;
  return encodeURIComponent(anchor.slug).replace(/%2D/gi, '-');
}

// Joins segments onto a folder; null when .. leaves the project.
function join(base: string[], path: string): string | null {
  const parts = [...base];
  for (const seg of path.split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') { if (!parts.length) return null; parts.pop(); } else parts.push(seg);
  }
  return parts.length ? parts.join('/') : null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Where a link written in `from` (a project path) leads, in project `project`. `exists` says whether a project
// path is a file. Null for what is not a place of this project (another scheme, another project, outside it).
export function resolveInternal(from: string, href: string, project: string, exists: (path: string) => boolean): Target | null {
  const hash = href.indexOf('#');
  const anchor = hash >= 0 ? parseAnchor(href.slice(hash + 1)) : null;
  const raw = decode((hash >= 0 ? href.slice(0, hash) : href).trim()).replace(/\\/g, '/');
  if (!raw) return { path: from, anchor, found: exists(from) }; // #section: the same document
  // Schemes are checked before matching project folders: an external URL is never a local reference.
  const drive = /^[a-z]:\//i.test(raw);
  if ((!drive && /^[a-z][a-z0-9+.-]*:/i.test(raw)) || raw.startsWith('//')) return null;
  const projectFolder = /(?:^|\/)projects\/([^/]+)\//.exec(raw);
  if (projectFolder && projectFolder[1] !== project) return null;
  const here = from.split('/').slice(0, -1);
  // Through this project's folder, from the repository or the computer: what follows the folder.
  const inside = new RegExp(`(?:^|/)projects/${escapeRe(project)}/(.+)$`).exec(raw);
  let candidates: (string | null)[];
  if (inside) candidates = [join([], inside[1])];
  else if (drive) return null;
  else if (raw.startsWith('/')) candidates = [join([], raw)];
  else candidates = [join(here, raw), join([], raw)]; // relative to the document, else to the project
  const paths = candidates.filter((p): p is string => Boolean(p));
  if (!paths.length) return null;
  const hit = paths.find((p) => exists(p));
  return { path: hit ?? paths[0], anchor, found: Boolean(hit) };
}

// The link to write in `from` for a place: relative to the document, as any Markdown viewer reads it.
export function hrefTo(from: string, path: string, anchor?: Anchor | null): string {
  const a = from.split('/').slice(0, -1);
  const b = path.split('/');
  let same = 0;
  while (same < a.length && same < b.length - 1 && a[same] === b[same]) same++;
  const rel = [...a.slice(same).map(() => '..'), ...b.slice(same)].join('/');
  const hash = anchor ? `#${anchorFragment(anchor)}` : '';
  if (from === path && hash) return hash; // a place of the same document
  return encodeURI(rel).replace(/#/g, '%23').replace(/\(/g, '%28').replace(/\)/g, '%29') + hash; // ( ) would end the Markdown link
}

// A copied link has no referring document yet: root it at the active project.
export function projectLink(path: string, anchor?: Anchor): string {
  const label = (path.split('/').pop() ?? path).replace(/[\\[\]]/g, '\\$&');
  const href = hrefTo('', path, anchor);
  return `[${label}](/${href})`;
}
// Paths written as text ("see inbox/US-12.md#rules" or "glossary.md"): where each starts and ends. Only shapes
// that look like a file (a name with an extension, optional folders and anchor); the caller keeps those that exist.
const PATH = /(?<![\p{L}\p{N}_/@.\\:-])((?:[A-Za-z]:[\\/]|\/)?(?:\.{1,2}[\\/])*(?:[\p{L}\p{N}_@.%~-]+[\\/])*[\p{L}\p{N}_@%-][\p{L}\p{N}_@.%~-]*\.[A-Za-z][A-Za-z0-9]{0,11}(?:#[\p{L}\p{N}_%=.:-]+)?)(?![\p{L}\p{N}_/\\-])/gu;
export function findPaths(text: string): { start: number; end: number; text: string }[] {
  const out: { start: number; end: number; text: string }[] = [];
  for (const m of text.matchAll(PATH)) {
    let value = m[1];
    while (/[.:]$/.test(value)) value = value.slice(0, -1); // the period that ends the sentence
    if ((!value.includes('/') && value.includes('@')) || /^(?:[a-z]\.)+[a-z]$/i.test(value)) continue;
    out.push({ start: m.index ?? 0, end: (m.index ?? 0) + value.length, text: value });
  }
  return out;
}
