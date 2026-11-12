// Clock, tray and native notifications for routines. The engine keeps running
// when the window is hidden; the tray is optional and never required for a tick.

import { app, Menu, nativeImage, Notification, powerMonitor, Tray, type BrowserWindow } from 'electron';
import { existsSync } from 'node:fs';
import type { RoutineNote, RoutineSettings } from '../scripts/lib/routines.ts';

export interface RoutineHost {
  stop: () => void;
}

export function startRoutineHost(opts: {
  tick: () => Promise<unknown>;
  notes: () => RoutineNote[];
  settings: () => RoutineSettings;
  setPaused: (paused: boolean) => void;
  getWindow: () => BrowserWindow | null;
  show: (note?: RoutineNote) => void;
  quit: () => void;
  iconFile: string;
  cupFile: string;
}): RoutineHost {
  const shown = new Set<string>();
  let tray: Tray | null = null;
  const cup = existsSync(opts.cupFile) ? nativeImage.createFromPath(opts.cupFile) : undefined;

  const showFresh = () => {
    if (!Notification.isSupported()) return;
    for (const note of opts.notes()) {
      if (note.system === false || note.readAt || shown.has(note.id) || note.category === 'info') continue;
      shown.add(note.id);
      const toast = new Notification({ title: note.title, body: note.message, icon: cup });
      toast.on('click', () => opts.show(note));
      toast.show();
    }
  };

  const syncTray = () => {
    const settings = opts.settings();
    try { app.setLoginItemSettings({ openAtLogin: settings.openAtLogin }); } catch { /* this session cannot register a login item */ }
    if (!settings.background) {
      tray?.destroy();
      tray = null;
      return;
    }
    if (!existsSync(opts.iconFile)) return;
    try {
      if (!tray) tray = new Tray(nativeImage.createFromPath(opts.iconFile));
      const pending = opts.notes().filter((n) => !n.readAt && n.category === 'approval').length;
      tray.setToolTip(pending ? `Moki · ${pending}` : 'Moki');
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open Moki', click: () => opts.show() },
        { label: pending ? `Approvals waiting: ${pending}` : 'No approvals waiting', enabled: false },
        { label: settings.schedulerPaused ? 'Resume scheduler' : 'Pause scheduler', click: () => opts.setPaused(!settings.schedulerPaused) },
        { label: 'Notifications', click: () => opts.show() },
        { type: 'separator' },
        { label: 'Quit Moki', click: () => opts.quit() },
      ]));
    } catch { /* a desktop without a tray still runs the clock */ }
  };

  let busy = false;
  const pass = () => {
    if (busy) return;
    busy = true;
    void opts.tick().then(() => { showFresh(); syncTray(); }).catch(() => { syncTray(); }).finally(() => { busy = false; });
  };
  const timer = setInterval(pass, 30_000);
  const onResume = () => pass();
  pass();
  powerMonitor.on('resume', onResume);
  return {
    stop: () => {
      clearInterval(timer);
      powerMonitor.off('resume', onResume);
      tray?.destroy();
    },
  };
}
