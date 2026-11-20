// Editor-independent contract tests for native chat routing; never start a real AI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdeChatIntegration } from '../ide/vscode/chat-integrations.ts';
import type { IdeChatRequest } from '../ide/companion-types.ts';

const request: IdeChatRequest = { project: 'acme', folder: '/acme', ai: 'codex', prompt: 'Investigate the selected file.', requestId: 'a'.repeat(32) };
const command = 'workbench.action.chat.openNewSessionEditor.agent-host-codex';

test('native chat: one atomic new-session command, with no focus, clipboard or global submit', async () => {
  const calls: unknown[][] = [];
  const chat = createIdeChatIntegration({ version: '1.147.0', commands: async () => [command], current: () => true,
    execute: async (...args) => { calls.push(args); return { scheme: 'agent-host-codex', path: '/new-session' }; } });
  const capability = (await chat.capabilities()).find((c) => c.id === 'codex');
  assert.equal(capability?.automatic, true);
  const result = await chat.start(request);
  assert.deepEqual(calls, [[command, { prompt: request.prompt }]]);
  assert.equal(result.status, 'unconfirmed', 'an editor URI alone is not an execution acknowledgement');
  assert.equal(result.session, 'agent-host-codex:/new-session');
});

test('native chat: unsupported versions and commands never fall back to the active chat', async () => {
  for (const version of ['1.101.0', '1.146.9', 'unknown']) {
    const chat = createIdeChatIntegration({ version, commands: async () => [command, 'workbench.action.chat.open'], current: () => true,
      execute: async () => { assert.fail('must not dispatch'); } });
    assert.equal((await chat.start(request)).status, 'blocked');
  }
  const cursor = createIdeChatIntegration({ version: '1.147.0', commands: async () => ['cursor.newChat'], current: () => true,
    execute: async () => { assert.fail('must not dispatch'); } });
  assert.equal((await cursor.start({ ...request, ai: 'cursor' })).status, 'blocked');
});

test('native chat: changing the project while commands resolve blocks delivery', async () => {
  let finish: (value: string[]) => void = () => {};
  const pending = new Promise<string[]>((resolve) => { finish = resolve; });
  let current = true;
  const chat = createIdeChatIntegration({ version: '1.147.0', commands: () => pending, current: () => current,
    execute: async () => { assert.fail('must not dispatch'); } });
  const result = chat.start(request);
  current = false;
  finish([command]);
  assert.equal((await result).status, 'blocked');
});

test('native chat: an ambiguous workspace blocks dispatch even after a capability check', async () => {
  let ambiguous = false;
  const issue = 'Open this project\'s folder in its own IDE window to start a separate chat.';
  const chat = createIdeChatIntegration({ version: '1.147.0', commands: async () => [command], current: () => true,
    workspaceIssue: () => ambiguous ? issue : undefined, execute: async () => { assert.fail('must not dispatch in a different root'); } });
  assert.equal((await chat.capabilities()).find((c) => c.id === 'codex')?.automatic, true);
  ambiguous = true;
  const capability = (await chat.capabilities()).find((c) => c.id === 'codex');
  assert.equal(capability?.available, true);
  assert.equal(capability?.automatic, false);
  assert.equal((await chat.start(request)).message, issue);
});

test('native chat: uncertain delivery is reported once, with no automatic retry or raw error', async () => {
  let count = 0;
  const chat = createIdeChatIntegration({ version: '1.147.0', commands: async () => [command], current: () => true,
    execute: async () => { count++; throw new Error('private host details'); } });
  const result = await chat.start(request);
  assert.equal(result.status, 'unconfirmed');
  assert.equal(count, 1);
  assert.ok(!result.message.includes('private host details'));
});

test('native chat: each supported AI uses only its registered new-editor command', async () => {
  const cases = [['claude', 'agent-host-claude'], ['copilot', 'agent-host-copilotcli']] as const;
  for (const [ai, type] of cases) {
    const expected = `workbench.action.chat.openNewSessionEditor.${type}`;
    const chat = createIdeChatIntegration({ version: '1.147.0-insider', commands: async () => [expected], current: () => true,
      execute: async (actual) => { assert.equal(actual, expected); return { scheme: type, path: '/fresh' }; } });
    assert.equal((await chat.start({ ...request, ai })).status, 'unconfirmed');
  }
});
