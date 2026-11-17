// Moving in the project tree: Ctrl+click picks several files, dragging one of them moves them all, a folder goes into
// another folder, and Esc ends the selection.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
  root = mkdtempSync(join(tmpdir(), 'moki-tree-move-ui-'));
  userData = mkdtempSync(join(tmpdir(), 'moki-tree-move-profile-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  project = join(root, 'workspace', 'projects', 'acme');
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary', 'notes', 'Bugs', 'Fluxos']) mkdirSync(join(project, dir), { recursive: true });
  const file = join(project, 'project.json');
  writeFileSync(file, `${JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), project: 'acme', name: 'Acme Library' }, null, 2)}\n`);
  writeFileSync(join(project, 'Bugs', 'bug-1.md'), '# Bug 1\n');
  for (const name of ['a.md', 'b.md', 'c.md']) writeFileSync(join(project, name), `# ${name}\n`);

  app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: userData, QA_OPEN_PROJECT: 'acme', QA_FAKE_TOOLS: '1' });
  page = await app.firstWindow();
  page.on('pageerror', (err) => console.error('pageerror', err.message));
  await page.evaluate(() => { localStorage.setItem('qa-ui-language', 'pt-BR'); localStorage.setItem('qa-language', 'Portuguese (pt-BR)'); });
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

const row = (path: string) => page.locator(`.tree-row[title="${path}"]`);

test('Ctrl+click picks files; Esc and a plain click end the selection', async () => {
  await row('a.md').click({ modifiers: ['Control'] });
  await row('b.md').click({ modifiers: ['Control'] });
  await expect(page.locator('.tree-row.selected')).toHaveCount(2);
  await row('b.md').click({ modifiers: ['Control'] }); // again: out of the selection
  await expect(page.locator('.tree-row.selected')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tree-row.selected')).toHaveCount(0);
  await expect(row('context')).toBeVisible();
  await row('context').click({ modifiers: ['Control'] }); // Moki's own folders are not picked
  await expect(page.locator('.tree-row.selected')).toHaveCount(0);
});

test('dragging one of the picked files moves them all to the folder', async () => {
  await row('a.md').click({ modifiers: ['Control'] });
  await row('b.md').click({ modifiers: ['Control'] });
  const shots = process.env.QA_SHOTS;
  if (shots) {
    const side = await page.locator('.sidebar').boundingBox();
    for (const mode of ['light', 'dark'] as const) {
      await page.evaluate((m) => { document.documentElement.setAttribute('data-theme', m); }, mode);
      await page.waitForTimeout(150);
      // Through Electron, twice: Playwright's capture stalls on a project window off screen, and the first capture can be the frame before.
      const png = await app.evaluate(async ({ BrowserWindow }, rect) => { const web = BrowserWindow.getAllWindows()[0].webContents; await web.capturePage(rect); return (await web.capturePage(rect)).toPNG().toString('base64'); },
        { x: Math.floor(side!.x), y: Math.floor(side!.y), width: Math.ceil(side!.width), height: Math.min(460, Math.ceil(side!.height)) });
      writeFileSync(join(shots, `tree-select-${mode}.png`), Buffer.from(png, 'base64'));
    }
  }
  await row('b.md').dragTo(row('Fluxos'));
  await expect(page.getByText('2 itens movidos para Fluxos.')).toBeVisible();
  expect(existsSync(join(project, 'Fluxos', 'a.md'))).toBe(true);
  expect(existsSync(join(project, 'Fluxos', 'b.md'))).toBe(true);
  expect(existsSync(join(project, 'c.md'))).toBe(true);
  await expect(page.locator('.tree-row.selected')).toHaveCount(0);
});

test('a folder goes into another folder', async () => {
  await row('Bugs').dragTo(row('Fluxos'));
  await expect(page.getByText('Bugs foi para Fluxos.')).toBeVisible();
  expect(existsSync(join(project, 'Fluxos', 'Bugs', 'bug-1.md'))).toBe(true);
  expect(existsSync(join(project, 'Bugs'))).toBe(false);
});

test('dropped on the empty part of the tree, an item goes to the project root', async () => {
  const scroll = page.locator('.sidebar-scroll');
  const box = (await scroll.boundingBox())!;
  await row('Fluxos/a.md').dragTo(scroll, { targetPosition: { x: 40, y: box.height - 12 } });
  await expect(page.getByText('a.md foi para a pasta do projeto.')).toBeVisible();
  expect(existsSync(join(project, 'a.md'))).toBe(true);
});
