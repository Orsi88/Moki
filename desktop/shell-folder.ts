// The folder the system asks Moki to open: "Open in Moki" on a folder (Windows Explorer, Linux "Open with"),
// or `Moki <folder>`. argv as Electron gives it: packaged [exe, ...args], from source [electron, app, ...args]
// (the `qa` command starts `electron <root>`, so the root is never taken). Chromium may add its own --switches,
// and Linux file managers may pass a file:// URI (%U). The last argument that is an existing folder wins.
// `app`: the app's own folder, never taken even when switches come before it (Playwright starts
// `electron --inspect=0 --remote-debugging-port=0 <app>`, so its position alone does not say it is the app).
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function folderArg(argv: string[], cwd: string, fromSource: boolean, app?: string): string | null {
  const own = app ? resolve(app) : null;
  for (const raw of argv.slice(fromSource ? 2 : 1).reverse()) {
    if (!raw || raw.startsWith('-')) continue;
    if (own && resolve(cwd, raw) === own) continue;
    let path = raw;
    if (raw.startsWith('file://')) { try { path = fileURLToPath(raw); } catch { continue; } }
    const full = resolve(cwd, path);
    try { if (statSync(full).isDirectory()) return full; } catch { /* not a folder */ }
  }
  return null;
}
