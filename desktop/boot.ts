// Entry point of the desktop app. When installed, it prepares the framework and
// workspace paths before loading the rest of the app. Development uses the checkout.

import { app, dialog } from 'electron';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareInstalledFramework } from './framework.ts';
import { fixToolPath } from './tool-path.ts';

async function prepareInstalledApp(): Promise<boolean> {
  const here = dirname(fileURLToPath(import.meta.url));
  let buildId = app.getVersion();
  try { buildId = (JSON.parse(readFileSync(join(here, 'build-info.json'), 'utf8')) as { buildId: string }).buildId; } catch { /* use the version */ }
  try {
    prepareInstalledFramework(join(process.resourcesPath, 'framework'), app.getPath('documents'), buildId);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await app.whenReady(); // On Linux, a dialog shown before ready only writes to stderr.
    dialog.showErrorBox('Moki could not start', `Moki could not prepare its framework files. Check access to the folder and reopen Moki.\n\n${message}`);
    app.exit(1);
    return false;
  }
}

if (!app.isPackaged || await prepareInstalledApp()) {
  // main.mjs is a separate built file next to this one; it must load after QA_ROOT is set.
  const mainEntry = './main.mjs';
  await import(mainEntry);

  // Started from the app menu, the app does not get the terminal's PATH, so AI tools would look missing (desktop/tool-path.ts).
  // Read in the background, after the app's code is loaded: detection and installs wait for it (pathReady), the window does not.
  if (app.isPackaged) void fixToolPath();
}
