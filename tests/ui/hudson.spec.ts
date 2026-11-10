// Hudson organizes the files runs left: the AI proposes (faked by QA_FAKE_TOOLS from the file names), the person
// keeps what they want checked, and Moki applies it: to the context, renamed, or to the trash.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

const RUN = '20261109-1500-requirements-review-us-12';
let app: ElectronApplication;
let page: Page;
let root = '';
let userData = '';
let project = '';

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'moki-hudson-ui-'));
  userData = mkdtempSync(join(tmpdir(), 'moki-hudson-profile-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  project = join(root, 'workspace', 'projects', 'acme');
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary', 'notes']) mkdirSync(join(project, dir), { recursive: true });
  const file = join(project, 'project.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...data, project: 'acme', name: 'Acme Library' }, null, 2)}\n`);
  const run = join(project, 'runs', RUN);
  for (const sub of ['outputs', 'work', 'inputs']) mkdirSync(join(run, sub), { recursive: true });
  // work/ stays empty, as older runs left it: the project still opens (an empty folder is removed, not trashed).
  writeFileSync(join(run, 'state.json'), JSON.stringify({ schemaVersion: '1', id: RUN, project: 'acme', skill: 'requirements-review', title: 'Revisão da US-12', status: 'completed', currentStep: '', completedSteps: [], pending: [], approvals: [], inputs: [], results: [], artifacts: [], createdAt: 'x', updatedAt: 'x' }));
  writeFileSync(join(run, 'outputs', 'definicoes.md'), '# Definições\n\nFrete grátis acima de R$ 100.\n');
  writeFileSync(join(run, 'outputs', 'saida.md'), '# Relatório\n');
  writeFileSync(join(run, 'outputs', 'matriz.md'), '# Matriz\n');
  writeFileSync(join(run, 'outputs', 'rascunho-apoio.md'), 'notas'); // a support file nobody asked for, next to the deliverables
  writeFileSync(join(run, 'inputs', 'us-12.md'), 'história\n');

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

test('the execution files show each run by its title and only its deliverables', async () => {
  await page.locator('.tree-row[title="runs"]').click();
  const run = page.locator(`.tree-row[title^="Revisão da US-12"]`);
  await expect(run).toContainText('Revisão da US-12');
  await run.click();
  await expect(page.locator(`.tree-row[title="runs/${RUN}/outputs/definicoes.md"]`)).toBeVisible();
  await expect(page.locator(`.tree-row[title="runs/${RUN}/inputs"]`)).toHaveCount(0);
  await expect(page.locator(`.tree-row[title="runs/${RUN}/state.json"]`)).toHaveCount(0);
});

test('Hudson proposes, the person unchecks one, and only the kept steps are applied', async () => {
  await page.locator('.tree-row[title="runs"]').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Organizar com o Hudson' }).click();
  const dialog = page.getByRole('dialog', { name: 'Organizar com o Hudson' });
  await expect(dialog.locator('.hudson-context')).toContainText('definicoes.md');
  await expect(dialog.locator('.hudson-delete')).toContainText('rascunho-apoio.md');
  await expect(dialog.locator('.hudson-rename')).toContainText('Matriz de revisão US-12.md');
  await expect(dialog.locator('.hudson-keep')).toContainText('matriz.md');
  await expect(dialog).not.toContainText('us-12.md'); // a run's inputs are never offered
  const shots = process.env.QA_SHOTS;
  if (shots) {
    for (const mode of ['light', 'dark'] as const) {
      await page.evaluate((m) => { document.documentElement.setAttribute('data-theme', m); }, mode);
      await page.waitForTimeout(150);
      await dialog.screenshot({ path: join(shots, `hudson-${mode}.png`) });
    }
  }
  await dialog.locator('.hudson-rename').getByRole('checkbox').uncheck(); // not this one
  await dialog.getByRole('button', { name: 'Aplicar (2)' }).click();
  await expect(dialog).toContainText('2 arquivos organizados.');
  const run = join(project, 'runs', RUN);
  expect(readFileSync(join(project, 'context', 'definicoes.md'), 'utf8')).toContain('Frete grátis');
  expect(readFileSync(join(project, 'context', 'index.md'), 'utf8')).toContain('[definicoes.md](definicoes.md)');
  expect(existsSync(join(run, 'outputs', 'rascunho-apoio.md'))).toBe(false);
  expect(existsSync(join(run, 'outputs', 'saida.md'))).toBe(true); // unchecked: untouched
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
});
