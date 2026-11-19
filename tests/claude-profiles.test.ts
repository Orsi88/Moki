// Claude accounts: profiles found in the user folder, the active one applied to CLAUDE_CONFIG_DIR and remembered,
// new accounts made only from a safe name. A made-up user folder stands in for the person's.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClaudeProfiles, isProfileId, listClaudeProfiles, profileOf } from '../desktop/claude-profiles.ts';

function home(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'moki-claude-home-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, '.claude'));
  writeFileSync(join(dir, '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'main@example.com' } }));
  mkdirSync(join(dir, '.claude-work'));
  writeFileSync(join(dir, '.claude-work', '.claude.json'), JSON.stringify({ oauthAccount: { emailAddress: 'work@example.com' } }));
  writeFileSync(join(dir, '.claude-work', '.credentials.json'), '{}');
  writeFileSync(join(dir, '.claude-file'), 'not a folder');
  mkdirSync(join(dir, '.claude-'));
  mkdirSync(join(dir, '.claudette'));
  return { dir, settings: join(dir, 'moki', 'claude-profile.json') };
}

test('claude profiles: the default and every ~/.claude-<name> folder, named by the account e-mail', (t) => {
  const { dir } = home(t);
  mkdirSync(join(dir, '.claude-new'));
  assert.deepEqual(listClaudeProfiles(dir, '.claude-work'), [
    { id: '.claude', name: 'main@example.com', email: 'main@example.com', signedIn: true, active: false },
    { id: '.claude-new', name: '.claude-new', email: '', signedIn: false, active: false },
    { id: '.claude-work', name: 'work@example.com', email: 'work@example.com', signedIn: true, active: true },
  ]);
  assert.ok(isProfileId('.claude') && isProfileId('.claude-work') && !isProfileId('.claude-') && !isProfileId('../.claude') && !isProfileId('.claude-a/b'));
});

test('claude profiles: choosing one sets CLAUDE_CONFIG_DIR, the default clears it, and the choice survives a restart', (t) => {
  const { dir, settings } = home(t);
  const env: NodeJS.ProcessEnv = {};
  const profiles = createClaudeProfiles(dir, settings, env);
  assert.equal(profiles.active(), '.claude');
  assert.equal(env.CLAUDE_CONFIG_DIR, undefined);
  profiles.use('.claude-work');
  assert.equal(env.CLAUDE_CONFIG_DIR, join(dir, '.claude-work'));
  assert.deepEqual(JSON.parse(readFileSync(settings, 'utf8')), { profile: '.claude-work' });
  const later: NodeJS.ProcessEnv = {};
  assert.equal(createClaudeProfiles(dir, settings, later).active(), '.claude-work');
  assert.equal(later.CLAUDE_CONFIG_DIR, join(dir, '.claude-work'));
  profiles.use('.claude');
  assert.equal(env.CLAUDE_CONFIG_DIR, undefined);
  assert.throws(() => profiles.use('.claude-missing'), /Unknown Claude account/);
  assert.throws(() => profiles.use('../outside'), /Unknown Claude account/);
});

test('claude profiles: without a saved choice, the CLAUDE_CONFIG_DIR Moki started with is kept', (t) => {
  const { dir, settings } = home(t);
  const env: NodeJS.ProcessEnv = { CLAUDE_CONFIG_DIR: join(dir, '.claude-work') };
  assert.equal(createClaudeProfiles(dir, settings, env).active(), '.claude-work');
  assert.equal(profileOf(dir, undefined), '.claude');
  // A folder outside the user folder is the person's own setting: left as it is, and no profile is marked.
  const outside = { CLAUDE_CONFIG_DIR: join(tmpdir(), 'elsewhere') };
  const profiles = createClaudeProfiles(dir, settings, outside);
  assert.equal(outside.CLAUDE_CONFIG_DIR, join(tmpdir(), 'elsewhere'));
  assert.ok(profiles.list().every((p) => !p.active));
  // A saved profile whose folder is gone falls back to what Moki started with.
  mkdirSync(join(dir, 'moki'));
  writeFileSync(settings, JSON.stringify({ profile: '.claude-gone' }));
  assert.equal(createClaudeProfiles(dir, settings, {}).active(), '.claude');
});

test('claude profiles: a new account is an empty folder from a safe name, made active', (t) => {
  const { dir, settings } = home(t);
  const env: NodeJS.ProcessEnv = {};
  const profiles = createClaudeProfiles(dir, settings, env);
  const list = profiles.add('  Trabalho Cliente ');
  assert.ok(existsSync(join(dir, '.claude-trabalho-cliente')));
  assert.equal(list.find((p) => p.active)?.id, '.claude-trabalho-cliente');
  assert.equal(env.CLAUDE_CONFIG_DIR, join(dir, '.claude-trabalho-cliente'));
  assert.throws(() => profiles.add('trabalho cliente'), /already an account/);
  for (const bad of ['', '   ', '../..', '***', 42]) assert.throws(() => profiles.add(bad), /letters or numbers/);
});
