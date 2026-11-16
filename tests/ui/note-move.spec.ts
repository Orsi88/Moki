// Moving a note to another project from its menu in the tree: the dialog says what stays behind, and the note
// leaves this project's tree and lands in the other one with its title.
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

const makeProject = (id: string, name: string) => {
  const project = join(root, 'workspace', 'projects', id);
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary', 'notes']) mkdirSync(join(project, dir), { recursive: true });
  const file = join(project, 'project.json');
  writeFileSync(file, `${JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), project: id, name }, null, 2)}\n`);
  return project;
};

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'moki-note-move-ui-'));
  userData = mkdtempSync(join(tmpdir(), 'moki-note-move-profile-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  const acme = makeProject('acme', 'Acme Library');
  makeProject('beta', 'Beta Portal');
  writeFileSync(join(acme, 'notes', 'ideias.md'), '# Ideias\n\nVer [a spec](../inbox/spec.md).\n');
  writeFileSync(join(acme, 'inbox', 'spec.md'), 'spec\n');
  writeFileSync(join(acme, '.moki-note-titles.json'), JSON.stringify([{ path: 'notes/ideias.md', title: 'Ideias de teste' }]));

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

test('a note moves to another project from its menu', async () => {
  const row = page.locator('.tree-row[title="notes/ideias.md"]');
  await row.click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Mover para outro projeto…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Mover "Ideias de teste" para outro projeto' });
  await expect(dialog.locator('select option')).toHaveText(['Escolha um projeto', 'Beta Portal']);
  const move = dialog.getByRole('button', { name: 'Mover', exact: true });
  await expect(move).toBeDisabled();
  await dialog.locator('select').selectOption('beta');
  await expect(dialog).toContainText('1 link para um arquivo deste projeto deixa de abrir.');
  const shots = process.env.QA_SHOTS;
  if (shots) {
    for (const mode of ['light', 'dark'] as const) {
      await page.evaluate((m) => { document.documentElement.setAttribute('data-theme', m); }, mode);
      await page.waitForTimeout(150);
          // Through Electron: Playwright's capture stalls on a project window on Windows (the window is off screen).
      const box = await dialog.boundingBox();
      // The first capture can return the last frame drawn before; the second has the current one.
      const png = await app.evaluate(async ({ BrowserWindow }, rect) => { const web = BrowserWindow.getAllWindows()[0].webContents; await web.capturePage(rect); return (await web.capturePage(rect)).toPNG().toString('base64'); },
        { x: Math.floor(box!.x), y: Math.floor(box!.y), width: Math.ceil(box!.width), height: Math.ceil(box!.height) });
      writeFileSync(join(shots, `note-move-${mode}.png`), Buffer.from(png, 'base64'));
    }
  }
  await move.click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Nota movida para Beta Portal.')).toBeVisible();
  await expect(row).toHaveCount(0);
  const beta = join(root, 'workspace', 'projects', 'beta');
  expect(readFileSync(join(beta, 'notes', 'ideias.md'), 'utf8')).toContain('# Ideias');
  expect(JSON.parse(readFileSync(join(beta, '.moki-note-titles.json'), 'utf8'))).toEqual([{ path: 'notes/ideias.md', title: 'Ideias de teste' }]);
  expect(existsSync(join(root, 'workspace', 'projects', 'acme', 'notes', 'ideias.md'))).toBe(false);
});
