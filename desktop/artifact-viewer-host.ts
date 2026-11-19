// The artifact viewer of the project chat: a separate WebContentsView over the chat tab, with a persistent claude.ai
// session (the person signs in once) and nothing of Moki: no preload, no IPC, no local file protocol. It never shares
// the trusted window's permissions; only writing to the clipboard (the artifact's own Copy buttons) is allowed.

import { WebContentsView, session, type BrowserWindow } from 'electron';
import { basename, join } from 'node:path';
import { isViewerUrl, type ViewerBounds, type ViewerStatus } from './artifact-viewer.ts';

const PARTITION = 'persist:moki-claude';
const ALLOWED_PERMISSIONS = new Set(['clipboard-sanitized-write']);

export interface ArtifactViewer {
  show(scope: string, url: string, bounds: ViewerBounds): ViewerStatus;
  hide(scope?: string): void;
  reload(scope: string): void;
  close(): void;
}

// `scope`: the project folder (downloads start in its inbox). `fake` (UI tests): a local page instead of claude.ai.
// `shortcut`: Moki's own shortcuts still work while the artifact has the keyboard focus.
export function createArtifactViewer(window: () => BrowserWindow | null, external: (url: string) => void, fake = false, shortcut?: (key: 'chat' | 'call') => void): ArtifactViewer {
  let current: { scope: string; requested: string; view: WebContentsView; status: ViewerStatus } | null = null;
  let configured = false;
  const detach = () => { if (current) { current.view.setVisible(false); window()?.contentView.removeChildView(current.view); } };
  const close = () => {
    detach();
    if (current && !current.view.webContents.isDestroyed()) current.view.webContents.close();
    current = null;
  };
  const load = (entry: NonNullable<typeof current>, url: string) => {
    entry.requested = url;
    entry.status.url = url;
    entry.status.error = '';
    entry.status.loading = true;
    const target = fake ? `data:text/html,${encodeURIComponent(`<html><body><h1>Artifact</h1><p>${url.replace(/[<>&"]/g, '')}</p></body></html>`)}` : url;
    void entry.view.webContents.loadURL(target).catch((e: Error) => { entry.status.loading = false; entry.status.error = e.message; entry.view.setVisible(false); });
  };

  return {
    show(scope, url, bounds) {
      const win = window();
      if (!win || win.isDestroyed()) throw new Error('The Moki window is closed.');
      if (!isViewerUrl(url)) throw new Error('This link is not a Claude artifact.');
      if (current && current.scope !== scope) close();
      if (!current) {
        const browser = session.fromPartition(PARTITION);
        if (!configured) {
          configured = true;
          browser.setPermissionRequestHandler((_wc, permission, done) => done(ALLOWED_PERMISSIONS.has(permission)));
          browser.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));
          browser.on('will-download', (_event, item, contents) => {
            if (current?.view.webContents !== contents) return;
            item.setSaveDialogOptions({ defaultPath: join(current.scope, 'inbox', basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')) });
          });
        }
        const view = new WebContentsView({ webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true } });
        const entry = { scope, requested: '', view, status: { url, loading: true, error: '' } };
        current = entry;
        view.webContents.on('before-input-event', (event, input) => {
          if (input.type !== 'keyDown' || input.alt || !(input.control || input.meta)) return;
          const key = input.key.toLowerCase();
          if ((key === 'l' && !input.shift) || (key === 'k' && input.shift)) { event.preventDefault(); win.webContents.focus(); shortcut?.(key === 'l' ? 'chat' : 'call'); }
        });
        // Sign-in pop-ups stay inside the same session; other pages open in the browser.
        view.webContents.setWindowOpenHandler(({ url: target }) => {
          if (isViewerUrl(target)) return { action: 'allow', overrideBrowserWindowOptions: { parent: win, autoHideMenuBar: true,
            webPreferences: { partition: PARTITION, contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true } } };
          if (/^https?:\/\//.test(target)) external(target);
          return { action: 'deny' };
        });
        view.webContents.on('will-navigate', (event, target) => {
          if (!isViewerUrl(target)) { event.preventDefault(); if (/^https?:\/\//.test(target)) external(target); }
        });
        view.webContents.on('did-navigate', (_event, target) => { if (isViewerUrl(target)) entry.status.url = target; });
        view.webContents.on('did-start-loading', () => { entry.status.loading = true; });
        view.webContents.on('did-stop-loading', () => { entry.status.loading = false; });
        view.webContents.on('did-fail-load', (_e, code, message, _url, mainFrame) => {
          if (mainFrame && code !== -3) { entry.status.loading = false; entry.status.error = message; view.setVisible(false); }
        });
        view.webContents.on('render-process-gone', () => { entry.status.error = 'The artifact stopped. Open it again to continue.'; view.setVisible(false); });
      }
      const entry = current;
      if (entry.requested !== url) load(entry, url);
      const zoom = win.webContents.getZoomFactor();
      const area = win.getContentBounds();
      const x = Math.min(Math.max(0, Math.round(bounds.x * zoom)), area.width - 1);
      const y = Math.min(Math.max(0, Math.round(bounds.y * zoom)), area.height - 1);
      entry.view.setBounds({ x, y, width: Math.max(1, Math.min(Math.round(bounds.width * zoom), area.width - x)), height: Math.max(1, Math.min(Math.round(bounds.height * zoom), area.height - y)) });
      win.contentView.addChildView(entry.view);
      entry.view.setVisible(!entry.status.error);
      return { ...entry.status };
    },
    hide(scope) { if (!scope || current?.scope === scope) detach(); },
    reload(scope) {
      if (current?.scope !== scope) return;
      // After a failure the artifact is loaded again; otherwise the page shown now (it may be a sign-in) reloads.
      if (current.status.error) load(current, current.requested);
      else current.view.webContents.reload();
    },
    close,
  };
}
