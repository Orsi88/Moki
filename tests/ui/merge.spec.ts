// Merging a project into another from the start screen: the preview names what takes another name, the merge
// needs the receiving project's name typed, and afterwards that project opens with both notes and the source is suspended.
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
  root = mkdtempSync(join(tmpdir(), 'moki-merge-ui-'));
  userData = mkdtempSync(join(tmpdir(), 'moki-merge-profile-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  const acme = makeProject('acme', 'Acme Library');
  const beta = makeProject('beta', 'Beta Portal');
  writeFileSync(join(acme, 'notes', 'ideias.md'), '# Ideias da Acme\n');
  writeFileSync(join(acme, '.moki-note-titles.json'), JSON.stringify([{ path: 'notes/ideias.md', title: 'Ideias de teste' }]));
  writeFileSync(join(beta, 'notes', 'ideias.md'), '# Ideias da Beta\n');
  writeFileSync(join(acme, 'context', 'glossary.md'), '# Glossary\n\n- Apólice: contrato\n');

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

test('a project merges into another from its menu, with a preview and the name typed', async () => {
  await page.getByRole('button', { name: /^Workspace 2 projetos/ }).click();
  await page.locator('.home-row', { hasText: 'Acme Library' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Mesclar em outro projeto…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Mesclar Acme Library em outro projeto' });
  await expect(dialog.locator('select option')).toHaveText(['Escolha um projeto', 'Beta Portal']); // not itself
  await dialog.locator('select').selectOption('beta');
  await expect(dialog).toContainText('1 recebe outro nome');
  await expect(dialog).toContainText('1 arquivo de contexto fica ao lado');
  const merge = dialog.getByRole('button', { name: 'Mesclar', exact: true });
  await expect(merge).toBeDisabled();
  await dialog.locator('details').first().locator('summary').click();
  await expect(dialog.locator('.merge-moves').first()).toContainText('notes/ideias-2.md');
  await dialog.getByRole('textbox').fill('Beta Portal');
  const shots = process.env.QA_SHOTS;
  if (shots) {
    for (const mode of ['light', 'dark'] as const) {
      await page.evaluate((m) => { document.documentElement.setAttribute('data-theme', m); }, mode);
      await page.waitForTimeout(150);
      await dialog.screenshot({ path: join(shots, `merge-${mode}.png`) });
    }
  }
  await expect(merge).toBeEnabled();
  await merge.click();
  await expect(dialog).toHaveCount(0);
  const beta = join(root, 'workspace', 'projects', 'beta');
  expect(readFileSync(join(beta, 'notes', 'ideias.md'), 'utf8')).toBe('# Ideias da Beta\n');
  expect(readFileSync(join(beta, 'notes', 'ideias-2.md'), 'utf8')).toBe('# Ideias da Acme\n');
  expect(existsSync(join(beta, 'context', 'glossary-acme.md'))).toBe(true);
  expect(existsSync(join(root, 'workspace', 'suspended', 'acme', 'project.json'))).toBe(true);
  // The receiving project opens, and the copied note keeps its title in the tree.
  await expect(page.locator('.tree-row[title="notes/ideias-2.md"]')).toContainText('Ideias de teste');
});
