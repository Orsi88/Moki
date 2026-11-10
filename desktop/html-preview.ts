// Capability URLs for runnable local HTML previews. Only web assets of the chosen project are served;
// the iframe has an opaque origin, no Moki bridge, no filesystem API and no network access.
import { annotationScript } from './preview-annotations.mjs';
import { randomBytes } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, relative, sep } from 'node:path';
import { resolveInside } from './fs-guard.ts';
import type { FileGrantDeps } from './file-protocol.ts';

export const PREVIEW_SCHEME = 'moki-preview';
const LIMIT = 30 * 1024 * 1024;
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};
export const PREVIEW_CSP = [
  "default-src 'none'", `script-src ${PREVIEW_SCHEME}: 'unsafe-inline' 'unsafe-eval' blob:`,
  `style-src ${PREVIEW_SCHEME}: 'unsafe-inline'`, `img-src ${PREVIEW_SCHEME}: data: blob:`,
  `font-src ${PREVIEW_SCHEME}: data:`, `media-src ${PREVIEW_SCHEME}: blob:`, `connect-src ${PREVIEW_SCHEME}:`,
  "frame-src 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'none'", "worker-src blob:",
  'sandbox allow-scripts allow-forms',
].join('; ');
interface Grant { scope: number; project: string; workspace: string; base: string; entry: string }

export function createPreviewGrants(deps: FileGrantDeps) {
  const grants = new Map<string, Grant>();
  const bases = (project: string) => (deps.bases(project) ?? []).map((base) => { try { return realpathSync(base); } catch { return ''; } }).filter(Boolean);
  const inside = (base: string, file: string) => { try { return resolveInside(base, relative(base, file)) === file; } catch { return false; } };
  return {
    grant(scope: number, project: string, file: string): string | null {
      try {
        const entry = realpathSync(file);
        const base = bases(project).find((b) => inside(b, entry));
        if (!base || !/\.html?$/i.test(entry) || statSync(entry).size > LIMIT) return null;
        for (const [token, grant] of grants) if (grant.scope === scope && grant.project === project && grant.base === base && grant.entry === entry && grant.workspace === deps.workspace()) return `${PREVIEW_SCHEME}://${token}/${relative(base, entry).split(sep).map(encodeURIComponent).join('/')}`;
        const mine = [...grants].filter(([, g]) => g.scope === scope);
        if (mine.length >= 32) grants.delete(mine[0][0]);
        const token = randomBytes(24).toString('hex');
        grants.set(token, { scope, project, workspace: deps.workspace(), base, entry });
        return `${PREVIEW_SCHEME}://${token}/${relative(base, entry).split(sep).map(encodeURIComponent).join('/')}`;
      } catch { return null; }
    },
    revokeScope(scope: number): void { for (const [key, grant] of grants) if (grant.scope === scope) grants.delete(key); },
    revokeOutside(scope: number, project: string): void { for (const [key, grant] of grants) if (grant.scope === scope && grant.project !== project) grants.delete(key); },
    async serve(method: string, url: string): Promise<Response> {
      const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Access-Control-Allow-Origin': '*', 'Content-Security-Policy': PREVIEW_CSP };
      const missing = () => new Response(method === 'HEAD' ? null : 'Not found', { status: 404, headers });
      if (!['GET', 'HEAD'].includes(method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
      try {
        const parsed = new URL(url);
        const grant = parsed.protocol === `${PREVIEW_SCHEME}:` && /^[0-9a-f]{48}$/.test(parsed.hostname) ? grants.get(parsed.hostname) : undefined;
        if (!grant || grant.workspace !== deps.workspace() || !bases(grant.project).includes(grant.base)) return missing();
        const path = decodeURIComponent(parsed.pathname).replace(/^\//, '');
        if (path.includes('\\') || path.split('/').some((part) => part.startsWith('.') || /^(node_modules|backups)$/i.test(part))) return missing();
        const file = resolveInside(grant.base, path);
        const type = TYPES[extname(file).toLowerCase()];
        if (!type || !statSync(file).isFile() || statSync(file).size > LIMIT) return missing();
        let data = method === 'HEAD' ? null : new Uint8Array(await readFile(file));
        if (data && data.byteLength > LIMIT) return missing();
        if (data && /\.html?$/i.test(file)) data = new Uint8Array(Buffer.from(Buffer.from(data).toString('utf8') + annotationScript));
        return new Response(data, { headers: { ...headers, 'Content-Type': type } });
      } catch { return missing(); }
    },
  };
}
