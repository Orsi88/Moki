// Accounts of the AI tools: Claude Code and Codex profiles found in the user folder, the active one per AI applied
// to its environment variable and remembered, hiding, new accounts from a safe name. A made-up user folder stands in.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { accountOf, createAiAccounts, isAccountId, listAccounts } from '../desktop/ai-accounts.ts';

const jwt = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;

function home(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'moki-ai-accounts-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.claude'));
  writeFileSync(join(dir, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'main@example.com' } }));
  mkdirSync(join(dir, '.claude-work'));
  writeFileSync(join(dir, '.claude-work', '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'work@example.com' } }));
  writeFileSync(join(dir, '.claude-work', '.credentials.json'), '{}');
  mkdirSync(join(dir, '.codex'));
  writeFileSync(join(dir, '.codex', 'auth.json'), JSON.stringify({ tokens: { id_token: jwt({ email: 'gpt@example.com' }) } }));
  mkdirSync(join(dir, '.codex-cliente'));
  writeFileSync(join(dir, '.claude-file'), 'not a folder');
  mkdirSync(join(dir, '.codexx'));
  return { dir, settings: join(dir, 'moki', 'ai-accounts.json'), legacy: join(dir, 'moki', 'claude-profile.json') };
}

test('ai accounts: the default and every ~/.<tool>-<name> folder of Claude and Codex, named by the account e-mail', (t) => {
  const { dir } = home(t);
  assert.deepEqual(listAccounts('claude', dir, '.claude-work').map((a) => [a.id, a.name, a.signedIn, a.active]), [
    ['.claude', 'main@example.com', true, false], ['.claude-work', 'work@example.com', true, true],
  ]);
  assert.deepEqual(listAccounts('codex', dir, '.codex').map((a) => [a.id, a.name, a.signedIn, a.active]), [
    ['.codex', 'gpt@example.com', true, true], ['.codex-cliente', '.codex-cliente', false, false],
  ]);
  assert.ok(isAccountId('codex', '.codex-a1') && !isAccountId('codex', '.codexx') && !isAccountId('codex', '.claude') && !isAccountId('claude', '../.claude'));
});

test('ai accounts: choosing one sets that AI\'s variable, the default clears it, each AI on its own, kept after a restart', (t) => {
  const { dir, settings } = home(t);
  const env: NodeJS.ProcessEnv = {};
  const accounts = createAiAccounts(dir, settings, env);
  accounts.use('claude', '.claude-work');
  accounts.use('codex', '.codex-cliente');
  assert.equal(env.CLAUDE_CONFIG_DIR, join(dir, '.claude-work'));
  assert.equal(env.CODEX_HOME, join(dir, '.codex-cliente'));
  const later: NodeJS.ProcessEnv = {};
  const again = createAiAccounts(dir, settings, later);
  assert.deepEqual([again.active('claude'), again.active('codex')], ['.claude-work', '.codex-cliente']);
  assert.equal(later.CODEX_HOME, join(dir, '.codex-cliente'));
  accounts.use('codex', '.codex');
  assert.equal(env.CODEX_HOME, undefined);
  assert.equal(env.CLAUDE_CONFIG_DIR, join(dir, '.claude-work'), 'the other AI keeps its account');
  assert.throws(() => accounts.use('codex', '.codex-missing'), /Unknown account/);
  assert.throws(() => accounts.use('gemini', '.gemini'), /no accounts in Moki/);
});

test('ai accounts: the first version\'s Claude choice is kept; an outside folder set by the person is left as it is', (t) => {
  const { dir, settings, legacy } = home(t);
  mkdirSync(join(dir, 'moki'));
  writeFileSync(legacy, JSON.stringify({ profile: '.claude-work' }));
  const env: NodeJS.ProcessEnv = {};
  assert.equal(createAiAccounts(dir, settings, env, legacy).active('claude'), '.claude-work');
  assert.equal(env.CLAUDE_CONFIG_DIR, join(dir, '.claude-work'));
  const outside = { CODEX_HOME: join(tmpdir(), 'elsewhere') };
  const accounts = createAiAccounts(dir, join(dir, 'moki', 'other.json'), outside);
  assert.equal(outside.CODEX_HOME, join(tmpdir(), 'elsewhere'));
  assert.ok(accounts.list().find((g) => g.tool === 'codex')!.accounts.every((a) => !a.active));
  assert.equal(accountOf('codex', dir, undefined), '.codex');
});

test('ai accounts: hiding keeps the folder and never the account in use; a new account is an empty folder made active', (t) => {
  const { dir, settings } = home(t);
  const env: NodeJS.ProcessEnv = {};
  const accounts = createAiAccounts(dir, settings, env);
  assert.throws(() => accounts.hide('claude', '.claude', true), /before hiding the one in use/);
  const hidden = accounts.hide('claude', '.claude-work', true).find((g) => g.tool === 'claude')!;
  assert.equal(hidden.accounts.find((a) => a.id === '.claude-work')?.hidden, true);
  assert.ok(existsSync(join(dir, '.claude-work')));
  assert.deepEqual(JSON.parse(readFileSync(settings, 'utf8')).hidden.claude, ['.claude-work']);
  accounts.use('claude', '.claude-work');
  assert.equal(accounts.list().find((g) => g.tool === 'claude')!.accounts.find((a) => a.id === '.claude-work')?.hidden, false, 'using it shows it again');
  const added = accounts.add('codex', '  Trabalho Cliente ').find((g) => g.tool === 'codex')!;
  assert.ok(existsSync(join(dir, '.codex-trabalho-cliente')));
  assert.equal(added.accounts.find((a) => a.active)?.id, '.codex-trabalho-cliente');
  assert.equal(env.CODEX_HOME, join(dir, '.codex-trabalho-cliente'));
  assert.throws(() => accounts.add('codex', 'trabalho cliente'), /already an account/);
  for (const bad of ['', '../..', '***', 42]) assert.throws(() => accounts.add('claude', bad), /letters or numbers/);
});
