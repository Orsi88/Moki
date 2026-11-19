// Mycroft in the app (scripts/lib/evolution.ts, EvolutionPanel): a change Mycroft proposed for a built-in skill waits
// in the notification bell and on the skill's page with its difference; approving makes it version 1 in the
// workspace (Moki's file never changes); "Go back to this version" and "Restore the original" are new entries in
// the history, after a confirmation. The proposal is seeded through the library, as moki_propose_version does.
import { test, expect, type ElectronApplication } from '@playwright/test';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { learn, propose, activeFile, itemHistory } from '../../scripts/lib/evolution.ts';
import { evolutionItem } from '../../scripts/lib/evolution-check.ts';
import { launchMoki } from './launch.ts';

test('Mycroft: a proposal waits with its difference, approve, go back and restore the original', async () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'moki-evolution-ui-'));
  let app: ElectronApplication | undefined;
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
    for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
    const project = join(root, 'workspace', 'projects', 'acme');
    cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
    const config = JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'));
    writeFileSync(join(project, 'project.json'), JSON.stringify({ ...config, project: 'acme', name: 'Evolution project' }));

    const item = evolutionItem('skill', 'test-design', root);
    const original = readFileSync(item.file, 'utf8');
    const lesson = learn({ kind: 'skill', name: 'test-design', text: 'Number the test cases TC-001, TC-002…' }, root);
    const text = original.replace('## Rules and constraints\n', '## Rules and constraints\n\n- Number the test cases TC-001, TC-002, in order.\n');
    expect(text).not.toBe(original);
    propose(item, { text, reason: 'You asked to number the test cases TC-001, TC-002.', learnings: [lesson.id] }, [], root);

    app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: join(root, 'profile'), QA_OPEN_PROJECT: 'acme', QA_FAKE_TOOLS: '1', CLAUDE_CONFIG_DIR: '' });
    const page = await app.firstWindow();
    await page.evaluate(() => localStorage.setItem('qa-ui-language', 'en'));
    await page.reload();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const shot = async (name: string) => {
      if (!process.env.QA_UI_INSPECTION) return;
      const png = await app!.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'));
      writeFileSync(join(realpathSync(process.env.QA_UI_INSPECTION), name), Buffer.from(png, 'base64'));
    };

    // The bell counts it and takes the person to the Skills tab.
    await page.getByRole('button', { name: 'Notifications' }).first().click();
    const waiting = page.getByRole('region', { name: 'Waiting for your approval' });
    await expect(waiting).toContainText('Mycroft has 1 improvement waiting for you');
    await waiting.getByRole('button', { name: /test-design/ }).click();
    await expect(page.getByRole('heading', { name: 'Skills', level: 1 })).toBeVisible();
    await page.locator('.skill-item', { hasText: 'Test design' }).first().click();

    const panel = page.getByRole('region', { name: 'Evolution' });
    await expect(panel.getByText('Original in use')).toBeVisible();
    await expect(panel.getByText('Waiting for you: a change proposed by Mycroft')).toBeVisible();
    await expect(panel.getByText('“Number the test cases TC-001, TC-002…”').first()).toBeVisible();
    await expect(panel.locator('.evolution-proposal .diff-added').first()).toContainText('Number the test cases TC-001, TC-002, in order.');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      const size = await panel.evaluate((el) => ({ own: el.clientWidth, scroll: el.scrollWidth }));
      expect(size.scroll).toBeLessThanOrEqual(size.own + 1);
      await panel.scrollIntoViewIfNeeded();
      await shot(`evolution-proposal-${theme}.png`);
    }
    await page.evaluate(() => { delete document.documentElement.dataset.theme; });

    // Approve: version 1 in the workspace, Moki's own file unchanged, the learning answered.
    await panel.getByRole('button', { name: 'Approve' }).click();
    await expect(panel.getByText('Version 1 in use')).toBeVisible();
    await expect(panel.getByText('Waiting for you: a change proposed by Mycroft')).toHaveCount(0);
    expect(readFileSync(item.file, 'utf8')).toBe(original);
    expect(readFileSync(activeFile(item, root)!, 'utf8')).toBe(text);
    await expect(panel.getByText('Proposed by Mycroft', { exact: false })).toBeVisible();

    // The difference of version 1, then restore the original (after confirming): a new entry, nothing deleted.
    await panel.getByRole('button', { name: 'View the difference' }).click();
    await expect(panel.getByRole('heading', { name: 'Version 1: what changed' })).toBeVisible();
    await panel.getByRole('button', { name: 'Restore the original' }).click();
    await panel.getByRole('button', { name: 'Confirm: restore the original' }).click();
    await expect(panel.getByText('Original in use')).toBeVisible();
    await expect(panel.getByText('Original restored', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Notifications' }).first().click();
    await expect(page.getByRole('region', { name: 'Waiting for your approval' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    expect(activeFile(item, root)).toBeNull();

    // Go back to version 1: confirmed, it is version 1's text in use again, as a new entry.
    await panel.getByRole('button', { name: 'Go back to this version' }).click();
    await panel.getByRole('button', { name: 'Confirm: use version 1' }).click();
    await expect(panel.getByText(/Version \d in use/)).toBeVisible();
    expect(readFileSync(activeFile(item, root)!, 'utf8')).toBe(text);
    expect(itemHistory('skill', 'test-design', root).entries.map((e) => e.event)).toEqual(['version', 'restore', 'revert']);
    await panel.scrollIntoViewIfNeeded();
    await shot('evolution-history.png');
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
});
