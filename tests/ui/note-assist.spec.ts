// The quick assistants of a note: one click, no terminal; the answer is a suggestion accepted or discarded.
// QA_FAKE_TOOLS makes the main process answer as the AI would (desktop/main.ts).
import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

const NOTE = '# Ideias de teste\n\nvalidar login com sso e o logout.\n';

let app: ElectronApplication;
let page: Page;
let root = '';
let userData = '';
let project = '';

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'moki-note-assist-ui-'));
  userData = mkdtempSync(join(tmpdir(), 'moki-note-assist-profile-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  project = join(root, 'workspace', 'projects', 'acme');
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary', 'notes']) mkdirSync(join(project, dir), { recursive: true });
  const file = join(project, 'project.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...data, project: 'acme', name: 'Acme Library' }, null, 2)}\n`);
  writeFileSync(join(project, 'notes', 'ideias.md'), NOTE);

  app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: userData, QA_OPEN_PROJECT: 'acme', QA_FAKE_TOOLS: '1' });
  page = await app.firstWindow();
  page.on('pageerror', (err) => console.error('pageerror', err.message));
  await page.evaluate(() => {
    localStorage.setItem('qa-ui-language', 'pt-BR');
    localStorage.setItem('qa-language', 'Portuguese (pt-BR)');
  });
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

const onDisk = () => readFileSync(join(project, 'notes', 'ideias.md'), 'utf8');

async function shots(name: string, target = page.locator('.note-dialog')) {
  const dir = process.env.QA_SHOTS;
  if (!dir) return;
  for (const mode of ['light', 'dark'] as const) {
    await page.evaluate((m) => { document.documentElement.setAttribute('data-theme', m); document.documentElement.setAttribute('data-doc-theme', m); }, mode);
    await page.waitForTimeout(150);
    await target.screenshot({ path: join(dir, `${name}-${mode}.png`) });
  }
}

test('improving the writing is a suggestion: the differences show, and only Accept changes the note', async () => {
  await page.locator('.tree-row[title="notes"]').click();
  await page.locator('.tree-row[title="notes/ideias.md"]').click();
  const note = page.locator('.note-dialog');
  const assistants = note.getByRole('group', { name: 'Assistentes rápidos' });
  for (const name of ['Melhorar a escrita', 'Resumir', 'Pesquisar (Sherlock)', 'Revisar criticamente (Moriarty)']) await expect(assistants.getByRole('button', { name })).toBeEnabled();

  await assistants.getByRole('button', { name: 'Melhorar a escrita' }).click();
  const panel = note.getByRole('region', { name: 'Assistentes rápidos' });
  await expect(panel).toContainText('Texto revisado pelo assistente.');
  await expect(panel).toContainText('Aceitar troca a nota por esta versão.');
  expect(onDisk()).toBe(NOTE); // nothing written yet
  await panel.getByRole('tab', { name: 'Diferenças' }).click();
  await expect(panel.locator('ins')).toContainText('Texto revisado pelo assistente.');
  await shots('note-assist-diff');
  await panel.getByRole('button', { name: 'Descartar' }).click();
  await expect(panel).toHaveCount(0);
  expect(onDisk()).toBe(NOTE);

  await assistants.getByRole('button', { name: 'Melhorar a escrita' }).click();
  await note.getByRole('region', { name: 'Assistentes rápidos' }).getByRole('button', { name: 'Aceitar' }).click();
  await expect.poll(onDisk, { timeout: 10_000 }).toContain('Texto revisado pelo assistente.');
});

test('research adds its section at the end of the note when accepted', async () => {
  const note = page.locator('.note-dialog');
  await note.getByRole('group', { name: 'Assistentes rápidos' }).getByRole('button', { name: 'Pesquisar (Sherlock)' }).click();
  const panel = note.getByRole('region', { name: 'Assistentes rápidos' });
  await expect(panel).toContainText('ponto do assistente');
  await expect(panel).toContainText('Aceitar coloca isto no fim da nota.');
  await shots('note-assist-research');
  await panel.getByRole('button', { name: 'Aceitar' }).click();
  await expect.poll(onDisk, { timeout: 10_000 }).toMatch(/Texto revisado pelo assistente\.\n\n## research\n\n- ponto do assistente\n$/);
});

test('a loose note: the title is renamed in place in the header, beside the project it can be sent to; no title field, no source pencil', async () => {
  await page.locator('.ribbon').getByRole('button', { name: 'Nova nota' }).click();
  const note = page.locator('.note-dialog').last();
  await expect(note).toBeVisible();
  await expect(note.getByLabel('Título', { exact: true })).toHaveCount(0); // no separate title field
  await expect(note.getByRole('button', { name: 'Usar com a IA' })).toHaveCount(0);
  await expect(note.getByRole('button', { name: 'Código Markdown' })).toHaveCount(0);
  await expect(note.locator('.note-head-title select')).toBeVisible(); // send to a project, in the header
  await note.locator('.note-head-title h2').click({ button: 'right' });
  await note.locator('.note-title-input').fill('Ideias soltas');
  await note.locator('.note-title-input').press('Enter');
  await expect(note.locator('.note-head-title h2')).toHaveText('Ideias soltas');
  await note.locator('.tiptap-body').click();
  await page.keyboard.type('Uma ideia.');
  await shots('note-loose-header', note);
});
