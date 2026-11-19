// Accounts in Settings › My AIs: the Claude and Codex profiles of a made-up user folder (QA_HOME) named by e-mail,
// one block per AI; choosing one sets that AI's variable for everything started afterwards and is remembered;
// hiding keeps the folder; a new account opens the AI in a terminal to sign in. QA_FAKE_TOOLS fakes the AI tools.
import { test, expect, type ElectronApplication } from '@playwright/test';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

const jwt = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;

test('AI accounts: one block per AI, choose and remember, hide, and add one that opens the AI to sign in', async () => {
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
    mkdirSync(join(home, '.codex'));
    writeFileSync(join(home, '.codex', 'auth.json'), JSON.stringify({ tokens: { id_token: jwt({ email: 'gpt@example.com' }) } }));
    mkdirSync(join(home, '.codex-cliente'));
    writeFileSync(join(home, '.codex-cliente', 'auth.json'), JSON.stringify({ tokens: { id_token: jwt({ email: 'cliente@example.com' }) } }));

    app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: join(root, 'profile'), QA_OPEN_PROJECT: 'acme', QA_FAKE_TOOLS: '1', QA_HOME: home, CLAUDE_CONFIG_DIR: '', CODEX_HOME: '' });
    const page = await app.firstWindow();
    await page.evaluate(() => localStorage.setItem('qa-ui-language', 'en'));
    await page.reload();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const envOf = (name: string) => app!.evaluate((_electron, key) => process.env[key] ?? '', name);

    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('tab', { name: 'My AIs', exact: true }).click();
    const claude = page.getByRole('radiogroup', { name: 'Claude account' });
    const codex = page.getByRole('radiogroup', { name: 'ChatGPT (Codex) account' });
    await expect(claude.getByRole('radio')).toHaveCount(2);
    await expect(codex.getByRole('radio')).toHaveCount(2);
    await expect(claude.getByRole('radio', { name: /main@example\.com/ })).toBeChecked();
    await expect(codex.getByRole('radio', { name: /gpt@example\.com/ })).toBeChecked();

    // Each AI on its own: its variable is set for what starts afterwards, and the choice is remembered.
    await claude.getByText('work@example.com').click();
    await codex.getByText('cliente@example.com').click();
    await expect(codex.getByRole('radio', { name: /cliente@example\.com/ })).toBeChecked();
    expect(await envOf('CLAUDE_CONFIG_DIR')).toBe(join(home, '.claude-work'));
    expect(await envOf('CODEX_HOME')).toBe(join(home, '.codex-cliente'));
    expect(JSON.parse(readFileSync(join(root, 'workspaces', 'ai-accounts.json'), 'utf8')).active).toEqual({ claude: '.claude-work', codex: '.codex-cliente' });

    // Hiding an account not in use: out of the list, its folder stays, and "Show hidden" brings it back.
    await page.getByRole('button', { name: 'Hide main@example.com from Moki' }).click();
    await expect(claude.getByRole('radio')).toHaveCount(1);
    expect(existsSync(join(home, '.claude'))).toBe(true);
    await page.getByRole('button', { name: 'Show hidden (1)' }).click();
    await expect(claude.getByRole('radio')).toHaveCount(2);

    const section = page.locator('.ai-accounts-section');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      const width = await section.evaluate((el) => ({ own: el.clientWidth, scroll: el.scrollWidth, grid: (document.querySelector('.ai-grid') as HTMLElement).clientWidth }));
      expect(width.scroll).toBeLessThanOrEqual(width.own + 1);
      expect(Math.abs(width.own - width.grid)).toBeLessThanOrEqual(2); // as wide as the AI cards above it
      if (process.env.QA_UI_INSPECTION) await page.screenshot({ path: join(realpathSync(process.env.QA_UI_INSPECTION), `ai-accounts-${theme}.png`), fullPage: true });
    }

    // A new Codex account: an empty profile, made active, and Codex opens in a terminal tab to sign in.
    await page.getByRole('button', { name: 'Add ChatGPT (Codex) account', exact: true }).click();
    await page.getByRole('textbox', { name: 'Account name', exact: true }).fill('Pessoal');
    await page.getByRole('button', { name: 'Create and sign in', exact: true }).click();
    await expect(page.locator('.term-pane:not([hidden])')).toContainText('[ready]');
    expect(existsSync(join(home, '.codex-pessoal'))).toBe(true);
    expect(await envOf('CODEX_HOME')).toBe(join(home, '.codex-pessoal'));
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
});
