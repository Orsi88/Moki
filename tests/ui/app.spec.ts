// Opens the built Moki window and checks the settings we use by hand:
// the Templates screen scrolls and accepts a logo and a watermark, and
// Create skill lives only under Add a skill.

import { test, expect, type ElectronApplication, type Locator, type Page } from '@playwright/test';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

// 1×1 PNG. The window accepts data: images; this is enough to prove the logo landed.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

let app: ElectronApplication;
let page: Page;
let scratch = '';

function addProject(root: string, id: string, name: string, extra: Record<string, unknown> = {}): void {
  const project = join(root, 'workspace', 'projects', id);
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary']) mkdirSync(join(project, dir), { recursive: true });
  const file = join(project, 'project.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...data, project: id, name, ...extra }, null, 2)}\n`);
}

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'moki-ui-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  cpSync(join(ROOT, 'skills'), join(root, 'skills'), { recursive: true });
  cpSync(join(ROOT, 'agents'), join(root, 'agents'), { recursive: true });
  cpSync(join(ROOT, 'activities'), join(root, 'activities'), { recursive: true });
  cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
  addProject(root, 'acme', 'Acme Library');
  return root;
}

// Opens the app in Portuguese on a project of `root` (acme), or on the workspace picker (null).
async function openApp(root: string, userData: string, project: string | null = 'acme', extra: Record<string, string> = {}): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: userData, QA_OPEN_PROJECT: project ?? undefined, ...extra });
  const page = await app.firstWindow();
  page.on('pageerror', (err) => console.error('pageerror', err.message));
  await page.evaluate(() => {
    localStorage.setItem('qa-ui-language', 'pt-BR');
    localStorage.setItem('qa-language', 'Portuguese (pt-BR)');
  });
  const reloaded = page.waitForEvent('load');
  await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].webContents.reload(); });
  await reloaded;
  return { app, page };
}

async function cssSize(selector: string): Promise<{ height: number; fontSize: string }> {
  return page.locator(selector).first().evaluate((el) => {
    const box = el.getBoundingClientRect();
    return { height: box.height, fontSize: getComputedStyle(el).fontSize };
  });
}

test('Moki restores document tabs, active mode and scroll after leaving, reloading and deleting a file', async () => {
  const root = fixture();
  const profile = mkdtempSync(join(tmpdir(), 'moki-view-profile-'));
  const project = join(root, 'workspace', 'projects', 'acme');
  writeFileSync(join(project, 'context', 'long.md'), '# Long document\n\n' + 'A paragraph for scrolling.\n\n'.repeat(160));
  writeFileSync(join(project, 'context', 'second.txt'), 'Line for scrolling\n'.repeat(180));
  let running: ElectronApplication | undefined;
  try {
    const opened = await openApp(root, profile);
    running = opened.app;
    const view = opened.page;
    const tabs = view.locator('.pane-tabs .tab:not(.tab-term)');
    await view.locator('.tree-row[title="context"]').click();
    await view.locator('.tree-row[title="context/long.md"]').click();
    await expect(view.locator('.doc .ProseMirror')).toContainText('Long document');
    await view.locator('.doc-body').evaluate((el) => { el.scrollTop = 900; el.dispatchEvent(new Event('scroll')); });
    await view.locator('.tree-row[title="context/second.txt"]').click();
    await view.locator('.doc textarea.editor').evaluate((el) => { el.scrollTop = 600; el.dispatchEvent(new Event('scroll')); });
    // Leave immediately: the pending metadata write must be flushed on unmount.
    await view.getByRole('button', { name: 'Todos os projetos', exact: true }).click();
    await view.locator('.home-project', { hasText: 'Acme Library' }).first().click();
    await expect(tabs).toHaveText(['long.md', 'second.txt']);
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => view.locator('.doc textarea.editor').evaluate((el) => el.scrollTop)).toBe(600);
    await tabs.first().click();
    await expect.poll(() => view.locator('.doc-body').evaluate((el) => el.scrollTop)).toBe(900);
    await view.reload();
    await expect(view.locator('.doc .ProseMirror')).toContainText('Long document');
    await expect.poll(() => view.locator('.doc-body').evaluate((el) => el.scrollTop)).toBe(900);

    await view.keyboard.press('Control+e');
    const source = view.locator('.doc textarea.md-source');
    await expect(source).toBeVisible();
    await source.evaluate((el) => { el.scrollTop = 450; el.dispatchEvent(new Event('scroll')); });
    await view.reload();
    await expect(tabs).toHaveText(['long.md', 'second.txt']);
    await expect(source).toBeVisible();
    await expect.poll(() => source.evaluate((el) => Math.abs(el.scrollTop - 450))).toBeLessThan(1);

    if (!await view.locator('.tree-row[title="context/long.md"]').isVisible()) await view.locator('.tree-row[title="context"]').click();
    await view.locator('.tree-row[title="context/long.md"]').focus();
    await view.keyboard.press('F2');
    const rename = view.getByRole('textbox', { name: 'Novo nome de long.md' });
    await rename.fill('continued');
    await rename.press('Enter');
    await expect(tabs.first()).toContainText('continued.md');
    await view.reload();
    await expect(tabs).toHaveText(['continued.md', 'second.txt']);
    await expect.poll(() => source.evaluate((el) => Math.abs(el.scrollTop - 450))).toBeLessThan(1);

    // A missing active file does not stop the other tabs from coming back.
    await view.getByRole('button', { name: 'Todos os projetos', exact: true }).click();
    rmSync(join(project, 'context', 'continued.md'));
    await view.locator('.home-project', { hasText: 'Acme Library' }).first().click();
    await expect(tabs).toHaveText(['second.txt']);
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => view.locator('.doc textarea.editor').evaluate((el) => el.scrollTop)).toBe(600);

    // Closed tabs stay closed; a new opening still works after restoration.
    await tabs.first().locator('.tab-close').click();
    await view.reload();
    await expect(tabs).toHaveCount(0);
    await view.locator('.tree-row[title="context"]').click();
    await view.locator('.tree-row[title="context/second.txt"]').click();
    await expect(tabs).toHaveCount(1);
    await expect(tabs.first()).toContainText('second.txt');
  } finally {
    await running?.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  }
});

test('Moki restores scroll after PDF pages load asynchronously', async () => {
  const root = fixture();
  const profile = mkdtempSync(join(tmpdir(), 'moki-pdf-view-profile-'));
  const pdf = await PDFDocument.create();
  for (let n = 0; n < 5; n++) pdf.addPage().drawText('Page ' + (n + 1));
  writeFileSync(join(root, 'workspace', 'projects', 'acme', 'inbox', 'long.pdf'), await pdf.save());
  let running: ElectronApplication | undefined;
  try {
    const opened = await openApp(root, profile);
    running = opened.app;
    const view = opened.page;
    await view.locator('.tree-row[title="inbox"]').click();
    await view.locator('.tree-row[title="inbox/long.pdf"]').click();
    const pages = view.locator('.pdf-page');
    const scroller = view.locator('.pdf-scroll');
    await expect(pages).toHaveCount(5);
    await scroller.evaluate((el) => { el.scrollTop = 1200; el.dispatchEvent(new Event('scroll')); });
    await view.reload();
    await expect(pages).toHaveCount(5);
    await expect.poll(() => scroller.evaluate((el) => Math.abs(el.scrollTop - 1200))).toBeLessThan(1);
  } finally {
    await running?.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  }
});

test('Moki quick notes stay available over a project, collapsed sidebar and settings without replacing the current view', async () => {
  const root = fixture();
  const profile = mkdtempSync(join(tmpdir(), 'moki-quick-note-profile-'));
  const project = join(root, 'workspace', 'projects', 'acme');
  writeFileSync(join(project, 'context', 'working.md'), '# Working document\n\n' + 'Keep my place.\n\n'.repeat(150));
  let running: ElectronApplication | undefined;
  try {
    const opened = await openApp(root, profile);
    running = opened.app;
    const view = opened.page;
    const rail = view.locator('.ribbon');
    const add = rail.getByRole('button', { name: 'Nova nota', exact: true });
    // A real terminal remains attached while a note is opened and saved above the project.
    await rail.getByTitle('Num terminal novo', { exact: true }).click();
    await view.getByRole('menuitem', { name: 'Terminal', exact: true }).click();
    await view.getByRole('menuitem', { name: /seu shell/ }).click();
    await expect(view.locator('.term-pane:not([hidden])')).toBeVisible();
    await expect.poll(() => view.evaluate(async () => (await window.qa?.term?.list('acme'))?.length)).toBe(1);
    const terminals = await view.evaluate(() => window.qa?.term?.list('acme'));
    await view.locator('.tree-row[title="context"]').click();
    await view.locator('.tree-row[title="context/working.md"]').click();
    await expect(view.locator('.doc .ProseMirror')).toContainText('Working document');
    await view.locator('.doc-body').evaluate((el) => { el.scrollTop = 450; el.dispatchEvent(new Event('scroll')); });
    await rail.getByRole('button', { name: 'Recolher barra de arquivos', exact: true }).click();
    await expect(view.locator('.workspace')).toHaveClass(/sidebar-collapsed/);
    // The two bottom actions are the note + followed by the sidebar toggle.
    await expect(rail.locator('button').nth(-2)).toHaveAttribute('aria-label', 'Nova nota');
    // Same size as its neighbours (no block of color): only its icon is in the accent color.
    const [noteBox, toggleBox] = await Promise.all([add.boundingBox(), rail.locator('button').nth(-1).boundingBox()]);
    expect([noteBox!.width, noteBox!.height]).toEqual([toggleBox!.width, toggleBox!.height]);
    await add.click();
    const note = view.locator('.main .note-host .note-dialog'); // in the main area, over the tabs
    await expect(note).toBeVisible();
    await expect(view.locator('.modal-backdrop > .note-dialog')).toHaveCount(0);
    await expect(view.locator('.workspace .project-switch')).toHaveText('Acme Library');
    await expect(note.locator('.note-destination select')).toHaveValue('');
    await note.getByPlaceholder('ex.: Ideias de teste').fill('Captura rápida');
    await view.keyboard.press('Control+e');
    await note.locator('textarea.note-editor').fill('Anotei sem sair do arquivo.');
    await expect(view.locator('.doc textarea.md-source')).toHaveCount(0); // Ctrl+E belongs only to the note
    await view.keyboard.press('Control+s');
    await view.keyboard.press('Control+f');
    expect(running.windows()).toHaveLength(1); // no workspace search opens behind the note
    await note.getByRole('button', { name: 'Fechar (Esc)', exact: true }).click();
    await expect(note).toHaveCount(0);
    await expect(add).toBeFocused();
    await expect(view.locator('.workspace')).toHaveClass(/sidebar-collapsed/);
    await expect(view.locator('.pane-tabs .tab:not(.tab-term)')).toHaveText(['working.md']);
    await expect.poll(() => view.locator('.doc-body').evaluate((el) => Math.abs(el.scrollTop - 450))).toBeLessThan(1);
    expect(await view.evaluate(() => window.qa?.term?.list('acme'))).toEqual(terminals);
    expect(existsSync(join(project, 'notes')) && readdirSync(join(project, 'notes')).some((name) => name.endsWith('.md'))).toBe(false);
    expect(await view.evaluate(() => localStorage.getItem('qa-loose-notes'))).toContain('Anotei sem sair do arquivo.');

    // Both settings entry points keep their selected tab after closing a quick note (on top: Settings fill the main area).
    const onTop = view.locator('.modal-backdrop > .note-dialog');
    for (const atHome of [false, true]) {
      if (atHome) await rail.getByRole('button', { name: 'Todos os projetos', exact: true }).click();
      await rail.getByRole('button', { name: 'Configurações', exact: true }).click();
      const themes = view.getByRole('tab', { name: 'Temas', exact: true });
      await themes.click();
      await add.click();
      await expect(onTop).toBeVisible();
      await onTop.getByPlaceholder('ex.: Ideias de teste').fill(atHome ? 'Na tela inicial' : 'No projeto');
      await view.keyboard.press('Escape');
      await expect(onTop).toHaveCount(0);
      await expect(themes).toHaveAttribute('aria-selected', 'true');
      await expect(add).toBeFocused();
    }
    await rail.getByRole('button', { name: 'Configurações', exact: true }).click();
    await expect(view.locator('.home-row', { hasText: 'Captura rápida' })).toBeVisible();
    await expect(view.locator('[data-section="notes"] .add-btn')).toHaveCount(0);
  } finally {
    await running?.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  }
});

test('Moki themed confirmations wait for a decision, trap focus and preserve the file when cancelled', async () => {
  const root = fixture();
  const profile = mkdtempSync(join(tmpdir(), 'moki-dialog-profile-'));
  const file = join(root, 'workspace', 'projects', 'acme', 'context', 'disposable.txt');
  writeFileSync(file, 'Do not delete before confirming.');
  let running: ElectronApplication | undefined;
  try {
    const opened = await openApp(root, profile);
    running = opened.app;
    const view = opened.page;
    const native: string[] = [];
    view.on('dialog', (dialog) => { native.push(dialog.message()); void dialog.dismiss(); });
    await view.locator('.tree-row[title="context"]').click();
    const remove = async () => {
      await view.locator('.tree-row[title="context/disposable.txt"]').click({ button: 'right' });
      await view.getByRole('menuitem', { name: 'Excluir', exact: true }).click();
    };
    await remove();
    const dialog = view.getByRole('alertdialog', { name: 'Confirmar ação' });
    await expect(dialog).toContainText('disposable.txt');
    await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
    expect(existsSync(file)).toBe(true);
    for (let n = 0; n < 6; n++) {
      await view.keyboard.press(n % 2 ? 'Shift+Tab' : 'Tab');
      await expect.poll(() => dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    }
    await view.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(existsSync(file)).toBe(true);
    await remove();
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(existsSync(file)).toBe(true);
    await remove();
    await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect.poll(() => existsSync(file)).toBe(false);
    await expect(view.locator('.tree-row[title="context/disposable.txt"]')).toHaveCount(0);
    // A catalog opened over a note owns the first Escape; the note and its contents stay underneath.
    const add = view.locator('.ribbon').getByRole('button', { name: 'Nova nota', exact: true });
    await add.click();
    const note = view.locator('.main .note-host .note-dialog'); // the new note opens in the main area
    await note.getByPlaceholder('ex.: Ideias de teste').fill('Sobreposta');
    await note.locator('.note-destination select').selectOption('acme');
    await note.getByTitle('Usar esta nota com a IA', { exact: true }).click();
    const choose = note.getByRole('button', { name: 'Escolher atividade', exact: true });
    await choose.click();
    await expect(view.locator('.modal.catalog')).toBeVisible();
    await view.keyboard.press('Escape');
    await expect(view.locator('.modal.catalog')).toHaveCount(0);
    await expect(note).toBeVisible();
    await expect(note.getByPlaceholder('ex.: Ideias de teste')).toHaveValue('Sobreposta');
    await expect(choose).toBeFocused();
    await view.keyboard.press('Escape');
    await expect(note).toHaveCount(0);
    await expect(add).toBeFocused();
    expect(native).toEqual([]);
  } finally {
    await running?.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  }
});

test('Moki dialogs follow all palettes in both modes and update an already-open notebook', async ({}, info) => {
  const root = fixture();
  const profile = mkdtempSync(join(tmpdir(), 'moki-dialog-theme-profile-'));
  const notes = join(root, 'workspace', 'projects', 'acme', 'notes');
  mkdirSync(notes, { recursive: true });
  writeFileSync(join(notes, 'theme.md'), '# Theme note\n\nKeep this window open.');
  let running: ElectronApplication | undefined;
  try {
    const opened = await openApp(root, profile);
    running = opened.app;
    const view = opened.page;
    const bookOpened = running.waitForEvent('window');
    await view.evaluate(() => window.qa?.openNoteWindow({ project: 'acme', path: 'notes/theme.md' }));
    const book = await bookOpened;
    await expect(book.locator('.note-dialog')).toBeVisible();
    const notebookTab = book.locator('.notebook-tab-label').first();
    await notebookTab.focus();
    await expect(notebookTab).toBeFocused(); // a whole notebook window must not trap focus away from its own tabs
    await view.locator('.ribbon').getByRole('button', { name: 'Todos os projetos', exact: true }).click();
    const palettes = [
      ['amber', '🧈 Moki clássico'], ['blue', '🌊 Azul oceano'], ['purple', '🔮 Roxo cósmico'],
      ['green', '👽 Verde que te quero'], ['red', '👀 Vermelhor'],
    ];
    for (const mode of ['light', 'dark']) {
      for (const [palette, label] of palettes) {
        await view.locator('.ribbon').getByRole('button', { name: 'Configurações', exact: true }).click();
        await view.getByRole('tab', { name: 'Temas', exact: true }).click();
        await view.getByRole('radiogroup', { name: 'moki-mode', exact: true }).getByText(mode === 'light' ? 'Claro' : 'Escuro', { exact: true }).click();
        await view.getByRole('button', { name: label, exact: true }).click();
        // A dialog follows Moki even when document/CLI modes deliberately differ from it.
        await view.getByRole('radiogroup', { name: 'document-theme', exact: true }).getByText(mode === 'light' ? 'Escuro' : 'Claro', { exact: true }).click();
        await view.getByRole('radiogroup', { name: 'cli-theme', exact: true }).getByText(mode === 'light' ? 'Escuro' : 'Claro', { exact: true }).click();
        await expect(book.locator('html')).toHaveAttribute('data-moki-palette', palette);
        await expect(book.locator('html')).toHaveAttribute('data-theme', mode);
        await view.locator('.ribbon').getByRole('button', { name: 'Configurações', exact: true }).click();
        const create = view.getByRole('button', { name: 'Criar', exact: true });
        await create.click();
        const dialog = view.getByRole('dialog', { name: 'Criar um novo projeto', exact: true });
        await expect(dialog).toBeVisible();
        const colors = await dialog.evaluate((el) => ({
          surface: getComputedStyle(el).backgroundColor,
          app: getComputedStyle(document.documentElement).backgroundColor,
        }));
        expect(colors.surface).toBe(colors.app);
        await expect(dialog.getByRole('textbox', { name: /Nome do projeto/ })).toBeFocused();
        await dialog.screenshot({ path: info.outputPath(`${mode}-${palette}.png`) });
        await view.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expect(create).toBeFocused();
      }
    }
    await book.close();
  } finally {
    await running?.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  }
});

test.describe.serial('Moki settings', () => {
  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    scratch = join(tmpdir(), 'moki-ui-keep');
    mkdirSync(scratch, { recursive: true });
    writeFileSync(join(scratch, 'root.txt'), `${root}\n${userData}\n`);
    ({ app, page } = await openApp(root, userData));
    await expect(page.getByRole('button', { name: 'Configurações', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Configurações', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Templates' })).toBeVisible();
  });

  test.afterAll(async () => {
    await app?.close();
    try {
      const [root, userData] = readFileSync(join(scratch, 'root.txt'), 'utf8').trim().split('\n');
      rmSync(root, { recursive: true, force: true });
      rmSync(userData, { recursive: true, force: true });
      rmSync(scratch, { recursive: true, force: true });
    } catch { /* the window may have exited before the paths were written */ }
  });

  test('Templates scrolls and its controls share one size', async () => {
    await page.getByRole('tab', { name: 'Templates' }).click();
    await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
    await expect(page.locator('.ds-card-item')).toHaveCount(1); // the list first: every template of the workspace
    await page.getByRole('button', { name: 'Default', exact: true }).click();
    const form = page.locator('.ds-form');
    const room = await form.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(room).toBeGreaterThan(40);
    await form.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Adicionar logo' })).toBeEnabled();
    await expect(page.getByPlaceholder('ex.: CONFIDENCIAL, RASCUNHO')).toBeEnabled();

    const empty = await cssSize('.ds-logo-empty');
    const button = await cssSize('.ds-logo .btn');
    const side = await cssSize('.ds-logo select');
    expect(button.fontSize).toBe(empty.fontSize);
    expect(side.fontSize).toBe(empty.fontSize);
    expect(Math.abs(button.height - empty.height)).toBeLessThan(1.5);
    expect(Math.abs(side.height - empty.height)).toBeLessThan(1.5);
  });

  test('a chosen logo shows in the form and in the preview', async () => {
    const logo = join(scratch, 'logo.png');
    writeFileSync(logo, PNG);
    await page.locator('.ds-logo input[type=file]').setInputFiles(logo);
    await expect(page.getByRole('img', { name: 'Logo' })).toBeVisible();
    await expect(page.locator('.ds-page img')).toBeVisible();
    await expect(page.getByText('Não foi possível ler esta imagem.')).toHaveCount(0);
  });

  test('a watermark text shows on the preview page', async () => {
    await page.getByPlaceholder('ex.: CONFIDENCIAL, RASCUNHO').fill('RASCUNHO');
    await expect(page.locator('.ds-page-mark')).toHaveText('RASCUNHO');
  });

  test('templates are a list: a new one tagged with a project applies only to it', async () => {
    await page.getByRole('button', { name: 'Voltar para Templates' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Continuar', exact: true }).click(); // discard the watermark typed above
    await page.getByRole('button', { name: 'Novo template' }).click();
    await page.locator('.ds-form').getByRole('textbox', { name: 'Nome' }).fill('Acme look');
    await page.locator('.ds-form .tag-field').getByRole('textbox', { name: 'Adicionar uma tag' }).fill('Acme');
    await page.getByRole('listbox').getByText('Acme Library').click();
    await page.locator('.ds-actions').getByRole('button', { name: 'Salvar' }).click();
    await expect(page.locator('.list-back')).toContainText('Acme Library');
    await page.getByRole('button', { name: 'Voltar para Templates' }).click();
    const card = page.locator('.ds-card-item', { hasText: 'Acme look' });
    await expect(card).toContainText('Acme Library');
    await expect(page.locator('.ds-card-item')).toHaveCount(2);

    await page.getByRole('searchbox', { name: 'Buscar templates' }).fill('acme');
    await expect(page.locator('.ds-card-item')).toHaveCount(1);
    await page.getByRole('searchbox', { name: 'Buscar templates' }).fill('');

    const [root] = readFileSync(join(scratch, 'root.txt'), 'utf8').trim().split('\n');
    const saved = readdirSync(join(root, 'workspace', 'templates')).map((f) => JSON.parse(readFileSync(join(root, 'workspace', 'templates', f), 'utf8')) as { name: string; tags: string[] });
    expect(saved.find((x) => x.name === 'Acme look')?.tags).toEqual(['project:acme']);
  });

  test('Skills is one list like the other tabs: filter tabs, search, a detail; Add a skill has its own page', async () => {
    await page.getByRole('tab', { name: 'Skills' }).click();
    await expect(page.getByRole('heading', { name: 'Skills', level: 1 })).toBeVisible();
    await page.getByRole('tab', { name: /^Plugins/ }).click();
    await expect(page.locator('.skill-item')).toHaveCount(4);
    await page.getByRole('searchbox', { name: 'Buscar skills' }).fill('caveman');
    await expect(page.locator('.skill-item')).toHaveCount(1);
    await page.locator('.skill-item').click();
    const acme = page.getByRole('checkbox', { name: 'Acme Library' });
    await expect(acme).not.toBeChecked();
    await acme.check();
    await expect(acme).toBeChecked();
    await page.getByRole('button', { name: 'Voltar para Skills' }).click();
    await expect(page.locator('.skill-item')).toContainText('Usado em 1 projeto');

    await page.getByRole('button', { name: 'Adicionar skill' }).click();
    await expect(page.getByRole('tab', { name: 'Criar skill' })).toBeVisible();
    await page.getByRole('tab', { name: 'Enviar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Escolher arquivo (.zip ou .md)' })).toBeVisible();
    await expect(page.getByText('Instalar para')).toHaveCount(0); // Settings installs for every project
    await page.getByRole('button', { name: 'Voltar para Skills' }).click();
  });

  test('an agent shows what it needs and delivers; your copy edits it, MCPs and AI included', async () => {
    await page.getByRole('tab', { name: 'Agentes' }).click();
    await expect(page.getByRole('heading', { name: 'Agentes' })).toBeVisible(); // the list first
    await page.locator('.library-item', { has: page.locator('.list-card-title', { hasText: /^test-designer$/ }) }).click();
    const contract = page.getByRole('group', { name: 'Na operação' });
    await expect(contract.getByRole('list', { name: 'Entradas' })).toContainText('User stories');
    await expect(contract.getByRole('list', { name: 'Saídas' })).toContainText('test-cases.json');
    await expect(contract.getByRole('textbox')).toHaveCount(0); // built-in: read-only

    await page.getByRole('button', { name: 'Duplicar' }).click();
    await expect(page.locator('.title-row h1')).toHaveText('test-designer-custom');
    await contract.getByRole('textbox', { name: 'Entradas' }).fill('Logs');
    await contract.getByRole('textbox', { name: 'Entradas' }).press('Enter');
    await contract.getByRole('combobox', { name: 'Servidor MCP' }).fill('jira');
    await contract.getByRole('button', { name: 'Adicionar: Servidor MCP' }).click();
    await contract.getByRole('combobox', { name: 'Como jira é usado' }).selectOption('execute');
    await contract.getByRole('combobox', { name: 'IA padrão' }).selectOption('codex');
    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);

    const [root] = readFileSync(join(scratch, 'root.txt'), 'utf8').trim().split('\n');
    const file = readFileSync(join(root, 'workspace', 'library', 'agents', 'quality', 'test-designer-custom.md'), 'utf8');
    expect(file).toContain('inputs: User stories, Business rules, Acceptance criteria, Logs\n');
    expect(file).toContain('mcps:\n  jira: execute\nai: codex\nmetadata:');
  });

  test('your agent: description and instructions in text fields, skills searched and added, one Save; tags say which projects it reaches', async () => {
    await expect(page.locator('.title-row h1')).toHaveText('test-designer-custom');
    await page.getByRole('textbox', { name: 'Descrição' }).fill('Designs the tests of the Acme stories.');
    await expect(page.getByText('Alterações não salvas')).toBeVisible();
    const notes = page.getByRole('textbox', { name: 'Instruções' });
    expect((await notes.boundingBox())?.height ?? 0).toBeGreaterThan(400);
    await notes.fill('# Notes only\n');
    await expect(page.getByText(/Faltam as seções: ## Role/)).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Alterações não salvas')).toHaveCount(0);

    await page.getByRole('textbox', { name: 'Descrição' }).fill('Designs the tests of the Acme stories.');
    await page.getByRole('searchbox', { name: 'Adicionar skill' }).fill('requirements');
    await page.locator('.skill-options button', { has: page.locator('.skill-name', { hasText: /^requirements-review$/ }) }).click();
    await expect(page.locator('.skill-row .skill-name')).toHaveText(['test-design', 'project-context', 'requirements-review']);
    await page.locator('.agent-savebar').getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Alterações não salvas')).toHaveCount(0);

    await page.locator('.library-detail .tag-field').getByRole('textbox', { name: 'Adicionar uma tag' }).fill('Acme');
    await page.getByRole('listbox').getByText('Acme Library').click();
    await expect(page.locator('.library-detail .tag-field .tag-chip')).toHaveText('Acme Library');

    // Before typing, the field suggests what was linked or worked on last; the ⓘ explains how tags work.
    await page.locator('.library-detail .tag-field .tag-chip').getByRole('button', { name: 'Remover tag' }).click();
    await expect(page.locator('.library-detail .tag-field .tag-chip')).toHaveCount(0);
    const field = page.locator('.library-detail .tag-field').getByRole('textbox', { name: 'Adicionar uma tag' });
    await field.focus();
    const suggested = page.getByRole('listbox', { name: 'Tags sugeridas' });
    await expect(suggested.locator('.tag-options-head')).toHaveText(['Projetos recentes']);
    await expect(suggested.getByRole('option')).toContainText(['Acme Library']);
    await field.press('Escape');
    await expect(suggested).toHaveCount(0);
    const tip = page.locator('.library-detail .tag-field').getByRole('button', { name: 'Como as tags funcionam' });
    await expect(page.getByRole('tooltip')).toBeHidden();
    await tip.hover();
    await expect(page.getByRole('tooltip')).toHaveText(/Para ligar a um projeto, escreva o nome dele/);
    await field.click(); // still focused: a click opens the suggestions again
    await suggested.getByRole('option', { name: 'Acme Library' }).click();
    await expect(page.locator('.library-detail .tag-field .tag-chip')).toHaveText('Acme Library');

    const [root] = readFileSync(join(scratch, 'root.txt'), 'utf8').trim().split('\n');
    const file = readFileSync(join(root, 'workspace', 'library', 'agents', 'quality', 'test-designer-custom.md'), 'utf8');
    expect(file).toMatch(/skills: .*requirements-review/);
    expect(file).toContain('description: Designs the tests of the Acme stories.\n');
    expect(file).toContain('\n## Role\n');
    const tags = JSON.parse(readFileSync(join(root, 'workspace', 'library', 'agent-tags.json'), 'utf8')) as { agents: Record<string, string[]> };
    expect(tags.agents['test-designer-custom']).toEqual(['project:acme']);
  });

  test('an operation links agents with arrows: approval, which output answers which input, saved in the list', async () => {
    // The window starts in English and is reloaded in Portuguese: its first load may already have listed the operations,
    // and the example then came in English. Start from an empty folder so the first listing seeds it in the app's language.
    const [fixtureRoot] = readFileSync(join(scratch, 'root.txt'), 'utf8').trim().split('\n');
    rmSync(join(fixtureRoot, 'workspace', 'library', 'operations'), { recursive: true, force: true });
    await page.getByRole('tab', { name: 'Operações' }).click();
    // The first time, an example to learn from: three lanes, the Moki agents, approval between them.
    const example = page.locator('.library-item', { hasText: 'Exemplo: da história às evidências' });
    await example.click();
    await expect(page.locator('.ops-card-name')).toHaveText(['requirements-analyst', 'test-designer', 'evidence-builder']);
    await expect(page.getByRole('region', { name: 'Checagem' }).locator('.ops-panel-head .pill')).toHaveText('Pronta');
    await page.getByRole('button', { name: 'Voltar para Operações' }).click(); // the list, like every tab
    await page.getByRole('button', { name: 'Nova operação' }).click();
    await page.getByRole('textbox', { name: 'Nome da operação' }).fill('Revisão e testes');
    const pick = async (name: string) => {
      if (!(await page.locator('.ops-palette').isVisible())) await page.getByRole('button', { name: '+ Adicionar agente' }).click();
      await page.locator('.ops-palette button', { has: page.locator('.ops-palette-name', { hasText: new RegExp(`^${name}$`) }) }).click();
    };
    await pick('requirements-analyst');
    await pick('test-designer'); // linked to the end of the line on its own

    const arrow = page.getByRole('button', { name: 'Seta de requirements-analyst para test-designer' });
    await expect(arrow).toHaveText('Aprovação');
    const inspector = page.getByRole('region', { name: 'Selecionado' });
    await expect(inspector.getByRole('heading', { level: 2 })).toHaveText('requirements-analyst → test-designer');
    await inspector.getByRole('combobox', { name: 'Resposta para Business rules' }).selectOption('review-matrix.json');
    const check = page.getByRole('region', { name: 'Checagem' });
    await expect(check.locator('.ops-initial-agent')).toHaveText(['requirements-analyst', 'test-designer']);
    await expect(check.locator('.ops-initial .chip')).toHaveText(['User stories', 'User stories', 'Acceptance criteria']);
    await expect(check).toContainText('Pronta para usar.');
    await expect(check.locator('.ops-panel-head .pill')).toHaveText('Pronta');

    // The bar under the board makes it taller; the two panels below share what is left, side by side, same size.
    const board = page.locator('.ops-board-scroll');
    const before = (await board.boundingBox())?.height ?? 0;
    const bar = await page.getByRole('separator', { name: 'Altura do quadro' }).boundingBox();
    await page.mouse.move((bar?.x ?? 0) + 20, (bar?.y ?? 0) + 6);
    await page.mouse.down();
    await page.mouse.move((bar?.x ?? 0) + 20, (bar?.y ?? 0) - 54, { steps: 6 });
    await page.mouse.up();
    expect(Math.round((await board.boundingBox())?.height ?? 0)).toBe(Math.round(Math.max(before - 60, 180))); // never below 180px
    const [left, right] = [await inspector.boundingBox(), await check.boundingBox()];
    expect(Math.round(left?.height ?? 0)).toBe(Math.round(right?.height ?? 1));
    expect(Math.round(left?.width ?? 0)).toBe(Math.round(right?.width ?? 1));

    await inspector.getByRole('radio', { name: 'Seguir direto para test-designer' }).check();
    await expect(arrow).toHaveText('Direto');

    // A third agent, linked by dragging from the dot of test-designer to its card.
    await pick('failure-analyst');
    await page.getByRole('button', { name: 'Seta de test-designer para failure-analyst' }).click();
    await inspector.getByRole('button', { name: 'Remover seta' }).click();
    await expect(check).toContainText('Etapas sem ligação com as outras: failure-analyst');
    const dot = page.getByRole('button', { name: 'Ligar test-designer a outra etapa' });
    const target = page.getByRole('button', { name: 'Etapa failure-analyst' });
    await dot.hover();
    await page.mouse.down();
    const box = await target.boundingBox();
    await page.mouse.move((box?.x ?? 0) + 60, (box?.y ?? 0) + 40, { steps: 8 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Seta de test-designer para failure-analyst' })).toBeVisible();
    await expect(page.locator('.ops-card-n')).toHaveText(['1', '2', '3']);

    // Lanes: coloured bands named after the phases; a colour from the palette; wider by dragging the border.
    await page.getByRole('button', { name: '+ Adicionar raia' }).click();
    await page.getByRole('button', { name: '+ Adicionar raia' }).click();
    const names = page.getByRole('textbox', { name: 'Nome da raia' });
    await expect(names.first()).toHaveValue('Raia 1');
    await expect(names.last()).toHaveValue('Raia 2');
    await names.first().fill('Análise');
    await names.last().fill('Testes');
    await page.getByRole('button', { name: 'Cor de Testes' }).click();
    await page.getByRole('group', { name: 'Cor da raia' }).getByRole('button', { name: '#c79be0' }).click();
    const border = page.locator('.ops-lane-resize').first();
    const edge = await border.boundingBox();
    await page.mouse.move((edge?.x ?? 0) + 4, (edge?.y ?? 0) + 200);
    await page.mouse.down();
    await page.mouse.move((edge?.x ?? 0) + 104, (edge?.y ?? 0) + 200, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('.ops-lane').first()).toHaveCSS('width', '400px');

    // Dragging the empty board moves the view.
    const scroller = page.locator('.ops-board-scroll');
    const area = await scroller.boundingBox();
    await page.mouse.move((area?.x ?? 0) + 300, (area?.y ?? 0) + 200);
    await page.mouse.down();
    await page.mouse.move((area?.x ?? 0) + 100, (area?.y ?? 0) + 200, { steps: 6 });
    await page.mouse.up();
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100);

    // Expand: the editor takes the whole window and the board grows; Esc brings it back, Settings stays open.
    const normalH = (await scroller.boundingBox())?.height ?? 0;
    await page.getByRole('button', { name: 'Expandir' }).click();
    await expect(page.locator('.ops-editor.expanded')).toBeVisible();
    await expect.poll(async () => (await scroller.boundingBox())?.height ?? 0).toBeGreaterThan(normalH + 100);
    await page.getByRole('button', { name: 'Recolher', exact: true }).click();
    await expect(page.locator('.ops-editor.expanded')).toHaveCount(0);
    // Esc: first it closes the details of what is selected, then the expanded view; Settings stays open.
    await page.getByRole('button', { name: 'Expandir' }).click();
    if (await page.locator('.ops-inspector.has-sel').count()) await page.keyboard.press('Escape');
    await expect(page.locator('.ops-inspector.has-sel')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('.ops-editor.expanded')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Operações' })).toBeVisible();

    await page.getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByText('Salva nas suas operações.')).toBeVisible();
    await page.getByRole('button', { name: 'Voltar para Operações' }).click();
    await expect(page.locator('.library-item', { hasText: 'Revisão e testes' })).toBeVisible();
    const [root] = readFileSync(join(scratch, 'root.txt'), 'utf8').trim().split('\n');
    const saved = JSON.parse(readFileSync(join(root, 'workspace', 'library', 'operations', 'revisao-e-testes.json'), 'utf8'));
    expect(saved.steps.map((s: { agent: string }) => s.agent)).toEqual(['library:requirements-analyst', 'library:test-designer', 'library:failure-analyst']);
    expect(saved.links).toEqual([
      { from: 's1', to: 's2', gate: 'auto', map: { 'Business rules': 'review-matrix.json' }, when: '' },
      { from: 's2', to: 's3', gate: 'approval', map: {}, when: '' },
    ]);
    expect(saved.lanes).toEqual([
      { id: 'l1', name: 'Análise', color: '#f1d27c', width: 400 },
      { id: 'l2', name: 'Testes', color: '#c79be0', width: 300 },
    ]);
  });
});

test.describe.serial('Moki tags', () => {
  let tagsApp: ElectronApplication;
  let tagsPage: Page;
  const dirs: string[] = [];

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    writeFileSync(join(root, 'workspace', 'tags.json'), JSON.stringify({ tags: [{ id: 'pagamentos', name: 'Pagamentos', color: '#3b82f6', description: '' }] }));
    addProject(root, 'docs', 'Docs', { tags: ['pagamentos'] });
    ({ app: tagsApp, page: tagsPage } = await openApp(root, userData));
  });

  test.afterAll(async () => {
    await tagsApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('a project tag brings the other project into the activity context', async () => {
    const input = tagsPage.locator('.sidebar-tags').getByRole('textbox', { name: 'Adicionar uma tag' });
    await input.fill('Pag');
    await tagsPage.getByRole('listbox').getByText('Pagamentos').click();
    await expect(tagsPage.locator('.sidebar-tags .tag-chip')).toHaveText('Pagamentos');

    // The tag added last is suggested first, before anything is typed.
    await tagsPage.locator('.sidebar-tags .tag-chip').getByRole('button', { name: 'Remover tag' }).click();
    await input.focus();
    const suggested = tagsPage.getByRole('listbox', { name: 'Tags sugeridas' });
    await expect(suggested.locator('.tag-options-head')).toHaveText(['Tags recentes']);
    await suggested.getByRole('option', { name: 'Pagamentos' }).click();
    await expect(tagsPage.locator('.sidebar-tags .tag-chip')).toHaveText('Pagamentos');
    await expect(suggested).toHaveCount(0); // closes once chosen: nothing left to suggest

    await tagsPage.getByRole('button', { name: 'Abrir na sua ferramenta de IA' }).click();
    await tagsPage.getByRole('button', { name: /Só abrir o projeto/ }).click();
    await tagsPage.getByRole('button', { name: 'Continuar sem arquivos' }).click();
    await expect(tagsPage.getByRole('heading', { name: 'Qual contexto a IA deve considerar?' })).toBeVisible();
    const docs = tagsPage.locator('.context-source', { hasText: 'Docs' });
    await expect(docs.getByRole('checkbox')).toBeChecked();
    await docs.getByRole('checkbox').click();
    await expect(docs.getByRole('checkbox')).not.toBeChecked();
  });
});

test('ES translates the workspace picker and the rest of the app, survives reload, and keeps EN and PT-BR working', async () => {
  const root = fixture();
  const userData = mkdtempSync(join(tmpdir(), 'moki-language-'));
  const { app: languageApp, page: languagePage } = await openApp(root, userData, null);
  try {
    const select = languagePage.locator('.lang-select');
    const languages = [
      { value: 'Spanish', code: 'es', title: 'Elige un espacio de trabajo', create: 'Crear un nuevo espacio de trabajo', open: 'Abrir una carpeta como espacio de trabajo' },
      { value: 'English', code: 'en', title: 'Choose a workspace', create: 'Create a new workspace', open: 'Open a folder as a workspace' },
      { value: 'Portuguese (pt-BR)', code: 'pt-BR', title: 'Escolha um workspace', create: 'Criar um novo workspace', open: 'Abrir uma pasta como workspace' },
      { value: 'Spanish', code: 'es', title: 'Elige un espacio de trabajo', create: 'Crear un nuevo espacio de trabajo', open: 'Abrir una carpeta como espacio de trabajo' },
    ];
    for (const expected of languages) {
      await select.selectOption(expected.value);
      await expect(languagePage.locator('html')).toHaveAttribute('lang', expected.code);
      await expect(languagePage.locator('.picker-main > p')).toContainText(expected.title);
      await expect(languagePage.getByText(expected.create, { exact: true })).toBeVisible();
      await expect(languagePage.getByRole('button', { name: expected.open })).toBeVisible();
      expect(await languagePage.evaluate(() => [localStorage.getItem('qa-ui-language'), localStorage.getItem('qa-language')])).toEqual([expected.code, expected.value]);
      await languagePage.reload();
      await expect(select).toHaveValue(expected.value);
      await expect(languagePage.locator('html')).toHaveAttribute('lang', expected.code);
      await expect(languagePage.locator('.picker-main > p')).toContainText(expected.title);
    }
    await expect(languagePage.getByText('Un lugar separado para otros proyectos, con sus propias etiquetas y configuración.')).toBeVisible();
    await expect(languagePage.getByText('Una carpeta que ya tienes. Moki añade una carpeta projects dentro de ella.')).toBeVisible();

    // With no explicit conversation preference, the selector also follows the restored UI language.
    await languagePage.evaluate(() => localStorage.removeItem('qa-language'));
    await languagePage.reload();
    await expect(select).toHaveValue('Spanish');
    await languagePage.getByRole('button', { name: 'Crear', exact: true }).click();
    await expect(languagePage.getByText('Nombre del espacio de trabajo', { exact: true })).toBeVisible();
    await expect(languagePage.getByRole('button', { name: 'Crear espacio de trabajo', exact: true })).toBeDisabled();
    await languagePage.getByRole('button', { name: 'Cancelar', exact: true }).click();

    await languagePage.locator('.picker-open').first().click();
    await expect(languagePage.getByText('Crear un nuevo proyecto', { exact: true })).toBeVisible();
    await expect(select).toHaveValue('Spanish');
    await languagePage.getByRole('button', { name: 'Configuración', exact: true }).click();
    await expect(languagePage.getByRole('tab', { name: 'Plantillas', exact: true })).toBeVisible();
    await expect(languagePage.getByRole('tab', { name: 'Agentes', exact: true })).toBeVisible();
  } finally {
    await languageApp.close();
    for (const dir of [root, userData]) rmSync(dir, { recursive: true, force: true });
  }
});

test.describe.serial('Moki workspaces', () => {
  let wsApp: ElectronApplication;
  let wsPage: Page;
  const dirs: string[] = [];

  test.beforeAll(async () => {
    const root = fixture();
    addProject(root, 'old-portal', 'Old Portal');
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    ({ app: wsApp, page: wsPage } = await openApp(root, userData, null));
  });

  test.afterAll(async () => {
    await wsApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('the app starts on the workspace picker; a new workspace opens empty and can be switched back', async () => {
    await expect(wsPage.getByText('Escolha um workspace', { exact: false })).toBeVisible();
    await expect(wsPage.locator('.picker-cat')).toBeVisible();
    await wsPage.getByRole('button', { name: 'Gerenciar' }).click();
    const manager = wsPage.locator('.workspace-management-main');
    await expect(manager).toBeVisible();
    await manager.getByRole('searchbox').fill('no-such-workspace');
    await expect(manager.locator('.workspace-manage-row')).toHaveCount(0);
    await manager.getByRole('searchbox').fill('Workspace');
    await expect(manager.locator('.workspace-manage-row')).toHaveCount(1);
    const star = manager.getByRole('button', { name: 'Adicionar Workspace aos favoritos' });
    await star.click();
    await expect(manager.getByRole('button', { name: 'Remover Workspace dos favoritos' })).toHaveAttribute('aria-pressed', 'true');
    await manager.getByRole('button', { name: 'Voltar', exact: true }).click();
    await wsPage.getByRole('button', { name: 'Gerenciar' }).click();
    await expect(manager.getByRole('button', { name: 'Remover Workspace dos favoritos' })).toBeVisible();
    await manager.getByRole('button', { name: 'Voltar', exact: true }).click();
    await wsPage.getByRole('button', { name: 'Criar' }).click();
    await expect(wsPage.getByRole('dialog', { name: 'Criar um novo workspace' })).toBeVisible();
    await wsPage.getByPlaceholder('ex.: Cliente X').fill('Cliente X');
    await wsPage.getByRole('button', { name: 'Criar workspace' }).click();
    await expect(wsPage.locator('.ws-switch-name')).toHaveText('Cliente X');
    await expect(wsPage.getByText('Nenhum projeto ainda.')).toBeVisible();

    await wsPage.locator('.ws-switch-btn').click();
    await wsPage.getByRole('menuitem', { name: 'Workspace', exact: true }).click();
    await expect(wsPage.locator('.ws-switch-name')).toHaveText('Workspace');
    await expect(wsPage.getByRole('button', { name: /Acme Library/ })).toBeVisible();
    await wsPage.evaluate(() => window.qa!.call('saveTag', { name: 'Filtro de teste' }));
    const newWindow = wsApp.waitForEvent('window');
    await wsPage.keyboard.press('Control+Shift+f');
    const searchPage = await newWindow;
    await searchPage.getByText('+ tag', { exact: true }).click();
    await expect(searchPage.getByRole('button', { name: /Filtro de teste/ })).toBeVisible();
    await searchPage.getByRole('textbox', { name: 'Buscar em projetos e arquivos' }).click();
    await expect(searchPage.getByRole('button', { name: /Filtro de teste/ })).toBeHidden();
    await searchPage.getByText('+ tag', { exact: true }).click();
    await searchPage.getByRole('button', { name: /Filtro de teste/ }).click();
    await expect(searchPage.getByRole('button', { name: 'Remover tag' })).toBeVisible();
    await searchPage.getByRole('button', { name: 'Remover tag' }).click();
    await searchPage.getByRole('textbox', { name: 'Buscar em projetos e arquivos' }).fill('projeto: Acme');
    await expect(searchPage.getByRole('button', { name: /Acme Library/ })).toBeVisible();
    await searchPage.getByRole('button', { name: 'Limpar pesquisa' }).click();
    await expect(searchPage.getByRole('textbox', { name: 'Buscar em projetos e arquivos' })).toHaveValue('');
    await searchPage.getByRole('textbox', { name: 'Buscar em projetos e arquivos' }).fill('projeto: Acme');
    await searchPage.getByRole('button', { name: /Acme Library/ }).click();
    await expect(wsPage.locator('.workspace')).toBeVisible();
    await searchPage.close();
    await wsPage.getByRole('button', { name: /Acompanhamento/ }).click();
    await wsPage.locator('.tree-row[title="activity-log.md"]').click();
    const reopenedWindow = wsApp.waitForEvent('window');
    await wsPage.keyboard.press('Control+f');
    const reopenedSearch = await reopenedWindow;
    await expect(reopenedSearch.getByRole('textbox', { name: 'Buscar em projetos e arquivos' })).toBeVisible();
    await expect(reopenedSearch.getByText('Arquivos recentes')).toBeVisible();
    await expect(reopenedSearch.getByRole('button', { name: /activity-log\.md/ })).toBeVisible();
    await reopenedSearch.close();
    await wsPage.getByRole('button', { name: 'Todos os projetos' }).click();
  });

  test('a hidden project is deleted for good only after typing delete', async () => {
    const row = wsPage.locator('.home-row', { hasText: 'Old Portal' });
    await row.click({ button: 'right' }); // the row's actions are on the right click
    await wsPage.getByRole('menuitem', { name: 'Desvisualizar' }).click();
    await wsPage.getByRole('alertdialog').getByRole('button', { name: 'Continuar', exact: true }).click();
    await wsPage.getByText('Ocultos (1)').click();
    await wsPage.locator('.home-hidden .home-row', { hasText: 'Old Portal' }).click({ button: 'right' });
    await wsPage.getByRole('menuitem', { name: 'Excluir definitivamente' }).click();

    const dialog = wsPage.getByRole('dialog', { name: 'Excluir Old Portal' });
    const confirm = dialog.getByRole('button', { name: 'Excluir definitivamente' });
    await expect(confirm).toBeDisabled();
    await dialog.getByPlaceholder('delete').fill('Delete');
    await expect(confirm).toBeDisabled();
    await dialog.getByPlaceholder('delete').fill('delete');
    await confirm.click();

    await expect(dialog).toBeHidden();
    await expect(wsPage.getByText('Old Portal')).toHaveCount(0);
    await expect(wsPage.getByRole('button', { name: /Acme Library/ })).toBeVisible();
    expect(existsSync(join(dirs[0], 'workspace', 'projects', 'old-portal'))).toBe(false);
  });

  test('creating a project opens directly without setup or AI planning', async () => {
    await wsPage.getByRole('button', { name: 'Criar', exact: true }).click(); // the + of "Create a new project"
    await expect(wsPage.getByRole('dialog', { name: 'Criar um novo projeto' })).toBeVisible();
    await expect(wsPage.getByRole('button', { name: 'Criar e personalizar…' })).toHaveCount(0);
    await wsPage.getByRole('textbox', { name: /Nome do projeto/ }).fill('Rapido');
    await wsPage.keyboard.press('Enter');
    await expect(wsPage.locator('.project-switch')).toHaveText('Rapido');
    await expect(wsPage.getByRole('dialog')).toHaveCount(0); // nothing to set up
    const quick = join(dirs[0], 'workspace', 'projects', 'rapido');
    for (const sub of ['context', 'inbox', 'runs', 'temporary']) expect(existsSync(join(quick, sub))).toBe(true);
    expect(readdirSync(join(quick, 'context'))).toEqual([]);

    await wsPage.locator('.project-switch').click(); // back to the start screen
  });

  test('a loose note is created from the fixed rail; saved notes open inside the app and in the notebook tabs', async () => {
    await wsPage.locator('.ribbon').getByRole('button', { name: 'Nova nota' }).click();
    const note = wsPage.locator('.home-main .note-dialog'); // in the main area, like the notes opened from the list
    await expect(note).toBeVisible();
    await expect(wsPage.locator('.modal-backdrop > .note-dialog')).toHaveCount(0);
    await note.getByPlaceholder('ex.: Ideias de teste').fill('Lista');
    await note.getByRole('button', { name: 'Código Markdown' }).click(); // a note opens in its formatted editor; the source is one click away
    await note.locator('textarea.note-editor').fill('leite');
    await expect(note.getByRole('button', { name: 'Salvar' })).toHaveCount(0); // it saves on its own
    await expect(note.getByText(/^Salvo às/)).toBeVisible();
    await note.getByRole('button', { name: 'Fechar (Esc)' }).click();
    await expect(note).toBeHidden();
    await expect(wsPage.locator('.hero')).toBeVisible(); // back to the start screen

    // A click opens it here again; the icon beside it opens the notebook window.
    await wsPage.locator('.home-row', { hasText: 'Lista' }).last().locator('.home-project').click();
    const embedded = wsPage.locator('.home-main .note-dialog');
    await embedded.getByRole('button', { name: 'Código Markdown' }).click();
    await expect(embedded.locator('textarea.note-editor')).toHaveValue('leite');
    // A new note takes the main area in its place (one note at a time there).
    await wsPage.locator('.ribbon').getByRole('button', { name: 'Nova nota' }).click();
    await expect(embedded.getByPlaceholder('ex.: Ideias de teste')).toHaveValue('');
    await embedded.getByRole('button', { name: 'Fechar (Esc)' }).click();
    await expect(wsPage.locator('.hero')).toBeVisible();

    const row = wsPage.locator('.home-row', { hasText: 'Lista' }).last();
    await row.click({ button: 'right' });
    const opened = wsApp.waitForEvent('window');
    await wsPage.getByRole('menuitem', { name: 'Abrir no bloco de notas' }).click();
    const book = await opened;
    await expect(book.getByRole('tab')).toHaveText(['Lista']);
    await book.getByRole('button', { name: 'Código Markdown' }).click();
    await expect(book.locator('textarea.note-editor')).toHaveValue('leite');

    await book.getByRole('button', { name: 'Nova nota' }).click();
    await expect(book.getByRole('tab')).toHaveCount(2);
    await expect(book.getByRole('tab', { name: 'Nova nota' })).toHaveAttribute('aria-selected', 'true');
    await book.getByRole('tab', { name: 'Nova nota' }).getByRole('button', { name: 'Fechar aba' }).click();
    await expect(book.getByRole('tab')).toHaveText(['Lista']);
    await book.close();
  });
});

test.describe.serial('Moki project tree', () => {
  let treeApp: ElectronApplication;
  let treePage: Page;
  const dirs: string[] = [];

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    ({ app: treeApp, page: treePage } = await openApp(root, userData));
  });

  test.afterAll(async () => {
    await treeApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('right click on a tree item copies its full path', async () => {
    await treePage.locator('.tree-row[title="context"]').click({ button: 'right' });
    await expect(treePage.getByRole('menuitem', { name: 'Mostrar na pasta' })).toBeVisible();
    await treePage.getByRole('menuitem', { name: 'Copiar caminho' }).click();
    const expected = join(dirs[0], 'workspace', 'projects', 'acme', 'context');
    await expect(treePage.getByRole('status')).toContainText(expected);
    expect(await treeApp.evaluate(({ clipboard }) => clipboard.readText())).toBe(expected);
    await expect(treePage.getByRole('menu')).toBeHidden();
  });

  test('the ⋯ menu creates a file that opens to be written, and a folder at the project root', async () => {
    const inbox = treePage.locator('.tree-line', { has: treePage.locator('.tree-row[title="inbox"]') });
    await inbox.hover();
    await inbox.getByRole('button', { name: 'Mais opções' }).click();
    await treePage.getByRole('menuitem', { name: 'Novo arquivo' }).click();
    const dialog = treePage.getByRole('dialog', { name: 'Novo arquivo' });
    await dialog.getByLabel('Nome').fill('cenarios');
    await dialog.getByRole('button', { name: 'Criar' }).click();
    await expect(dialog).toBeHidden();
    const project = join(dirs[0], 'workspace', 'projects', 'acme');
    expect(existsSync(join(project, 'inbox', 'cenarios.md'))).toBe(true);
    await expect(treePage.locator('.tree-row[title="inbox/cenarios.md"]')).toBeVisible();
    // It opens in the editor, where the / commands are.
    const visual = treePage.locator('.commented-editor .tiptap-body');
    await expect(visual).toHaveAttribute('contenteditable', 'true');
    await visual.click();
    await treePage.keyboard.type('/tab');
    await expect(treePage.getByRole('listbox', { name: 'Comandos' })).toContainText('Tabela');
    await treePage.keyboard.press('Enter');
    await expect(visual.locator('table')).toBeVisible();
    await expect.poll(() => readFileSync(join(dirs[0], 'workspace', 'projects', 'acme', 'inbox', 'cenarios.md'), 'utf8')).toMatch(/\|\s*-{3,}\s*\|/); // saved on its own

    await treePage.getByRole('button', { name: 'Opções da pasta do projeto' }).click();
    await expect(treePage.getByRole('menuitem', { name: 'Copiar caminho' })).toBeVisible();
    await treePage.getByRole('menuitem', { name: 'Nova pasta' }).click();
    await treePage.getByRole('dialog', { name: 'Nova pasta' }).getByLabel('Nome').fill('sprint-12');
    await treePage.getByRole('dialog', { name: 'Nova pasta' }).getByRole('button', { name: 'Criar' }).click();
    await expect(treePage.locator('.tree-row[title="sprint-12"]')).toBeVisible();
    expect(existsSync(join(project, 'sprint-12'))).toBe(true);

    await treePage.locator('.tree-row[title="runs"]').click({ button: 'right' });
    await expect(treePage.getByRole('menuitem', { name: 'Mostrar na pasta' })).toBeVisible();
    await expect(treePage.getByRole('menuitem', { name: 'Novo arquivo' })).toHaveCount(0);
    await treePage.keyboard.press('Escape');
  });

  test('the sidebar is in blocks: folders, Tracking and Other files, then Project settings and MCPs; the Operations card is in the project panel', async () => {
    const project = join(dirs[0], 'workspace', 'projects', 'acme');
    writeFileSync(join(project, 'rascunho.md'), 'x');
    const other = treePage.locator('.tree-row[title=".other"]');
    await expect(other).toContainText('Outros arquivos');
    await expect(treePage.locator('.tree-row[title="rascunho.md"]')).toHaveCount(0);
    await other.click();
    await expect(treePage.locator('.tree-row[title="rascunho.md"]')).toBeVisible();
    // A group of the sidebar is not a folder: no menu to create, reveal or copy.
    await expect(treePage.locator('.tree-line', { has: other }).getByRole('button', { name: 'Mais opções' })).toHaveCount(0);

    // The files Moki keeps up to date are grouped too, with their friendly names.
    await treePage.locator('.tree-row[title=".tracking"]').click();
    await expect(treePage.locator('.tree-row[title="activity-log.md"]')).toContainText('Registro de atividades');

    // No Project settings group in the tree (the project settings edit what README.md and project.json hold); the MCP servers stay.
    await expect(treePage.locator('.tree-row[title=".settings"]')).toHaveCount(0);
    await expect(treePage.locator('.tree-row[title="project.json"]')).toHaveCount(0);
    await expect(treePage.locator('.tree-row[title="README.md"]')).toHaveCount(0);
    await expect(treePage.locator('.tree-row[title=".mcps"]')).toBeVisible();
    // Operations is the last card of the project panel, below the AI assistant. With nothing under way it stays on that list; an operation is chosen on the assistant card.
    const ops = treePage.locator('.panel').getByRole('region', { name: 'Execuções' });
    await expect(ops.getByRole('tab', { name: 'Em andamento' })).toHaveAttribute('aria-selected', 'true');
    // The tabs are the header of both cards: neither shows a title of its own.
    await expect(ops.getByText('Execuções', { exact: true })).toHaveCount(0);
    await expect(treePage.locator('.panel').getByText('Assistente de IA', { exact: true })).toHaveCount(0);
    await expect(ops.getByRole('button', { name: 'Vincular operações a este projeto' })).toHaveCount(0);
    await ops.getByRole('tab', { name: 'Pedidos', exact: true }).click();
    await expect(ops.getByRole('tab', { name: 'Em andamento' })).toHaveAttribute('aria-selected', 'true');
    await ops.getByRole('tab', { name: 'Operações', exact: true }).click();
    const order = await treePage.locator('.sidebar-scroll > *').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? e.className));
    expect(order).toEqual(['tree']); // only the files scroll
    // The sidebar keeps only the files and, fixed below them, the settings.
    const blocks = await treePage.locator('.sidebar > *').evaluateAll((els) => els.map((e) => e.className.split(' ')[0]));
    expect(blocks.slice(-2)).toEqual(['sidebar-scroll', 'sidebar-foot']);
    await expect(treePage.locator('.sidebar .ops-side')).toHaveCount(0);
    // The MCP servers stay fixed at the bottom of the sidebar.
    await expect(treePage.locator('.sidebar-foot .tree-row[title=".mcps"]')).toBeVisible();
  });

  test('the file sidebar resizes, collapses and remembers its width independently of the right panel', async () => {
    const sidebar = treePage.locator('.sidebar');
    const splitter = treePage.getByRole('separator', { name: 'Ajustar largura da barra de arquivos' });
    const initial = await sidebar.boundingBox();
    if (!initial) throw new Error('Sidebar is not visible');
    await splitter.hover();
    expect(await splitter.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    expect(await splitter.evaluate((el) => getComputedStyle(el, '::after').width)).toBe('2px');
    expect((await splitter.evaluate((el) => getComputedStyle(el, '::after').boxShadow)).split('rgb').length).toBe(3);
    await treePage.mouse.move(initial.x + initial.width - 1, initial.y + 100);
    await treePage.mouse.down();
    await treePage.mouse.move(initial.x + initial.width + 100, initial.y + 100, { steps: 5 });
    await treePage.mouse.up();
    await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeGreaterThan(initial.width + 80);
    const expanded = await sidebar.boundingBox();
    if (!expanded) throw new Error('Sidebar is not visible');
    await splitter.focus();
    await treePage.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await sidebar.boundingBox())?.width ?? 0).toBeLessThan(expanded.width - 10);
    const savedWidth = await sidebar.evaluate((el) => el.getBoundingClientRect().width);
    const rightPanel = treePage.locator('.panel');
    await treePage.getByRole('button', { name: 'Recolher barra de arquivos' }).click();
    await expect(sidebar).toBeHidden();
    await expect(rightPanel).not.toHaveClass(/panel-rail/);
    await treePage.getByRole('button', { name: 'Mostrar barra de arquivos' }).click();
    await expect(sidebar).toBeVisible();
    await expect.poll(async () => Math.abs((await sidebar.evaluate((el) => el.getBoundingClientRect().width)) - savedWidth)).toBeLessThan(2);
    await rightPanel.getByRole('button', { name: 'Recolher o painel' }).click();
    await expect(rightPanel).toHaveClass(/panel-rail/);
    await treePage.getByRole('button', { name: 'Recolher barra de arquivos' }).click();
    await expect(sidebar).toBeHidden();
    await expect(rightPanel).toHaveClass(/panel-rail/);
    await treePage.getByRole('button', { name: 'Mostrar barra de arquivos' }).click();
    await rightPanel.getByRole('button', { name: 'Expandir o painel' }).click();
    await treePage.getByRole('button', { name: 'Recolher barra de arquivos' }).click();
    await treePage.getByRole('button', { name: 'Todos os projetos' }).click();
    await treePage.locator('.home-project', { hasText: 'Acme Library' }).first().click();
    await expect(treePage.locator('.sidebar')).toBeHidden();
    await treePage.getByRole('button', { name: 'Mostrar barra de arquivos' }).click();
    await expect.poll(async () => Math.abs((await treePage.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width)) - savedWidth)).toBeLessThan(2);
    await treePage.getByRole('button', { name: 'Recolher barra de arquivos' }).click();
    const searchWindow = treeApp.waitForEvent('window');
    await treePage.getByRole('button', { name: 'Buscar (Ctrl+Shift+F)' }).click();
    const searchPage = await searchWindow;
    await expect(treePage.locator('.sidebar')).toBeVisible();
    await expect(searchPage.getByRole('textbox', { name: 'Buscar em projetos e arquivos' })).toBeVisible();
    await searchPage.close();
    await treePage.getByRole('button', { name: 'Recolher barra de arquivos' }).click();
    const keyboardSearchWindow = treeApp.waitForEvent('window');
    await treePage.keyboard.press('Control+Shift+f');
    const keyboardSearch = await keyboardSearchWindow;
    await expect(treePage.locator('.sidebar')).toBeVisible();
    await keyboardSearch.close();
  });

  test('a linked folder shows first in the tree, live, with Open in the IDE; its files open in the app', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'moki-linked-'));
    dirs.push(folder);
    mkdirSync(join(folder, 'docs'));
    writeFileSync(join(folder, 'docs', 'us-1.md'), '# US-1 da pasta');
    const file = join(dirs[0], 'workspace', 'projects', 'acme', 'project.json');
    const data = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify({ ...data, repositories: [{ name: 'app', localPath: folder, linkedFolder: true }] }, null, 2));
    // Opened again, as after creating it from the folder: the folder is listed and watched.
    await treePage.locator('.project-switch').click();
    await treePage.locator('.home-project', { hasText: 'Acme Library' }).first().click();

    const linked = treePage.locator('.tree-row[title="' + folder.replace(/\\/g, '\\\\') + '"]');
    await expect(linked).toContainText(basename(folder));
    await expect(treePage.locator('.sidebar-scroll .tree-row.top').first()).toHaveAttribute('title', folder);
    await expect(treePage.locator('.tree-line', { has: linked }).getByRole('button', { name: 'Abrir na IDE' })).toBeVisible();
    await linked.click();
    await treePage.locator('.tree-row[title="@folder/docs"]').click();
    await treePage.locator('.tree-row[title="@folder/docs/us-1.md"]').click();
    await expect(treePage.locator('.tiptap-body h1', { hasText: 'US-1 da pasta' })).toBeVisible(); // its .md files open in the editor too
    await expect(treePage.locator('.file-tags-bar')).toHaveCount(0); // tags are for the project's own files

    // Changes in the folder show by themselves.
    writeFileSync(join(folder, 'docs', 'us-2.md'), '# US-2');
    await expect(treePage.locator('.tree-row[title="@folder/docs/us-2.md"]')).toBeVisible();
    writeFileSync(file, JSON.stringify(data, null, 2));
  });

  test('typing / in a note lists the formatting commands; a checklist continues on Enter', async () => {
    await treePage.locator('.tree-row[title="notes"]').click();
    await treePage.locator('.sidebar').getByRole('button', { name: 'Nova nota' }).click();
    const note = treePage.locator('.note-dialog'); // its name follows the title typed below
    await note.getByPlaceholder('ex.: Ideias de teste').fill('Compras');
    await note.getByRole('button', { name: 'Código Markdown' }).click();
    const editor = note.locator('textarea.note-editor');
    const commands = note.getByRole('listbox', { name: 'Comandos' });

    await editor.click();
    await editor.pressSequentially('/tare');
    await expect(commands.getByRole('option')).toHaveCount(1);
    await expect(commands.getByRole('option', { name: 'Checklist' })).toBeVisible();
    const editorBox = await editor.boundingBox();
    expect((await commands.boundingBox())!.y - editorBox!.y).toBeLessThan(80); // at the caret, under the first line
    await editor.press('Enter');
    await expect(commands).toBeHidden();
    await expect(editor).toHaveValue('- [ ] ');
    await editor.pressSequentially('pão');
    await editor.press('Enter');
    await editor.pressSequentially('café');
    await expect(editor).toHaveValue('- [ ] pão\n- [ ] café');

    await editor.press('Enter');
    await editor.press('Enter'); // an empty item ends the list
    await note.getByRole('button', { name: 'Comandos (digite /)' }).click();
    await expect(commands).toBeVisible();
    await editor.pressSequentially('gra');
    await commands.getByRole('option', { name: 'Título grande' }).click();
    await editor.pressSequentially('Fim');
    await expect(editor).toHaveValue('- [ ] pão\n- [ ] café\n# Fim');

    await editor.pressSequentially(' e/ou /');
    await expect(commands).toBeVisible(); // after a space only; "e/ou" did not open it
    await editor.press('Escape');
    await expect(commands).toBeHidden();
    await expect(note).toBeVisible(); // Escape closed the list, not the note
    await treePage.keyboard.press('Escape'); // closing saves it: no question, nothing lost
    await expect(note).toBeHidden();
    await expect.poll(() => { try { return readFileSync(join(dirs[0], 'workspace', 'projects', 'acme', 'notes', 'compras.md'), 'utf8'); } catch { return ''; } })
      .toBe('- [ ] pão\n- [ ] café\n# Fim e/ou /');
  });

  test('the star turns a note into a golden favorite, first in the notes folder', async () => {
    const create = async (name: string) => {
      await treePage.locator('.tree-row[title="notes"]').click({ button: 'right' });
      await treePage.getByRole('menuitem', { name: 'Novo arquivo' }).click();
      await treePage.getByRole('dialog', { name: 'Novo arquivo' }).getByLabel('Nome').fill(name);
      await treePage.getByRole('dialog', { name: 'Novo arquivo' }).getByRole('button', { name: 'Criar' }).click();
      await expect(treePage.locator('.note-dialog')).toBeVisible(); // a note opens in its popup
    };
    await create('aaa');
    await treePage.keyboard.press('Escape');
    await create('ideias');

    const star = treePage.locator('.note-dialog').getByRole('button', { name: 'Favoritar' });
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await star.click();
    const on = treePage.locator('.note-dialog').getByRole('button', { name: 'Desfavoritar' });
    await expect(on).toHaveAttribute('aria-pressed', 'true');
    await on.hover(); // the button hover color must not win over the gold
    const fill = await on.evaluate((el) => getComputedStyle(el.querySelector('.star-shape') as SVGPathElement).fill);
    expect(['rgb(242, 194, 48)', 'rgb(217, 164, 6)']).toContain(fill); // --star, dark or light theme
    await treePage.keyboard.press('Escape');

    const notes = treePage.locator('.tree-row[title^="notes/"]');
    await expect(notes.first()).toHaveAttribute('title', 'notes/ideias.md');
    await expect(notes.first().locator('.star-mark')).toBeVisible();

    await notes.first().click({ button: 'right' });
    await treePage.getByRole('menuitem', { name: 'Desfavoritar' }).click();
    await expect(treePage.locator('.tree-row[title="notes/ideias.md"] .star-mark')).toHaveCount(0);
    await expect(notes.first()).toHaveAttribute('title', 'notes/aaa.md');
  });

  test('a project note opens inside the app, and in its notebook with every note of the project as a tab', async () => {
    await treePage.locator('.tree-row[title="notes/aaa.md"]').click();
    const inApp = treePage.locator('.main .note-host .note-dialog'); // in the main area, not a popup
    await expect(inApp).toBeVisible();
    await expect(treePage.locator('.modal-backdrop')).toHaveCount(0);
    const opened = treeApp.waitForEvent('window');
    await inApp.getByRole('button', { name: 'Abrir no bloco de notas' }).click();
    const book = await opened;
    await expect(inApp).toBeHidden();
    await expect(book.getByRole('tab')).toHaveText(['aaa', 'compras', 'ideias']);
    await expect(book.getByRole('tab', { name: 'aaa' })).toHaveAttribute('aria-selected', 'true');

    // Another note of the project goes to the same window.
    await treePage.locator('.tree-row[title="notes/ideias.md"]').click({ button: 'right' });
    await treePage.getByRole('menuitem', { name: 'Abrir no bloco de notas' }).click();
    await expect(book.getByRole('tab', { name: 'ideias' })).toHaveAttribute('aria-selected', 'true');
    expect(treeApp.windows()).toHaveLength(2);

    // + writes a new note of the project; saved, it stays open as its own tab.
    await book.getByRole('button', { name: 'Nova nota' }).click();
    const page = book.locator('.notebook-page:not([hidden])');
    await page.getByPlaceholder('ex.: Ideias de teste').fill('terceira');
    await page.getByRole('button', { name: 'Código Markdown' }).click();
    const editor = page.locator('textarea.note-editor');
    await editor.fill('texto');
    await expect(book.getByRole('tab', { name: 'terceira' })).toHaveAttribute('aria-selected', 'true'); // saved on its own
    await expect(book.getByRole('tab')).toHaveCount(4);
    const file = join(dirs[0], 'workspace', 'projects', 'acme', 'notes', 'terceira.md');
    await expect.poll(() => readFileSync(file, 'utf8')).toBe('texto');
    await editor.pressSequentially(' mais'); // still the same note, still writing
    await expect(editor).toBeFocused();
    await expect.poll(() => readFileSync(file, 'utf8')).toBe('texto mais');
    await book.close();
  });
});

// AI tools are faked (QA_FAKE_TOOLS): nothing is started; the test writes what each agent would deliver.
test.describe.serial('Moki operations in a project', () => {
  let opsApp: ElectronApplication;
  let opsPage: Page;
  const dirs: string[] = [];

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    mkdirSync(join(root, 'workspace', 'library', 'operations'), { recursive: true });
    writeFileSync(join(root, 'workspace', 'library', 'operations', 'fluxo-qa.json'), JSON.stringify({
      schemaVersion: 1, id: 'fluxo-qa', name: 'Fluxo QA', description: 'Revisão e testes', lanes: [],
      steps: [{ id: 's1', agent: 'library:requirements-analyst', x: 20, y: 60 }, { id: 's2', agent: 'library:test-designer', x: 320, y: 60 }],
      links: [{ from: 's1', to: 's2', gate: 'approval', map: { 'Business rules': 'review-matrix.json' } }],
    }));
    writeFileSync(join(root, 'workspace', 'projects', 'acme', 'inbox', 'us-1.md'), '# US-1');
    // A reviewer that ends approved or rejected, and a fixer: rejected goes to the fixer and back to the review.
    const agent = (name: string, extra: string) => [
      '---', `name: ${name}`, `description: ${name}.`, 'category: quality', 'skills: project-context', 'access: project-write', extra,
      'metadata:', '  version: "1.0.0"', '  status: draft', '---', '', `# ${name}`, '', '## Role', '', 'x', '', '## When to use', '', 'x', '', '## How to work', '', 'x', '', '## Boundaries', '', 'x', '',
    ].join('\n');
    mkdirSync(join(root, 'workspace', 'library', 'agents', 'quality'), { recursive: true });
    writeFileSync(join(root, 'workspace', 'library', 'agents', 'quality', 'reviewer.md'), agent('reviewer', 'outputs: review.md\noutcomes: approved, rejected'));
    writeFileSync(join(root, 'workspace', 'library', 'agents', 'quality', 'fixer.md'), agent('fixer', 'outputs: fixed.md'));
    writeFileSync(join(root, 'workspace', 'library', 'operations', 'revisa-ate-aprovar.json'), JSON.stringify({
      schemaVersion: 1, id: 'revisa-ate-aprovar', name: 'Revisa até aprovar', description: '', lanes: [], start: 's1', maxRounds: 3,
      steps: [{ id: 's1', agent: 'library:reviewer', x: 20, y: 60 }, { id: 's2', agent: 'library:fixer', x: 340, y: 240 }],
      links: [{ from: 's1', to: 's2', gate: 'auto', map: {}, when: 'rejected' }, { from: 's2', to: 's1', gate: 'auto', map: {}, when: '' }],
    }));
    ({ app: opsApp, page: opsPage } = await openApp(root, userData, 'acme', { QA_FAKE_TOOLS: '1' }));
  });

  test.afterAll(async () => {
    await opsApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('an operation is started from its form, and moves on as each agent delivers its files', async () => {
    const side = opsPage.getByRole('region', { name: 'Execuções' });
    const assistant = opsPage.getByRole('region', { name: 'Assistente de IA' });
    await assistant.getByRole('button', { name: 'Chamar…', exact: true }).click();
    const dialog = opsPage.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Operações', exact: true }).click();
    await dialog.getByRole('searchbox').fill('fluxo');
    await expect(dialog.locator('.invoke-row')).toHaveCount(1);
    await expect(dialog.locator('.invoke-row')).toContainText('Cada etapa usa seu próprio terminal');
    await dialog.locator('.invoke-row').click();
    await expect(dialog).toHaveCount(0);

    const launch = opsPage.getByRole('region', { name: 'Iniciar Fluxo QA' });
    await expect(launch.locator('.ops-run-agent')).toHaveText(['requirements-analyst', 'test-designer']);
    await launch.getByRole('textbox', { name: 'O que você quer?' }).fill('Revisar o login');
    await launch.getByRole('textbox', { name: 'User stories (requirements-analyst)' }).fill('US-1 login');
    await launch.locator('.ops-run-inputs').first().getByRole('button', { name: 'us-1.md' }).click();
    await launch.getByRole('button', { name: 'Iniciar operação' }).click();

    // The run opens on its board: each card shows how its step is doing; the panel beside it, the step under way.
    const runView = opsPage.locator('.ops-run');
    const card = (step: string) => runView.locator(`.ops-run-card[data-step="${step}"]`);
    await expect(card('s1')).toHaveAttribute('data-state', 'running');
    await expect(card('s2')).toHaveAttribute('data-state', 'pending');
    await expect(runView.locator('.ops-run-panel h2')).toHaveText('requirements-analyst');
    // The step's panel takes the right side of the screen: the project panel steps aside while the board shows.
    await expect(opsPage.locator('.workspace.panel-rail')).toHaveCount(1);
    await expect(runView.locator('.ops-run-panel')).toHaveCSS('position', 'absolute');
    // The Operations card lives in that project panel: it steps aside with it, and is back in the list view.
    await expect(side).toHaveCount(0);
    await runView.getByRole('button', { name: 'Lista', exact: true }).click();
    await expect(side.locator('.ops-side-row', { hasText: 'Em andamento' })).toHaveAttribute('data-status', 'in-progress'); // its color: lilac
    await runView.getByRole('button', { name: 'Quadro', exact: true }).click();
    const runs = join(dirs[0], 'workspace', 'projects', 'acme', 'runs');
    const runId = readdirSync(runs).find((d) => d.includes('-op-fluxo-qa')) as string;
    const run = join(runs, runId);
    expect(readFileSync(join(run, 'inputs', 'request.md'), 'utf8')).toContain('workspace/projects/acme/inbox/us-1.md');

    // The analyst stops to ask something: the run waits for the user and shows the question.
    writeFileSync(join(run, 'waiting', 's1.md'), 'Qual ambiente devo considerar?');
    await expect(runView.locator('.ops-question')).toContainText('requirements-analyst pergunta: Qual ambiente devo considerar?');
    await expect(card('s1')).toHaveAttribute('data-state', 'asking');
    await expect(runView.locator('.ops-run-head .pill')).toHaveText('Aguardando informações');
    // Answered here: its terminal is not open in Moki (the tools are faked), so the step starts again with the answer.
    await expect(runView.getByRole('button', { name: 'Ver a pergunta completa' })).toBeVisible();
    await expect(runView.locator('.ops-question')).toContainText('O terminal dele não está aberto no Moki');
    await runView.getByRole('textbox', { name: 'Sua resposta' }).fill('Homologação');
    await runView.getByRole('button', { name: 'Responder e retomar' }).click();
    await expect(runView.locator('.ops-question')).toHaveCount(0);
    await expect(card('s1')).toHaveAttribute('data-state', 'running');
    expect(existsSync(join(run, 'waiting', 's1.md'))).toBe(false);
    expect(JSON.parse(readFileSync(join(run, 'state.json'), 'utf8')).visits[0].resume).toEqual({ question: 'Qual ambiente devo considerar?', answer: 'Homologação' });

    // The analyst delivers its files and its summary: the next step waits for approval (an approval arrow).
    mkdirSync(join(run, 'outputs', 's1'), { recursive: true });
    for (const f of ['review-matrix.json', 'Matriz.xlsx', 'Relatorio.pdf']) writeFileSync(join(run, 'outputs', 's1', f), 'x');
    writeFileSync(join(run, 'handoff', 's1.md'), 'Revisei a US-1.');
    await expect(card('s1')).toHaveAttribute('data-state', 'done');
    await expect(card('s2')).toHaveAttribute('data-state', 'awaiting-approval');
    await expect(runView.locator('.ops-run-panel h2')).toHaveText('test-designer');

    // Rejected with a reason and sent back: the analyst runs again (its second time) and sees why.
    await runView.getByRole('button', { name: 'Reprovar…' }).click();
    await runView.getByRole('textbox', { name: 'Por que você reprova' }).fill('Falta a regra de senha.');
    await runView.getByRole('button', { name: 'Devolver para requirements-analyst' }).click();
    await expect(card('s2')).toHaveAttribute('data-state', 'cancelled');
    await expect(card('s1')).toHaveAttribute('data-state', 'running');
    await expect(card('s1').locator('.chip')).toHaveText('×2');
    await expect(runView.locator('.ops-run-panel .ops-notes')).toContainText('Falta a regra de senha.');

    mkdirSync(join(run, 'outputs', 's1-2'), { recursive: true });
    for (const f of ['review-matrix.json', 'Matriz.xlsx', 'Relatorio.pdf']) writeFileSync(join(run, 'outputs', 's1-2', f), 'x');
    writeFileSync(join(run, 'handoff', 's1-2.md'), 'Revisei de novo.');
    await expect(card('s2')).toHaveAttribute('data-state', 'awaiting-approval');
    await runView.getByRole('button', { name: 'Aprovar e iniciar test-designer' }).click();
    await expect(card('s2')).toHaveAttribute('data-state', 'running');

    mkdirSync(join(run, 'outputs', 's2-2'), { recursive: true });
    for (const f of ['mapping.md', 'test-cases.json', 'Casos.xlsx']) writeFileSync(join(run, 'outputs', 's2-2', f), 'x');
    writeFileSync(join(run, 'handoff', 's2-2.md'), 'Casos prontos.');
    await expect(card('s2')).toHaveAttribute('data-state', 'done');
    await expect(runView.locator('.ops-run-head .pill')).toHaveText('Concluída');

    // A click on a card shows that step beside the board.
    await card('s1').click();
    await expect(runView.locator('.ops-run-panel h2')).toHaveText('requirements-analyst');
    await expect(runView.locator('.ops-run-panel .ops-run-visit')).toHaveCount(2);

    // The list shows each time a step ran (the app remembers it: the next test reads the list).
    await runView.getByRole('button', { name: 'Lista', exact: true }).click();
    await expect(runView.locator('.ops-timeline-status')).toHaveText(['Concluída', 'Cancelada', 'Concluída', 'Concluída']);

    // Each step's summary and files show in the run screen itself, without opening anything else.
    const summary = runView.getByRole('region', { name: 'Resumo da etapa' }).first();
    await expect(summary).toBeVisible();
    const delivered = runView.getByRole('region', { name: 'O que entregou' }).first();
    await delivered.locator('.run-file').first().click();
    await expect(delivered.locator('.run-preview')).toBeVisible();
    // Closed, the run stays in the side panel, among the finished ones.
    await side.getByRole('tab', { name: /Concluídas/ }).click();
    await expect(side.locator('.ops-side-ended .ops-side-row')).toContainText('Fluxo QA');
  });

  test('an operation starts from the assistant card: its steps keep their agent and each AI is changed with the same pick', async () => {
    const card = opsPage.getByRole('region', { name: 'Assistente de IA' });
    await card.getByRole('button', { name: 'Chamar…', exact: true }).click();
    const dialog = opsPage.getByRole('dialog');
    await dialog.getByRole('tab', { name: 'Operações', exact: true }).click();
    await dialog.getByRole('searchbox').fill('fluxo');
    await expect(dialog.locator('.invoke-row')).toHaveCount(1);
    await dialog.locator('.invoke-row').click();
    await expect(dialog).toHaveCount(0);

    // Each step arrives with its agent and AI; the operation's start is not flattened to one agent and one AI.
    const launch = opsPage.getByRole('region', { name: 'Iniciar Fluxo QA' });
    await expect(launch.locator('.ops-run-agent')).toHaveText(['requirements-analyst', 'test-designer']);
    const analyst = launch.getByRole('button', { name: 'IA de requirements-analyst' });
    const designer = launch.getByRole('button', { name: 'IA de test-designer' });
    await expect(analyst).toBeVisible();
    await analyst.click();
    await opsPage.getByRole('dialog').locator('.catalog-card').filter({ hasText: 'Gemini CLI' }).click();
    await expect(analyst).toContainText('Gemini CLI');
    await expect(designer).not.toContainText('Gemini CLI');
    await launch.getByRole('button', { name: 'Fechar' }).click();
    await expect(launch).toHaveCount(0);
  });

  test('a result picks the arrow: rejected goes to the fixer and back to the review; no valid result asks the user', async () => {
    const assistant = opsPage.getByRole('region', { name: 'Assistente de IA' });
    await assistant.getByRole('button', { name: 'Chamar…', exact: true }).click();
    await opsPage.getByRole('dialog').getByRole('tab', { name: 'Operações', exact: true }).click();
    await opsPage.getByRole('dialog').locator('.invoke-row').filter({ hasText: 'Revisa até aprovar' }).click();
    await opsPage.getByRole('region', { name: 'Iniciar Revisa até aprovar' }).getByRole('button', { name: 'Iniciar operação' }).click();

    const runView = opsPage.locator('.ops-run');
    const runs = join(dirs[0], 'workspace', 'projects', 'acme', 'runs');
    const run = join(runs, readdirSync(runs).find((d) => d.includes('-op-revisa-ate-aprovar')) as string);
    const deliver = (slot: string, file: string, handoff: string) => {
      mkdirSync(join(run, 'outputs', slot), { recursive: true });
      writeFileSync(join(run, 'outputs', slot, file), 'x');
      writeFileSync(join(run, 'handoff', `${slot}.md`), handoff);
    };
    deliver('s1', 'review.md', 'outcome: rejected');
    await expect(runView.locator('.ops-timeline-title strong')).toHaveText(['reviewer', 'fixer']);
    await expect(runView.locator('.pill-outcome')).toHaveText(['rejected']);
    deliver('s2', 'fixed.md', 'Ajustado.');
    await expect(runView.locator('.ops-timeline-title strong')).toHaveText(['reviewer', 'fixer', 'reviewer']);
    await expect(runView.locator('.ops-timeline-step').last().locator('.chip')).toHaveText('2ª vez');

    // "approved" has no arrow and there is no "otherwise": the operation ends; a result it does not know: the user decides.
    deliver('s1-2', 'review.md', 'Acho que ficou bom.');
    const decision = opsPage.getByRole('group', { name: 'Sua decisão' });
    await expect(decision).toContainText('reviewer não informou como terminou.');
    await decision.getByRole('button', { name: 'Seguir para fixer (como "rejected")' }).click();
    await expect(runView.locator('.ops-timeline-title strong')).toHaveText(['reviewer', 'fixer', 'reviewer', 'fixer']);
    deliver('s2-2', 'fixed.md', 'De novo.');
    deliver('s1-3', 'review.md', 'outcome: approved');
    await expect(runView.locator('.ops-run-head .pill')).toHaveText('Concluída');
    await expect(runView.locator('.pill-outcome')).toHaveText(['rejected', 'approved']);

    // In the editor, the reviewer's card has a dot per result (and "otherwise"); the arrow shows its result; the loop curves back.
    await opsPage.getByRole('button', { name: 'Configurações', exact: true }).click();
    await opsPage.getByRole('tab', { name: 'Operações' }).click();
    await opsPage.locator('.library-item', { hasText: 'Revisa até aprovar' }).click();
    await expect(opsPage.locator('[data-step="s1"] .ops-dot-label')).toHaveText(['approved', 'rejected', 'senão']);
    await expect(opsPage.getByRole('button', { name: 'Seta de reviewer para fixer, quando rejected' })).toContainText('rejected');
    await expect(opsPage.locator('.ops-card-start')).toHaveText('Início');
  });
});

// A terminal keeps running when you leave its project, and its tab comes back, with what it printed, when the project opens again.
test.describe.serial('Moki terminals outlive the project screen', () => {
  let termApp: ElectronApplication;
  let termPage: Page;
  const dirs: string[] = [];

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    ({ app: termApp, page: termPage } = await openApp(root, userData, 'acme'));
  });

  test.afterAll(async () => {
    await termApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('leaving the project does not close its terminal; opening it again brings the tab back', async () => {
    await termPage.getByTitle('Num terminal novo').first().click();
    await termPage.getByRole('menuitem', { name: 'Terminal' }).click(); // the category, then its option
    await termPage.getByRole('menuitem', { name: /seu shell/ }).click();
    const pane = termPage.locator('.term-pane:not([hidden])');
    await expect(pane).toBeVisible();
    await pane.click();
    await termPage.keyboard.type('echo moki-segue-rodando');
    await termPage.keyboard.press('Enter');
    await expect(pane.locator('.xterm-rows')).toContainText('moki-segue-rodando');

    // Leaving asks nothing (a confirm would be dismissed and keep us here).
    await termPage.getByTitle('Todos os projetos').click();
    await expect(termPage.locator('.home-project', { hasText: 'Acme Library' }).first()).toBeVisible();
    await termPage.locator('.home-project', { hasText: 'Acme Library' }).first().click();
    await expect(termPage.locator('.term-pane:not([hidden]) .xterm-rows')).toContainText('moki-segue-rodando');

    // Closing its tab is what stops it.
    await termPage.locator('.tab-close[title="Fechar o terminal"]').first().click();
    await termPage.getByRole('alertdialog').getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(termPage.locator('.term-pane')).toHaveCount(0);
  });

  test('the + of the tabs opens categories in place; File creates an empty spreadsheet in Inbox and shows it', async () => {
    await termPage.getByTitle('Novo: terminal, IA ou arquivo').click();
    const menu = termPage.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText(['Terminal', 'IA', 'Arquivo', 'Apps ArtCraft']);
    await menu.getByRole('menuitem', { name: 'Arquivo' }).click();
    await expect(menu.getByRole('menuitem')).toHaveText(['Voltar', 'Nota (.md)', 'Texto (.txt)', 'Planilha (.xlsx)', 'Documento Word (.docx)']);
    await termPage.keyboard.press('Escape'); // back to the categories
    await expect(menu.getByRole('menuitem').first()).toHaveText('Terminal');
    await menu.getByRole('menuitem', { name: 'Arquivo' }).click();
    await menu.getByRole('menuitem', { name: 'Planilha (.xlsx)' }).click();

    const dialog = termPage.getByRole('dialog', { name: 'Nova planilha' });
    await expect(dialog.getByLabel('Pasta')).toHaveValue('inbox');
    await dialog.getByLabel('Nome').fill('casos');
    await expect(dialog).toContainText('Será salvo como casos.xlsx.');
    await dialog.getByRole('button', { name: 'Criar' }).click();
    await expect(dialog).toBeHidden();
    const file = join(dirs[0], 'workspace', 'projects', 'acme', 'inbox', 'casos.xlsx');
    expect(existsSync(file)).toBe(true);
    await expect(termPage.locator('.tree-row[title="inbox/casos.xlsx"]')).toBeVisible();
  });

  // The download itself needs GitHub (main-process fetch is not faked here); the unit tests cover it.
  test('the + menu offers the ArtCraft apps: 16 apps, launcher first, and a Download button for each', async () => {
    await termPage.getByTitle('Num terminal novo').first().click();
    await termPage.getByRole('menuitem', { name: 'Apps ArtCraft' }).click();
    await termPage.getByRole('menuitem', { name: /Baixar apps ArtCraft/ }).click();
    const dialog = termPage.getByRole('dialog', { name: 'Baixar apps ArtCraft' });
    await expect(dialog.locator('.skill-row')).toHaveCount(16);
    await expect(dialog.locator('.skill-row').first()).toContainText('ArtCraft Launcher');
    await expect(dialog.locator('.skill-row').first()).toContainText('Recomendado');
    await expect(dialog.getByRole('button', { name: 'Baixar' })).toHaveCount(16);
    await termPage.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });
});

// MCP servers: where each one applies is set right in the list (Global switch, project picker, chips).
test.describe.serial('Moki MCP servers list', () => {
  let mcpApp: ElectronApplication;
  let mcpPage: Page;
  const dirs: string[] = [];
  let catalog = '';

  test.beforeAll(async () => {
    const root = fixture();
    addProject(root, 'beta', 'Beta Store');
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    catalog = join(root, 'workspace', 'mcp-servers.json');
    writeFileSync(catalog, JSON.stringify({ servers: [{ id: 'playwright', name: 'Playwright', transport: 'stdio', command: 'npx', args: ['@playwright/mcp@latest'], access: 'read', enabled: true, projects: [] }] }));
    ({ app: mcpApp, page: mcpPage } = await openApp(root, userData, 'acme'));
  });

  test.afterAll(async () => {
    await mcpApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('a server is made global or given to chosen projects from its row', async () => {
    const saved = () => (JSON.parse(readFileSync(catalog, 'utf8')) as { servers: { projects: string[] }[] }).servers[0].projects;
    await mcpPage.getByRole('button', { name: 'Configurações', exact: true }).click();
    await mcpPage.getByRole('tab', { name: 'Servidores MCP' }).click();
    await expect(mcpPage.getByText('Usar nas IAs')).toHaveCount(0);
    const global = mcpPage.getByRole('switch', { name: 'Global: Playwright em todos os projetos' });
    const pick = mcpPage.getByRole('button', { name: 'Escolher os projetos de Playwright' });
    await expect(global).toHaveAttribute('aria-checked', 'true');
    await expect(pick).toBeDisabled();

    // Global off: the picker opens; the server stays global until a project is chosen.
    await global.click();
    const picker = mcpPage.getByRole('dialog', { name: 'Projetos de Playwright' });
    await expect(picker).toBeVisible();
    expect(saved()).toEqual([]);
    await picker.getByRole('checkbox', { name: 'Acme Library' }).check();
    await expect.poll(saved).toEqual(['acme']);
    await expect(picker.getByRole('checkbox', { name: 'Acme Library' })).toBeDisabled(); // the last one stays
    await picker.getByRole('checkbox', { name: 'Beta Store' }).check();
    await expect.poll(saved).toEqual(['acme', 'beta']);
    await mcpPage.keyboard.press('Escape');
    await expect(picker).toHaveCount(0);

    // The projects show as chips under the row; one can be removed there.
    const chips = mcpPage.getByRole('list', { name: 'Projetos de Playwright' });
    await expect(chips.locator('.mcp-chip')).toHaveText(['Acme Library', 'Beta Store']);
    await chips.getByRole('button', { name: 'Tirar Beta Store de Playwright' }).click();
    await expect.poll(saved).toEqual(['acme']);
    await expect(chips.locator('.mcp-chip')).toHaveText(['Acme Library']);

    // Global on again: every project, no chips.
    await global.click();
    await expect.poll(saved).toEqual([]);
    await expect(global).toHaveAttribute('aria-checked', 'true');
    await expect(mcpPage.locator('.mcp-chip')).toHaveCount(0);
  });

  test('an HTTP server takes an optional OAuth client (id and callback port) under Headers, saved without any secret', async () => {
    const saved = () => (JSON.parse(readFileSync(catalog, 'utf8')) as { servers: { name: string; oauth?: unknown }[] }).servers.find((x) => x.name === 'Azure DevOps')?.oauth;
    await mcpPage.getByRole('button', { name: 'Adicionar servidor', exact: true }).click();
    await mcpPage.getByRole('textbox', { name: 'Nome do servidor', exact: true }).fill('Azure DevOps');
    await mcpPage.getByRole('button', { name: 'HTTP', exact: true }).click();
    await mcpPage.getByRole('textbox', { name: 'URL', exact: true }).fill('https://mcp.dev.azure.com/acme');
    await mcpPage.getByRole('tab', { name: 'Cabeçalhos' }).click();
    await expect(mcpPage.getByText('Login OAuth (opcional)')).toBeVisible();
    await mcpPage.getByRole('textbox', { name: 'Client id' }).fill('0f1e2d3c-aaaa-bbbb-cccc-1234567890ab');
    await mcpPage.getByRole('textbox', { name: 'Porta de callback' }).fill('3118');
    for (const mode of ['light', 'dark']) {
      await mcpPage.evaluate((m) => document.documentElement.setAttribute('data-theme', m), mode);
      await mcpPage.locator('.mcp-form').screenshot({ path: test.info().outputPath(`mcp-oauth-${mode}.png`) });
    }
    await mcpPage.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect.poll(saved).toEqual({ clientId: '0f1e2d3c-aaaa-bbbb-cccc-1234567890ab', callbackPort: 3118 });
    // stdio servers have no OAuth fields.
    await mcpPage.getByRole('tab', { name: 'Configuração' }).click();
    await mcpPage.getByRole('button', { name: 'stdio', exact: true }).click();
    await mcpPage.getByRole('tab', { name: 'Ambiente' }).click();
    await expect(mcpPage.getByText('Login OAuth (opcional)')).toHaveCount(0);
  });
});

// A small PDF with one line of text per page, its xref offsets computed (pdf.js reads it as is).
function smallPdf(lines: string[]): Buffer {
  const objs: string[] = [];
  const pageIds = lines.map((_, i) => 3 + i * 2);
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${lines.length} >>`);
  const font = 3 + lines.length * 2;
  lines.forEach((line, i) => {
    const stream = `BT /F1 18 Tf 72 700 Td (${line}) Tj ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`);
    objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

// Drags the mouse over `words` inside `block` (the reading view or the editor), as a person selects them.
async function selectWords(page: Page, block: Locator, words: string): Promise<void> {
  const box = await block.evaluate((el, w) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
      const at = n.data.indexOf(w);
      if (at < 0) continue;
      const range = document.createRange();
      range.setStart(n, at); range.setEnd(n, at + w.length);
      const r = range.getBoundingClientRect();
      return { x: r.left, y: r.top + r.height / 2, width: r.width };
    }
    return null;
  }, words);
  if (!box) throw new Error(`"${words}" is not in the block`);
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.mouse.move(box.x + 1, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 1, box.y, { steps: 6 });
  await page.mouse.up();
}

const REVIEW_MD = '# Revisão\n\nA senha expira em 30 dias.\n';
const IRREGULAR_MD = '# Revisão\n\n## Pendências\n- Primeira <!--c:a1-->regra<!--/c:a1-->\n- Segunda regra\n\n<!-- moki-comments\n[{"id":"a1","author":"Ana","at":"2026-01-01","text":"Verificar","replies":[],"color":"blue"}]\n-->\n';

test.describe.serial('Moki PDF comments', () => {
  let pdfApp: ElectronApplication;
  let pdfPage: Page;
  const dirs: string[] = [];

  test.beforeAll(async () => {
    const root = fixture();
    writeFileSync(join(root, 'workspace', 'projects', 'acme', 'relatorio.pdf'), smallPdf(['Requisito de login', 'Segunda pagina']));
    writeFileSync(join(root, 'workspace', 'projects', 'acme', 'revisao.md'), REVIEW_MD);
    writeFileSync(join(root, 'workspace', 'projects', 'acme', 'visual.md'), '# Título\r\n\r\n**Como cliente** quero comprar.\r\n\r\n## Regras\r\n\r\n- Primeira regra\r\n- Segunda regra\r\n');
    writeFileSync(join(root, 'workspace', 'projects', 'acme', 'irregular.md'), IRREGULAR_MD);
    writeFileSync(join(root, 'workspace', 'projects', 'acme', 'irregular-windows.md'), '# Título\r\n## Regras\r\n- Primeira regra\r\n- Segunda regra\r\n');
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    ({ app: pdfApp, page: pdfPage } = await openApp(root, userData, 'acme'));
  });

  test.afterAll(async () => {
    await pdfApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('every PDF toolbar control has the same height', async () => {
    if (!await pdfPage.locator('.tree-row[title="relatorio.pdf"]').isVisible()) await pdfPage.locator('.tree-row[title=".other"]').click();
    await pdfPage.locator('.tree-row[title="relatorio.pdf"]').click();
    const bar = pdfPage.getByRole('toolbar', { name: 'Ferramentas do PDF' });
    await expect(bar.getByRole('searchbox', { name: 'Buscar no PDF' })).toBeVisible();
    const heights = () => bar.locator('button:visible, input[type="search"]:visible, summary:visible').evaluateAll((els) => els.map((el) => ({ label: el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent, height: el.getBoundingClientRect().height })));
    for (const item of await heights()) expect(item.height, String(item.label)).toBe(28);
    await bar.getByRole('button', { name: 'Editar PDF' }).click();
    await expect(bar.locator('summary')).toBeVisible();
    for (const item of await heights()) expect(item.height, String(item.label)).toBe(28);
    await bar.getByRole('button', { name: 'Destacar e comentar' }).click();
  });

  test('a selection is commented right on the page; the comment stays beside it, joined by a line', async () => {
    // Files loose in the project root are grouped in the sidebar; the group may already be open from the first test.
    if (!await pdfPage.locator('.tree-row[title="relatorio.pdf"]').isVisible()) await pdfPage.locator('.tree-row[title=".other"]').click();
    await pdfPage.locator('.tree-row[title="relatorio.pdf"]').click();
    const span = pdfPage.locator('.pdf-page .textLayer span', { hasText: 'Requisito' }).first();
    await expect(span).toBeVisible();
    await pdfPage.evaluate(() => {
      const el = [...document.querySelectorAll('.pdf-page .textLayer span')].find((s) => s.textContent?.includes('Requisito'));
      if (!el) return;
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel?.removeAllRanges(); sel?.addRange(range);
      document.querySelector('.pdf-pages')?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });
    const box = pdfPage.getByRole('dialog', { name: 'Destacar e comentar' });
    await expect(box).toBeVisible();
    await box.getByRole('radio', { name: 'Verde' }).click();
    await box.getByRole('textbox').fill('Falta o caso de senha expirada');
    await box.getByRole('button', { name: 'Comentar' }).click();
    await expect(box).toHaveCount(0);

    const card = pdfPage.locator('.pdf-card', { hasText: 'Falta o caso de senha expirada' });
    await expect(card).toBeVisible();
    await expect(pdfPage.locator('.pdf-links path')).toHaveCount(1);
    // The card sits at the height of the commented line, beside the page.
    const spanBox = await span.boundingBox();
    await expect.poll(async () => Math.abs(((await card.boundingBox())?.y ?? 0) + 18 - ((spanBox?.y ?? 0) + (spanBox?.height ?? 0) / 2))).toBeLessThan(30);
    expect(((await card.boundingBox())?.x ?? 0)).toBeGreaterThan((spanBox?.x ?? 0) + (spanBox?.width ?? 0));

    await card.getByRole('button', { name: 'Responder' }).click();
    const thread = pdfPage.locator('.pdf-card').first();
    await thread.getByRole('textbox').fill('Vou incluir');
    await thread.getByRole('button', { name: 'Salvar' }).click();
    await expect(thread).toContainText('Vou incluir');

    // The column closes from the bar: the page grows and a mark on its edge shows the comment; the mark opens it again.
    const pageWidth = async () => (await pdfPage.locator('.pdf-page').first().boundingBox())?.width ?? 0;
    const withRail = await pageWidth();
    await pdfPage.getByRole('button', { name: /^Comentários \(/ }).click();
    await expect(pdfPage.locator('.pdf-card')).toHaveCount(0);
    await expect.poll(pageWidth).toBeGreaterThan(withRail);
    const marker = pdfPage.locator('.pdf-marker');
    await expect(marker).toHaveCount(1);
    await marker.click();
    await expect(pdfPage.locator('.pdf-card')).toHaveCount(1);

    // The search field finds the text in every page, selects the match (the box opens there) and highlights all of them.
    const field = pdfPage.getByRole('searchbox', { name: 'Buscar no PDF' });
    await field.fill('pagina');
    await field.press('Enter');
    await expect(pdfPage.locator('.pdf-find-count')).toHaveText('1 de 1');
    await expect(pdfPage.getByRole('dialog', { name: 'Destacar e comentar' })).toBeVisible();
    await pdfPage.getByRole('button', { name: 'Destacar todas' }).click();
    await expect(pdfPage.locator('.pdf-card')).toHaveCount(2);
    await expect(pdfPage.locator('.pdf-card').nth(1)).toContainText('página 2');
    // The comments took the project panel's place; opening the panel closes them, and a button brings them back.
    await expect(pdfPage.locator('.workspace.panel-rail')).toHaveCount(1);
  });

  test('notes can be inserted between PDF pages, edited and restored', async () => {
    const bar = pdfPage.locator('.doc-bar');
    await expect(pdfPage.locator('.file-tags-bar')).toHaveCount(0);
    await bar.getByRole('button', { name: 'Mostrar detalhes do arquivo' }).click();
    await expect(pdfPage.locator('.file-tags-bar')).toBeVisible();
    await bar.getByRole('button', { name: 'Recolher detalhes do arquivo' }).click();
    await pdfPage.getByRole('button', { name: 'Editar PDF' }).click();
    const first = pdfPage.locator('.pdf-page-wrap').first();
    await first.getByRole('button', { name: 'Adicionar nota aqui' }).click();
    const card = first.locator('.pdf-inline-note');
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Alterar cor da borda da nota' }).click();
    const palette = card.getByRole('radiogroup', { name: 'Cor da borda da nota' });
    await expect(palette.getByRole('radio')).toHaveCount(7);
    await palette.getByRole('radio', { name: 'Verde' }).click();
    await expect(card).toHaveCSS('border-left-color', 'rgb(70, 196, 106)');
    await expect.poll(() => JSON.parse(readFileSync(join(dirs[0], 'workspace', 'projects', 'acme', '.moki-pdf-notes.json'), 'utf8'))[0]?.notes[0]?.color).toBe('green');
    const title = card.getByRole('textbox', { name: 'Título da nota' });
    await title.fill('Minha nota revisada');
    await title.press('Enter');
    await expect.poll(() => JSON.parse(readFileSync(join(dirs[0], 'workspace', 'projects', 'acme', '.moki-note-titles.json'), 'utf8'))[0]?.title).toBe('Minha nota revisada');
    await expect(card.getByRole('toolbar', { name: 'Formatação' })).toBeHidden();
    await card.getByRole('button', { name: 'Mostrar ferramentas da nota' }).click();
    await expect(card.getByRole('toolbar', { name: 'Formatação' })).toBeVisible();
    await card.getByRole('button', { name: 'Código Markdown' }).click(); // the source is in the tools; the note opens formatted
    await card.getByRole('button', { name: 'Recolher ferramentas da nota' }).click();
    const noteEditor = card.locator('textarea.note-editor');
    await noteEditor.fill(`Uma anotação entre páginas${'\n'.repeat(8)}`);
    await noteEditor.press('End');
    await noteEditor.press('/');
    const commands = pdfPage.getByRole('listbox', { name: 'Comandos' });
    await expect(commands).toBeVisible();
    const menuBox = await commands.boundingBox();
    const viewport = await pdfPage.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    if (!menuBox || !viewport) throw new Error('The commands menu is not visible');
    expect(menuBox.y).toBeGreaterThanOrEqual(0);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
    expect(await commands.evaluate((el) => { const r = el.getBoundingClientRect(); const at = document.elementFromPoint(r.left + 20, r.bottom - 10); return !!at && el.contains(at); })).toBe(true);
    for (let i = 0; i < 10; i++) await noteEditor.press('ArrowDown');
    await expect.poll(() => commands.evaluate((el) => { const selected = el.querySelector('[aria-selected="true"]')?.getBoundingClientRect(); const box = el.getBoundingClientRect(); return !!selected && selected.top >= box.top && selected.bottom <= box.bottom; })).toBe(true);
    await commands.getByRole('option', { name: 'Checklist' }).click();
    await expect(noteEditor).toHaveValue(/- \[ \]/);
    await expect.poll(() => readFileSync(join(dirs[0], 'workspace', 'projects', 'acme', 'notes', 'nova-nota.md'), 'utf8')).toContain('Uma anotação entre páginas');
    await card.scrollIntoViewIfNeeded();
    const initial = await card.boundingBox();
    if (!initial) throw new Error('Note card is not visible');
    await pdfPage.mouse.move(initial.x + initial.width - 6, initial.y + initial.height - 6);
    await pdfPage.mouse.down();
    await pdfPage.mouse.move(initial.x + initial.width - 6, initial.y + initial.height + 64, { steps: 5 });
    await pdfPage.mouse.up();
    await expect.poll(async () => (await card.boundingBox())?.height ?? 0).toBeGreaterThan(initial.height + 30);
    await expect.poll(() => JSON.parse(readFileSync(join(dirs[0], 'workspace', 'projects', 'acme', '.moki-pdf-notes.json'), 'utf8'))[0]?.notes[0]?.height).toBeGreaterThan(initial.height + 30);
    await card.scrollIntoViewIfNeeded();
    const enlarged = await card.boundingBox();
    if (!enlarged) throw new Error('Note card is not visible');
    await pdfPage.mouse.move(enlarged.x + enlarged.width - 6, enlarged.y + enlarged.height - 6);
    await pdfPage.mouse.down();
    await pdfPage.mouse.move(enlarged.x + enlarged.width - 6, enlarged.y + enlarged.height - 66, { steps: 5 });
    await pdfPage.mouse.up();
    await expect.poll(async () => (await card.boundingBox())?.height ?? 0).toBeLessThan(enlarged.height - 30);
    await expect.poll(() => JSON.parse(readFileSync(join(dirs[0], 'workspace', 'projects', 'acme', '.moki-pdf-notes.json'), 'utf8'))[0]?.notes[0]?.height).toBeLessThan(enlarged.height - 30);
    await pdfPage.locator('.tree-row[title="revisao.md"]').click();
    await pdfPage.locator('.tree-row[title="relatorio.pdf"]').click();
    await expect(pdfPage.locator('.pdf-page-wrap').first().locator('.pdf-inline-note .tiptap-body')).toContainText('Uma anotação entre páginas'); // comes back formatted
    await expect(pdfPage.locator('.pdf-page-wrap').first().locator('.pdf-inline-note')).toHaveCSS('border-left-color', 'rgb(70, 196, 106)');
    await expect(pdfPage.locator('.pdf-page-wrap').first().getByRole('textbox', { name: 'Título da nota' })).toHaveValue('Minha nota revisada');
    const storedHeight = JSON.parse(readFileSync(join(dirs[0], 'workspace', 'projects', 'acme', '.moki-pdf-notes.json'), 'utf8'))[0]?.notes[0]?.height as number;
    await expect.poll(async () => Math.abs(((await pdfPage.locator('.pdf-page-wrap').first().locator('.pdf-inline-note').boundingBox())?.height ?? 0) - storedHeight)).toBeLessThan(2);
    await pdfPage.locator('.tree-row[title="notes"]').click();
    const source = pdfPage.locator('.tree-row[title="notes/nova-nota.md"]');
    await expect(source).toContainText('Minha nota revisada');
    const transfer = await pdfPage.evaluateHandle(() => new DataTransfer());
    await source.dispatchEvent('dragstart', { dataTransfer: transfer });
    await pdfPage.locator('.pdf-doc').dispatchEvent('dragenter', { dataTransfer: transfer });
    const destination = pdfPage.locator('.pdf-page-wrap').nth(1).locator('.pdf-note-drop');
    await destination.dispatchEvent('dragover', { dataTransfer: transfer });
    await destination.dispatchEvent('drop', { dataTransfer: transfer });
    await expect(pdfPage.locator('.pdf-page-wrap').nth(1).locator('.pdf-inline-note .tiptap-body')).toContainText('Uma anotação entre páginas');
  });

  test('a .md file opens in its editor and is commented there; the comment is kept inside the file, invisible to other viewers', async () => {
    const file = join(dirs[0], 'workspace', 'projects', 'acme', 'revisao.md');
    if (!await pdfPage.locator('.tree-row[title="revisao.md"]').isVisible()) await pdfPage.locator('.tree-row[title=".other"]').click();
    await pdfPage.locator('.tree-row[title="revisao.md"]').click();
    const visual = pdfPage.locator('.commented-editor .tiptap-body');
    await expect(visual).toHaveAttribute('contenteditable', 'true');
    // One view: no switch between reading and editing.
    await expect(pdfPage.getByRole('button', { name: 'Modo de leitura (Ctrl+E)' })).toHaveCount(0);
    await expect(pdfPage.getByRole('button', { name: 'Editar (Ctrl+E)' })).toHaveCount(0);
    await selectWords(pdfPage, visual.locator('p', { hasText: 'A senha expira' }), 'expira em 30 dias');
    const selection = pdfPage.getByRole('toolbar', { name: 'Seleção' });
    await expect(selection).toBeVisible();
    await expect(pdfPage.getByRole('dialog', { name: 'Comentário' })).toHaveCount(0);
    await selection.getByRole('button', { name: 'Comentar' }).click();
    const box = pdfPage.getByRole('dialog', { name: 'Comentário' });
    await box.getByRole('radiogroup', { name: 'Cor do comentário' }).getByRole('radio', { name: 'Verde' }).click();
    await box.getByRole('textbox').fill('E quando expira?');
    await box.getByRole('button', { name: 'Comentar' }).click();

    await expect(pdfPage.locator('.md-card')).toContainText('E quando expira?');
    const commentButton = pdfPage.locator('.doc-bar').getByRole('button', { name: 'Comentários (1)' });
    const sourceButton = pdfPage.locator('.doc-bar').getByRole('button', { name: 'Código Markdown' });
    await expect.poll(async () => Math.abs(((await commentButton.boundingBox())?.height ?? 0) - ((await sourceButton.boundingBox())?.height ?? 0))).toBeLessThan(10);
    await expect(pdfPage.locator('.md-card')).toHaveCSS('border-left-color', 'rgb(70, 196, 106)');
    await expect(visual.locator('span[data-md-comment]')).toHaveCSS('--md-comment-color', '#46c46a');
    await expect(visual.locator('span[data-md-comment]')).toHaveText('expira em 30 dias');
    await expect(pdfPage.locator('.md-links path')).toHaveCount(1);
    await expect.poll(() => readFileSync(file, 'utf8')).toMatch(/A senha <!--c:[a-z0-9]+-->expira em 30 dias<!--\/c:[a-z0-9]+-->\./);
    expect(readFileSync(file, 'utf8')).toContain('<!-- moki-comments');
    await pdfPage.locator('.md-card').getByRole('button', { name: 'Alterar cor do comentário' }).click();
    await pdfPage.locator('.md-card').getByRole('radio', { name: 'Azul' }).click();
    await expect.poll(() => readFileSync(file, 'utf8')).toContain('"color":"blue"');
    await expect(pdfPage.locator('.md-card')).toHaveCSS('border-left-color', 'rgb(74, 143, 240)');
    await pdfPage.locator('.tree-row[title="relatorio.pdf"]').click();
    await pdfPage.locator('.tree-row[title="revisao.md"]').click();
    await expect(pdfPage.locator('.md-card')).toHaveCSS('border-left-color', 'rgb(74, 143, 240)');

    // Typing saves on its own: no Save button, the bar says when.
    await visual.locator('p').filter({ hasText: 'A senha expira' }).evaluate((p) => {
      const node = p.firstChild as Text;
      const range = document.createRange();
      range.setStart(node, node.length); range.collapse(true);
      const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range);
      (p.closest('[contenteditable]') as HTMLElement).focus();
    });
    await pdfPage.keyboard.insertText('alterada ');
    await expect(pdfPage.locator('.doc-bar').getByRole('button', { name: 'Salvar' })).toHaveCount(0);
    await expect.poll(() => readFileSync(file, 'utf8')).toContain('A senha alterada <!--c:');
    await expect(pdfPage.locator('.doc-bar .doc-saved')).toContainText('Salvo às');
    await expect(visual.locator('span[data-md-comment]')).toHaveText('expira em 30 dias'); // still there after the save

    // The bar's comments button hides the column (a mark on the text's edge stays) and the mark brings it back.
    await commentButton.click();
    await expect(pdfPage.locator('.md-card')).toHaveCount(0);
    await expect(visual.locator('span[data-md-comment]')).toHaveText('expira em 30 dias');
    await pdfPage.locator('.md-marker').click();
    await expect(pdfPage.locator('.md-card')).toContainText('E quando expira?');

    await pdfPage.locator('.md-card').getByRole('button', { name: 'Excluir' }).click();
    await pdfPage.getByRole('alertdialog').getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(pdfPage.locator('.md-card')).toHaveCount(0);
    await expect.poll(() => readFileSync(file, 'utf8')).toBe(REVIEW_MD.replace('A senha ', 'A senha alterada '));
  });

  test('visual Markdown editing keeps headings, bold, lists and Windows line endings', async () => {
    const file = join(dirs[0], 'workspace', 'projects', 'acme', 'visual.md');
    if (!await pdfPage.locator('.tree-row[title="visual.md"]').isVisible()) await pdfPage.locator('.tree-row[title=".other"]').click();
    await pdfPage.locator('.tree-row[title="visual.md"]').click();
    const editor = pdfPage.locator('.tiptap-body');
    await expect(editor).toHaveAttribute('contenteditable', 'true');
    await expect(editor.locator('h1')).toHaveText('Título');
    await expect(editor.locator('strong')).toHaveText('Como cliente');
    await expect(editor.locator('li')).toHaveCount(2);
    await editor.locator('strong').evaluate((strong) => {
      (strong.closest('[contenteditable]') as HTMLElement).focus();
      const range = document.createRange(); range.selectNodeContents(strong); range.collapse(false);
      const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range);
    });
    await pdfPage.keyboard.insertText(' fiel');
    await expect(editor.locator('strong')).toHaveText('Como cliente fiel');
    await editor.locator('li').first().click();
    await pdfPage.keyboard.press('End');
    await pdfPage.keyboard.insertText(' revisada');
    await expect.poll(() => readFileSync(file, 'utf8')).toContain('- Primeira regra revisada\r\n- Segunda regra');
    expect(readFileSync(file, 'utf8')).toContain('**Como cliente fiel** quero comprar.\r\n');
    await editor.locator('p').first().click();
    await pdfPage.keyboard.press('End');
    await pdfPage.keyboard.press('Enter');
    await pdfPage.keyboard.insertText('Outra informação.');
    await expect.poll(() => readFileSync(file, 'utf8')).toContain('Outra informação.');
  });

  test('visual editing preserves original spacing and comments when a heading touches a list', async () => {
    const file = join(dirs[0], 'workspace', 'projects', 'acme', 'irregular.md');
    if (!await pdfPage.locator('.tree-row[title="irregular.md"]').isVisible()) await pdfPage.locator('.tree-row[title=".other"]').click();
    await pdfPage.locator('.tree-row[title="irregular.md"]').click();
    const editor = pdfPage.locator('.tiptap-body');
    await expect(editor).toHaveAttribute('contenteditable', 'true');
    await expect(editor.locator('h2')).toHaveText('Pendências');
    await expect(editor.locator('li')).toHaveCount(2);
    expect(readFileSync(file, 'utf8')).toBe(IRREGULAR_MD);
    await editor.locator('li').nth(1).click();
    await pdfPage.keyboard.press('End');
    await pdfPage.keyboard.insertText(' revisada');
    const expected = IRREGULAR_MD.replace('- Segunda regra', '- Segunda regra revisada');
    await expect.poll(() => readFileSync(file, 'utf8')).toBe(expected);
    await pdfPage.getByRole('button', { name: 'Código Markdown' }).click();
    await expect(pdfPage.locator('textarea.editor')).toHaveValue(expected);
    await pdfPage.locator('.doc-bar').getByRole('button', { name: 'Código Markdown' }).click(); // back to the editor
    await expect(editor).toHaveAttribute('contenteditable', 'true');
    await expect(editor.locator('span[data-md-comment]')).toHaveText('regra');
    await expect(editor.locator('span[data-md-comment]')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(pdfPage.locator('.md-card')).toContainText('Verificar'); // the comments sit beside the editor
  });

  test('visual editing preserves adjacent headings and list with Windows line endings', async () => {
    const file = join(dirs[0], 'workspace', 'projects', 'acme', 'irregular-windows.md');
    if (!await pdfPage.locator('.tree-row[title="irregular-windows.md"]').isVisible()) await pdfPage.locator('.tree-row[title=".other"]').click();
    await pdfPage.locator('.tree-row[title="irregular-windows.md"]').click();
    const editor = pdfPage.locator('.tiptap-body');
    await expect(editor).toHaveAttribute('contenteditable', 'true');
    await editor.locator('li').nth(1).click();
    await pdfPage.keyboard.press('End');
    await pdfPage.keyboard.insertText(' revisada');
    await expect.poll(() => readFileSync(file, 'utf8')).toBe('# Título\r\n## Regras\r\n- Primeira regra\r\n- Segunda regra revisada\r\n');
  });

  test('the native viewer has an icon and PDF properties stay visible and save', async () => {
    await pdfPage.locator('.tree-row[title="relatorio.pdf"]').click();
    const native = pdfPage.getByRole('button', { name: 'Visualizador nativo' });
    await expect(native).toHaveAttribute('title', 'Visualizador nativo');
    await expect(native.locator('svg')).toHaveCount(1);
    await native.click();
    await expect(native).toHaveAttribute('aria-pressed', 'true');
    await pdfPage.getByRole('button', { name: 'Páginas', exact: true }).click();
    await pdfPage.getByRole('button', { name: 'Editar PDF' }).click();
    const properties = pdfPage.locator('.pdf-drop');
    await properties.locator('summary').click();
    const panel = properties.locator('.pdf-drop-body');
    await expect(panel).toBeVisible();
    const box = await panel.boundingBox();
    const button = await properties.locator('summary').boundingBox();
    const toolbar = await pdfPage.locator('.pdf-bar').boundingBox();
    const viewport = await pdfPage.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
    if (!box || !button || !toolbar || !viewport) throw new Error('Properties panel is not visible');
    expect(Math.abs(box.x + box.width / 2 - (button.x + button.width / 2))).toBeLessThan(2);
    expect(Math.abs(button.x + button.width / 2 - (toolbar.x + toolbar.width / 2))).toBeLessThan(2);
    expect(box.y).toBeGreaterThanOrEqual(button.y + button.height);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(await panel.evaluate((el) => { const r = el.getBoundingClientRect(); const top = document.elementFromPoint(r.left + 10, r.top + 10); return !!top && el.contains(top); })).toBe(true);
    expect(await panel.evaluate((el) => Number.parseFloat(getComputedStyle(el).paddingTop))).toBeGreaterThan(0);
    await panel.getByLabel('Título', { exact: true }).fill('Documento revisado');
    await panel.getByLabel('Autor', { exact: true }).fill('Ana');
    await panel.getByRole('button', { name: 'Salvar' }).click();
    const edited = join(dirs[0], 'workspace', 'projects', 'acme', 'relatorio-edited.pdf');
    await expect.poll(() => existsSync(edited)).toBe(true);
    const pdf = await PDFDocument.load(readFileSync(edited));
    expect(pdf.getTitle()).toBe('Documento revisado');
    expect(pdf.getAuthor()).toBe('Ana');
  });
});

// Activities: ready-made requests, configured in Settings like agents and skills; favorites come first.
test.describe.serial('Moki activities', () => {
  let actApp: ElectronApplication;
  let actPage: Page;
  const dirs: string[] = [];
  let library = '';

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    library = join(root, 'workspace', 'library', 'activities');
    ({ app: actApp, page: actPage } = await openApp(root, userData, 'acme'));
  });

  test.afterAll(async () => {
    await actApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('a new activity is created in Settings, starred, and comes first when opening the AI tool', async () => {
    await actPage.getByRole('button', { name: 'Configurações', exact: true }).click();
    await actPage.getByRole('tab', { name: 'Atividades' }).click();
    await expect(actPage.locator('.activity-item .list-card-title').getByText('Desenhar testes', { exact: true })).toBeVisible(); // one that comes with Moki
    await actPage.getByRole('button', { name: 'Nova atividade' }).click();
    await actPage.getByRole('textbox', { name: 'Nome' }).fill('Checar smoke');
    await actPage.getByRole('combobox', { name: 'Ela usa', exact: true }).selectOption('skills');
    await actPage.getByRole('group', { name: 'Skills', exact: true }).getByRole('button', { name: 'test-design', exact: true }).click();
    await actPage.getByRole('textbox', { name: 'Pedido enviado à IA' }).fill('Use the test-design skill to list smoke checks for: {files}.');
    await actPage.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(actPage.getByRole('heading', { name: 'Checar smoke', level: 1 })).toBeVisible();
    await expect.poll(() => existsSync(join(library, 'checar-smoke.md'))).toBe(true);
    expect(readFileSync(join(library, 'checar-smoke.md'), 'utf8')).toContain('uses: skill:test-design');

    await actPage.getByRole('button', { name: 'Favorita: Checar smoke' }).click();
    await expect(actPage.getByRole('button', { name: 'Favorita: Checar smoke' })).toHaveAttribute('aria-pressed', 'true');
    await actPage.getByRole('button', { name: 'Voltar para Atividades' }).click();
    await actPage.getByRole('tab', { name: /^Favoritas/ }).click();
    await expect(actPage.locator('.activity-item .list-card-title')).toHaveText(['Checar smoke']);

    // In the project, the starred activity is the first one offered.
    await actPage.getByRole('button', { name: 'Configurações', exact: true }).click();
    await actPage.getByRole('button', { name: 'Abrir na sua ferramenta de IA' }).click();
    await expect(actPage.locator('.answer-list .answer').first()).toContainText('Checar smoke');
    await actPage.getByRole('button', { name: 'Fechar (Esc)' }).click();
  });

  test('text-only activities require a request and keep it through editing', async () => {
    await actPage.getByRole('button', { name: 'Configurações', exact: true }).click();
    await actPage.getByRole('tab', { name: 'Atividades', exact: true }).click();
    await actPage.getByRole('button', { name: 'Nova atividade' }).click();
    await actPage.getByRole('textbox', { name: 'Nome', exact: true }).fill('Resumir minhas notas');
    await expect(actPage.getByRole('combobox', { name: 'Ela usa', exact: true })).toHaveValue('prompt');
    await expect(actPage.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
    await actPage.getByRole('textbox', { name: 'Pedido enviado à IA' }).fill('Summarize my notes for {project}.');
    await actPage.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(actPage.getByRole('heading', { name: 'Resumir minhas notas', level: 1 })).toBeVisible();
    const file = join(library, 'resumir-minhas-notas.md');
    expect(readFileSync(file, 'utf8')).not.toContain('uses:');
    await actPage.getByRole('textbox', { name: 'Pedido enviado à IA' }).fill('Summarize the decisions for {project}.');
    await actPage.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect.poll(() => readFileSync(file, 'utf8')).toContain('Summarize the decisions');
    await actPage.getByRole('button', { name: 'Voltar para Atividades' }).click();
    await actPage.getByRole('tab', { name: /^Todos/ }).click();
    await expect(actPage.locator('.activity-item', { hasText: 'Resumir minhas notas' })).toContainText('Só texto');
  });

  test('multiple skills survive saving and reopening, and the prepared request includes them all', async () => {
    await actPage.getByRole('button', { name: 'Nova atividade' }).click();
    await actPage.getByRole('textbox', { name: 'Nome', exact: true }).fill('Revisar e desenhar');
    await actPage.getByRole('combobox', { name: 'Ela usa', exact: true }).selectOption('skills');
    const skills = actPage.getByRole('group', { name: 'Skills', exact: true });
    await expect(actPage.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
    for (const name of ['requirements-review', 'test-design']) await skills.getByRole('button', { name, exact: true }).click();
    await actPage.getByRole('textbox', { name: 'Pedido enviado à IA' }).fill('Focus on permissions.');
    await actPage.screenshot({ path: test.info().outputPath('multiple-skills.png') });
    await actPage.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(actPage.getByRole('heading', { name: 'Revisar e desenhar', level: 1 })).toBeVisible();
    expect(readFileSync(join(library, 'revisar-e-desenhar.md'), 'utf8')).toContain('uses: skill:requirements-review, skill:test-design');
    await actPage.getByRole('button', { name: 'Voltar para Atividades' }).click();
    await actPage.locator('.activity-item .list-card', { hasText: 'Revisar e desenhar' }).click();
    for (const name of ['requirements-review', 'test-design']) await expect(skills.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
    const request = await actPage.evaluate(async () => {
      if (!window.qa) throw new Error('Moki bridge is missing');
      const result = await window.qa.call('launch', { project: 'acme', activity: 'revisar-e-desenhar', tool: 'print', files: [], note: '', language: 'English' });
      if (!result.ok) throw new Error(result.error);
      return result.value as { prompt: string };
    });
    expect(request.prompt).toContain('procedure and approval gates: requirements-review, test-design. Focus on permissions.');
  });

  test('an agent can be created with instructions and no skills', async () => {
    await actPage.getByRole('tab', { name: 'Agentes', exact: true }).click();
    await actPage.getByRole('button', { name: 'Criar agente', exact: true }).click();
    await actPage.getByRole('textbox', { name: 'Nome', exact: true }).fill('Writing helper');
    await actPage.getByRole('combobox', { name: 'Descreva o agente' }).fill('Review my writing and explain unclear wording.');
    const create = actPage.locator('.form-actions').getByRole('button', { name: 'Criar agente', exact: true });
    await expect(create).toBeEnabled();
    await create.click();
    const file = join(dirs[0], 'workspace', 'projects', 'acme', 'agents', 'writing-helper.md');
    await expect.poll(() => existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('No skills are assigned. Follow the role and instructions above.');
  });
});

// A workspace with no project: Settings keeps every list in its layout; only what needs a project waits for one.
test.describe.serial('Moki settings without a project', () => {
  let emptyApp: ElectronApplication;
  let emptyPage: Page;
  const dirs: string[] = [];

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    ({ app: emptyApp, page: emptyPage } = await openApp(root, userData, null));
  });

  test.afterAll(async () => {
    await emptyApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('Skills lists the skills of Moki; without a project only the upload can add (for every project)', async () => {
    await emptyPage.getByRole('button', { name: 'Criar' }).click();
    await emptyPage.getByPlaceholder('ex.: Cliente X').fill('Vazio');
    await emptyPage.getByRole('button', { name: 'Criar workspace' }).click();
    await expect(emptyPage.getByText('Nenhum projeto ainda.')).toBeVisible();
    await emptyPage.getByRole('button', { name: 'Configurações', exact: true }).click();
    await emptyPage.getByRole('tab', { name: 'Skills' }).click();
    await expect(emptyPage.getByRole('heading', { name: 'Skills', level: 1 })).toBeVisible();
    await expect(emptyPage.locator('.list-card-title').getByText('test-design', { exact: true })).toBeVisible();
    await expect(emptyPage.getByRole('button', { name: 'Adicionar skill' })).toHaveCount(0);
    await emptyPage.getByRole('button', { name: 'Enviar skills ou uma pasta .claude' }).click();
    await expect(emptyPage.getByRole('button', { name: 'Escolher uma pasta' })).toBeEnabled();
    await expect(emptyPage.getByText('Instalar para')).toHaveCount(0); // no project: every project only
    await emptyPage.getByRole('button', { name: 'Voltar para Skills' }).click();
    await emptyPage.getByRole('tab', { name: 'Atividades' }).click();
    await expect(emptyPage.locator('.activity-item .list-card-title').getByText('Desenhar testes', { exact: true })).toBeVisible();
  });
});

// Favorites: a star on the cards of Agents, Operations, Templates and Skills; starred ones come first.
test.describe.serial('Moki favorites', () => {
  let favApp: ElectronApplication;
  let favPage: Page;
  const dirs: string[] = [];
  let favFile = '';

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    mkdirSync(join(root, 'workspace', 'library', 'operations'), { recursive: true });
    for (const [id, name] of [['alfa', 'Alfa'], ['beta', 'Beta']]) {
      writeFileSync(join(root, 'workspace', 'library', 'operations', `${id}.json`), JSON.stringify({
        schemaVersion: 1, id, name, description: '', lanes: [],
        steps: [{ id: 's1', agent: 'library:test-designer', x: 20, y: 60 }], links: [],
      }));
    }
    favFile = join(root, 'workspace', 'library', 'favorites.json');
    ({ app: favApp, page: favPage } = await openApp(root, userData, 'acme'));
  });

  test.afterAll(async () => {
    await favApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('agents, operations, templates and skills are starred from their cards and come first', async () => {
    const saved = () => { try { return JSON.parse(readFileSync(favFile, 'utf8')) as Record<string, string[]>; } catch { return {}; } };
    await favPage.getByRole('button', { name: 'Configurações', exact: true }).click();

    await favPage.getByRole('tab', { name: 'Agentes' }).click();
    await favPage.getByRole('button', { name: 'Favorita: test-designer' }).click();
    await expect(favPage.getByRole('button', { name: 'Favorita: test-designer' })).toHaveAttribute('aria-pressed', 'true');
    await expect(favPage.locator('.list-group').first().locator('.fav-item .list-card-title').first()).toHaveText('test-designer');

    await favPage.getByRole('tab', { name: 'Operações' }).click();
    await expect(favPage.locator('.fav-item .list-card-title')).toHaveText(['Alfa', 'Beta']);
    await favPage.getByRole('button', { name: 'Favorita: Beta' }).click();
    await expect(favPage.locator('.fav-item .list-card-title')).toHaveText(['Beta', 'Alfa']);

    await favPage.getByRole('tab', { name: 'Templates' }).click();
    await favPage.getByRole('button', { name: 'Favorita: Default' }).click();
    await expect(favPage.getByRole('button', { name: 'Favorita: Default' })).toHaveAttribute('aria-pressed', 'true');

    await favPage.getByRole('tab', { name: 'Skills' }).click();
    await favPage.getByRole('button', { name: 'Favorita: test-design' }).click();
    await expect(favPage.locator('.fav-item .list-card-title').first()).toHaveText('test-design');

    await expect.poll(() => saved().skills).toEqual(['test-design']);
    expect(saved()).toMatchObject({ agents: ['test-designer'], operations: ['beta'], templates: ['default'] });
  });
});

// Settings › My AIs: the default AI is chosen there; an activity starts in it and choosing another one there does not change it.
// AI tools are faked (QA_FAKE_TOOLS): every one looks installed and reports version 1.0.0 (fake).
test.describe.serial('Moki my AIs and the project panel', () => {
  let aiApp: ElectronApplication;
  let aiPage: Page;
  const dirs: string[] = [];

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    ({ app: aiApp, page: aiPage } = await openApp(root, userData, 'acme', { QA_FAKE_TOOLS: '1' }));
  });

  test.afterAll(async () => {
    await aiApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('the default AI is set in My AIs and an activity choosing another one keeps it', async () => {
    await aiPage.getByRole('button', { name: 'Configurações', exact: true }).click();
    await aiPage.getByRole('tab', { name: 'Minhas IAs' }).click();
    const gemini = aiPage.locator('.ai-card').filter({ hasText: 'Gemini CLI' });
    await expect(gemini).toContainText('1.0.0 (fake)');
    await expect(aiPage.locator('.ai-card.on')).toHaveCount(1);
    await expect(aiPage.locator('.ai-card').filter({ hasText: 'VS Code' })).toContainText('Extensão do Moki não instalada');
    await expect(aiPage.locator('.ai-card').filter({ hasText: 'Editor Cursor' }).getByText('Não verificado')).toBeVisible();
    // VS Code shows the extension as not installed, so its card offers installing it as its icon.
    await expect(aiPage.locator('.ai-card').filter({ hasText: 'VS Code' }).getByRole('button', { name: 'Instalar a extensão do Moki e abrir' })).toBeVisible();
    await gemini.getByRole('button', { name: 'Mais opções de Gemini CLI' }).click();
    await aiPage.getByRole('menuitem', { name: 'Tornar padrão' }).click();
    await expect(gemini).toHaveClass(/\bon\b/);
    await expect(gemini.getByText('Padrão', { exact: true })).toBeVisible();
    expect(await aiPage.evaluate(() => localStorage.getItem('qa-tool'))).toBe('gemini');
    // The default AI has nothing more to offer: no "…" that would open an empty menu.
    await expect(gemini.getByRole('button', { name: 'Mais opções de Gemini CLI' })).toHaveCount(0);

    await aiPage.keyboard.press('Escape');
    const where = aiPage.locator('.pp-field').filter({ has: aiPage.locator('.pp-field-label', { hasText: /^Onde$/ }) }).locator('.pp-pick');
    await expect(where).toContainText('Gemini CLI');
    await where.click();
    await aiPage.locator('.catalog-card').filter({ hasText: 'OpenAI Codex CLI' }).click();
    await expect(where).toContainText('OpenAI Codex CLI');
    expect(await aiPage.evaluate(() => localStorage.getItem('qa-tool'))).toBe('gemini');
  });

  test('one Call catalog lists activities, agents, skills and operations', async () => {
    const card = aiPage.getByRole('region', { name: 'Assistente de IA' });
    await expect(card.getByRole('tab')).toHaveCount(0);
    await card.getByRole('button', { name: 'Chamar…', exact: true }).click();
    const dialog = aiPage.getByRole('dialog');
    for (const name of ['Todos', 'Atividades', 'Agentes', 'Skills', 'Operações']) await expect(dialog.getByRole('tab', { name, exact: true })).toBeVisible();
    await dialog.getByRole('tab', { name: 'Agentes', exact: true }).click();
    await dialog.getByRole('searchbox').fill('requirements-analyst');
    await expect(dialog.locator('.invoke-row')).toHaveCount(1);
    await aiPage.screenshot({ path: test.info().outputPath('call-picker.png') });
    await dialog.locator('.invoke-row').click();
    await dialog.getByRole('button', { name: 'Continuar sem arquivos' }).click();
    await expect(dialog.locator('textarea')).toBeVisible();
    await aiPage.keyboard.press('Escape');
  });

  test('the Call catalog searches across kinds and reports an empty result', async () => {
    await aiPage.getByRole('region', { name: 'Assistente de IA' }).getByRole('button', { name: 'Chamar…', exact: true }).click();
    const dialog = aiPage.getByRole('dialog');
    const all = await dialog.locator('.invoke-row').count();
    expect(all).toBeGreaterThan(1);
    await dialog.getByRole('searchbox').fill('zzzz-nada');
    await expect(dialog.locator('.invoke-row')).toHaveCount(0);
    await expect(dialog.getByText('Nada corresponde a esta busca.')).toBeVisible();
    await dialog.getByRole('searchbox').fill('');
    await expect(dialog.locator('.invoke-row')).toHaveCount(all);
    await aiPage.keyboard.press('Escape');
  });

  test('the panel shows the project name and description; they are edited in the project settings', async () => {
    const panel = aiPage.locator('.pp');
    await expect(panel.getByRole('button', { name: 'Editar nome do projeto' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Adicionar uma descrição' })).toHaveCount(0); // no description: nothing shown
    await expect(panel.getByText('Plugins', { exact: true })).toHaveCount(0); // they are in the project settings
    await panel.getByRole('button', { name: 'Configurações do projeto' }).click();
    const settings = aiPage.getByRole('dialog', { name: /^Configurações de / });
    await settings.getByRole('textbox', { name: 'Nome' }).fill('Novo nome');
    await settings.getByRole('textbox', { name: 'Descrição' }).fill('Primeira linha\nDescrição completa do projeto.');
    // Editing settings opens no AI: the "ask the AI next" box is off outside the plan flows.
    await expect(settings.getByRole('checkbox', { name: /adapte o contexto/ })).not.toBeChecked();
    await settings.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(settings).toBeHidden();
    await expect(panel.getByRole('heading', { name: 'Novo nome' })).toBeVisible();
    await expect(panel.locator('.pp-desc')).toContainText('Primeira linha');
    await panel.getByRole('button', { name: 'Ver completa...' }).click();
    await expect(panel.getByRole('region', { name: 'Descrição' })).toContainText('Descrição completa do projeto.');
    await expect(aiPage.getByRole('dialog')).toHaveCount(0);
  });

  test('an activity request appears in executions and follows its registered run', async () => {
    const panel = aiPage.locator('.pp');
    await panel.getByRole('button', { name: 'Chamar…', exact: true }).click();
    const wizard = aiPage.getByRole('dialog');
    await wizard.getByRole('button', { name: /Só abrir o projeto/ }).click();
    await wizard.getByRole('button', { name: 'Continuar sem arquivos' }).click();
    const decide = wizard.getByRole('button', { name: /Deixar a skill decidir/ });
    if (await decide.count()) await decide.click();
    await wizard.getByRole('button', { name: 'Nada mais — continuar' }).click();
    await wizard.getByRole('button', { name: /^Num terminal novo/ }).click();
    await wizard.getByRole('button', { name: /OpenAI Codex CLI/ }).click();
    await wizard.getByRole('button', { name: 'Abrir no OpenAI Codex CLI' }).click();
    await wizard.getByRole('button', { name: 'Concluir', exact: true }).click();
    const side = aiPage.getByRole('region', { name: 'Execuções' });
    await expect(side.getByRole('tab', { name: 'Pedidos', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(side.getByText('Aguardando registro da execução')).toBeVisible();
    const token = await aiPage.evaluate(() => {
      const key = Object.keys(localStorage).find((item) => item.startsWith('qa-activity-launches:'))!;
      return (JSON.parse(localStorage.getItem(key)!) as { id: string }[])[0].id;
    });
    const run = `20260101-1200-project-context-moki-${token}`;
    const path = join(dirs[0], 'workspace', 'projects', 'acme', 'runs', run);
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, 'state.json'), JSON.stringify({ status: 'in-progress', skill: 'project-context' }));
    await expect(side.getByText('Aguardando registro da execução')).toHaveCount(0);
    await expect(side.getByText('Em andamento', { exact: true })).toBeVisible();
    writeFileSync(join(path, 'state.json'), JSON.stringify({ status: 'completed', skill: 'project-context' }));
    await side.getByRole('tab', { name: 'Concluídas' }).click();
    await expect(side.getByText('Concluída', { exact: true })).toBeVisible();
  });

  test('calling an activity retains required files, optional agent and destination choices', async () => {
    writeFileSync(join(dirs[0], 'workspace', 'projects', 'acme', 'inbox', 'us-1.md'), '# US-1');
    await aiPage.getByRole('region', { name: 'Assistente de IA' }).getByRole('button', { name: 'Chamar…', exact: true }).click();
    const wizard = aiPage.getByRole('dialog');
    await wizard.getByRole('tab', { name: 'Atividades', exact: true }).click();
    await wizard.getByRole('searchbox').fill('requirements-review');
    // Two activities use the skill (pasted stories, and an MF read from the tracker); this one requires files.
    await wizard.locator('.invoke-row', { hasText: 'Revisar histórias de usuário' }).click();
    await expect(wizard.getByRole('button', { name: 'Escolha um arquivo para continuar' })).toBeDisabled();
    await wizard.getByText('us-1.md').click();
    await wizard.getByRole('button', { name: 'Continuar', exact: true }).click();
    await wizard.getByRole('button', { name: /Deixar a skill decidir/ }).click();
    await wizard.getByRole('button', { name: 'Nada mais — continuar' }).click();
    await expect(wizard.getByRole('button', { name: /^Neste terminal/ })).toBeDisabled();
    await wizard.getByRole('button', { name: /^Num terminal novo/ }).click();
    await expect(wizard.locator('.answer-list')).toContainText('Claude Code');
    await aiPage.keyboard.press('Escape');
  });
});

test.describe('Moki run details panel', () => {
  test('the executions card shows all finished activity and operation runs in the right tabs', async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    const project = join(root, 'workspace', 'projects', 'acme');
    for (const kind of ['activity', 'operation']) {
      for (let i = 0; i < 8; i++) {
        const id = `20261105-120${i}-${kind}-example`;
        const run = join(project, 'runs', id);
        mkdirSync(run, { recursive: true });
        const status = i === 0 ? 'in-progress' : i === 1 ? 'cancelled' : 'completed';
        writeFileSync(join(run, 'state.json'), JSON.stringify({ id, status, currentStep: '', ...(kind === 'operation' ? { operation: { id: 'demo', name: `Operação ${i}` }, steps: [], visits: [] } : { skill: 'project-context' }) }));
      }
    }
    let window: ElectronApplication | undefined;
    try {
      const opened = await openApp(root, userData); window = opened.app;
      const page = opened.page;
      await expect(page.locator('.tree-row[title="runs"]')).toContainText('Arquivos de execuções');
      const card = page.getByRole('region', { name: 'Execuções' });
      await expect(card.getByRole('tab', { name: 'Operações', exact: true })).toHaveAttribute('aria-selected', 'true');
      await expect(card.getByText('Operação 0', { exact: true })).toBeVisible();
      await card.getByRole('tab', { name: 'Concluídas' }).click();
      await expect(card.locator('.ops-side-row')).toHaveCount(7);
      await expect(card.getByText('Operação 1', { exact: true })).toBeAttached();
      await card.getByRole('tab', { name: 'Pedidos', exact: true }).click();
      await expect(card.locator('.activity-launch-row')).toHaveCount(1);
      await card.getByRole('tab', { name: 'Concluídas' }).click();
      await expect(card.locator('.activity-launch-row')).toHaveCount(7);
      await expect(card.getByText('operation-example')).toHaveCount(0);
    } finally {
      await window?.close();
      rmSync(root, { recursive: true, force: true });
      rmSync(userData, { recursive: true, force: true });
    }
  });

  test('shows only the selected activity or operation and distinguishes repeated file names', async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    const project = join(root, 'workspace', 'projects', 'acme');
    const activity = '20261105-1200-project-context-review';
    const operation = '20261105-1201-operation-demo-review';
    for (const id of [activity, operation]) {
      const run = join(project, 'runs', id);
      mkdirSync(join(run, 'outputs', 's1'), { recursive: true });
      mkdirSync(join(run, 'outputs', 's2'), { recursive: true });
      writeFileSync(join(run, 'outputs', 's1', 'revisao.md'), '# Primeira');
      writeFileSync(join(run, 'outputs', 's2', 'revisao.md'), '# Segunda');
      // Not delivered: a screenshot and a copy in another format, left in outputs/ by the AI.
      writeFileSync(join(run, 'outputs', 's2', 'revisao.png'), 'png');
      writeFileSync(join(run, 'outputs', 'revisao.csv'), 'a,b');
      writeFileSync(join(run, 'state.json'), JSON.stringify({ id, status: 'in-progress', currentStep: 's2', completedSteps: ['s1'], approvals: [{ step: 's1', decision: 'approved' }], artifacts: [`workspace/projects/acme/runs/${id}/outputs/s1/revisao.md`, `workspace/projects/acme/runs/${id}/outputs/s2/revisao.md`], ...(id === operation ? { operation: { id: 'demo', name: 'Fluxo de teste' }, workflow: 'operation-demo' } : { skill: 'project-context' }) }));
    }
    let window: ElectronApplication | undefined;
    try {
      const opened = await openApp(root, userData); window = opened.app;
      const page = opened.page;
      await page.locator('.tree-row[title="runs"]').click();
      await page.locator(`.tree-row[title*="${activity}"]`).click(); // the tooltip names the run first, then its folder
      await page.locator(`.tree-row[title="runs/${activity}/state.json"]`).click();
      await expect(page.locator('.panel.run-detail')).toHaveCount(0);
      await expect(page.locator('.panel.pp')).toBeVisible();
      const card = page.getByRole('region', { name: 'Execuções' });
      await card.getByRole('tab', { name: 'Pedidos', exact: true }).click();
      await card.locator(`[title="${activity}"]`).click();
      const details = page.locator('main .ops-run');
      await expect(details).toHaveAttribute('aria-label', 'Atividade');
      await expect(details.getByText('Etapas concluídas')).toBeVisible();
      await expect(details.getByText('s2', { exact: true })).toBeVisible();
      await expect(details.getByRole('button', { name: 'Continuar na sua ferramenta de IA' })).toBeVisible();
      await expect(page.locator('.panel.pp')).toBeVisible();
      await expect(page.locator('.panel.run-detail')).toHaveCount(0);
      const files = details.locator('.run-detail-file');
      await expect(files).toHaveCount(2);
      await expect(files.nth(0)).toContainText('outputs/s1');
      await expect(files.nth(1)).toContainText('outputs/s2');
      // What is in outputs/ but not delivered is offered for the trash, one by one.
      const leftovers = details.getByRole('region', { name: 'Sobras' });
      await expect(leftovers.getByRole('heading')).toHaveText('Sobras (2)');
      await leftovers.getByRole('checkbox', { name: 'revisao.csv' }).uncheck();
      await leftovers.getByRole('button', { name: 'Mandar para a lixeira (1)' }).click();
      await expect(leftovers.getByRole('checkbox')).toHaveCount(1);
      expect(existsSync(join(project, 'runs', activity, 'outputs', 's2', 'revisao.png'))).toBe(false);
      expect(existsSync(join(project, 'runs', activity, 'outputs', 's2', 'revisao.md'))).toBe(true);
      await details.getByRole('button', { name: 'Fechar' }).click();
      await page.locator(`.tree-row[title*="${operation}"]`).click();
      await page.locator(`.tree-row[title="runs/${operation}/state.json"]`).click();
      const operationDetails = page.locator('.panel.run-detail');
      await expect(operationDetails).toHaveAttribute('aria-label', 'Operação');
      await expect(operationDetails.getByRole('heading', { name: 'Fluxo de teste' })).toBeVisible();
      await expect(operationDetails.getByRole('button', { name: 'Abrir operação' })).toBeVisible();
      await expect(operationDetails.getByRole('button', { name: 'Continuar na sua ferramenta de IA' })).toHaveCount(0);
      await expect(operationDetails.locator('.ops-side')).toHaveCount(0);
    } finally {
      await window?.close();
      rmSync(root, { recursive: true, force: true });
      rmSync(userData, { recursive: true, force: true });
    }
  });
});

test.describe.serial('Moki tree rename', () => {
  let renameApp: ElectronApplication;
  let rp: Page;
  let project = '';
  const dirs: string[] = [];
  const row = (path: string) => rp.locator(`.tree-row[title="${path}"]`);
  const expand = async (folder: string, child: string) => { if (!(await row(child).isVisible())) await row(folder).click(); await expect(row(child)).toBeVisible(); };

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    project = join(root, 'workspace', 'projects', 'acme');
    writeFileSync(join(project, 'inbox', 'rascunho.md'), '# rascunho');
    writeFileSync(join(project, 'inbox', 'outro.md'), 'outro');
    mkdirSync(join(project, 'notes'), { recursive: true });
    writeFileSync(join(project, 'notes', 'ideia.md'), '# ideia');
    ({ app: renameApp, page: rp } = await openApp(root, userData));
  });

  test.afterAll(async () => {
    await renameApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('Rename types the name over the row, keeps the extension, and the open tab follows with its text', async () => {
    await expand('inbox', 'inbox/rascunho.md');
    await row('inbox/rascunho.md').click();
    await rp.locator('.commented-editor .tiptap-body h1').click();
    await rp.keyboard.press('End');
    await rp.keyboard.type(' editado');

    const rowBox = await row('inbox/rascunho.md').boundingBox();
    const treeBox = await rp.locator('.sidebar-scroll .tree').boundingBox();
    await row('inbox/rascunho.md').click({ button: 'right' });
    await expect(rp.getByRole('menuitem', { name: /^Renomear/ })).toContainText('F2');
    await rp.getByRole('menuitem', { name: /^Renomear/ }).click();

    const field = rp.getByRole('textbox', { name: 'Novo nome de rascunho.md' });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('rascunho');
    expect(await field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, 8]); // the name, not the extension
    await expect(rp.locator('.rename-suffix')).toHaveText('.md');
    // Same row, same height: nothing in the tree moves while the name is typed.
    expect((await rp.locator('.tree-row.renaming').boundingBox())?.height).toBe(rowBox?.height);
    expect((await rp.locator('.sidebar-scroll .tree').boundingBox())?.height).toBe(treeBox?.height);

    await field.fill('cenarios de login');
    await field.press('Enter');
    await expect(field).toBeHidden();
    await expect(row('inbox/cenarios de login.md')).toBeFocused();
    expect(existsSync(join(project, 'inbox', 'rascunho.md'))).toBe(false);

    // The tab follows the file; what was typed (saved on its own, before or after the rename) is in the renamed file.
    const tab = rp.locator('.tab[title="inbox/cenarios de login.md"]');
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => readFileSync(join(project, 'inbox', 'cenarios de login.md'), 'utf8')).toBe('# rascunho editado');
    await expect(tab.locator('.tab-dirty')).toBeHidden();
    expect(existsSync(join(project, 'inbox', 'rascunho.md'))).toBe(false);
    await expect(rp.locator('.error-bar:not(.info-bar)')).toHaveCount(0);
    expect(existsSync(join(project, 'inbox', 'rascunho.md'))).toBe(false);
  });

  test('F2 starts renaming and Esc goes back; a refused name is explained under the row and the field stays open', async () => {
    await row('inbox/outro.md').focus();
    await rp.keyboard.press('F2');
    const field = rp.getByRole('textbox', { name: 'Novo nome de outro.md' });
    await expect(field).toBeFocused();
    await field.fill('qualquer');
    await field.press('Escape');
    await expect(field).toBeHidden();
    await expect(row('inbox/outro.md')).toBeFocused();
    expect(existsSync(join(project, 'inbox', 'outro.md'))).toBe(true);

    await rp.keyboard.press('F2');
    await field.fill('cenarios de login');
    await field.press('Enter');
    await expect(rp.getByRole('alert')).toHaveText('Já existe um arquivo ou pasta com esse nome aqui.');
    await expect(field).toBeVisible();
    await expect(field).toHaveValue('cenarios de login');
    await expect(field).toHaveAttribute('aria-invalid', 'true');

    // A forbidden character is flagged as it is typed, and Enter does nothing.
    await field.fill('a/b');
    await expect(rp.getByRole('alert')).toContainText('Use um nome sem');
    await field.press('Enter');
    await expect(field).toBeVisible();
    await field.press('Escape');
    await expect(field).toBeHidden();
    expect(readFileSync(join(project, 'inbox', 'outro.md'), 'utf8')).toBe('outro');
  });

  test('a note is renamed by its title: its file, and the links to it, stay', async () => {
    await expand('notes', 'notes/ideia.md');
    await row('notes/ideia.md').click({ button: 'right' });
    await rp.getByRole('menuitem', { name: /^Renomear/ }).click();
    const field = rp.getByRole('textbox', { name: 'Novo nome de ideia' });
    await expect(field).toHaveValue('ideia');
    await expect(rp.locator('.rename-suffix')).toHaveCount(0);
    await field.fill('Ideia principal');
    await field.press('Enter');
    await expect(row('notes/ideia.md')).toContainText('Ideia principal');
    expect(existsSync(join(project, 'notes', 'ideia.md'))).toBe(true);
    expect(readFileSync(join(project, '.moki-note-titles.json'), 'utf8')).toContain('Ideia principal');
  });

  test('what keeps its name shows Rename disabled, with the reason under it; F2 there says why', async () => {
    mkdirSync(join(project, 'runs', 'op-demo', 'outputs'), { recursive: true });
    writeFileSync(join(project, 'runs', 'op-demo', 'outputs', 'revisao.md'), '# revisao');
    await rp.getByRole('button', { name: 'Atualizar' }).first().click();
    const cases: [string, string][] = [
      ['context', 'As pastas fixas do projeto mantêm o nome.'],
      ['runs', 'As pastas fixas do projeto mantêm o nome.'],
    ];
    for (const [path, why] of cases) {
      await row(path).click({ button: 'right' });
      const item = rp.getByRole('menuitem', { name: /^Renomear/ });
      await expect(item).toBeDisabled();
      await expect(rp.locator('.menu-why')).toHaveText(why);
      await rp.getByRole('menuitem', { name: 'Mostrar na pasta' }).press('Escape');
      await expect(rp.getByRole('menu')).toBeHidden();
    }
    // A file of an activity: its name is how the activity finds it.
    await expand('runs', 'runs/op-demo');
    await expand('runs/op-demo', 'runs/op-demo/outputs');
    await expand('runs/op-demo/outputs', 'runs/op-demo/outputs/revisao.md');
    await row('runs/op-demo/outputs/revisao.md').click({ button: 'right' });
    await expect(rp.getByRole('menuitem', { name: /^Renomear/ })).toBeDisabled();
    await expect(rp.locator('.menu-why')).toHaveText('A atividade usa esses nomes para continuar e conferir o que entregou.');
    await rp.getByRole('menuitem', { name: 'Mostrar na pasta' }).press('Escape');
    // F2 on a fixed folder: the reason, not silence.
    await row('context').focus();
    await rp.keyboard.press('F2');
    await expect(rp.getByRole('status').filter({ hasText: 'As pastas fixas do projeto mantêm o nome.' })).toBeVisible();
    await expect(rp.locator('.rename-box')).toHaveCount(0);
    expect(existsSync(join(project, 'runs', 'op-demo', 'outputs', 'revisao.md'))).toBe(true);
  });
});

test.describe.serial('Moki start screen rename', () => {
  let homeApp: ElectronApplication;
  let hp: Page;
  let project = '';
  const dirs: string[] = [];
  const LOOSE_ID = '11111111-1111-4111-8111-111111111111';
  const rowOf = (text: string) => hp.locator('.home-row', { hasText: text });

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    project = join(root, 'workspace', 'projects', 'acme');
    mkdirSync(join(project, 'notes'), { recursive: true });
    writeFileSync(join(project, 'notes', 'ideia.md'), '# ideia');
    ({ app: homeApp, page: hp } = await openApp(root, userData, null));
    await hp.getByRole('button', { name: /^Workspace/ }).click(); // the workspace picker comes first
    await expect(hp.locator('.home-project', { hasText: 'Acme Library' }).first()).toBeVisible();
    // A loose note and a recent project note, as the start screen keeps them on this computer.
    await hp.evaluate(({ id }) => {
      const now = Date.now();
      localStorage.setItem('qa-loose-notes', JSON.stringify([{ id, title: 'rascunho solto', text: 'texto', at: now - 1000 }]));
      localStorage.setItem('qa-recent-notes', JSON.stringify([{ project: 'acme', path: 'notes/ideia.md', title: 'ideia', at: now }]));
    }, { id: LOOSE_ID });
    const reloaded = hp.waitForEvent('load');
    await homeApp.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].webContents.reload(); });
    await reloaded;
    await hp.getByRole('button', { name: /^Workspace/ }).click();
    await expect(rowOf('rascunho solto')).toBeVisible();
  });

  test.afterAll(async () => {
    await homeApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('a loose note is renamed from its right-click menu, in place, without moving in the list', async () => {
    const before = await rowOf('rascunho solto').boundingBox();
    await rowOf('rascunho solto').click({ button: 'right' });
    await expect(hp.getByRole('menuitem', { name: /^Renomear/ })).toContainText('F2');
    await hp.getByRole('menuitem', { name: /^Renomear/ }).click();
    const field = hp.getByRole('textbox', { name: 'Novo nome de rascunho solto' });
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('rascunho solto');
    expect((await hp.locator('.home-row:has(.rename-box)').boundingBox())?.height).toBe(before?.height); // the row keeps its height
    await field.fill('plano de testes');
    await field.press('Enter');
    await expect(field).toBeHidden();
    await expect(hp.locator(`[data-rename-key="note:${LOOSE_ID}"]`)).toBeFocused();
    await expect(hp.locator(`[data-rename-key="note:${LOOSE_ID}"]`)).toContainText('plano de testes');
    const notes = await hp.locator('.home-block', { hasText: 'Notas avulsas' }).locator('.home-project-name').allTextContents();
    expect(notes).toEqual(['ideia', 'plano de testes']); // same order: renaming is not opening
    const stored = await hp.evaluate(() => JSON.parse(localStorage.getItem('qa-loose-notes') ?? '[]') as { title: string; text: string }[]);
    expect(stored[0]).toMatchObject({ title: 'plano de testes', text: 'texto' });
  });

  test('a project note is renamed by its title (F2), and its file stays', async () => {
    await rowOf('ideia').locator('.home-project').focus();
    await hp.keyboard.press('F2');
    const field = hp.getByRole('textbox', { name: 'Novo nome de ideia' });
    await expect(field).toBeFocused();
    await field.fill('qualquer coisa');
    await field.press('Escape');
    await expect(rowOf('ideia')).toBeVisible();
    await hp.keyboard.press('F2');
    await field.fill('Ideia principal');
    await field.press('Enter');
    await expect(rowOf('Ideia principal')).toBeVisible();
    expect(existsSync(join(project, 'notes', 'ideia.md'))).toBe(true);
    expect(readFileSync(join(project, '.moki-note-titles.json'), 'utf8')).toContain('Ideia principal');
  });

  test('a project gets a new name; its folder and id stay', async () => {
    await rowOf('Acme Library').first().click({ button: 'right' });
    await hp.getByRole('menuitem', { name: /^Renomear/ }).click();
    const field = hp.getByRole('textbox', { name: 'Novo nome de Acme Library' });
    await expect(field).toHaveValue('Acme Library');
    await field.fill('Loja Acme');
    await field.press('Enter');
    await expect(hp.locator('[data-rename-key="project:acme"]')).toContainText('Loja Acme');
    await expect(hp.locator('[data-rename-key="project:acme"]')).toBeFocused();
    expect(JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'))).toMatchObject({ project: 'acme', name: 'Loja Acme' });
  });
});

test.describe.serial('Moki Markdown selection', () => {
  let selApp: ElectronApplication;
  let sp: Page;
  const dirs: string[] = [];
  // Drags the mouse over the text, as a person selects it.
  const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await sp.mouse.move(from.x, from.y);
    await sp.mouse.down();
    await sp.mouse.move(to.x, to.y, { steps: 8 });
    await sp.mouse.up();
  };

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    // HTML the editor would drop: the file is shown in the reading view these tests are about.
    writeFileSync(join(root, 'workspace', 'projects', 'acme', 'inbox', 'doc.md'), '# Título do documento\n\nPrimeiro parágrafo com **negrito** no meio.\n\nSegundo parágrafo simples.\n\n<details><summary>Mais</summary>\n\nOculto.\n\n</details>\n');
    ({ app: selApp, page: sp } = await openApp(root, userData));
    if (!(await sp.locator('.tree-row[title="inbox/doc.md"]').isVisible())) await sp.locator('.tree-row[title="inbox"]').click();
    await sp.locator('.tree-row[title="inbox/doc.md"]').click();
    await expect(sp.locator('.md-commented .markdown h1')).toBeVisible();
  });

  test.afterAll(async () => {
    await selApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('selecting from the start moves nothing: the Comment button floats, disabled, with the reason', async () => {
    const h1 = sp.locator('.md-commented .markdown h1');
    const title = await h1.boundingBox();
    const para = await sp.locator('.md-commented .markdown p').first().boundingBox();
    await drag({ x: title!.x + 1, y: title!.y + title!.height / 2 }, { x: para!.x + 120, y: para!.y + para!.height / 2 });
    const bubble = sp.getByRole('toolbar', { name: 'Seleção' });
    await expect(bubble).toBeVisible();
    await expect(bubble.getByRole('button', { name: 'Comentar' })).toBeDisabled();
    await expect(bubble).toContainText('Selecione um trecho dentro de um mesmo parágrafo para comentar.');
    expect((await h1.boundingBox())!.y).toBe(title!.y); // the document did not move
    await expect(sp.getByRole('dialog', { name: 'Comentário' })).toHaveCount(0);
    await sp.keyboard.press('Escape');
    await expect(bubble).toBeHidden();
  });

  test('a selection inside one paragraph is still copied with Ctrl+C; the box opens only from the button', async () => {
    await sp.evaluate(() => window.getSelection()?.removeAllRanges()); // a drag that starts on selected text moves it instead of selecting
    const h1 = sp.locator('.md-commented .markdown h1');
    const title = await h1.boundingBox();
    await drag({ x: title!.x + 1, y: title!.y + title!.height / 2 }, { x: title!.x + 90, y: title!.y + title!.height / 2 });
    const bubble = sp.getByRole('toolbar', { name: 'Seleção' });
    await expect(bubble.getByRole('button', { name: 'Comentar' })).toBeEnabled();
    await expect(sp.getByRole('dialog', { name: 'Comentário' })).toHaveCount(0);
    const picked = await sp.evaluate(() => window.getSelection()?.toString() ?? '');
    expect(picked.length).toBeGreaterThan(2);
    await sp.keyboard.press('Control+c');
    await expect.poll(() => selApp.evaluate(({ clipboard }) => clipboard.readText())).toBe(picked);
    // The button keeps the selection and opens the comment box under it.
    await bubble.getByRole('button', { name: 'Comentar' }).click();
    const box = sp.getByRole('dialog', { name: 'Comentário' });
    await expect(box).toBeVisible();
    await expect(box.getByRole('textbox')).toBeFocused();
    await expect(bubble).toBeHidden();
    await box.getByRole('textbox').press('Escape');
    await expect(box).toBeHidden();
  });

  test('the button goes away when the selection does', async () => {
    await sp.evaluate(() => window.getSelection()?.removeAllRanges());
    const h1 = sp.locator('.md-commented .markdown h1');
    const title = await h1.boundingBox();
    await drag({ x: title!.x + 1, y: title!.y + title!.height / 2 }, { x: title!.x + 90, y: title!.y + title!.height / 2 });
    const bubble = sp.getByRole('toolbar', { name: 'Seleção' });
    await expect(bubble).toBeVisible();
    const para = await sp.locator('.md-commented .markdown p').last().boundingBox();
    await sp.mouse.click(para!.x + para!.width + 40, para!.y + para!.height + 60); // a click on the page, away from the text
    await expect(bubble).toBeHidden();
  });
});

test.describe.serial('Moki comments in the editor', () => {
  let edApp: ElectronApplication;
  let ep: Page;
  let file = '';
  const dirs: string[] = [];
  // Only the delete confirmation the test asks for may show up; any other dialog fails the test.
  const unexpected: string[] = [];
  const START = 'A senha <!--c:k1-->expira<!--/c:k1--> em 30 dias.';
  const SOURCE = `# Revisão\n\n${START}\n\nSegundo parágrafo com **negrito** aqui.\n\nTerceiro parágrafo.\n\n<!-- moki-comments\n[\n{"id":"k1","author":"ana","at":"2026-11-01T10:00:00.000Z","text":"Quantos dias?","replies":[]}\n]\n-->\n`;
  const body = () => ep.locator('.commented-editor .tiptap-body');
  // Drags the mouse over a stretch of a paragraph, as a person selects it.
  const dragOver = async (paragraph: string, fromX: number, toX: number, toParagraph = paragraph) => {
    const a = (await body().locator('p', { hasText: paragraph }).boundingBox())!;
    const b = (await body().locator('p', { hasText: toParagraph }).boundingBox())!;
    await ep.evaluate(() => window.getSelection()?.removeAllRanges());
    await ep.mouse.move(a.x + fromX, a.y + a.height / 2);
    await ep.mouse.down();
    await ep.mouse.move(b.x + toX, b.y + b.height / 2, { steps: 8 });
    await ep.mouse.up();
  };

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    file = join(root, 'workspace', 'projects', 'acme', 'inbox', 'revisao-editor.md');
    writeFileSync(file, SOURCE);
    ({ app: edApp, page: ep } = await openApp(root, userData));
    ep.on('dialog', (d) => {
      unexpected.push(`${d.type()}: ${d.message()}`);
      void d.dismiss();
    });
    if (!(await ep.locator('.tree-row[title="inbox/revisao-editor.md"]').isVisible())) await ep.locator('.tree-row[title="inbox"]').click();
    await ep.locator('.tree-row[title="inbox/revisao-editor.md"]').click();
    await expect(body()).toHaveAttribute('contenteditable', 'true');
  });

  test.afterEach(() => { expect(unexpected).toEqual([]); });

  test.afterAll(async () => {
    await edApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('the editor shows the comments beside the text, joined to their words', async () => {
    await expect(ep.locator('.commented-editor .md-card')).toContainText('Quantos dias?');
    await expect(body().locator('span[data-md-comment="k1"]')).toHaveText('expira');
    await expect(ep.locator('.commented-editor .md-links path')).toHaveCount(1);
    await expect(ep.locator('.doc-bar').getByRole('button', { name: 'Comentários (1)' })).toBeVisible();
  });

  test('text with formatting inside is commented from the editor, and saved at once', async () => {
    await dragOver('Segundo parágrafo', 75, 260); // "parágrafo com negrito", bold inside
    const bubble = ep.getByRole('toolbar', { name: 'Seleção' });
    await expect(bubble.getByRole('button', { name: 'Comentar' })).toBeEnabled();
    await bubble.getByRole('button', { name: 'Comentar' }).click();
    const box = ep.getByRole('dialog', { name: 'Comentário' });
    await box.getByRole('textbox').fill('Rever este trecho');
    await box.getByRole('button', { name: 'Comentar' }).click();
    await expect(box).toBeHidden();
    await expect(ep.locator('.commented-editor .md-card')).toHaveCount(2);
    await expect.poll(() => readFileSync(file, 'utf8')).toContain('Rever este trecho');
    const saved = readFileSync(file, 'utf8');
    expect(saved).toMatch(/Segundo [^<]*<!--c:([a-z0-9]+)-->[^<]*\*\*negrito\*\*[^<]*<!--\/c:\1-->/); // the bold word inside the comment
    expect(saved).toContain(START); // the other comment's marks stay as they were
    await expect(ep.locator('.commented-editor .md-links path')).toHaveCount(2);
  });

  test('a selection over two paragraphs, or in code, cannot be commented: the reason is in the button', async () => {
    await dragOver('Segundo parágrafo', 10, 60, 'Terceiro parágrafo');
    const bubble = ep.getByRole('toolbar', { name: 'Seleção' });
    await expect(bubble.getByRole('button', { name: 'Comentar' })).toBeDisabled();
    await expect(bubble).toContainText('Selecione um trecho dentro de um mesmo parágrafo para comentar.');
    await ep.keyboard.press('Escape');
    await expect(bubble).toBeHidden();
  });

  test('a comment is answered, recolored and deleted from the editor; the words stay', async () => {
    const card = ep.locator('.commented-editor .md-card', { hasText: 'Quantos dias?' });
    await card.getByRole('button', { name: 'Responder' }).click();
    await card.getByRole('textbox').fill('Trinta, confirmado.');
    await card.getByRole('button', { name: 'Salvar' }).click();
    await expect(card).toContainText('Trinta, confirmado.');
    await expect.poll(() => readFileSync(file, 'utf8')).toContain('Trinta, confirmado.');

    await card.getByRole('button', { name: 'Alterar cor do comentário' }).click();
    await card.getByRole('radio', { name: 'Azul' }).click();
    await expect.poll(() => readFileSync(file, 'utf8')).toContain('"color":"blue"');
    await expect(body().locator('span[data-md-comment="k1"]')).toHaveCSS('--md-comment-color', '#4a8ff0');

    await card.getByRole('button', { name: 'Excluir' }).click();
    await ep.getByRole('alertdialog').getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(card).toHaveCount(0);
    await expect(body().locator('span[data-md-comment="k1"]')).toHaveCount(0);
    await expect.poll(() => readFileSync(file, 'utf8')).toContain('A senha expira em 30 dias.');
    expect(readFileSync(file, 'utf8')).not.toContain('Quantos dias?');
  });

  test('a comment made while editing saves the edits typed before it', async () => {
    await body().locator('p', { hasText: 'Terceiro parágrafo' }).click();
    // The editor takes the caret from the click a moment after it gets the focus back (until then it still holds
    // the last selection it had); a person never types that fast, so the test waits for it as well.
    await expect.poll(() => ep.evaluate(() => {
      const editor = (document.querySelector('.commented-editor .tiptap-body') as unknown as { editor?: { state: { selection: { empty: boolean; $from: { parent: { textContent: string } } } } } }).editor;
      return Boolean(editor?.state.selection.empty && editor.state.selection.$from.parent.textContent.startsWith('Terceiro'));
    })).toBe(true);
    await ep.keyboard.press('End');
    await ep.keyboard.type(' Com uma frase nova.');
    await dragOver('Terceiro parágrafo', 2, 60);
    await ep.getByRole('toolbar', { name: 'Seleção' }).getByRole('button', { name: 'Comentar' }).click();
    const box = ep.getByRole('dialog', { name: 'Comentário' });
    await box.getByRole('textbox').fill('Ok');
    await box.getByRole('button', { name: 'Comentar' }).click();
    await expect.poll(() => readFileSync(file, 'utf8')).toContain('Com uma frase nova.');
    expect(readFileSync(file, 'utf8')).toContain('"text":"Ok"');
  });
});

test.describe.serial('Moki one view for Markdown', () => {
  let oneApp: ElectronApplication;
  let op: Page;
  let inbox = '';
  const dirs: string[] = [];
  const open = async (name: string) => {
    if (!(await op.locator(`.tree-row[title="inbox/${name}"]`).isVisible())) await op.locator('.tree-row[title="inbox"]').click();
    await op.locator(`.tree-row[title="inbox/${name}"]`).click();
  };
  const editor = () => op.locator('.commented-editor .tiptap-body');
  const reading = () => op.locator('.md-commented .markdown');
  const note = (text: string) => op.getByRole('status').filter({ hasText: text });
  // What the editor would do with Markdown as people and the AI write it (see the probe in TipTapEditor's onRewrite).
  const SAMPLES: Record<string, { text: string; kind: 'none' | 'format' | 'loss' }> = {
    'ai-table.md': { text: '# Casos\n\n| ID | Cenário | Resultado |\n|----|---------|-----------|\n| CT-01 | Login válido | OK |\n', kind: 'format' },
    'padded-table.md': { text: '# Casos\n\n| ID    | Cenário      | Resultado |\n| ----- | ------------ | --------- |\n| CT-01 | Login válido | OK        |\n', kind: 'none' },
    'dash-table.md': { text: '# Casos\n\n| ID | Cenário |\n| --- | --- |\n| 1 | a |\n', kind: 'format' },
    'numbered.md': { text: '# Passos\n\n1. abrir\n2. clicar\n', kind: 'none' },
    'emphasis.md': { text: '# T\n\nTexto _itálico_ e __forte__.\n', kind: 'format' },
    'html.md': { text: '# T\n\n<details><summary>Mais</summary>\n\nOculto.\n\n</details>\n', kind: 'loss' },
  };

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    inbox = join(root, 'workspace', 'projects', 'acme', 'inbox');
    writeFileSync(join(inbox, 'conflito.md'), '# Conflito\n\nTexto inicial.\n');
    writeFileSync(join(inbox, 'grande.md'), `# Grande\n\n${'Uma linha comprida de texto. '.repeat(40000)}\n`);
    writeFileSync(join(inbox, 'links.md'), '# Links\n\nVeja [o site](https://example.com/pagina) aqui.\n');
    for (const [name, sample] of Object.entries(SAMPLES)) writeFileSync(join(inbox, name), sample.text);
    ({ app: oneApp, page: op } = await openApp(root, userData));
  });

  test.afterAll(async () => {
    await oneApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('Ctrl+E shows the Markdown source, to read and copy, not to edit', async () => {
    await open('conflito.md');
    await expect(editor()).toHaveAttribute('contenteditable', 'true');
    await editor().click();
    await op.keyboard.press('Control+e');
    const source = op.locator('textarea.md-source');
    await expect(source).toBeVisible();
    await expect(source).toHaveJSProperty('readOnly', true);
    await expect(source).toHaveValue('# Conflito\n\nTexto inicial.\n');
    await expect(op.locator('.doc-bar').getByRole('button', { name: 'Código Markdown' })).toHaveAttribute('aria-pressed', 'true');
    // The bar's buttons line up: the copy icon is as tall as the source button beside it.
    const copy = op.locator('.doc-bar').getByRole('button', { name: 'Copiar tudo' });
    expect((await copy.boundingBox())?.height).toBe((await op.locator('.doc-bar').getByRole('button', { name: 'Código Markdown' }).boundingBox())?.height);
    await copy.click();
    await expect(op.locator('.doc-bar').getByRole('button', { name: 'Copiado' })).toBeVisible();
    await expect.poll(() => oneApp.evaluate(({ clipboard }) => clipboard.readText())).toBe('# Conflito\n\nTexto inicial.\n');
    await op.keyboard.press('Control+e');
    await expect(editor()).toBeVisible();
    await expect(op.locator('.doc-bar').getByRole('button', { name: 'Código Markdown' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('a change made outside Moki while editing is never overwritten: keep mine, or see the new version', async () => {
    const file = join(inbox, 'conflito.md');
    // The AI writes the file while there are edits not saved yet.
    await editor().locator('p').click();
    await op.keyboard.press('End');
    await op.keyboard.type(' Minha parte.');
    writeFileSync(file, '# Conflito\n\nEscrito pela IA.\n');
    const bar = op.getByRole('alert').filter({ hasText: 'mudou fora do Moki' });
    await expect(bar).toBeVisible();
    expect(readFileSync(file, 'utf8')).toBe('# Conflito\n\nEscrito pela IA.\n'); // nothing was overwritten
    await bar.getByRole('button', { name: 'Manter a minha' }).click();
    await expect(bar).toBeHidden();
    await expect.poll(() => readFileSync(file, 'utf8')).toContain('Texto inicial. Minha parte.');

    await editor().locator('p').click();
    await op.keyboard.press('End');
    await op.keyboard.type(' De novo.');
    writeFileSync(file, '# Conflito\n\nA IA de novo.\n');
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: 'Ver a versão nova' }).click();
    await expect(bar).toBeHidden();
    await expect(editor()).toContainText('A IA de novo.');
    await expect(editor()).not.toContainText('De novo.');
    expect(readFileSync(file, 'utf8')).toBe('# Conflito\n\nA IA de novo.\n');
  });

  test('what the editor would do to a file is told apart: nothing, only its formatting, or losing parts of it', async () => {
    for (const [name, sample] of Object.entries(SAMPLES)) {
      await open(name);
      if (sample.kind === 'loss') {
        // Shown for reading and comments; to edit it, the user's own program.
        await expect(note('perderia partes deste arquivo'), name).toBeVisible();
        await expect(reading(), name).toBeVisible();
        await expect(op.locator('.commented-editor'), name).toHaveCount(0);
        await expect(note('perderia partes').getByRole('button', { name: 'Abrir no seu programa' }), name).toBeVisible();
      } else {
        await expect(editor(), name).toHaveAttribute('contenteditable', 'true');
        if (sample.kind === 'format') await expect(note('escreve a formatação do jeito dele'), name).toBeVisible();
        else await expect(note('escreve a formatação do jeito dele'), name).toHaveCount(0);
      }
      expect(readFileSync(join(inbox, name), 'utf8'), name).toBe(sample.text); // opening it changed nothing
    }
    // The note about the formatting closes, and stays closed for this tab.
    await open('emphasis.md');
    await note('escreve a formatação do jeito dele').getByRole('button', { name: 'Fechar' }).click();
    await expect(note('escreve a formatação do jeito dele')).toHaveCount(0);
    await open('numbered.md');
    await open('emphasis.md');
    await expect(note('escreve a formatação do jeito dele')).toHaveCount(0);
  });

  test('a large file is for reading and comments', async () => {
    await open('grande.md');
    await expect(note('grande')).toBeVisible();
    await expect(op.locator('.md-commented .markdown h1')).toHaveText('Grande');
    await expect(op.locator('.commented-editor')).toHaveCount(0);
  });

  test('a click in a link puts the caret there; Ctrl+click opens it', async () => {
    await open('links.md');
    await op.evaluate(() => { (window as unknown as { opened: string[] }).opened = []; window.open = (url?: string | URL) => { (window as unknown as { opened: string[] }).opened.push(String(url)); return null; }; });
    const link = editor().locator('a', { hasText: 'o site' });
    await link.click();
    await expect(op.getByRole('toolbar', { name: 'Link' })).toBeVisible();
    expect(await op.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual([]);
    await link.click({ modifiers: ['Control'] });
    await expect.poll(() => op.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual(['https://example.com/pagina']);
  });
});

test.describe.serial('Moki tables in the editor', () => {
  let tabApp: ElectronApplication;
  let tp: Page;
  let file = '';
  const dirs: string[] = [];
  const editor = () => tp.locator('.commented-editor .tiptap-body');
  const bar = () => tp.getByRole('toolbar', { name: 'Tabela' });
  // The table as saved: its lines, and the cells of its header.
  const saved = () => readFileSync(file, 'utf8').split('\n').filter((line) => line.startsWith('|'));
  const columns = () => (saved()[0] ?? '').split('|').length - 2;
  // Clicks a cell and waits for the editor to take the caret there (it takes it a moment after the click; a person is slower).
  const inCell = async (cell: Locator) => {
    await cell.click();
    await expect.poll(() => cell.evaluate((td) => {
      const editor = (td.closest('.tiptap-body') as unknown as { editor: { view: { posAtDOM: (node: Node, offset: number) => number }; state: { selection: { from: number } } } }).editor;
      const from = editor.state.selection.from;
      return from >= editor.view.posAtDOM(td, 0) && from <= editor.view.posAtDOM(td, td.childNodes.length);
    })).toBe(true);
  };

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    file = join(root, 'workspace', 'projects', 'acme', 'inbox', 'tabela.md');
    // Written as the editor writes tables, so opening it changes nothing.
    writeFileSync(file, '# Casos\n\n| ID    | Cenário      |\n| ----- | ------------ |\n| CT-01 | Login válido |\n');
    ({ app: tabApp, page: tp } = await openApp(root, userData));
    if (!(await tp.locator('.tree-row[title="inbox/tabela.md"]').isVisible())) await tp.locator('.tree-row[title="inbox"]').click();
    await tp.locator('.tree-row[title="inbox/tabela.md"]').click();
    await expect(editor().locator('table')).toBeVisible();
  });

  test.afterAll(async () => {
    await tabApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('rows and columns are added and removed from the table\'s bubble, and saved', async () => {
    await inCell(editor().locator('td', { hasText: 'CT-01' }));
    await expect(bar()).toBeVisible();
    await bar().getByRole('button', { name: 'Adicionar linha abaixo' }).click();
    await expect(editor().locator('tr')).toHaveCount(3);
    await expect.poll(() => saved().length).toBe(4); // header, its line, two rows

    await bar().getByRole('button', { name: 'Adicionar coluna à direita' }).click();
    await expect(editor().locator('tr').first().locator('th')).toHaveCount(3);
    await expect.poll(columns).toBe(3);
    // The new column is right of the caret's (between ID and Cenário); the caret stays where it was, so it is deleted from one of its own cells.
    await expect(editor().locator('tr').nth(1).locator('td').nth(2)).toHaveText('Login válido');
    await inCell(editor().locator('tr').first().locator('th').nth(1));
    await bar().getByRole('button', { name: 'Excluir a coluna' }).click();
    await expect(editor().locator('tr').first().locator('th')).toHaveCount(2);
    await expect.poll(columns).toBe(2);

    await inCell(editor().locator('td', { hasText: 'CT-01' }));
    await bar().getByRole('button', { name: 'Adicionar coluna à esquerda' }).click();
    await expect(editor().locator('tr').first().locator('th')).toHaveCount(3);
    await expect(editor().locator('tr').nth(1).locator('td').nth(1)).toHaveText('CT-01'); // the new column is before it
    await inCell(editor().locator('tr').first().locator('th').first());
    await bar().getByRole('button', { name: 'Excluir a coluna' }).click();
    await expect.poll(columns).toBe(2);
    expect(readFileSync(file, 'utf8')).toContain('Login válido'); // the words stay
  });

  test('the header row cannot get a row above it nor be deleted: a Markdown table needs it', async () => {
    await inCell(editor().locator('th', { hasText: 'Cenário' }));
    await expect(bar().getByRole('button', { name: 'Adicionar linha acima' })).toBeDisabled();
    await expect(bar().getByRole('button', { name: 'Excluir a linha' })).toBeDisabled();
    await expect(bar().getByRole('button', { name: 'Adicionar linha abaixo' })).toBeEnabled();
    await inCell(editor().locator('td', { hasText: 'CT-01' }));
    await expect(bar().getByRole('button', { name: 'Adicionar linha acima' })).toBeEnabled();
    await expect(bar().getByRole('button', { name: 'Excluir a linha' })).toBeEnabled();
  });

  test('Tab in the last cell adds a row; a row and then the table are deleted', async () => {
    await inCell(editor().locator('tr').last().locator('td').last());
    await tp.keyboard.press('Tab');
    await expect(editor().locator('tr')).toHaveCount(4);
    await expect.poll(() => saved().length).toBe(5);
    await bar().getByRole('button', { name: 'Excluir a linha' }).click();
    await expect(editor().locator('tr')).toHaveCount(3);
    await expect.poll(() => saved().length).toBe(4);

    await inCell(editor().locator('td', { hasText: 'CT-01' }));
    await bar().getByRole('button', { name: 'Excluir a tabela' }).click();
    await expect(editor().locator('table')).toHaveCount(0);
    await expect(bar()).toBeHidden();
    await expect.poll(() => saved().length).toBe(0);
    expect(readFileSync(file, 'utf8')).toContain('# Casos');
  });
});

test.describe.serial('Moki requests', () => {
  let reqApp: ElectronApplication;
  let qp: Page;
  let runs = '';
  const dirs: string[] = [];
  const card = () => qp.getByRole('region', { name: 'Execuções' });
  const make = (id: string, extra: Record<string, unknown>) => {
    mkdirSync(join(runs, id), { recursive: true });
    writeFileSync(join(runs, id, 'state.json'), JSON.stringify({ schemaVersion: '1', id, project: 'acme', currentStep: '', completedSteps: [], pending: [], approvals: [], inputs: [], results: [], artifacts: [], createdAt: 'x', updatedAt: 'x', ...extra }));
  };

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    runs = join(root, 'workspace', 'projects', 'acme', 'runs');
    make('20261108-1030-failure-analysis-erro-no-login', { skill: 'failure-analysis', activity: 'failure', status: 'in-progress' });
    make('20261108-1100-failure-analysis-checkout-lento', { skill: 'failure-analysis', activity: 'failure', status: 'completed' });
    make('20261108-1200-test-design-carrinho', { skill: 'test-design', status: 'in-progress' }); // asked straight to the AI
    ({ app: reqApp, page: qp } = await openApp(root, userData));
  });

  test.afterAll(async () => {
    await reqApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('each request shows the activity it came from and its scenario, or that it was a free request', async () => {
    await card().getByRole('tab', { name: 'Pedidos', exact: true }).click();
    await expect(card().getByRole('tab', { name: 'Atividades', exact: true })).toHaveCount(0); // executions are not activities
    const fromActivity = card().locator('.ops-side-row', { hasText: '· erro no login' });
    await expect(fromActivity).toBeVisible();
    await expect(fromActivity.locator('.ops-free')).toHaveCount(0);
    const free = card().locator('.ops-side-row', { hasText: 'carrinho' });
    await expect(free.locator('.ops-free')).toHaveText('Pedido livre');
    await card().getByRole('tab', { name: 'Concluídas' }).click();
    await expect(card().locator('.ops-side-row', { hasText: '· checkout lento' })).toBeVisible();
    await card().getByRole('tab', { name: 'Em andamento' }).click();
    // The tree's run folders have the same names.
    await qp.locator('.tree-row[title="runs"]').click();
    const tree = qp.locator('.sidebar');
    // The tree is narrow: its rows say the scenario; the whole name is in the tooltip.
    await expect(tree.locator('.tree-row', { hasText: 'erro no login' })).toHaveAttribute('title', /· erro no login/);
    await expect(tree.locator('.tree-row', { hasText: 'checkout lento' })).toBeVisible();
    await expect(tree.locator('.tree-row', { hasText: 'carrinho' })).toBeVisible();
  });

  test('the requests are filtered by activity, and the filter is there only when they come from more than one place', async () => {
    const filter = card().getByRole('combobox', { name: 'Mostrar os pedidos de' });
    await expect(filter).toBeVisible();
    await filter.selectOption({ label: 'Pedido livre' });
    await expect(card().locator('.ops-side-row', { hasText: 'carrinho' })).toBeVisible();
    await expect(card().locator('.ops-side-row', { hasText: 'erro no login' })).toHaveCount(0);
    await filter.selectOption({ label: 'Todas' });
    await expect(card().locator('.ops-side-row', { hasText: 'erro no login' })).toBeVisible();
    // Only one place left: no filter.
    rmSync(join(runs, '20261108-1200-test-design-carrinho'), { recursive: true });
    await expect(filter).toHaveCount(0);
    await expect(card().locator('.ops-side-row', { hasText: 'erro no login' })).toBeVisible();
  });
});

test('Moki call pastes into the current AI terminal and waits for Enter', async () => {
  const root = fixture();
  const profile = mkdtempSync(join(tmpdir(), 'moki-call-'));
  let window: ElectronApplication | undefined;
  try {
    const opened = await openApp(root, profile, 'acme', { QA_FAKE_TOOLS: '1' }); window = opened.app;
    const page = opened.page;
    await page.getByRole('button', { name: 'Novo: terminal, IA ou arquivo', exact: true }).click();
    await page.getByRole('menuitem', { name: 'IA', exact: true }).click();
    await page.getByRole('menuitem', { name: /Claude Code/ }).click();
    const pane = page.locator('.term-pane:not([hidden])');
    await expect(pane).toContainText('[ready]');
    await pane.locator('textarea').focus();
    await page.keyboard.type('meu contexto: ');
    await page.keyboard.press('Control+Shift+K');
    const wizard = page.getByRole('dialog');
    await wizard.getByRole('tab', { name: 'Skills', exact: true }).click();
    await wizard.getByRole('searchbox').fill('test-design');
    await wizard.locator('.invoke-row').click();
    await wizard.getByRole('button', { name: 'Continuar sem arquivos' }).click();
    const decide = wizard.getByRole('button', { name: /Deixar a skill decidir/ });
    if (await decide.count()) await decide.click();
    await wizard.locator('textarea').fill('Foque no login');
    await wizard.getByRole('button', { name: 'Continuar', exact: true }).click();
    await wizard.getByRole('button', { name: /^Neste terminal/ }).click();
    await wizard.getByRole('button', { name: 'Colar neste terminal' }).click();
    await expect(wizard).toHaveCount(0);
    await expect(pane).toContainText('Foque no login');
    await expect(pane).toContainText('meu contexto:');
    await expect(pane).not.toContainText('[submitted]');
    await expect(pane.locator('textarea')).toBeFocused();
    // The note about it says what to do next, then goes away by itself (no bar left on screen).
    const pasted = page.getByRole('status').filter({ hasText: 'Pedido colado' });
    await expect(pasted).toBeVisible();
    await expect(pasted).toBeHidden({ timeout: 10_000 });
    const phases = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('qa-activity-launches:')).flatMap(k => JSON.parse(localStorage.getItem(k)!)).map((r: { phase: string }) => r.phase));
    expect(phases).toContain('prepared');
    await page.screenshot({ path: test.info().outputPath('call-pasted.png') });
    await page.keyboard.press('Enter');
    await expect(pane).toContainText('[submitted]');
    // The same list opens from the keyboard while the AI terminal is in front (no extra bar on the screen).
    await expect(page.locator('.terminal-callbar')).toHaveCount(0);
    await page.keyboard.press('Control+Shift+K');
    await expect(page.getByRole('dialog').getByRole('tab', { name: 'Atividades', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  } finally {
    await window?.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  }
});

test.describe.serial('Moki project defaults', () => {
  let defApp: ElectronApplication;
  let dp: Page;
  let project = '';
  const dirs: string[] = [];
  const pane = () => dp.locator('.term-pane:not([hidden])');
  const newAi = async (plain = false) => {
    await dp.getByRole('button', { name: 'Novo: terminal, IA ou arquivo', exact: true }).click();
    await dp.getByRole('menuitem', { name: 'IA', exact: true }).click();
    if (plain) await dp.getByRole('menuitemcheckbox', { name: /Sem o padrão do projeto/ }).click();
    await dp.getByRole('menuitem', { name: /Claude Code/ }).click();
    await expect(pane()).toContainText('[ready]');
  };
  const closeTab = async () => { await dp.keyboard.press('Control+w'); };

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    project = join(root, 'workspace', 'projects', 'acme');
    // An activity of the person's that needs no files: as the only default, it starts by itself.
    const library = join(root, 'workspace', 'library', 'activities');
    mkdirSync(library, { recursive: true });
    writeFileSync(join(library, 'resumo-rapido.md'), '---\nlabel: "Resumo rápido"\ndescription: ""\ncategory: "QA"\nfiles: none\nnote: ""\ntags: ""\n---\n\nResuma o estado do projeto em três linhas.\n');
    // For the mirror: another project, a workspace tag acme carries, an activity and a template of the other project,
    // and an activity that reaches acme through the shared tag.
    addProject(root, 'beta', 'Beta Store');
    addProject(root, 'gamma', 'Gamma'); // so acme and beta are not every project
    writeFileSync(join(root, 'workspace', 'tags.json'), JSON.stringify({ tags: [{ id: 'pagamentos', name: 'Pagamentos', color: '#3b82f6', description: '' }] }));
    const acmeFile = join(project, 'project.json');
    writeFileSync(acmeFile, JSON.stringify({ ...JSON.parse(readFileSync(acmeFile, 'utf8')), tags: ['pagamentos'] }, null, 2));
    writeFileSync(join(library, 'triagem-de-log.md'), '---\nlabel: "Triagem de log"\ndescription: ""\ncategory: "QA"\nfiles: required\nnote: ""\ntags: "project:beta"\n---\n\nSepare os erros do log.\n');
    writeFileSync(join(library, 'conciliacao.md'), '---\nlabel: "Conciliação"\ndescription: ""\ncategory: "QA"\nfiles: required\nnote: ""\ntags: "pagamentos"\n---\n\nConcilie os pagamentos.\n');
    const templates = join(root, 'workspace', 'templates');
    mkdirSync(templates, { recursive: true });
    writeFileSync(join(templates, 'default.json'), JSON.stringify({ name: 'Default', tags: [], style: {} }));
    writeFileSync(join(templates, 'cliente.json'), JSON.stringify({ name: 'Cliente', tags: ['project:beta'], style: {} }));
    ({ app: defApp, page: dp } = await openApp(root, userData, 'acme', { QA_FAKE_TOOLS: '1' }));
  });

  test.afterAll(async () => {
    await defApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('the settings open from the project menu and the panel, one section per kind', async () => {
    await dp.getByRole('button', { name: 'Opções da pasta do projeto' }).click();
    await dp.getByRole('menuitem', { name: 'Configurações do projeto' }).click();
    const settings = dp.getByRole('dialog', { name: /^Configurações de / });
    for (const section of ['Projeto', 'Ao abrir uma IA aqui', 'Agentes', 'Skills', 'Atividades', 'Operações', 'Templates', 'Servidores MCP', 'Plugins']) {
      await expect(settings.getByRole('group', { name: section, exact: true })).toBeVisible();
    }
    await expect(settings.getByRole('status')).toHaveText('Uma IA aberta aqui começa sem nada configurado.');
    await settings.getByRole('button', { name: 'Cancelar' }).click();
    await expect(settings).toBeHidden();
    // The panel's sliders open the same settings.
    await dp.locator('.pp').getByRole('button', { name: 'Configurações do projeto' }).click();
    await expect(settings).toBeVisible();
    await settings.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('a default agent and skill with instructions: a new AI takes the role, uses the skill and waits', async () => {
    await dp.locator('.pp').getByRole('button', { name: 'Configurações do projeto' }).click();
    const settings = dp.getByRole('dialog', { name: /^Configurações de / });
    await settings.getByRole('button', { name: 'Padrão: failure-analyst' }).click();
    await expect(settings.getByRole('button', { name: 'Padrão: failure-analyst' })).toHaveAttribute('aria-pressed', 'true');
    // Every kind is one field: a click lists what can be added, typing filters it, a choice joins the field as a chip.
    const skills = settings.getByRole('combobox', { name: 'Skills' });
    await skills.click();
    await expect(settings.getByRole('listbox', { name: 'Skills' }).locator('.chip-picker-head')).toContainText(['Moki']);
    await skills.fill('failure-ana');
    await expect(settings.getByRole('listbox', { name: 'Skills' }).getByRole('option')).toHaveCount(1);
    await settings.getByRole('option', { name: /failure-analysis/ }).click();
    const chosen = settings.getByRole('list', { name: 'Skills' });
    await expect(chosen).toContainText('failure-analysis');
    await expect(chosen.getByRole('button', { name: 'Padrão: failure-analysis' })).toHaveAttribute('aria-pressed', 'true'); // a Moki skill joins as a default
    await skills.press('Escape');
    await expect(settings.getByRole('listbox', { name: 'Skills' })).toBeHidden();
    await expect(settings).toBeVisible(); // Escape closed the list, not the settings
    await settings.getByRole('textbox', { name: /Instruções ao iniciar/ }).fill('Os logs vêm do serviço X, em horário de Brasília.');
    await expect(settings.getByRole('status')).toHaveText('Uma IA aberta aqui diz o que está configurado e espera você.');
    await settings.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(settings).toBeHidden();
    const saved = JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'));
    expect(saved.defaults).toEqual([{ kind: 'agent', id: 'failure-analyst' }, { kind: 'skill', id: 'failure-analysis' }]);
    expect(saved.startInstructions).toBe('Os logs vêm do serviço X, em horário de Brasília.');

    await newAi();
    await expect(pane()).toContainText('[start] Follow AGENTS.md. Project: acme.');
    await expect(pane()).toContainText('Act as the failure-analyst agent');
    await expect(pane()).toContainText('Use these skills whenever they fit');
    await expect(pane()).toContainText('Instructions for this project: Os logs vêm do serviço X');
    await expect(dp.locator('.tab-term.active')).toContainText('Claude Code · padrão do projeto');
    await closeTab();
  });

  test('an AI can still open without the project defaults', async () => {
    await newAi(true);
    await expect(pane()).not.toContainText('[start]');
    await expect(dp.locator('.tab-term.active')).not.toContainText('·');
    await closeTab();
  });

  test('one activity that needs no files as the only default starts by itself; defaults come first in Call', async () => {
    const file = join(project, 'project.json');
    const data = JSON.parse(readFileSync(file, 'utf8'));
    writeFileSync(file, JSON.stringify({ ...data, defaults: [{ kind: 'activity', id: 'resumo-rapido' }], startInstructions: '' }, null, 2));
    await expect.poll(async () => { await newAi(); const text = await pane().textContent(); await closeTab(); return text ?? ''; }).toContain('Resuma o estado do projeto em três linhas.');
    await newAi();
    await expect(pane()).toContainText('add --activity resumo-rapido'); // its origin is recorded, as for any activity
    await expect(dp.locator('.tab-term.active')).toContainText('Claude Code · Resumo rápido');
    await closeTab();
    // Call lists the project's defaults first, marked.
    await dp.locator('.pp').getByRole('button', { name: 'Chamar…', exact: true }).click();
    const call = dp.getByRole('dialog');
    await expect(call.locator('.invoke-row').first()).toContainText('Resumo rápido');
    await expect(call.locator('.invoke-row').first()).toContainText('Padrão');
    await dp.keyboard.press('Escape');
  });

  test('activities and templates are linked here or in the workspace settings, the same tags seen from both sides', async () => {
    const root = join(project, '..', '..', '..');
    const openSettings = async () => {
      await dp.locator('.pp').getByRole('button', { name: 'Configurações do projeto' }).click();
      return dp.getByRole('dialog', { name: /^Configurações de / });
    };
    let settings = await openSettings();
    const mine = settings.getByRole('list', { name: 'Atividades', exact: true });
    await expect(mine).toContainText('Resumo rápido'); // no tag: every project
    await expect(mine).not.toContainText('Triagem de log');
    // A shared tag brings it: in the field, locked (no remove), the tag named on hover.
    const shared = mine.locator('li', { hasText: 'Conciliação' });
    await expect(shared.getByRole('button', { name: /^Remover/ })).toHaveCount(0);
    await expect(shared).toHaveAttribute('title', /tag "Pagamentos"/);
    // Templates: the one for every project is locked; another can be linked and put in use.
    const templates = settings.getByRole('list', { name: 'Templates' });
    await expect(templates.getByRole('checkbox', { name: /Default/ })).toBeDisabled();
    await expect(templates.getByRole('radio', { name: 'Em uso' })).toHaveCount(1);
    await expect(settings.getByRole('group', { name: 'Servidores MCP' })).toContainText('Nenhum servidor MCP para este projeto.');

    await settings.getByRole('combobox', { name: 'Atividades' }).click();
    await settings.getByRole('option', { name: /Triagem de log/ }).click();
    await expect(mine).toContainText('Triagem de log');
    await templates.getByRole('checkbox', { name: 'Cliente' }).check();
    await templates.locator('li', { hasText: 'Cliente' }).getByRole('radio', { name: 'Em uso' }).check();
    await settings.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(settings).toBeHidden();
    // Written as the project's tag, where Settings › Activities and Templates read it.
    expect(readFileSync(join(root, 'workspace', 'library', 'activities', 'triagem-de-log.md'), 'utf8')).toContain('tags: "project:beta, project:acme"');
    expect(JSON.parse(readFileSync(join(root, 'workspace', 'templates', 'cliente.json'), 'utf8')).tags).toEqual(['project:beta', 'project:acme']);
    expect(JSON.parse(readFileSync(join(project, 'project.json'), 'utf8')).template).toBe('cliente');

    // The workspace side drops the tag: the project's settings show it unchecked.
    const file = join(root, 'workspace', 'library', 'activities', 'triagem-de-log.md');
    writeFileSync(file, readFileSync(file, 'utf8').replace('project:beta, project:acme', 'project:beta'));
    settings = await openSettings();
    await expect(settings.getByRole('list', { name: 'Atividades', exact: true })).not.toContainText('Triagem de log');
    await expect(settings.getByRole('list', { name: 'Templates' }).locator('li', { hasText: 'Cliente' }).getByRole('radio', { name: 'Em uso' })).toBeChecked();
    await settings.getByRole('button', { name: 'Cancelar' }).click();
  });

  test('bring to this project: one upload is sorted by kind, linked here and marked in the workspace settings', async () => {
    // A kit with an agent (Claude Code format) and an activity; the native folder dialog answers with it.
    const kit = mkdtempSync(join(tmpdir(), 'moki-kit-'));
    dirs.push(kit);
    mkdirSync(join(kit, '.claude', 'agents'), { recursive: true });
    mkdirSync(join(kit, 'activities'), { recursive: true });
    writeFileSync(join(kit, '.claude', 'agents', 'log-scout.md'), '---\nname: log-scout\ndescription: Finds the failing line\ntools: Read, Grep\n---\nLook at the log first.\n');
    writeFileSync(join(kit, 'activities', 'log-triage.md'), '---\nlabel: "Triagem do log"\ndescription: ""\ncategory: "QA"\nfiles: required\nnote: ""\ntags: ""\n---\n\nSepare os erros do log.\n');
    await defApp.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = (async () => ({ canceled: false, filePaths: [folder] })) as typeof dialog.showOpenDialog; }, kit);

    await dp.locator('.pp').getByRole('button', { name: 'Configurações do projeto' }).click();
    const settings = dp.getByRole('dialog', { name: /^Configurações de / });
    await settings.getByRole('button', { name: 'Trazer para este projeto' }).click();
    const bring = dp.getByRole('dialog', { name: 'Trazer para este projeto' });
    await expect(bring.getByRole('group', { name: 'Área para soltar' })).toContainText('Arraste uma pasta, um .zip ou um .md para cá');
    await bring.getByRole('button', { name: 'Escolher uma pasta' }).click();
    // Sorted by kind, everything checked; installed only after confirming.
    await expect(bring.getByRole('region', { name: 'Agentes' })).toContainText('log-scout');
    await expect(bring.getByRole('region', { name: 'Atividades' })).toContainText('log-triage');
    await expect(bring.getByRole('region', { name: 'Skills' })).toHaveCount(0);
    await bring.getByRole('button', { name: 'Instalar os itens escolhidos' }).click();
    await dp.getByRole('alertdialog').getByRole('button', { name: 'Continuar', exact: true }).click(); // Moki's own confirmation
    await expect(bring.getByRole('status')).toContainText('2');
    await bring.locator('.modal-foot').getByRole('button', { name: 'Fechar', exact: true }).click();
    // Already linked here: the fields show them, and saving keeps them.
    await expect(settings.getByRole('list', { name: 'Agentes', exact: true })).toContainText('log-scout');
    await expect(settings.getByRole('list', { name: 'Atividades', exact: true })).toContainText('Triagem do log');
    await settings.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(settings).toBeHidden();
    const root = join(project, '..', '..', '..');
    expect(readFileSync(join(root, 'workspace', 'library', 'activities', 'log-triage.md'), 'utf8')).toContain('tags: "project:acme"');
    expect(JSON.parse(readFileSync(join(root, 'workspace', 'library', 'agent-tags.json'), 'utf8')).agents['log-scout']).toEqual(['project:acme']);
    // The workspace settings list them with the mark of where they came from.
    await dp.getByRole('button', { name: 'Configurações', exact: true }).click();
    await dp.getByRole('tab', { name: 'Agentes' }).click();
    await expect(dp.locator('.library-item', { hasText: 'log-scout' }).getByRole('img', { name: 'Trazido de Acme Library' })).toBeVisible();
    await dp.getByRole('tab', { name: 'Atividades' }).click();
    await expect(dp.locator('.list-card', { hasText: 'Triagem do log' }).getByRole('img', { name: 'Trazido de Acme Library' })).toBeVisible();
    await dp.keyboard.press('Escape');
  });
});

test.describe.serial('Moki tab groups and split views', () => {
  let gApp: ElectronApplication;
  let gp: Page;
  let project = '';
  const dirs: string[] = [];
  const chips = () => gp.locator('.pane-0 .group-chip');
  const newAi = async () => {
    await gp.getByRole('button', { name: 'Novo: terminal, IA ou arquivo', exact: true }).click();
    await gp.getByRole('menuitem', { name: 'IA', exact: true }).click();
    await gp.getByRole('menuitem', { name: /Claude Code/ }).click();
    await expect(gp.locator('.term-pane:not([hidden])').last()).toContainText('[ready]');
  };
  // The terminals' ids, as the board saved them (the tab of each group's terminal).
  const terminalIds = () => gp.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('qa-tab-board:'));
    const board = JSON.parse(localStorage.getItem(key ?? '') ?? '{}') as { order?: string[] };
    return (board.order ?? []).filter((k) => k.startsWith('term:')).map((k) => k.slice(5));
  });

  test.beforeAll(async () => {
    const root = fixture();
    const userData = mkdtempSync(join(tmpdir(), 'moki-profile-'));
    dirs.push(root, userData);
    project = join(root, 'workspace', 'projects', 'acme');
    ({ app: gApp, page: gp } = await openApp(root, userData, 'acme', { QA_FAKE_TOOLS: '1' }));
  });

  test.afterAll(async () => {
    await gApp?.close();
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  test('every AI opens its own group; a group is renamed and colored like a browser tab group', async () => {
    const rowHeight = () => gp.locator('.pane-row').first().evaluate((el) => el.getBoundingClientRect().height);
    const plain = await rowHeight(); // no group yet
    await newAi();
    await newAi();
    await expect(chips()).toHaveCount(2);
    const [a, b] = await chips().evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    expect(a).not.toBe(b);
    await expect(chips().nth(1)).toHaveAttribute('aria-pressed', 'true');
    // The view shows only its group's tabs.
    await expect(gp.locator('.pane-0 [role="tab"]')).toHaveCount(1);
    await chips().first().click({ button: 'right' });
    const menu = gp.getByRole('dialog', { name: /^Grupo / });
    await menu.getByRole('textbox', { name: 'Nome do grupo' }).fill('Triagem');
    await menu.getByRole('radio', { name: 'Rosa' }).click();
    await expect(menu.getByRole('radio', { name: 'Rosa' })).toHaveAttribute('aria-checked', 'true');
    await menu.getByRole('textbox', { name: 'Nome do grupo' }).press('Enter');
    await expect(chips().first()).toHaveText('Triagem');
    expect(await rowHeight()).toBe(plain); // groups do not change the row's height
  });

  test('a deliverable of a terminal\'s run opens in its group by itself, marked new, without taking the screen', async () => {
    const [first] = await terminalIds();
    const run = join(project, 'runs', '20261108-1500-failure-analysis-log');
    mkdirSync(join(run, 'outputs'), { recursive: true });
    writeFileSync(join(run, 'outputs', 'pre-analysis.txt'), 'Falha no passo 3.');
    writeFileSync(join(run, 'outputs', 'print.png'), 'not a deliverable');
    writeFileSync(join(run, 'state.json'), JSON.stringify({ id: '20261108-1500-failure-analysis-log', status: 'in-progress', skill: 'failure-analysis', terminal: first, artifacts: ['workspace/projects/acme/runs/20261108-1500-failure-analysis-log/outputs/pre-analysis.txt'] }));
    // The second group stays on screen; the first one says it has something new.
    await expect(chips().first().locator('.group-chip-new')).toHaveText('1');
    await expect(chips().nth(1)).toHaveAttribute('aria-pressed', 'true');
    await chips().first().click();
    const tabs = gp.locator('.pane-0 [role="tab"]');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(1)).toContainText('pre-analysis.txt');
    await expect(gp.locator('.pane-0 [role="tab"]', { hasText: 'print.png' })).toHaveCount(0);
    await tabs.nth(1).click();
    await expect(chips().first().locator('.group-chip-new')).toHaveCount(0);
  });

  test('the screen splits: each view has its group and its own tabs; a tab is dragged to the other view', async () => {
    await gp.getByRole('button', { name: 'Dividir a tela' }).click();
    await gp.getByRole('menuitemradio', { name: 'Duas lado a lado' }).click();
    await expect(gp.locator('.pane')).toHaveCount(2);
    const heights = await gp.locator('.pane-row').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(new Set(heights).size).toBe(1); // every view's row has the same height
    // Different groups side by side.
    // No bar above the views: each one has its own row of groups and tabs.
    await expect(gp.getByRole('toolbar', { name: 'Grupos de abas' })).toHaveCount(0);
    await expect(gp.locator('.pane-1 .group-chip[aria-pressed="true"]')).not.toHaveText('Triagem');
    // The same group in both: the terminal on the left, the file on the right.
    await gp.locator('.pane-1 .group-chip', { hasText: 'Triagem' }).click();
    await expect(gp.locator('.pane-1 .group-chip[aria-pressed="true"]')).toHaveText('Triagem');
    await gp.locator('.pane-0 [role="tab"]', { hasText: 'pre-analysis.txt' }).dragTo(gp.locator('.pane-1 .pane-tabs'));
    await expect(gp.locator('.pane-1 [role="tab"]')).toHaveText(['pre-analysis.txt']);
    await expect(gp.locator('.pane-0 [role="tab"]')).toHaveCount(1);
    await expect(gp.locator('.pane-1')).toContainText('Falha no passo 3.');
    await expect(gp.locator('.pane-0 .term-pane:not([hidden])')).toBeVisible();
    // Back to one view: the tabs return to their group.
    await gp.getByRole('button', { name: 'Dividir a tela' }).click();
    await gp.getByRole('menuitemradio', { name: 'Uma divisão' }).click();
    await expect(gp.locator('.pane')).toHaveCount(1);
  });

  test('a note on top (over Settings) is resized from its bottom-right corner', async () => {
    await gp.locator('.ribbon').getByRole('button', { name: 'Configurações', exact: true }).click();
    await gp.locator('.ribbon').getByRole('button', { name: 'Nova nota', exact: true }).click();
    const note = gp.locator('.modal-backdrop > .note-dialog');
    await expect(note).toBeVisible();
    const before = (await note.boundingBox())!;
    await gp.mouse.move(before.x + before.width - 4, before.y + before.height - 4);
    await gp.mouse.down();
    await gp.mouse.move(before.x + before.width - 160, before.y + before.height - 120, { steps: 8 });
    await gp.mouse.up();
    const smaller = (await note.boundingBox())!;
    expect(smaller.width).toBeLessThan(before.width - 50);
    expect(smaller.height).toBeLessThan(before.height - 50);
    await note.getByRole('button', { name: 'Fechar (Esc)', exact: true }).click();
    await gp.locator('.ribbon').getByRole('button', { name: 'Configurações', exact: true }).click();
  });

  test('with many tabs, only the tabs scroll: the split and New buttons stay fixed at the end, same size', async () => {
    for (let n = 1; n <= 14; n++) writeFileSync(join(project, 'inbox', `caso-de-teste-numero-${n}.md`), `# Caso ${n}\n`);
    await gp.getByRole('navigation').getByRole('button', { name: 'Atualizar', exact: true }).click();
    await gp.locator('.tree-row[title="inbox"]').click();
    for (let n = 1; n <= 14; n++) await gp.locator(`.tree-row[title="inbox/caso-de-teste-numero-${n}.md"]`).click();
    await expect(gp.locator('.pane-0 [role="tab"]', { hasText: 'caso-de-teste-numero-14.md' })).toBeVisible();
    await expect(gp.locator('.pane-0 [role="tab"]', { hasText: 'caso-de-teste-numero-14.md' })).toBeInViewport(); // the active tab scrolls into view
    const actions = gp.locator('.pane-0 .pane-actions');
    const split = actions.getByRole('button', { name: 'Dividir a tela' });
    const add = actions.getByRole('button', { name: 'Novo: terminal, IA ou arquivo' });
    const [a, b, row] = await Promise.all([split.boundingBox(), add.boundingBox(), gp.locator('.pane-0 .pane-tabs').boundingBox()]);
    expect([a!.width, a!.height]).toEqual([b!.width, b!.height]);
    expect(a!.x).toBeGreaterThanOrEqual(row!.x + row!.width); // the buttons sit after the tabs, never under them
    expect(await gp.locator('.pane-0 .pane-tabs').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await split.click(); // still reachable with the tabs scrolled
    await expect(gp.getByRole('menu', { name: 'Dividir a tela' })).toBeVisible();
    await gp.keyboard.press('Escape');
  });
});
