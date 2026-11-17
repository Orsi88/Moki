// The rail's New note on the start screen opens a loose note once: going into a project and back does not open
// another one, and pressing it again still does.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

let app: ElectronApplication;
let page: Page;
let root = '';
let userData = '';

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'moki-home-note-ui-'));
  userData = mkdtempSync(join(tmpdir(), 'moki-home-note-profile-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  const project = join(root, 'workspace', 'projects', 'acme');
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary', 'notes']) mkdirSync(join(project, dir), { recursive: true });
  const file = join(project, 'project.json');
  writeFileSync(file, `${JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), project: 'acme', name: 'Acme Library' }, null, 2)}\n`);

  app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: userData, QA_FAKE_TOOLS: '1' });
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

test('back from a project, the start screen does not open a note by itself', async () => {
  await page.getByRole('button', { name: /^Workspace 1 projeto/ }).click();
  const note = page.locator('.note-dialog');
  await page.locator('.ribbon-note').click();
  await expect(note).toBeVisible();
  await note.getByRole('button', { name: 'Fechar (Esc)' }).click();
  await expect(note).toHaveCount(0);

  await page.locator('.home-row', { hasText: 'Acme Library' }).click();
  await expect(page.locator('.tree-row[title="context"]')).toBeVisible();
  await page.getByRole('button', { name: 'Todos os projetos' }).click();
  await expect(page.locator('.home-row', { hasText: 'Acme Library' })).toBeVisible();
  await page.waitForTimeout(800); // the screen's effects have run: a note it opened by itself would be there by now
  await expect(note).toHaveCount(0);

  await page.locator('.ribbon-note').click(); // a new press still opens one
  await expect(note).toBeVisible();
});
