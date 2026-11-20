// The real built IDE panel in a hidden Electron window, with a stand-in VS Code
// message host: a failed state read must be visible and a retry must recover.
import { test, expect, type ElectronApplication } from '@playwright/test';
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

interface PanelWindow extends Window { mokiPanelTest: { pending: number[]; launches: number } }

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
      webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false },
    }));
    await host.evaluate((window) => window.loadURL('about:blank'));
    const page = await nextWindow;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const control = { pending: [] as number[], launches: 0 };
      let ai = 'copilot';
      const connections = () => ({ ai, folder: '/fixture/project', workspace: 'Fixture', configuration: 'automatic', choices: [
        { id: 'copilot', label: 'GitHub Copilot', available: true, automatic: true, reason: '' },
        { id: 'cursor', label: 'Cursor', available: false, automatic: false, reason: 'Cursor prompt links require you to confirm the request. Automatic chat launch is not available.' },
      ], servers: [{ id: 'moki', name: 'Moki', transport: 'stdio', access: 'read', issues: [], authentication: false }] });
      Object.defineProperty(window, 'mokiPanelTest', { value: control });
      Object.defineProperty(window, 'acquireVsCodeApi', { value: () => ({
        postMessage: (msg: { id?: number; method?: string; args?: unknown[] }) => {
          if (typeof msg.id !== 'number') return;
          if (msg.method === 'state') { control.pending.push(msg.id); return; }
          if (msg.method === 'selectAi') ai = String(msg.args?.[0]);
          if (msg.method === 'startChat') control.launches++;
          const value = msg.method === 'activities' ? { activities: [{ id: 'inspect-file', label: 'Inspect a file', hint: 'Understand this project file', available: true, needsFiles: false }], languages: ['English'] }
            : msg.method === 'connections' || msg.method === 'selectAi' ? connections()
            : msg.method === 'startChat' ? { status: 'unconfirmed', message: 'Request dispatched to a new chat tab. Follow its execution there.' }
            : msg.method === 'testMcp' ? { at: new Date().toISOString(), ok: true, tools: [{ name: 'read_project' }], ms: 1 }
            : [];
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

    // A single primary action; legacy routes stay collapsed. Unsupported providers cannot dispatch.
    await expect(page.getByRole('combobox', { name: 'AI', exact: true })).toHaveValue('copilot');
    await page.getByRole('button', { name: /^Inspect a file/ }).click();
    const start = page.getByRole('button', { name: 'Start in a new chat', exact: true });
    await expect(start).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Copy for the chat', exact: true })).not.toBeVisible();
    await start.click();
    await expect(page.getByRole('status')).toContainText('Request dispatched to a new chat tab');
    expect(await page.evaluate(() => (window as PanelWindow).mokiPanelTest.launches)).toBe(1);
    await page.getByRole('combobox', { name: 'AI', exact: true }).selectOption('cursor');
    await expect(start).toBeDisabled();
    await expect(page.getByText('Cursor prompt links require', { exact: false })).toBeVisible();
    await page.getByRole('combobox', { name: 'AI', exact: true }).selectOption('copilot');
    await page.getByRole('button', { name: 'Connections', exact: true }).click();
    await page.getByRole('button', { name: 'Test', exact: true }).click();
    await expect(page.getByText('Server responded: 1 tools', { exact: false })).toBeVisible();
    await host.evaluate((window) => window.setSize(280, 720));
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBeLessThanOrEqual(280);
    await expect.poll(() => page.locator('.mk').evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.locator('body').evaluate((body) => body.classList.add('vscode-light'));
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(251, 248, 241)');
    if (process.env.QA_COMPANION_PREVIEW) {
      await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
      const png = await host.evaluate(async (window) => (await window.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true })).toPNG().toString('base64'));
      writeFileSync(process.env.QA_COMPANION_PREVIEW, Buffer.from(png, 'base64'));
    }
    await page.getByRole('button', { name: 'Done', exact: true }).click();

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
