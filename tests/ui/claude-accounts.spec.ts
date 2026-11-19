// Claude accounts in Settings › My AIs: the profiles of a made-up user folder (QA_HOME) named by e-mail, choosing one
// sets CLAUDE_CONFIG_DIR for every Claude started afterwards and is remembered, and a new account opens Claude in a
// terminal to sign in. QA_FAKE_TOOLS fakes the AI tools; nothing signs in for real.
import { test, expect, type ElectronApplication } from '@playwright/test';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

test('Claude accounts: choose one, remember it and add another that opens Claude to sign in', async () => {
  const root = mkdtempSync(join(realpathSync(tmpdir()), 'moki-accounts-ui-'));
  const home = join(root, 'home');
  let app: ElectronApplication | undefined;
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
    for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
    const project = join(root, 'workspace', 'projects', 'acme');
    cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
    const config = JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'));
    writeFileSync(join(project, 'project.json'), JSON.stringify({ ...config, project: 'acme', name: 'Accounts project' }));
    mkdirSync(join(home, '.claude'), { recursive: true });
    writeFileSync(join(home, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'main@example.com' } }));
    mkdirSync(join(home, '.claude-work'));
    writeFileSync(join(home, '.claude-work', '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'work@example.com' } }));

    app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: join(root, 'profile'), QA_OPEN_PROJECT: 'acme', QA_FAKE_TOOLS: '1', QA_HOME: home, CLAUDE_CONFIG_DIR: '' });
    const page = await app.firstWindow();
    await page.evaluate(() => localStorage.setItem('qa-ui-language', 'en'));
    await page.reload();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const configDir = () => app!.evaluate(() => process.env.CLAUDE_CONFIG_DIR ?? '');

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('tab', { name: 'My AIs', exact: true }).click();
    const accounts = page.getByRole('radiogroup', { name: 'Claude account' });
    await expect(accounts.getByRole('radio')).toHaveCount(2);
    await expect(accounts.getByRole('radio', { name: /main@example\.com/ })).toBeChecked();
    expect(await configDir()).toBe('');

    // Another account: every Claude started from now on gets its folder, and the choice is remembered.
    await accounts.getByText('work@example.com').click();
    await expect(accounts.getByRole('radio', { name: /work@example\.com/ })).toBeChecked();
    expect(await configDir()).toBe(join(home, '.claude-work'));
    expect(JSON.parse(readFileSync(join(root, 'workspaces', 'claude-profile.json'), 'utf8'))).toEqual({ profile: '.claude-work' });

    const section = page.locator('.claude-accounts-section');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      const width = await section.evaluate((el) => ({ own: el.clientWidth, scroll: el.scrollWidth }));
      expect(width.scroll).toBeLessThanOrEqual(width.own + 1);
      if (process.env.QA_UI_INSPECTION) await page.screenshot({ path: join(realpathSync(process.env.QA_UI_INSPECTION), `claude-accounts-${theme}.png`) });
    }

    // A new account: an empty profile, made active, and Claude opens in a terminal tab to sign in.
    await page.getByRole('button', { name: 'Add account', exact: true }).click();
    await page.getByRole('textbox', { name: 'Account name', exact: true }).fill('Cliente');
    await page.getByRole('button', { name: 'Create and sign in', exact: true }).click();
    await expect(page.locator('.term-pane:not([hidden])')).toContainText('[ready]');
    expect(existsSync(join(home, '.claude-cliente'))).toBe(true);
    expect(await configDir()).toBe(join(home, '.claude-cliente'));
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
  }
});
