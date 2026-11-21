import { test, expect, type ElectronApplication } from '@playwright/test';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';
import { pptx, SAMPLE_DECK } from '../pptx-fixture.ts';
import { deckNotes } from '../../scripts/lib/office-slides.ts';

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
    await expect(slides.locator('.slides-notes textarea')).toHaveValue('Falar sobre o objetivo.');
    // The text keeps its size from the file: 44 pt title, scaled with the slide.
    await expect(stage.locator('span', { hasText: 'Projeto' }).first()).toHaveCSS('font-size', '58.6667px');

    await slides.focus();
    await view.keyboard.press('ArrowRight');
    await expect(slides.getByRole('status').filter({ hasText: /^Slide/ })).toHaveText('Slide 2 of 3');
    await expect(stage).toContainText('Primeiro ponto');
    // A slide without notes still shows the notes box, ready to write in.
    await expect(slides.locator('.slides-notes textarea')).toHaveValue('');
    await expect(slides.locator('.slides-notes textarea')).toHaveAttribute('placeholder', 'Click to add speaker notes');
    await slides.getByRole('button', { name: 'Slide 3', exact: true }).click();
    await expect(stage.locator('table td')).toHaveText(['Item', 'Status', 'Login', 'OK']);
    await expect(slides.getByRole('button', { name: 'Next slide' })).toBeDisabled();
    await view.keyboard.press('Home');
    await expect(slides.getByRole('status').filter({ hasText: /^Slide/ })).toHaveText('Slide 1 of 3');
    await slides.getByRole('button', { name: 'Speaker notes' }).click();
    await expect(slides.locator('.slides-notes')).toHaveCount(0);
    // Present: an icon the size of the notes button (no text); the slides go full screen (the one permission the app
    // grants itself), keys move on, Esc ends.
    const presentButton = slides.getByRole('button', { name: 'Present', exact: true });
    await expect(presentButton).toHaveText('');
    const size = async (name: string) => { const b = await slides.getByRole('button', { name, exact: true }).boundingBox(); return [b?.width, b?.height]; };
    expect(await size('Present')).toEqual(await size('Speaker notes'));
    await presentButton.click();
    await expect(view.locator('.slides-show:fullscreen .slide-canvas')).toHaveCount(1);
    await expect(view.locator('.slides-show')).toContainText('Projeto Libélula');
    await view.keyboard.press('ArrowRight');
    await expect(view.locator('.slides-show')).toContainText('Primeiro ponto');
    await view.evaluate(() => document.exitFullscreen());
    await expect(view.locator('.slides-show:fullscreen')).toHaveCount(0);
    await expect(slides.getByRole('status').filter({ hasText: /^Slide/ })).toHaveText('Slide 2 of 3');
    expect(readFileSync(join(inbox, 'deck.pptx')).equals(deck), 'reading and presenting never write the presentation').toBe(true);

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

test('speaker notes are written into the .pptx, and areas of a slide (or the whole slide) are marked and commented', async () => {
  test.setTimeout(240000);
  const root = mkdtempSync(join(tmpdir(), 'moki-slide-notes-')), profile = mkdtempSync(join(tmpdir(), 'moki-slide-notes-profile-'));
  const project = join(root, 'workspace', 'projects', 'acme'), inbox = join(project, 'inbox'), file = join(inbox, 'deck.pptx');
  let app: ElectronApplication | undefined;
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
    for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
    cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
    const config = JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'));
    writeFileSync(join(project, 'project.json'), JSON.stringify({ ...config, project: 'acme', name: 'Slides' }));
    mkdirSync(inbox, { recursive: true });
    writeFileSync(file, pptx(SAMPLE_DECK));
    app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: profile, QA_OPEN_PROJECT: 'acme', QA_FAKE_TOOLS: '1' });
    const view = await app.firstWindow();
    await view.evaluate(() => { localStorage.setItem('qa-ui-language', 'en'); localStorage.setItem('qa-theme-settings', JSON.stringify({ mokiMode: 'light', documents: 'light', cli: 'dark' })); });
    await view.reload();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(1500, 940));
    const errors: string[] = []; view.on('pageerror', (e) => errors.push(e.message));
    const open = async () => {
      if (!(await view.locator('.tree-row[title="inbox/deck.pptx"]').isVisible())) await view.locator('.tree-row[title="inbox"]').click();
      await view.locator('.tree-row[title="inbox/deck.pptx"]').click();
    };
    await open();
    const slides = view.locator('.slides-view');
    await expect(slides.locator('.slides-thumb')).toHaveCount(3);
    const saved = () => deckNotes(readFileSync(file));
    const counter = slides.getByRole('status').filter({ hasText: /^Slide/ });
    const shot = async (name: string) => {
      await view.waitForTimeout(500);
      const png = await app!.evaluate(async ({ BrowserWindow }) => { const web = BrowserWindow.getAllWindows()[0].webContents; await web.capturePage(); return (await web.capturePage()).toPNG().toString('base64'); });
      writeFileSync(test.info().outputPath(name), Buffer.from(png, 'base64'));
    };

    // Notes: typed on slide 2 (which had none), saved after a pause; arrow keys move in the text, not to another slide.
    await slides.getByRole('button', { name: 'Slide 2', exact: true }).click();
    const notes = slides.locator('.slides-notes textarea');
    await notes.click();
    await view.keyboard.type('Explicar os dois pontos');
    await view.keyboard.press('ArrowLeft');
    await expect(counter).toHaveText('Slide 2 of 3');
    await expect.poll(() => saved().slides[1].notes, { timeout: 15000 }).toBe('Explicar os dois pontos');
    // An edit of slide 1's notes is saved too when moving to another slide before the pause ends.
    await slides.getByRole('button', { name: 'Slide 1', exact: true }).click();
    await notes.fill('Falar sobre o objetivo.\nE sobre o prazo.');
    await slides.getByRole('button', { name: 'Slide 3', exact: true }).click();
    await expect.poll(() => saved().slides[0].notes, { timeout: 15000 }).toBe('Falar sobre o objetivo.\nE sobre o prazo.');
    await expect(notes).toHaveValue('');

    // Mark an area of slide 1: drag, then Comment, write and add. It shows on the slide and beside it.
    await slides.getByRole('button', { name: 'Slide 1', exact: true }).click();
    await expect(notes).toHaveValue('Falar sobre o objetivo.\nE sobre o prazo.');
    await slides.getByRole('button', { name: 'Mark an area' }).click();
    const box = (await slides.locator('.slides-current').boundingBox())!;
    await view.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
    await view.mouse.down();
    await view.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.65, { steps: 6 });
    await view.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.8, { steps: 6 });
    await view.mouse.up();
    await view.locator('.marker-context button').first().click(); // Comment
    await view.locator('.pdf-composer textarea').fill('A forma laranja está cortada');
    await shot('slides-composer-light.png');
    await view.getByRole('button', { name: 'Add the comment' }).click();
    await expect(slides.locator('.md-card')).toHaveCount(1);
    await expect(slides.locator('.md-card')).toContainText('A forma laranja está cortada');
    await expect(slides.locator('.slide-mark')).toHaveCount(1);
    await expect.poll(() => saved().slides[0].comments.map((c) => c.text), { timeout: 15000 }).toEqual(['A forma laranja está cortada']);
    const area = saved().slides[0].comments[0].area!;
    expect(area.x).toBeCloseTo(0.6, 1); expect(area.y).toBeCloseTo(0.5, 1); expect(area.w).toBeCloseTo(0.25, 1); expect(area.h).toBeCloseTo(0.3, 1);
    await expect(slides.locator('.slides-thumb').first()).toHaveAttribute('title', 'Comments: 1');

    // Right-click: a comment on the whole slide; then a reply.
    await slides.locator('.slides-current').click({ button: 'right', position: { x: 40, y: 40 } });
    await view.locator('.marker-context button').first().click();
    await view.locator('.pdf-composer textarea').fill('Slide bom no geral');
    await view.getByRole('button', { name: 'Add the comment' }).click();
    await expect(slides.locator('.md-card')).toHaveCount(2);
    await expect(slides.locator('.md-card', { hasText: 'Slide bom no geral' })).toContainText('The whole slide');
    await expect(slides.locator('.slide-mark')).toHaveCount(1); // the whole slide draws no box
    const orange = slides.locator('.md-card', { hasText: 'A forma laranja' });
    await orange.getByRole('button', { name: 'Reply' }).click();
    await orange.locator('textarea').fill('Vou ajustar');
    await orange.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => saved().slides[0].comments.map((c) => [c.text, c.replies?.map((r) => r.text) ?? []]), { timeout: 15000 })
      .toEqual([['A forma laranja está cortada', ['Vou ajustar']], ['Slide bom no geral', []]]);
    await expect(slides.getByRole('button', { name: 'Comments (2)' })).toBeVisible();

    await shot('slides-comments-light.png');
    await view.evaluate(() => localStorage.setItem('qa-theme-settings', JSON.stringify({ mokiMode: 'dark', documents: 'dark', cli: 'dark' })));
    await view.reload();
    await open();
    await expect(slides.locator('.md-card')).toHaveCount(2);
    await shot('slides-comments-dark.png');

    // Delete both: the comment parts leave the file.
    for (const text of ['Slide bom no geral', 'A forma laranja']) {
      await slides.locator('.md-card', { hasText: text }).getByRole('button', { name: 'Delete' }).click();
      await view.getByRole('alertdialog').getByRole('button', { name: 'Continue' }).click();
      await expect(slides.locator('.md-card', { hasText: text })).toHaveCount(0);
    }
    await expect.poll(() => saved().slides[0].comments.length, { timeout: 15000 }).toBe(0);
    await expect(slides.locator('.slide-mark')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  }
});
