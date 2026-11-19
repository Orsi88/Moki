// The real built IDE panel in a hidden Electron window, with a stand-in VS Code
// message host: a failed state read must be visible and a retry must recover.
import { test, expect, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

interface PanelWindow extends Window { mokiPanelTest: { pending: number[] } }

test('IDE panel shows state failures, retries and recovers with or without a project', async () => {
  const base = realpathSync(tmpdir());
  const root = mkdtempSync(join(base, 'moki-panel-ui-'));
  let app: ElectronApplication | undefined;
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
    app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: join(root, 'profile') });
    await app.firstWindow();
    const nextWindow = app.waitForEvent('window');
    const host = await app.evaluateHandle(({ BrowserWindow }) => new BrowserWindow({
      show: false, width: 360, height: 720,
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
    }));
    await host.evaluate((window) => window.loadURL('about:blank'));
    const page = await nextWindow;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const control = { pending: [] as number[] };
      Object.defineProperty(window, 'mokiPanelTest', { value: control });
      Object.defineProperty(window, 'acquireVsCodeApi', { value: () => ({
        postMessage: (msg: { id?: number; method?: string }) => {
          if (typeof msg.id !== 'number') return;
          if (msg.method === 'state') { control.pending.push(msg.id); return; }
          const value = msg.method === 'activities' ? { activities: [], languages: ['English'] } : [];
          queueMicrotask(() => window.dispatchEvent(new MessageEvent('message', { data: { id: msg.id, reply: { ok: true, value } } })));
        },
      }) });
    });
    await page.goto(pathToFileURL(join(ROOT, 'ide', 'vscode', 'dist', 'webview', 'companion.html')).href);
    const respond = async (error?: string, connected = true) => {
      await expect.poll(() => page.evaluate(() => (window as PanelWindow).mokiPanelTest.pending.length)).toBeGreaterThan(0);
      await page.evaluate(({ error, connected }) => {
        const reply = error ? { ok: false, error } : { ok: true, value: {
          project: connected ? { id: 'acme', name: 'Panel project', description: '', repository: '' } : null,
          projects: [{ id: 'acme', name: 'Panel project' }], folder: null, mcp: [],
        } };
        for (const id of (window as PanelWindow).mokiPanelTest.pending.splice(0)) {
          window.dispatchEvent(new MessageEvent('message', { data: { id, reply } }));
        }
      }, { error, connected });
    };

    await expect(page.getByText('Loading…', { exact: true })).toBeVisible();
    const failure = 'Permission denied: C:\\Moki\\.claude\\skills';
    await respond(failure);
    await expect(page.getByRole('alert')).toContainText(failure);
    await expect(page.getByText('Loading…', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByText('Loading…', { exact: true })).toBeVisible();
    await respond('Still unavailable');
    await expect(page.getByRole('alert')).toContainText('Still unavailable');
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await respond();
    await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toHaveValue('acme');
    await expect(page.getByRole('tab', { name: 'Activities', exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0);

    // A later refresh failure keeps the last project visible and offers the same recovery.
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    await respond('Refresh failed');
    await expect(page.getByRole('alert')).toContainText('Refresh failed');
    await expect(page.getByRole('combobox', { name: 'Project', exact: true })).toHaveValue('acme');
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await respond(undefined, false);
    await expect(page.getByText('This folder is not linked to a Moki project.', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(errors).toEqual([]);
    await host.evaluate((window) => window.destroy());
    await host.dispose();
  } finally {
    await app?.close();
    assertTemporaryRoot();
    rmSync(root, { recursive: true, force: true });
  }
  function assertTemporaryRoot() { expect(dirname(root)).toBe(base); }
});
