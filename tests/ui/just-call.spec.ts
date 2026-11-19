// "Just call" in Call…: the AI with the project context and no activity, agent or skill. It skips the inputs and the
// notes, opens the AI and leaves nothing in the panel's Activities. QA_FAKE_TOOLS fakes the AI tools.
import { test, expect, type ElectronApplication } from '@playwright/test';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

test('Just call opens the AI with the project context, without an activity and without tracking one', async () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'moki-just-call-'));
  let app: ElectronApplication | undefined;
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
    for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
    const project = join(root, 'workspace', 'projects', 'acme');
    cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
    const config = JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'));
    writeFileSync(join(project, 'project.json'), JSON.stringify({ ...config, project: 'acme', name: 'Call project' }));
    app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: join(root, 'profile'), QA_OPEN_PROJECT: 'acme', QA_FAKE_TOOLS: '1', CLAUDE_CONFIG_DIR: '' });
    const page = await app.firstWindow();
    await page.evaluate(() => localStorage.setItem('qa-ui-language', 'en'));
    await page.reload();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.getByRole('button', { name: 'Open in your AI tool', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const plain = dialog.getByRole('button', { name: /^Just call/ });
    await expect(plain).toBeVisible();
    // It is not an activity of the list (issue #46).
    await expect(dialog.locator('.invoke-row', { hasText: 'Just call' })).toHaveCount(0);
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      if (process.env.QA_UI_INSPECTION) await page.screenshot({ path: join(realpathSync(process.env.QA_UI_INSPECTION), `just-call-${theme}.png`) });
    }
    await plain.click();
    // Straight to where it opens: no files, agent or notes steps.
    await expect(dialog.getByRole('button', { name: /^New terminal/ })).toBeVisible();
    await dialog.getByRole('button', { name: /^New terminal/ }).click();
    await dialog.locator('.answer-list .answer').first().click();
    await expect(dialog.getByText('Just call')).toBeVisible(); // the review names it
    await dialog.getByRole('button', { name: /^Open in / }).click();
    // The request (QA_FAKE_TOOLS shows it instead of starting the AI): the plain call, and nothing about a run of its own.
    await expect(dialog.getByRole('status')).toContainText('This is a plain call, not an activity');
    await expect(dialog.getByRole('status')).not.toContainText('record the activity it came from');
    for (const row of ['Files', 'Who does it', 'Notes']) await expect(dialog.getByRole('button', { name: new RegExp(`^${row} `) })).toHaveCount(0);
    await expect(page.locator('.pp-activity')).toHaveCount(0); // nothing tracked in the panel's Activities
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
  }
});
