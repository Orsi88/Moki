// A loose note's formatted view is editable, its title sits beside the project
// destination, and each start-screen section scrolls on its own.
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

function addProject(id: string, name: string): void {
  const project = join(root, 'workspace', 'projects', id);
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary']) mkdirSync(join(project, dir), { recursive: true });
  const file = join(project, 'project.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...data, project: id, name }, null, 2)}\n`);
}

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'moki-note-ui-'));
  userData = mkdtempSync(join(tmpdir(), 'moki-note-profile-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  cpSync(join(ROOT, 'skills'), join(root, 'skills'), { recursive: true });
  cpSync(join(ROOT, 'agents'), join(root, 'agents'), { recursive: true });
  cpSync(join(ROOT, 'activities'), join(root, 'activities'), { recursive: true });
  cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
  for (let i = 1; i <= 14; i++) addProject(`p${i}`, `Projeto ${i}`);
  app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: userData, QA_OPEN_PROJECT: 'p1' });
  page = await app.firstWindow();
  page.on('pageerror', (err) => console.error('pageerror', err.message));
  await page.evaluate(() => {
    localStorage.setItem('qa-ui-language', 'pt-BR');
    localStorage.setItem('qa-language', 'Portuguese (pt-BR)');
  });
  const reloaded = page.waitForEvent('load');
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setSize(1100, 720);
    win.webContents.reload();
  });
  await reloaded;
});

test.afterAll(async () => {
  await Promise.race([app?.close(), new Promise((resolve) => setTimeout(resolve, 3000))]);
  for (const dir of [root, userData]) {
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 2 }); } catch { /* the window may still hold the profile */ }
  }
});

test('execution phases are separate buttons, and the plus is not one of them', async () => {
  const ops = page.getByRole('region', { name: 'Operações' });
  const phases = ops.locator('.ops-phases');
  const tabs = phases.getByRole('tablist');
  await expect(tabs.getByRole('tab', { name: 'Em andamento' })).toHaveAttribute('aria-selected', 'true');
  await expect(phases.getByRole('button', { name: 'Vincular operações a este projeto' })).toHaveCount(0);
});

test('the Notes section of a project is resized on its top edge, within bounds, and keeps its height', async () => {
  const notes = page.locator('.sidebar-notes');
  const handle = notes.getByRole('separator', { name: 'Ajustar altura das notas' });
  await expect(handle).toBeVisible();
  const before = (await notes.boundingBox())!.height;
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y - 100, { steps: 5 });
  await page.mouse.up();
  const taller = (await notes.boundingBox())!.height;
  expect(taller).toBeGreaterThan(before + 80);
  expect(await page.evaluate(() => localStorage.getItem('qa-notes-height'))).toBe(String(Math.round(taller)));
  // The keyboard works too, and the section never squeezes the files away.
  await handle.focus();
  await page.keyboard.press('ArrowDown');
  expect((await notes.boundingBox())!.height).toBeLessThan(taller);
  for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowUp');
  expect((await page.locator('.sidebar-scroll').boundingBox())!.height).toBeGreaterThanOrEqual(110);
  for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowDown');
  expect((await notes.boundingBox())!.height).toBeGreaterThanOrEqual(79);
  writeFileSync(test.info().outputPath('notes-resized.png'), Buffer.from(await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')), 'base64'));
  // Collapsed, the section shrinks to its heading and the handle goes away.
  await notes.getByRole('button', { name: 'Notas' }).click();
  await expect(handle).toHaveCount(0);
  await notes.getByRole('button', { name: 'Notas' }).click();
});

test('with more tabs than fit, discreet arrows at the row ends scroll it, only on the side with hidden tabs', async () => {
  const row = page.locator('.pane-row').first();
  await expect(row.locator('.tabs-scroll')).toHaveCount(0);
  await page.locator('.tree-row[title="context"]').click();
  const files = page.locator('.tree-row[title^="context/"][title$=".md"]');
  const n = await files.count();
  for (let i = 0; i < n; i++) await files.nth(i).click();
  // The last tab opened is active and in view: tabs are hidden to the left only.
  await expect(row.locator('.tabs-scroll.left')).toBeVisible();
  await expect(row.locator('.tabs-scroll.right')).toHaveCount(0);
  const tabs = row.locator('.pane-tabs');
  const before = await tabs.evaluate((el) => el.scrollLeft);
  await row.getByRole('button', { name: 'Abas anteriores' }).click();
  await expect.poll(() => tabs.evaluate((el) => el.scrollLeft)).toBeLessThan(before);
  await expect(row.locator('.tabs-scroll.right')).toBeVisible();
  writeFileSync(test.info().outputPath('tab-arrows.png'), Buffer.from(await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')), 'base64'));
  // At the start of the row (wheel or arrows), the left arrow goes away.
  await tabs.evaluate((el) => { el.scrollLeft = 0; });
  await expect(row.locator('.tabs-scroll.left')).toHaveCount(0);
  await row.getByRole('button', { name: 'Próximas abas' }).click();
  await expect(row.locator('.tabs-scroll.left')).toBeVisible();
  // Closing the tabs until they fit removes both arrows.
  for (let i = 0; i < n; i++) await page.keyboard.press('Control+w');
  await expect(row.locator('.tabs-scroll')).toHaveCount(0);
  await page.locator('.tree-row[title="context"]').click();
});

test('a code file opens read-only with IDE colors and line numbers; a line is selected for "Open in the IDE"', async () => {
  const file = join(root, 'workspace', 'projects', 'p1', 'inbox', 'login.ts');
  writeFileSync(file, '// Signs the person in.\nexport async function login(user: string): Promise<boolean> {\n  const tries = 3;\n  return user.length > tries;\n}\n');
  await page.locator('.tree-row[title="inbox"]').click();
  await page.locator('.tree-row[title="inbox/login.ts"]').click();
  const code = page.locator('.code-file');
  await expect(code.locator('.hljs-keyword').first()).toHaveText('export');
  await expect(code.locator('.hljs-comment')).toHaveText('// Signs the person in.');
  await expect(code.locator('.hljs-string, .hljs-number').first()).toBeVisible();
  await expect(code.locator('.code-gutter button')).toHaveCount(6);
  await expect(code.locator('textarea')).toHaveCount(0); // read-only: changed in the IDE
  await code.locator('.code-gutter button').nth(2).click();
  await expect(code.locator('.code-file-bar')).toContainText('typescript · linha 3');
  await expect(code.locator('.code-line-mark')).toBeVisible();
  await expect(code.getByRole('button', { name: /Abrir na IDE/ })).toBeVisible();
  writeFileSync(test.info().outputPath('code-view.png'), Buffer.from(await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64')), 'base64'));
  await page.keyboard.press('Control+w');
  await page.locator('.tree-row[title="inbox"]').click();
});

test('start-screen sections keep their headings and scroll on their own', async () => {
  await page.locator('.project-switch').click();
  const projects = page.locator('.home-block').filter({ hasText: 'Projetos' });
  const notes = page.locator('.home-block').filter({ hasText: 'Notas avulsas' });
  await expect(projects).toBeVisible();
  await expect(notes).toBeVisible();
  const notesHead = notes.locator('.home-list-head');
  const before = await notesHead.boundingBox();
  const scroller = projects.locator('.home-block-scroll');
  await scroller.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  const after = await notesHead.boundingBox();
  expect(before && after && Math.abs(before.y - after.y)).toBeLessThan(2);

  const projectsHead = projects.getByRole('button', { name: 'Projetos' });
  const projectsTop = await projectsHead.boundingBox();
  await projectsHead.click();
  await expect(projects.locator('.home-block-scroll')).toHaveCount(0);
  await expect(projectsHead).toHaveAttribute('aria-expanded', 'false');
  const collapsedNotes = await notesHead.boundingBox();
  expect(projectsTop && collapsedNotes && collapsedNotes.y).toBeLessThan(projectsTop.y + 80);
  await projectsHead.click();
  await expect(projects.locator('.home-block-scroll')).toBeVisible();
});

test('a formatted note can be edited, with the title beside the project destination', async () => {
  await page.getByRole('button', { name: 'Nova nota' }).click();
  const note = page.locator('.home-main .note-dialog');
  const title = note.locator('.note-head-title h2');
  const destination = note.locator('select');
  await expect(title).toBeVisible();
  await expect(destination).toBeVisible();
  const titleBox = await title.boundingBox();
  const destinationBox = await destination.boundingBox();
  expect(titleBox && destinationBox && Math.abs(titleBox.y + titleBox.height / 2 - destinationBox.y - destinationBox.height / 2)).toBeLessThan(8);
  expect(destinationBox && titleBox && destinationBox.x).toBeGreaterThan(titleBox.x + titleBox.width - 4);

  // The note already opens in its formatted editor.
  const visual = note.locator('.tiptap-body');
  await expect(visual).toBeVisible();
  await visual.click();
  await page.keyboard.type('editavel');
  await expect(visual).toContainText('editavel');
});
