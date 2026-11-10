// Exercise project links with real documents and the real IPC bridge in an isolated fixture.
import { test, expect, type ElectronApplication } from '@playwright/test';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { addComment } from '../../app/src/md-comments.ts';
import { pdfScript, toComments } from '../../desktop/pdfcraft.ts';
import { runPdfLocal } from '../../desktop/pdf-local.ts';
import { launchMoki } from './launch.ts';

test('project links navigate headings, Markdown and PDF comments, pages and note mentions without rewriting sources', async ({}, info) => {
  const root = mkdtempSync(join(tmpdir(), 'moki-links-'));
  const profile = mkdtempSync(join(tmpdir(), 'moki-links-profile-'));
  const project = join(root, 'workspace', 'projects', 'acme');
  let app: ElectronApplication | undefined;
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
    for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
    cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
    const config = JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'));
    writeFileSync(join(project, 'project.json'), JSON.stringify({ ...config, project: 'acme', name: 'Link navigation' }));
    for (const dir of ['inbox', 'notes', 'runs']) mkdirSync(join(project, dir), { recursive: true });
    const source = '# Story\n\n' + 'A paragraph for scrolling.\n\n'.repeat(28) + '## Regras de frete\n\nConfirm the delivery rule.\n\n[Top](#story)\n';
    const at = source.indexOf('delivery rule');
    const story = addComment(source, at, at + 13, { author: 'Ana', at: '2026-11-01T10:00:00Z', text: 'Check the boundary', color: 'yellow' }, 'rule1').text;
    writeFileSync(join(project, 'inbox', 'story.md'), story);
    const pdf = await PDFDocument.create();
    for (let n = 1; n <= 3; n++) pdf.addPage().drawText(`Evidence page ${n}`, { x: 72, y: 700 });
    writeFileSync(join(project, 'inbox', 'evidence.pdf'), await pdf.save());
    const comments = toComments((await runPdfLocal(pdfScript('inbox/evidence.pdf', { op: 'highlight', marks: [{ page: 3, quads: [[72, 76, 220, 76, 72, 96, 220, 96]] }], contents: 'Inspect this evidence', color: 'yellow' }, 'Ana'), project)).at(-1));
    const pdfId = encodeURIComponent(comments[0].id);
    const report = '# Review\n\n[Rules](inbox/story.md#regras-de-frete)\n\n[MD comment](inbox/story.md#comment-rule1)\n\n[PDF page](inbox/evidence.pdf#page=2)\n\n[PDF comment](inbox/evidence.pdf#comment-' + pdfId + ')\n\n[Missing section](inbox/story.md#absent)\n\n[Other project](workspace/projects/other/inbox/story.md)\n\nBare inbox/story.md and `inbox/story.md` and absent.md and ana@example.com.\n\n```text\ninbox/story.md\n```\n';
    writeFileSync(join(project, 'review.md'), report);
    writeFileSync(join(project, 'inbox', 'editor.md'), '# Editor\n\n[Rules](story.md#regras-de-frete)\n');
    writeFileSync(join(project, 'notes', 'legacy.md'), '# A note\n\n[@story](inbox/story.md#regras-de-frete)\n');
    app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: profile, QA_OPEN_PROJECT: 'acme' });
    const view = await app.firstWindow();
    const errors: string[] = [];
    view.on('pageerror', (e) => errors.push(e.message));
    await view.evaluate(() => { localStorage.setItem('qa-ui-language', 'en'); });
    await view.reload();
    await view.locator('.tree-row[title="inbox"]').click();
    await view.locator('.tree-row[title="inbox/editor.md"]').click();
    await expect(view.locator('.doc .ProseMirror')).toContainText('Editor');
    // Formatted-editor Ctrl+click uses the same resolver as the reading view.
    await view.locator('.doc .ProseMirror a', { hasText: 'Rules' }).click({ modifiers: ['Control'] });
    await expect(view.locator('h2[data-link-target]')).toHaveText('Regras de frete');
    await view.locator('.tree-row[title=".other"]').click();
    await view.locator('.tree-row[title="review.md"]').click();
    await expect(view.locator('.doc')).toContainText('Review');
    const openReview = async () => {
      await view.locator('.pane-tabs .tab', { hasText: 'review.md' }).click();
      const reader = view.getByRole('button', { name: 'Reading view', exact: true });
      if (await reader.count() && await reader.getAttribute('aria-pressed') !== 'true') await reader.click();
    };
    await openReview();
    await expect(view.locator('.doc a[data-internal-link]')).toHaveCount(2);
    await expect(view.locator('.doc pre a')).toHaveCount(0);
    await view.getByRole('link', { name: 'MD comment', exact: true }).click();
    await expect(view.locator('[data-card="rule1"][data-link-target]')).toBeInViewport();
    await expect(view.getByRole('button', { name: 'Copy link to comment' })).toHaveCount(0); // a comment has no copy link
    await expect.poll(() => view.locator('.doc-body').evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    await view.getByRole('link', { name: 'Top', exact: true }).click();
    await expect(view.locator('h1[data-link-target]')).toHaveText('Story');
    await openReview();
    await view.getByRole('link', { name: 'Rules', exact: true }).click();
    await expect(view.locator('h2[data-link-target]')).toBeVisible();
    await openReview();
    await view.getByRole('link', { name: 'PDF page', exact: true }).click();
    await expect(view.locator('.pdf-page[data-page="2"][data-link-target]')).toBeVisible();
    await expect.poll(() => view.locator('.pdf-scroll').evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    await openReview();
    await view.getByRole('link', { name: 'PDF comment', exact: true }).click();
    await expect(view.locator('.pdf-card[data-link-target]')).toContainText('Inspect this evidence');
    await expect(view.locator('.pdf-card[data-link-target]')).toBeInViewport();
    await expect(view.getByRole('button', { name: 'Copy link to comment' })).toHaveCount(0); // a comment has no copy link
    await openReview();
    await view.getByRole('link', { name: 'Other project', exact: true }).click();
    await expect(view.getByText('This link does not point to a file in this project.', { exact: true })).toBeVisible();
    await view.getByRole('link', { name: 'Missing section', exact: true }).click();
    await expect(view.getByText('The referenced section, comment or page was not found.', { exact: true })).toBeVisible();
    await openReview();
    for (const theme of ['light', 'dark']) {
      await view.evaluate((mode) => { document.documentElement.dataset.theme = mode; document.documentElement.dataset.docTheme = mode; }, theme);
      await view.screenshot({ path: info.outputPath(`links-${theme}.png`) });
    }
    // Legacy project-root note mentions still resolve from notes/.
    await view.locator('.tree-row[title="notes"]').click();
    await view.locator('.tree-row[title="notes/legacy.md"]').click();
    await view.locator('.note-host .ProseMirror a').click({ modifiers: ['Control'] });
    await expect(view.locator('h2[data-link-target]')).toBeVisible();
    await view.locator('.tree-row[title="inbox/story.md"]').click({ button: 'right' });
    await view.getByRole('menuitem', { name: 'Copy link', exact: true }).click();
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe('[story.md](/inbox/story.md)');
    // A freshly inserted @ mention writes a document-relative destination.
    await view.locator('.tree-row[title="notes/legacy.md"]').click();
    await view.locator('.note-host .tiptap-body').click();
    await view.keyboard.press('Control+e'); // the note's Markdown source
    const noteSource = view.locator('.note-host textarea.note-editor');
    await noteSource.click();
    await noteSource.press('Control+End');
    await noteSource.pressSequentially('\n\n@story');
    await view.getByRole('option').filter({ hasText: 'inbox/story.md' }).click();
    await expect(noteSource).toHaveValue(/\[@story.md\]\(\.\.\/inbox\/story.md\)/);
    await view.locator('.note-host').getByRole('button', { name: /Close/, exact: false }).first().click();
    // A real shell prints a link. Plain click does not navigate; Ctrl+click does.
    await view.getByTitle('New: terminal, AI or file', { exact: true }).click();
    await view.getByRole('menuitem', { name: 'Terminal', exact: true }).click();
    await view.getByRole('menuitem', { name: /your shell/ }).click();
    const input = view.locator('.term-pane:not([hidden]) .xterm-helper-textarea');
    await input.pressSequentially('echo inbox/story.md#regras-de-frete');
    await input.press('Enter');
    const output = view.locator('.term-pane:not([hidden]) .xterm-rows > div').filter({ hasText: /^inbox\/story.md#regras-de-frete/ }).last();
    await expect(output).toBeVisible();
    const lineBox = await output.boundingBox();
    if (!lineBox) throw new Error('The terminal output has no screen position.');
    // xterm receives pointer events on its screen overlay, above the text rows.
    await view.mouse.move(lineBox.x + 35, lineBox.y + lineBox.height / 2);
    await view.mouse.click(lineBox.x + 35, lineBox.y + lineBox.height / 2);
    await expect(input).toBeVisible();
    await view.keyboard.down('Control');
    await view.mouse.click(lineBox.x + 35, lineBox.y + lineBox.height / 2);
    await view.keyboard.up('Control');
    await expect(view.locator('h2[data-link-target]')).toBeInViewport();
    expect(readFileSync(join(project, 'review.md'), 'utf8')).toBe(report);
    expect(readFileSync(join(project, 'inbox', 'story.md'), 'utf8')).toBe(story);
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(root, { recursive: true, force: true });
    rmSync(profile, { recursive: true, force: true });
  }
});
