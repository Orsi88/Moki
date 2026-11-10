// The screenshots of the wiki (docs/assets/wiki/<lang>/*.png), taken from the real app on a sample project, in English
// and Portuguese. Runs only with QA_WIKI_SHOTS=1 (npm run test:ui -- tests/ui/wiki-shots.spec.ts); the other runs skip it.
// QA_FAKE_TOOLS makes the AI tools look installed and gives the quick assistants and Hudson fixed answers.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

test.skip(process.env.QA_WIKI_SHOTS !== '1', 'wiki screenshots: set QA_WIKI_SHOTS=1');

const RUN = '20261110-0930-requirements-review-us-12';
const STORY = `---
id: US-12
status: ready
---

# US-12 — Free shipping above R$ 100

As a **customer**, I want free shipping when my cart is above R$ 100, so that I buy more in one order.

> [!NOTE]
> Written with the product team on 2026-11-05.

## Acceptance criteria

| # | Given | When | Then |
|---|---|---|---|
| 1 | a cart of R$ 120 | I go to checkout | shipping is <b>free</b> |
| 2 | a cart of R$ 99,90 | I go to checkout | the regular shipping applies |

## Open questions

- Does the coupon discount count before or after the R$ 100 limit?[^1]

[^1]: Asked to the product owner.
`;
const STORY_PT = `---
id: US-12
status: pronta
---

# US-12 — Frete grátis acima de R$ 100

Como **cliente**, quero frete grátis quando o carrinho passar de R$ 100, para comprar mais num só pedido.

> [!NOTE]
> Escrita com o time de produto em 05/11/2026.

## Critérios de aceite

| # | Dado | Quando | Então |
|---|---|---|---|
| 1 | um carrinho de R$ 120 | vou para o checkout | o frete é <b>grátis</b> |
| 2 | um carrinho de R$ 99,90 | vou para o checkout | vale o frete normal |

## Dúvidas em aberto

- O desconto do cupom conta antes ou depois do limite de R$ 100?[^1]

[^1]: Perguntado ao dono do produto.
`;

function sampleWorkspace(lang: 'en' | 'pt-BR'): { root: string; project: string } {
  const pt = lang === 'pt-BR';
  const root = mkdtempSync(join(tmpdir(), 'moki-wiki-shots-'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-wiki' }));
  for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  const project = join(root, 'workspace', 'projects', 'online-store');
  cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
  renameSync(join(project, 'gitignore.txt'), join(project, '.gitignore'));
  for (const dir of ['inbox', 'runs', 'temporary', 'notes']) mkdirSync(join(project, dir), { recursive: true });
  const file = join(project, 'project.json');
  const data = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...data, project: 'online-store', name: pt ? 'Loja on-line' : 'Online store', description: pt ? 'Checkout, frete e cupons da loja on-line.' : 'Checkout, shipping and coupons of the online store.' }, null, 2)}\n`);
  writeFileSync(join(project, 'inbox', 'us-12-free-shipping.md'), pt ? STORY_PT : STORY);
  writeFileSync(join(project, 'notes', pt ? 'ideias-de-teste.md' : 'test-ideas.md'), pt
    ? '# Ideias de teste\n\nverificar frete gratis com carrinho de exatamente R$ 100 e com cupom, e o que acontece quando o cliente tira um item no checkout.\n'
    : '# Test ideas\n\ncheck free shipping with a cart of exactly R$ 100 and with coupons, and what happens when the customer removes an item at checkout.\n');
  const run = join(project, 'runs', RUN);
  mkdirSync(join(run, 'outputs'), { recursive: true });
  writeFileSync(join(run, 'state.json'), JSON.stringify({ schemaVersion: '1', id: RUN, project: 'online-store', skill: 'requirements-review', title: pt ? 'Revisão da US-12 frete grátis' : 'Review of US-12 free shipping', status: 'completed', currentStep: '', completedSteps: [], pending: [], approvals: [], inputs: [], results: [], artifacts: [], createdAt: 'x', updatedAt: 'x' }));
  writeFileSync(join(run, 'outputs', pt ? 'definicoes-finais.md' : 'final-definitions.md'), '# Final definitions — US-12\n\nThe coupon applies before the R$ 100 limit.\n');
  writeFileSync(join(run, 'outputs', pt ? 'notas-de-apoio.md' : 'support-notes.md'), 'notes taken while reading the story\n');
  writeFileSync(join(run, 'outputs', 'doc1.md'), '# Review matrix of US-12\n');
  return { root, project };
}

for (const lang of ['en', 'pt-BR'] as const) {
  test.describe.serial(`wiki screenshots (${lang})`, () => {
    let app: ElectronApplication;
    let page: Page;
    let root = '';
    let userData = '';
    const out = join(ROOT, 'docs', 'assets', 'wiki', lang);
    const pt = lang === 'pt-BR';
    const shot = async (name: string, target = page.locator('body')) => {
      await page.evaluate(() => { for (const el of document.querySelectorAll('[contenteditable], textarea')) el.setAttribute('spellcheck', 'false'); });
      await page.waitForTimeout(400);
      await target.screenshot({ path: join(out, `${name}.png`) });
    };

    test.beforeAll(async () => {
      mkdirSync(out, { recursive: true });
      ({ root } = sampleWorkspace(lang));
      userData = mkdtempSync(join(tmpdir(), 'moki-wiki-shots-profile-'));
      app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: userData, QA_OPEN_PROJECT: 'online-store', QA_FAKE_TOOLS: '1' });
      page = await app.firstWindow();
      await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.setSize(1440, 880); w.center(); });
      await page.evaluate((l) => {
        localStorage.setItem('qa-ui-language', l);
        localStorage.setItem('qa-language', l === 'pt-BR' ? 'Portuguese (pt-BR)' : 'English');
        localStorage.setItem('qa-theme-settings', JSON.stringify({ mokiMode: 'light', documents: 'light', cli: 'dark', mokiPalette: 'butter' }));
      }, lang);
      const reloaded = page.waitForEvent('load');
      await app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].webContents.reload(); });
      await reloaded;
      // The sample documentation must not show the computer owner's real subscription usage.
      await page.addStyleTag({ content: '.usage-trigger:has(.usage-plan) { visibility: hidden; }' });
    });

    test.afterAll(async () => {
      await Promise.race([app?.close().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 3000))]);
      for (const dir of [root, userData]) { try { rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch { /* locked briefly */ } }
    });

    test('the project screen, with a story open in the editor', async () => {
      await page.locator('.tree-row[title="inbox"]').click();
      await page.locator('.tree-row[title="inbox/us-12-free-shipping.md"]').click();
      await expect(page.locator('.tiptap-body')).toContainText(pt ? 'Frete grátis' : 'Free shipping');
      await page.locator('.tiptap-body h1').click();
      await shot('project');
    });

    test('Call: one list of activities, agents, skills and operations', async () => {
      await page.locator('.pp').getByRole('button', { name: pt ? 'Chamar…' : 'Call…', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.locator('.invoke-row').first()).toBeVisible();
      await shot('call', dialog);
      await page.keyboard.press('Escape');
    });

    test('a note with a quick assistant suggestion', async () => {
      await page.locator('.tree-row[title="notes"]').click();
      await page.locator(`.tree-row[title="notes/${pt ? 'ideias-de-teste' : 'test-ideas'}.md"]`).click();
      const note = page.locator('.note-dialog').last();
      const group = note.getByRole('group', { name: pt ? 'Assistentes rápidos' : 'Quick assistants' });
      const write = group.getByRole('button', { name: pt ? 'Melhorar a escrita' : 'Improve the writing' });
      if (!(await write.isVisible())) await group.locator('.note-assist-mark').click();
      await write.click();
      const panel = note.getByRole('region', { name: pt ? 'Assistentes rápidos' : 'Quick assistants' });
      await panel.getByRole('tab', { name: pt ? 'Diferenças' : 'Differences' }).click();
      await shot('note-assistant', note);
      await panel.getByRole('button', { name: pt ? 'Descartar' : 'Discard' }).click();
      await page.keyboard.press('Escape');
    });

    test('Hudson organizing the files a run left', async () => {
      await page.locator('.tree-row[title="runs"]').click({ button: 'right' });
      await page.getByRole('menuitem', { name: pt ? 'Organizar com o Hudson' : 'Organize with Hudson' }).click();
      const dialog = page.getByRole('dialog', { name: pt ? 'Organizar com o Hudson' : 'Organize with Hudson' });
      await expect(dialog.locator('.hudson-group').first()).toBeVisible();
      await shot('hudson', dialog);
      await page.keyboard.press('Escape');
    });
  });
}
