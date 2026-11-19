// Entry point of the desktop app. When installed, it prepares the framework and
// workspace paths before loading the rest of the app. Development uses the checkout.

import { app, dialog } from 'electron';
import { join } from 'node:path';
import { prepareInstalledFramework } from './framework.ts';
import { fixToolPath } from './tool-path.ts';

async function prepareInstalledApp(): Promise<boolean> {
  try {
    const { warning } = prepareInstalledFramework(join(process.resourcesPath, 'framework'), app.getPath('documents'));
    // Files in use are not a reason to stop: Moki opens with the ones there and says why some are older.
    if (warning) void app.whenReady().then(() => dialog.showMessageBox({ type: 'warning', title: 'Moki', message: 'Moki opened with some older files', detail: warning }));
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
