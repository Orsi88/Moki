// An AI terminal takes images and files: a pasted screenshot is saved in temporary/pasted/ and its path typed in
// the prompt; a file dragged from the project tree is typed by its full path. QA_FAKE_TOOLS echoes what is typed.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

let app: ElectronApplication;
let page: Page;
let root = '';
let userData = '';
let project = '';

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'moki-term-images-ui-'));
  userData = mkdtempSync(join(tmpdir(), 'moki-term-images-profile-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  project = join(root, 'workspace', 'projects', 'acme');
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary', 'notes']) mkdirSync(join(project, dir), { recursive: true });
  const file = join(project, 'project.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...data, project: 'acme', name: 'Acme Library' }, null, 2)}\n`);
  writeFileSync(join(project, 'inbox', 'log do erro.txt'), 'ERROR 500\n');

  app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: userData, QA_OPEN_PROJECT: 'acme', QA_FAKE_TOOLS: '1' });
  page = await app.firstWindow();
  page.on('pageerror', (err) => console.error('pageerror', err.message));
  await page.evaluate(() => { localStorage.setItem('qa-ui-language', 'pt-BR'); });
  const reloaded = page.waitForEvent('load');
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].webContents.reload(); });
  await reloaded;
});

test.afterAll(async () => {
  await Promise.race([app?.close().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 3000))]);
  for (const dir of [root, userData]) {
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch { /* the window can keep its profile locked briefly */ }
  }
});

const pane = () => page.locator('.term-pane:not([hidden])');

test('a screenshot pasted into an AI terminal is saved and its path typed; a text paste stays text', async () => {
  await page.getByRole('button', { name: 'Novo: terminal, IA ou arquivo', exact: true }).click();
  await page.getByRole('menuitem', { name: 'IA', exact: true }).click();
  await page.getByRole('menuitem', { name: /Claude Code/ }).click();
  await expect(pane()).toContainText('[ready]');
  await pane().locator('textarea').focus();
  // A 1x1 PNG on the clipboard, as a screenshot tool leaves it.
  await pane().locator('textarea').evaluate((el) => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([png], 'image.png', { type: 'image/png' }));
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  const pasted = join(project, 'temporary', 'pasted');
  await expect.poll(() => (existsSync(pasted) ? readdirSync(pasted) : [])).toHaveLength(1);
  const name = readdirSync(pasted)[0];
  expect(name).toMatch(/^print-\d{14}\.png$/);
  await expect(pane().locator('.xterm-rows')).toContainText(name);
  await expect(pane().locator('.xterm-rows')).toContainText('pasted');

  await pane().locator('textarea').evaluate((el) => {
    const data = new DataTransfer();
    data.setData('text/plain', 'texto colado');
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(pane().locator('.xterm-rows')).toContainText('texto colado');
  expect(readdirSync(pasted)).toHaveLength(1); // nothing saved for text
});

test('a file dragged from the project tree onto an AI terminal is typed by its full path, not copied', async () => {
  await page.locator('.tree-row[title="inbox"]').click();
  const row = page.locator('.tree-row[title="inbox/log do erro.txt"]');
  await expect(row).toBeVisible();
  const before = readdirSync(join(project, 'inbox'));
  await pane().evaluate((el) => {
    const data = new DataTransfer();
    data.setData('application/x-moki-move', 'inbox/log do erro.txt');
    el.dispatchEvent(new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true }));
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));
  });
  await expect(pane().locator('.xterm-rows')).toContainText('log do erro.txt"');
  expect(readdirSync(join(project, 'inbox'))).toEqual(before);
});
