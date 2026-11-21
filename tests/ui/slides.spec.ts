import { test, expect, type ElectronApplication } from '@playwright/test';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';
import { pptx, SAMPLE_DECK } from '../pptx-fixture.ts';

test('a .pptx opens as slides (thumbnails, navigation, notes) and a large exported page still previews', async () => {
  test.setTimeout(180000);
  const root = mkdtempSync(join(tmpdir(), 'moki-slides-')), profile = mkdtempSync(join(tmpdir(), 'moki-slides-profile-'));
  const project = join(root, 'workspace', 'projects', 'acme'), inbox = join(project, 'inbox');
  let app: ElectronApplication | undefined;
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
    for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
    cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
    const config = JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'));
    writeFileSync(join(project, 'project.json'), JSON.stringify({ ...config, project: 'acme', name: 'Slides' }));
    mkdirSync(inbox, { recursive: true });
    const deck = pptx(SAMPLE_DECK);
    writeFileSync(join(inbox, 'deck.pptx'), deck);
    writeFileSync(join(inbox, 'export.html'), `<h1 id="title">Exported prototype</h1><button id="b">Count 0</button><script>let n=0;b.onclick=()=>b.textContent='Count '+(++n);/*${'x'.repeat(3 * 1024 * 1024)}*/</script>`);
    app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: profile, QA_OPEN_PROJECT: 'acme', QA_FAKE_TOOLS: '1' });
    const view = await app.firstWindow();
    await view.evaluate(() => localStorage.setItem('qa-ui-language', 'en')); await view.reload();
    const errors: string[] = []; view.on('pageerror', (e) => errors.push(e.message));
    await view.locator('.tree-row[title="inbox"]').click();

    await view.locator('.tree-row[title="inbox/deck.pptx"]').click();
    const slides = view.locator('.slides-view');
    await expect(slides.locator('.slides-thumb')).toHaveCount(3);
    await expect(slides.getByRole('status').filter({ hasText: /^Slide/ })).toHaveText('Slide 1 of 3');
    const stage = slides.locator('.slides-stage');
    await expect(stage).toContainText('Projeto Libélula');
    await expect(stage).toContainText('Forma laranja');
    await expect(slides.locator('.slides-notes')).toHaveText('Falar sobre o objetivo.');
    // The text keeps its size from the file: 44 pt title, scaled with the slide.
    await expect(stage.locator('span', { hasText: 'Projeto' }).first()).toHaveCSS('font-size', '58.6667px');

    await slides.focus();
    await view.keyboard.press('ArrowRight');
    await expect(slides.getByRole('status').filter({ hasText: /^Slide/ })).toHaveText('Slide 2 of 3');
    await expect(stage).toContainText('Primeiro ponto');
    await expect(slides.locator('.slides-notes')).toHaveCount(0); // this slide has no notes
    await slides.getByRole('button', { name: 'Slide 3', exact: true }).click();
    await expect(stage.locator('table td')).toHaveText(['Item', 'Status', 'Login', 'OK']);
    await expect(slides.getByRole('button', { name: 'Next slide' })).toBeDisabled();
    await view.keyboard.press('Home');
    await expect(slides.getByRole('status').filter({ hasText: /^Slide/ })).toHaveText('Slide 1 of 3');
    await slides.getByRole('button', { name: 'Speaker notes' }).click();
    await expect(slides.locator('.slides-notes')).toHaveCount(0);
    // Present: the slides go full screen (the one permission the app grants itself), keys move on, Esc ends.
    await slides.getByRole('button', { name: 'Present' }).click();
    await expect(view.locator('.slides-show:fullscreen .slide-canvas')).toHaveCount(1);
    await expect(view.locator('.slides-show')).toContainText('Projeto Libélula');
    await view.keyboard.press('ArrowRight');
    await expect(view.locator('.slides-show')).toContainText('Primeiro ponto');
    await view.evaluate(() => document.exitFullscreen());
    await expect(view.locator('.slides-show:fullscreen')).toHaveCount(0);
    await expect(slides.getByRole('status').filter({ hasText: /^Slide/ })).toHaveText('Slide 2 of 3');
    expect(readFileSync(join(inbox, 'deck.pptx')).equals(deck), 'the presentation is never written').toBe(true);

    await view.locator('.tree-row[title="inbox/export.html"]').click();
    await expect(view.getByText('File too large to preview.')).toHaveCount(0);
    const page = view.frameLocator('.html-preview-stage iframe');
    await expect(page.locator('#title')).toHaveText('Exported prototype');
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  }
});
