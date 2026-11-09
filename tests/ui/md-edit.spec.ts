// Any .md opens editable: what the formatted editor cannot draw (front matter, HTML, callouts, footnotes) is kept as
// written and an edit rewrites only its paragraph; a file too large for it opens editable in its source.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

// Written the way AIs write deliverables: properties, a table with <br>, a callout, HTML, a footnote, `*` lists.
const REPORT = [
  '---', 'title: Relatório de testes', 'status: draft', '---', '',
  '# Relatório', '',
  '> [!NOTE]', '> Gerado pela IA.', '',
  '* primeiro item', '* segundo item', '',
  '| Caso | Resultado |', '|---|---|', '| CT-01 | ok<br>revisado |', '',
  '<details>', '<summary>Log completo</summary>', '', 'linha do log', '', '</details>', '',
  'Parágrafo __forte__ para editar[^1].', '',
  '[^1]: Fonte da nota.', '',
].join('\n');

let app: ElectronApplication;
let page: Page;
let root = '';
let userData = '';
let project = '';

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'moki-md-edit-ui-'));
  userData = mkdtempSync(join(tmpdir(), 'moki-md-edit-profile-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  project = join(root, 'workspace', 'projects', 'acme');
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary', 'notes']) mkdirSync(join(project, dir), { recursive: true });
  const file = join(project, 'project.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...data, project: 'acme', name: 'Acme Library' }, null, 2)}\n`);
  writeFileSync(join(project, 'inbox', 'report.md'), REPORT);
  writeFileSync(join(project, 'inbox', 'large.md'), `# Grande\n\n${'Linha de log com bastante texto para ocupar espaço.\n'.repeat(22_000)}`);

  app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: userData, QA_OPEN_PROJECT: 'acme' });
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

const onDisk = (name: string) => readFileSync(join(project, 'inbox', name), 'utf8');

// Screenshots for the visual check, in light and dark (QA_SHOTS: a folder outside the repository).
async function shots(name: string) {
  const dir = process.env.QA_SHOTS;
  if (!dir) return;
  for (const mode of ['light', 'dark'] as const) {
    await page.evaluate((m) => {
      document.documentElement.setAttribute('data-theme', m);
      document.documentElement.setAttribute('data-doc-theme', m);
    }, mode);
    await page.waitForTimeout(150);
    await page.locator('.doc').first().screenshot({ path: join(dir, `${name}-${mode}.png`) });
  }
}

test('an AI-written .md opens in the formatted editor, keeps what it cannot draw and saves only the edited paragraph', async () => {
  await page.locator('.tree-row[title="inbox"]').click();
  await page.locator('.tree-row[title="inbox/report.md"]').click();
  const visual = page.locator('.tiptap-body');
  await expect(visual).toBeVisible();
  await expect(page.locator('.doc-notice')).toHaveCount(0); // no "open it in your program", no formatting note
  await expect(visual.locator('.md-raw')).toHaveCount(3); // properties and the two HTML lines of <details>
  await expect(visual.locator('.md-raw-kind').first()).toHaveText('Propriedades do documento'); // shown in capitals by CSS
  await expect(visual.locator('.md-raw-inline', { hasText: '[!NOTE]' })).toBeVisible();
  await expect(visual.locator('td .md-raw-br br')).toHaveCount(1);
  await shots('md-ai-report');

  await visual.getByText('para editar').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Editado no Moki.');
  await expect(page.locator('.doc-saved')).toContainText('Salvo às', { timeout: 10_000 });
  expect(onDisk('report.md')).toBe(REPORT.replace('Parágrafo __forte__ para editar[^1].', 'Parágrafo **forte** para editar[^1]. Editado no Moki.'));

  // The properties card is edited as text, and only it changes.
  const properties = visual.locator('.md-raw-text').first();
  await properties.click();
  await page.keyboard.press('Control+Home');
  for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End'); // after "status: draft"
  await page.keyboard.type('\nowner: QA');
  await page.locator('.tiptap-body h1').click(); // leaving the card saves it with the document
  await expect.poll(() => onDisk('report.md'), { timeout: 10_000 }).toContain('status: draft\nowner: QA\n---');
  expect(onDisk('report.md')).toContain('* primeiro item\n* segundo item');
  expect(onDisk('report.md')).toContain('<details>\n<summary>Log completo</summary>');
});

test('a large .md opens editable in its source, with a note that says why', async () => {
  const row = page.locator('.tree-row[title="inbox/large.md"]');
  if (!(await row.isVisible())) await page.locator('.tree-row[title="inbox"]').click(); // a fresh window after a failure
  await row.click();
  const source = page.locator('textarea.md-source');
  await expect(source).toBeVisible();
  await expect(source).toBeEditable();
  const notice = page.locator('.doc-notice');
  await expect(notice).toContainText('Arquivo grande, aberto como texto');
  await shots('md-large');
  await source.click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('Nota no topo.\n');
  await expect.poll(() => onDisk('large.md').slice(0, 30), { timeout: 10_000 }).toBe('Nota no topo.\n# Grande\n\nLinha ');
  await notice.getByRole('button', { name: 'Fechar' }).click();
  await expect(notice).toHaveCount(0);
});

test('a file changed outside Moki while it was being edited shows the conflict notice with its two choices', async () => {
  const row = page.locator('.tree-row[title="inbox/large.md"]');
  if (!(await row.isVisible())) await page.locator('.tree-row[title="inbox"]').click();
  await row.click();
  const source = page.locator('textarea.md-source');
  await source.click();
  await page.keyboard.press('Control+Home');
  await page.keyboard.type('X');
  writeFileSync(join(project, 'inbox', 'large.md'), 'Escrito pela IA.\n'); // before the autosave
  const notice = page.locator('.doc-notice-warn');
  await expect(notice).toContainText('Alterado fora do Moki', { timeout: 10_000 });
  await expect(notice.getByRole('button', { name: 'Ver a versão nova' })).toBeVisible();
  await shots('md-conflict');
  await notice.getByRole('button', { name: 'Ver a versão nova' }).click();
  await expect(source).toHaveValue('Escrito pela IA.\n');
});
