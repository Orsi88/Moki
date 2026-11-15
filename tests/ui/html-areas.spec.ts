// HTML pages: marking an area (a dragged rectangle) and marking selected text with a right-click; the area follows the
// page's layout when the preview gets wider, and the marker's icon sits in the left margin with no card of its own.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';
import { htmlComments } from '../../desktop/html-comments.ts';

let app: ElectronApplication;
let page: Page;
let root = '', profile = '', project = '';

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'moki-html-areas-'));
  profile = mkdtempSync(join(tmpdir(), 'moki-html-areas-profile-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  project = join(root, 'workspace', 'projects', 'acme');
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary']) mkdirSync(join(project, dir), { recursive: true });
  const data = JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'));
  writeFileSync(join(project, 'project.json'), JSON.stringify({ ...data, project: 'acme', name: 'Acme' }, null, 2));
  // A centred page: when the preview gets wider, its content moves to the right.
  writeFileSync(join(project, 'inbox', 'page.html'), '<!doctype html><html><body style="margin:0"><main style="max-width:360px;margin:40px auto;font:16px sans-serif"><h1 id="t">Relatório</h1><p id="p">Cliente Hospital ABC, ambiente de produção.</p><p>Pacote de destino 879.7.</p></main></body></html>');
  app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: profile, QA_OPEN_PROJECT: 'acme' });
  page = await app.firstWindow();
  await page.evaluate(() => { localStorage.setItem('qa-ui-language', 'pt-BR'); localStorage.setItem('qa-language', 'Portuguese (pt-BR)'); });
  const reloaded = page.waitForEvent('load');
  await app.evaluate(({ BrowserWindow }) => { const win = BrowserWindow.getAllWindows()[0]; win.setSize(1300, 820); win.webContents.reload(); });
  await reloaded;
});

test.afterAll(async () => {
  await Promise.race([app?.close(), new Promise((resolve) => setTimeout(resolve, 3000))]);
  for (const dir of [root, profile]) { try { rmSync(dir, { recursive: true, force: true, maxRetries: 2 }); } catch { /* the window may hold the profile */ } }
});

test('an area is marked from the menu shown on letting go, follows the page when it gets wider, and has its icon in the margin', async () => {
  await page.locator('.tree-row[title="inbox"]').click();
  await page.locator('.tree-row[title="inbox/page.html"]').click();
  const frame = page.frameLocator('iframe[title="inbox/page.html"]');
  await expect(frame.locator('#p')).toBeVisible();
  await page.getByLabel('Largura da prévia').selectOption('390px');
  await expect(page.locator('iframe[title="inbox/page.html"]')).toHaveCSS('width', '390px');
  await page.getByRole('button', { name: 'Marcar área', exact: true }).click();
  const target = (await frame.locator('#p').boundingBox())!;
  await page.mouse.move(target.x + 4, target.y + 2);
  await page.mouse.down();
  await page.mouse.move(target.x + 200, target.y + 60, { steps: 6 });
  await page.mouse.up();
  await page.getByRole('menu', { name: 'Marcar com' }).getByRole('menuitem', { name: /Revisar/ }).click();
  await expect.poll(() => htmlComments(project, 'inbox/page.html').length).toBe(1);
  const [area] = htmlComments(project, 'inbox/page.html');
  expect(area.text).toBe('[🔍 Revisar]');
  expect(area.anchor).toMatchObject({ kind: 'area' });
  expect((area.anchor as { path?: number[] }).path?.length).toBeGreaterThan(0);
  // No card; the icon in the left margin, on the area's line.
  await expect(page.locator('.html-preview-content .md-card')).toHaveCount(0);
  const icon = page.locator('.html-preview-content .marker-margin');
  await expect(icon).toHaveText('🔍');
  // Wider: the page's content moves, the area goes with its paragraph.
  const offset = () => frame.locator('body').evaluate(() => {
    const box = document.querySelector('[data-moki-areas] > div')!.getBoundingClientRect(), p = document.getElementById('p')!.getBoundingClientRect();
    return [Math.round(box.left - p.left), Math.round(box.top - p.top)];
  });
  const before = await offset();
  await page.getByLabel('Largura da prévia').selectOption('100%');
  await expect(page.locator('iframe[title="inbox/page.html"]')).not.toHaveCSS('width', '390px');
  await expect.poll(offset).toEqual(before);
});

test('selected text is marked with a right-click, with no comment box', async () => {
  const frame = page.frameLocator('iframe[title="inbox/page.html"]');
  await frame.locator('#t').evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); const s = document.getSelection()!; s.removeAllRanges(); s.addRange(r); });
  const box = (await frame.locator('#t').boundingBox())!;
  await page.mouse.click(box.x + 20, box.y + box.height / 2, { button: 'right' });
  await page.getByRole('menu', { name: 'Marcar com' }).getByRole('menuitem', { name: /Importante/ }).click();
  await expect.poll(() => htmlComments(project, 'inbox/page.html').map((c) => c.text)).toContain('[⭐ Importante]');
  await expect(page.getByRole('dialog', { name: 'Comentário' })).toHaveCount(0);
  await expect(page.locator('.html-preview-content .marker-margin')).toHaveCount(2);
});
