// Diagram sources are read by the service. Only this backend talks to an explicitly configured Kroki endpoint;
// the browser still sanitizes SVG before displaying it. Export verification below accepts a restricted SVG subset.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import { resolveInside } from './fs-guard.ts';
import type { DiagramKind, DiagramRenderResult, DiagramSettings } from '../scripts/lib/diagram-types.ts';

export const DIAGRAM_SOURCE_LIMIT = 2 * 1024 * 1024;
export const DIAGRAM_OUTPUT_LIMIT = 10 * 1024 * 1024;
const SETTINGS_FILE = '.moki-diagram-settings.json';
const TYPES: Record<string, DiagramKind> = { '.mmd': 'mermaid', '.mermaid': 'mermaid', '.puml': 'plantuml', '.plantuml': 'plantuml', '.d2': 'd2', '.dot': 'graphviz', '.gv': 'graphviz' };
export const diagramKind = (path: string): DiagramKind | undefined => TYPES[extname(path).toLowerCase()];
export const diagramHash = (source: string): string => createHash('sha256').update(source).digest('hex');

const endpoint = (value: string): URL => {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Enter a valid Kroki URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || value.length > 2048) throw new Error('Use a Kroki URL without credentials, query parameters or fragments.');
  // Resolve the familiar localhost spelling without DNS; a local provider cannot be rebound to a remote host.
  if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
  if (!isLoopback(url) && url.protocol !== 'https:') throw new Error('A remote Kroki URL must use HTTPS.');
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url;
};
const isLoopback = (url: URL): boolean => url.hostname === '127.0.0.1' || url.hostname === '[::1]';

export function parseDiagramSettings(raw: unknown): DiagramSettings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid diagram settings.');
  const input = raw as Record<string, unknown>;
  if ((input.provider !== 'local' && input.provider !== 'kroki') || typeof input.url !== 'string' || typeof input.allowRemote !== 'boolean') throw new Error('Invalid diagram settings.');
  if (input.provider === 'local') return { provider: 'local', url: '', allowRemote: false };
  return { provider: 'kroki', url: endpoint(input.url.trim()).href, allowRemote: input.allowRemote };
}

export function readDiagramSettings(directory: string): DiagramSettings {
  const file = resolveInside(directory, SETTINGS_FILE);
  if (!existsSync(file)) return { provider: 'local', url: '', allowRemote: false };
  if (statSync(file).size > 4096) throw new Error('Invalid diagram settings.');
  return parseDiagramSettings(JSON.parse(readFileSync(file, 'utf8')));
}

export function writeDiagramSettings(directory: string, raw: unknown): DiagramSettings {
  const settings = parseDiagramSettings(raw);
  const file = resolveInside(directory, SETTINGS_FILE), temporary = resolveInside(directory, `${SETTINGS_FILE}.${randomUUID()}.tmp`);
  try { writeFileSync(temporary, JSON.stringify(settings, null, 2) + '\n', { flag: 'wx' }); renameSync(temporary, file); }
  finally { if (existsSync(temporary)) rmSync(temporary); }
  return settings;
}

// Kroki must also run in SECURE mode. Reject resource-loading directives before any request so a diagram cannot
// use a renderer to fetch another URL or file. These checks are source restrictions, not an SVG sanitizer.
export function checkDiagramSource(kind: DiagramKind, source: string): void {
  if (!source.trim() || Buffer.byteLength(source) > DIAGRAM_SOURCE_LIMIT || source.includes('\0')) throw new Error('Diagram source is empty or too large.');
  if (/<\s*(?:script|iframe|object|embed|image|img|foreignObject)\b|javascript\s*:/i.test(source)) throw new Error('External resources and scripts are not allowed in diagrams.');
  if (kind === 'plantuml' && /!\s*(?:include\w*|import|theme\b[^\r\n]*\bfrom\b)|%\s*(?:load_?\w+|getenv|file_exists|call_user_func|invoke_procedure|eval)\b/i.test(source)
    || kind === 'd2' && /(?:\.\.\.\s*@|(?:^|[\r\n;:])\s*@|\bicon\s*:|\bshape\s*:\s*image\b)/i.test(source)
    || kind === 'graphviz' && /\b(?:image|shapefile|imagepath)\s*=/i.test(source)
    || kind === 'mermaid' && /@\{[^}]*\b(?:img|image)\s*:|\b(?:securityLevel|secure)\s*['"]?\s*:/i.test(source)) throw new Error('External resources and scripts are not allowed in diagrams.');
}

function dimensions(svg: string): { width?: number; height?: number } {
  const opening = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? '';
  const box = /\bviewBox\s*=\s*["']\s*([-+\d.e]+)[ ,]+([-+\d.e]+)[ ,]+([-+\d.e]+)[ ,]+([-+\d.e]+)\s*["']/i.exec(opening);
  const width = box ? Number(box[3]) : Number(/\bwidth\s*=\s*["']([\d.]+)(?:px)?["']/i.exec(opening)?.[1]);
  const height = box ? Number(box[4]) : Number(/\bheight\s*=\s*["']([\d.]+)(?:px)?["']/i.exec(opening)?.[1]);
  return Number.isFinite(width) && width > 0 && width <= 100000 && Number.isFinite(height) && height > 0 && height <= 100000 ? { width, height } : {};
}

export async function renderDiagramSource(kind: DiagramKind, source: string, raw: DiagramSettings, doFetch: typeof fetch = fetch, timeout = 20000): Promise<DiagramRenderResult> {
  checkDiagramSource(kind, source);
  const settings = parseDiagramSettings(raw), sourceHash = diagramHash(source);
  if (settings.provider === 'local') {
    if (kind !== 'mermaid') throw new Error('Configure Kroki to render this diagram type.');
    return { provider: 'local', sourceHash, source };
  }
  const url = endpoint(settings.url);
  if (!isLoopback(url) && !settings.allowRemote) throw new Error('Authorize sending this project’s diagram source to the configured Kroki server.');
  let response: Response;
  try {
    response = await doFetch(new URL(`${kind}/svg`, url), { method: 'POST', redirect: 'error',
      headers: { 'content-type': 'application/json', accept: 'image/svg+xml' },
      body: JSON.stringify({ diagram_source: source, ...(kind === 'plantuml' ? { diagram_options: { 'no-metadata': '' } } : {}) }), signal: AbortSignal.timeout(timeout) });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Diagram rendering failed (HTTP ${response.status}).`); }
    if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'image/svg+xml') { await response.body?.cancel(); throw new Error('Kroki did not return an SVG image.'); }
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > DIAGRAM_OUTPUT_LIMIT) { await response.body?.cancel(); throw new Error('The rendered diagram is too large.'); }
    if (!response.body) throw new Error('Kroki returned an empty diagram.');
    const reader = response.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > DIAGRAM_OUTPUT_LIMIT) { await reader.cancel(); throw new Error('The rendered diagram is too large.'); }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    const svg = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    if (!svg.trim()) throw new Error('Kroki returned an empty diagram.');
    return { provider: 'kroki', svg, source, sourceHash, ...dimensions(svg) };
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) throw new Error('Diagram rendering timed out.');
    if (error instanceof TypeError) throw new Error('Could not connect to the configured Kroki server.');
    throw error;
  }
}

const SVG_TAGS = new Set(['svg', 'g', 'a', 'path', 'rect', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'text', 'tspan', 'textPath', 'title', 'desc', 'defs', 'marker', 'clipPath', 'mask', 'linearGradient', 'radialGradient', 'stop', 'pattern', 'symbol', 'use', 'style']);
const SVG_ATTRIBUTES = new Set(['id', 'class', 'style', 'xmlns', 'xmlns:xlink', 'xml:space', 'viewbox', 'preserveaspectratio', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'dx', 'dy', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'text-decoration', 'letter-spacing', 'word-spacing', 'marker-start', 'marker-mid', 'marker-end', 'markerwidth', 'markerheight', 'markerunits', 'refx', 'refy', 'orient', 'clip-path', 'clippathunits', 'mask', 'maskunits', 'maskcontentunits', 'gradientunits', 'gradienttransform', 'offset', 'stop-color', 'stop-opacity', 'spreadmethod', 'patternunits', 'patterncontentunits', 'patterntransform', 'vector-effect', 'color', 'display', 'visibility', 'role', 'aria-label', 'aria-hidden', 'aria-labelledby', 'aria-describedby', 'href', 'xlink:href']);
const xmlText = (input: string): string => input.replace(/&([^;\s&]+);/g, (_all, entity: string) => {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  if (named[entity]) return named[entity];
  const value = /^#x[\da-f]+$/i.test(entity) ? Number.parseInt(entity.slice(2), 16) : /^#\d+$/.test(entity) ? Number(entity.slice(1)) : NaN;
  if (!Number.isInteger(value) || value <= 0 || value > 0x10ffff || value >= 0xd800 && value <= 0xdfff) throw new Error('Invalid SVG export.');
  return String.fromCodePoint(value);
});
const safeCss = (value: string): void => {
  // No escapes, comments, at-rules or external URL references; the only URLs this subset needs are local paint servers.
  const remaining = value.replace(/url\(\s*(['"]?)#[a-z_][\w:.-]*\1\s*\)/gi, '');
  if (/[\\@<>]|\/\*|url\s*\(|expression\s*\(|(?:javascript|vbscript)\s*:|(?:behavior|-moz-binding)\s*:/i.test(remaining)) throw new Error('Unsafe SVG export.');
};

// A small XML lexer verifies a closed, balanced drawing subset. It rejects unsupported markup rather than claiming
// to sanitize arbitrary XML. The viewer must separately sanitize using the browser DOM before it calls export.
export function verifySvgExport(input: unknown): Buffer {
  if (typeof input !== 'string' || Buffer.byteLength(input) > DIAGRAM_OUTPUT_LIMIT) throw new Error('Invalid SVG export.');
  const svg = input.trim(), stack: string[] = [];
  let cursor = 0, roots = 0, elements = 0;
  while (cursor < svg.length) {
    const next = svg.indexOf('<', cursor), end = next === -1 ? svg.length : next;
    const text = xmlText(svg.slice(cursor, end));
    if (!stack.length && text.trim()) throw new Error('Invalid SVG export.');
    if (stack.at(-1) === 'style') safeCss(text);
    if (next === -1) { cursor = end; break; }
    cursor = next;
    if (svg.startsWith('<!--', cursor)) {
      const closing = svg.indexOf('-->', cursor + 4);
      if (closing === -1 || svg.slice(cursor + 4, closing).includes('--')) throw new Error('Invalid SVG export.');
      cursor = closing + 3; continue;
    }
    const closing = /^<\/([A-Za-z][\w-]*)\s*>/.exec(svg.slice(cursor));
    if (closing) { if (stack.pop() !== closing[1]) throw new Error('Invalid SVG export.'); cursor += closing[0].length; continue; }
    const opening = /^<([A-Za-z][\w-]*)/.exec(svg.slice(cursor));
    if (!opening || !SVG_TAGS.has(opening[1]) || ++elements > 50000 || stack.length > 256) throw new Error('Unsafe SVG export.');
    const tag = opening[1];
    if (!stack.length && (tag !== 'svg' || ++roots !== 1)) throw new Error('Invalid SVG export.');
    cursor += opening[0].length;
    const attributes = new Set<string>();
    for (;;) {
      const ending = /^\s*(\/?>)/.exec(svg.slice(cursor));
      if (ending) { cursor += ending[0].length; if (ending[1] !== '/>') stack.push(tag); break; }
      const attribute = /^\s+([A-Za-z_:][\w:.-]*)\s*=\s*(["'])([\s\S]*?)\2/.exec(svg.slice(cursor));
      if (!attribute || attribute[3].includes('<')) throw new Error('Invalid SVG export.');
      cursor += attribute[0].length;
      const name = attribute[1].toLowerCase(), value = xmlText(attribute[3]).trim();
      if (attributes.has(name) || !SVG_ATTRIBUTES.has(name)) throw new Error('Unsafe SVG export.');
      attributes.add(name);
      if ((name === 'href' || name === 'xlink:href') && !/^#[a-z_][\w:.-]*$/i.test(value)) throw new Error('Unsafe SVG export.');
      if (name === 'xmlns' && value !== 'http://www.w3.org/2000/svg' || name === 'xmlns:xlink' && value !== 'http://www.w3.org/1999/xlink') throw new Error('Unsafe SVG export.');
      if (!['id', 'class', 'role', 'aria-label', 'aria-hidden', 'aria-labelledby', 'aria-describedby'].includes(name)) safeCss(value);
    }
  }
  if (stack.length || roots !== 1) throw new Error('Invalid SVG export.');
  return Buffer.from(svg);
}

export function verifyPngExport(input: unknown): Buffer {
  if (typeof input !== 'string' || input.length > Math.ceil(DIAGRAM_OUTPUT_LIMIT * 4 / 3) + 40) throw new Error('Invalid PNG export.');
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(input);
  if (!match) throw new Error('Invalid PNG export.');
  const bytes = Buffer.from(match[1], 'base64');
  if (bytes.length > DIAGRAM_OUTPUT_LIMIT || bytes.length < 45 || bytes.toString('base64') !== match[1]
    || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii', 12, 16) !== 'IHDR'
    || bytes.toString('hex', bytes.length - 12) !== '0000000049454e44ae426082') throw new Error('Invalid PNG export.');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width > 32768 || height > 32768 || width * height > 64_000_000) throw new Error('The diagram image is too large.');
  return bytes;
}
