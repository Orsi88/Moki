// A loose note's formatted view is editable, its title sits beside the project
// destination, and each start-screen section scrolls on its own.
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

// A click on line n of a code file's numbers (one block of text: the line is where the pointer is).
async function clickLine(code: import('@playwright/test').Locator, n: number, shift = false): Promise<void> {
  const gutter = code.locator('.code-gutter');
  const { pad, line } = await gutter.evaluate((el) => ({ pad: parseFloat(getComputedStyle(el).paddingTop), line: parseFloat(getComputedStyle(el).lineHeight) }));
  await gutter.click({ position: { x: 10, y: pad + (n - 0.5) * line }, modifiers: shift ? ['Shift'] : [] });
}
async function lineBox(code: import('@playwright/test').Locator, n: number): Promise<{ y: number; height: number }> {
  const box = (await code.locator('.code-gutter').boundingBox())!;
  const { pad, line } = await code.locator('.code-gutter').evaluate((el) => ({ pad: parseFloat(getComputedStyle(el).paddingTop), line: parseFloat(getComputedStyle(el).lineHeight) }));
  return { y: box.y + pad + (n - 1) * line, height: line };
}

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
  await expect(code.locator('.code-gutter')).toHaveAttribute('data-lines', '6');
  await expect(code.locator('textarea')).toHaveCount(0); // read-only: changed in the IDE
  await clickLine(code, 3);
  await expect(code.locator('.code-file-bar')).toContainText('typescript · linha 3');
  await expect(code.locator('.code-line-mark')).toBeVisible();
  await expect(code.getByRole('button', { name: /Abrir na IDE/ })).toBeVisible();
  // Shift+click extends the selection to a block; "Mark" makes it an area in the marker's color, its icon in the corner.
  await clickLine(code, 2);
  await clickLine(code, 4, true);
  await expect(code.locator('.code-file-bar')).toContainText('linhas 2–4');
  // A right-click on the selected lines: the markers; one click marks the block.
  await code.locator('.code-text').click({ button: 'right', position: { x: 60, y: 40 } });
  await page.getByRole('menu', { name: 'Marcar com' }).getByRole('menuitem', { name: /Revisar/ }).click();
  const area = code.locator('.code-area.marked');
  await expect(area).toHaveAttribute('data-marker-color', 'blue');
  await expect(code.locator('.code-area-anchor .code-area-icon')).toHaveText('🔍');
  const marked = await area.boundingBox();
  const second = await lineBox(code, 2);
  expect(Math.abs((marked?.y ?? 0) - (second?.y ?? 0))).toBeLessThan(4); // starts on line 2
  expect((marked?.height ?? 0) / (second?.height ?? 1)).toBeCloseTo(3, 0); // three lines
  // A comment on line 1, beside the code; the file itself never changes.
  await clickLine(code, 1);
  await page.getByRole('toolbar', { name: 'Seleção' }).getByRole('button', { name: 'Comentar' }).click();
  await page.getByRole('dialog', { name: 'Comentário' }).getByRole('textbox').fill('Explicar quem chama esta função.');
  await page.getByRole('dialog', { name: 'Comentário' }).getByRole('button', { name: 'Comentar' }).click();
  await expect(code.locator('.md-card', { hasText: 'Explicar quem chama' })).toContainText('linha 1');
  await expect(code.locator('.md-card', { hasText: 'linhas 2–4' })).toHaveCount(0); // a marker without a comment has no card
  await expect(code.getByRole('button', { name: 'Comentários (2)' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Comentário' })).toHaveCount(0);
  expect(readFileSync(file, 'utf8')).toContain('export async function login');
  expect(readFileSync(join(root, 'workspace', 'projects', 'p1', '.moki-html-comments.json'), 'utf8')).toContain('"kind": "code"');
  // "Create a note from here": a note of the project with these lines, tied to them as a pin; untied, it stays in Notes.
  await clickLine(code, 3);
  await clickLine(code, 4, true);
  const windows = app.windows().length;
  await code.getByRole('button', { name: 'Criar nota daqui', exact: true }).click();
  const pin = code.locator('.code-note-pin');
  await expect(pin).toContainText('login.ts L3-4');
  await expect.poll(() => app.windows().length).toBeGreaterThan(windows); // the note opened in its window
  const notesDir = join(root, 'workspace', 'projects', 'p1', 'notes');
  const created = readdirSync(notesDir).find((f) => readFileSync(join(notesDir, f), 'utf8').includes('Source: [@login.ts]'));
  expect(created).toBeTruthy();
  expect(readFileSync(join(notesDir, created!), 'utf8')).toContain('```typescript\n  const tries = 3;\n  return user.length > tries;\n```');
  const pinBox = await pin.boundingBox(), third = await lineBox(code, 3);
  expect(Math.abs((pinBox?.y ?? 0) - (third?.y ?? 0))).toBeLessThan(6); // beside line 3
  await pin.getByRole('button', { name: /Desvincular a nota/ }).click();
  await expect(pin).toHaveCount(0);
  expect(existsSync(join(notesDir, created!))).toBe(true);
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
