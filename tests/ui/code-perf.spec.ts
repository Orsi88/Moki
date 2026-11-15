// How long a large code file takes to open, to scroll and to select a line in: the code view must stay quick.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

let app: ElectronApplication;
let page: Page;
let root = '', profile = '';

test.beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'moki-code-perf-'));
  profile = mkdtempSync(join(tmpdir(), 'moki-code-perf-profile-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
  for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  const project = join(root, 'workspace', 'projects', 'acme');
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary']) mkdirSync(join(project, dir), { recursive: true });
  const data = JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'));
  writeFileSync(join(project, 'project.json'), JSON.stringify({ ...data, project: 'acme', name: 'Acme' }, null, 2));
  const block = (i: number) => `export function handler${i}(input: string, count: number): boolean {\n  // Checks the input ${i}\n  const value = input.trim().length + count * ${i};\n  return value > 10 && input !== "skip";\n}\n`;
  writeFileSync(join(project, 'inbox', 'big.ts'), Array.from({ length: 1000 }, (_, i) => block(i)).join('\n'));
  app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: profile, QA_OPEN_PROJECT: 'acme' });
  page = await app.firstWindow();
});

test.afterAll(async () => {
  await Promise.race([app?.close(), new Promise((resolve) => setTimeout(resolve, 3000))]);
  for (const dir of [root, profile]) { try { rmSync(dir, { recursive: true, force: true, maxRetries: 2 }); } catch { /* held */ } }
});

test('a 6,000-line code file opens and selects lines quickly', async () => {
  await page.locator('.tree-row[title="inbox"]').click();
  const t0 = Date.now();
  await page.locator('.tree-row[title="inbox/big.ts"]').click();
  await expect(page.locator('.code-file .hljs-keyword').first()).toBeVisible();
  const open = Date.now() - t0;
  // From the click on a line number until that line shows as selected (React render and layout).
  const select = await page.evaluate(async () => {
    const gutter = document.querySelector<HTMLElement>('.code-gutter')!;
    const pad = parseFloat(getComputedStyle(gutter).paddingTop), line = parseFloat(getComputedStyle(gutter).lineHeight), box = gutter.getBoundingClientRect();
    const pick = (n: number) => new Promise<number>((done) => {
      const t = performance.now();
      gutter.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: box.left + 10, clientY: box.top + pad + (n - 0.5) * line }));
      const check = () => { const mark = document.querySelector<HTMLElement>('.code-line-mark'); if (mark && mark.style.top.includes(`${n - 1} *`)) { void document.body.offsetHeight; done(performance.now() - t); } else setTimeout(check, 0); };
      check();
    });
    return [await pick(200), await pick(300), await pick(4000)].map(Math.round);
  });
  console.log('PERF', JSON.stringify({ open, select }));
  expect(Math.max(...select)).toBeLessThan(80); // it took 160-300 ms when every line was its own button
  expect(open).toBeLessThan(3000);
});
