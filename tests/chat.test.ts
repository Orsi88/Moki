// Chat protocols, process lifecycle and project isolation; scripts stand in for real, billable AI tools.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { claudeAdapter, codexAdapter, createChatSession, toolSummary, type ChatEvent } from '../desktop/chat.ts';
import { CHATS_DIR, chatTranscript, isChatId, listChats, newChat, readChat, removeChat, saveChat } from '../desktop/chat-store.ts';
import { isArtifactUrl, isViewerUrl, viewerBounds } from '../desktop/artifact-viewer.ts';
import { createService } from '../desktop/service.ts';
import { searchWorkspace, searchWorkspaceExpanded } from '../desktop/search.ts';
import { createProject, buildStartPrompt } from '../scripts/lib/core.ts';
import { ROOT, setWorkspaceDir } from '../scripts/lib/repo.mjs';

const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
const emit = "const emit=x=>process.stdout.write(JSON.stringify(x)+'\\n');";
const reader = "require('node:readline').createInterface({input:process.stdin}).on('line',line=>{const message=JSON.parse(line).message.content;";
const init = "emit({type:'system',subtype:'init',session_id:'session-1'});";
const text = "emit({type:'stream_event',event:{type:'content_block_delta',delta:{type:'text_delta',text:message}}});";
const result = "emit({type:'result',subtype:'success'});";
const echo = `${emit}${init}${reader}${text}${result}});`;
const delay = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

async function until(check: () => boolean, timeout = 7000) {
  const end = Date.now() + timeout;
  while (!check()) { if (Date.now() > end) throw new Error('Chat test timed out.'); await delay(15); }
}
function temp(t: TestContext) {
  const base = realpathSync(tmpdir());
  const dir = mkdtempSync(join(base, 'moki-chat-test-'));
  t.after(async () => {
    const rel = relative(base, realpathSync(dir));
    assert.ok(rel && !rel.startsWith('..') && !isAbsolute(rel));
    // Windows releases the child's current directory asynchronously. Let its close event run between attempts.
    for (let attempt = 0; ; attempt++) {
      try { rmSync(dir, { recursive: true, force: true }); break; }
      catch (e) { if (attempt === 2) throw e; await delay(250); }
    }
  });
  return dir;
}
function rig(t: TestContext, script = echo, resume?: string, command?: (args: string[], n: number) => string) {
  const events: ChatEvent[] = [], starts: string[][] = [], setup: boolean[] = [];
  const session = createChatSession({ file: process.execPath, adapter: claudeAdapter, cwd: process.cwd(), env, sessionId: resume,
    setup: ({ lost }) => { setup.push(lost); return { contextFile: 'context.md', extra: [] }; },
    onEvent: (event) => events.push(event),
    command: (args) => { starts.push(args); return { file: process.execPath, args: ['-e', command?.(args, starts.length) ?? script] }; },
  });
  t.after(() => session.close());
  return { session, events, starts, setup, turns: () => events.filter((event) => event.kind === 'turn-end') };
}

test('chat: fixed Claude flags, UTF-8 stdin messages, resume and project arguments', () => {
  const args = claudeAdapter.args({ resume: 'session-1', contextFile: 'a path/context.md', extra: ['--mcp-config', 'mcp.json'], effort: 'high' });
  assert.ok(args.includes('--include-partial-messages') && args.includes('--dangerously-skip-permissions'));
  assert.equal(args[args.indexOf('--resume') + 1], 'session-1');
  assert.equal(args[args.indexOf('--append-system-prompt-file') + 1], 'a path/context.md');
  assert.deepEqual(args.slice(-2), ['--mcp-config', 'mcp.json']);
  assert.ok(!claudeAdapter.args({ contextFile: 'c.md', extra: [] }).includes('--resume'));
  const message = 'ação\n"quoted" & %PATH% $(command)';
  assert.equal(JSON.parse(claudeAdapter.encode(message)).message.content, message);
  assert.ok(!args.includes(message));
});

test('chat: the recorded Claude stream shapes yield text, tool progress and turn outcomes', () => {
  // Synthetic values, preserving the event shapes captured from Claude Code 2.1.327.
  const stream = [
    { type: 'system', subtype: 'init', session_id: 'session-1' },
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'be' } } },
    { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ta' } } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: 'inbox/note.txt' } }] } },
    { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'read-1', is_error: false }] } },
    { type: 'result', subtype: 'success', is_error: false, result: 'beta' },
  ];
  assert.deepEqual(stream.flatMap((line) => claudeAdapter.parse(JSON.stringify(line))), [
    { kind: 'session', id: 'session-1' }, { kind: 'text', delta: 'be' }, { kind: 'text', delta: 'ta' },
    { kind: 'tool', id: 'read-1', name: 'Read', summary: 'inbox/note.txt' }, { kind: 'tool-done', id: 'read-1', ok: true }, { kind: 'turn-end', ok: true },
  ]);
  assert.deepEqual(claudeAdapter.parse('{bad'), []);
  assert.deepEqual(claudeAdapter.parse(JSON.stringify({ ...stream[1], parent_tool_use_id: 'subagent-1' })), []);
  assert.deepEqual(claudeAdapter.parse(JSON.stringify({ type: 'rate_limit_event' })), []);
  assert.deepEqual(claudeAdapter.parse(JSON.stringify({ type: 'result', subtype: 'error', result: 'not logged in' })), [{ kind: 'turn-end', ok: false, error: 'not logged in' }]);
  assert.equal(toolSummary({ command: 'npm\n test' }), 'npm test');
  assert.equal(toolSummary({ prompt: 'x'.repeat(200) }).length, 120);
});

test('chat: two turns share one process, messages stay on stdin and overlapping sends are refused', async (t) => {
  const r = rig(t);
  r.session.send('ação\nfirst');
  assert.throws(() => r.session.send('overlap'), /Wait/);
  await until(() => r.turns().length === 1);
  r.session.send('second');
  await until(() => r.turns().length === 2);
  assert.equal(r.starts.length, 1);
  assert.equal(r.events.filter((e) => e.kind === 'text').map((e) => e.delta).join('|'), 'ação\nfirst|second');
  assert.ok(!r.session.busy());
  assert.equal(r.session.sessionId(), 'session-1');
});

test('chat: stopping a turn resumes its session on the next send', async (t) => {
  const r = rig(t, `${emit}${init}${reader}${text}if(message!=='wait'){${result}}});`);
  r.session.send('wait');
  await until(() => r.events.some((e) => e.kind === 'text'));
  r.session.stop();
  await until(() => r.turns().length === 1);
  assert.deepEqual(r.turns()[0], { kind: 'turn-end', ok: false, error: 'stopped' });
  r.session.send('continue');
  await until(() => r.turns().length === 2);
  assert.equal(r.starts[1][r.starts[1].indexOf('--resume') + 1], 'session-1');
});

test('chat: a lost resumed session retries once with the transcript, even after init', async (t) => {
  const lost = `${emit}${init}process.stderr.write('No conversation found with session ID old');process.exit(1);`;
  const r = rig(t, echo, 'old-session', (_args, n) => n === 1 ? lost : echo);
  r.session.send('retained message');
  await until(() => r.turns().length === 1);
  assert.deepEqual(r.setup, [false, true]);
  assert.ok(!r.starts[1].includes('--resume'));
  assert.deepEqual(r.events.filter((e) => e.kind === 'text'), [{ kind: 'text', delta: 'retained message' }]);
  assert.equal(r.turns()[0].kind, 'turn-end');
  assert.ok(r.turns()[0].kind === 'turn-end' && r.turns()[0].ok);
});

test('chat: stderr failures finish once, ordinary resumed errors do not wait for process exit', async (t) => {
  const r = rig(t, `${emit}${init}${reader}emit({type:'result',subtype:'error',result:'quota exceeded'});});`, 'session-1');
  r.session.send('hello');
  await until(() => r.turns().length === 1);
  assert.deepEqual(r.turns()[0], { kind: 'turn-end', ok: false, error: 'quota exceeded' });
  const dead = rig(t, "process.stderr.write('not logged in\\n');process.exit(2)");
  dead.session.send('hello');
  await until(() => dead.turns().length === 1);
  assert.match(JSON.stringify(dead.turns()), /not logged in/);
});

test('chat: incomplete stdout chunks and the last line without a newline are processed', async (t) => {
  const script = "process.stdin.once('data',()=>{process.stdout.write('{\"type\":\"res');setTimeout(()=>process.stdout.end('ult\",\"subtype\":\"success\"}'),20);process.stdin.destroy();});";
  const r = rig(t, script);
  r.session.send('hello');
  await until(() => r.turns().length === 1);
  assert.deepEqual(r.turns(), [{ kind: 'turn-end', ok: true }]);
});

test('chat: close is final, stops busy state and suppresses later events', async (t) => {
  const r = rig(t);
  r.session.send('hello');
  r.session.close();
  const count = r.events.length;
  await delay(100);
  assert.equal(r.events.length, count);
  assert.equal(r.session.busy(), false);
  assert.throws(() => r.session.send('again'), /closed/);
});

test('chat: missing sessions never start an unbounded retry loop', async (t) => {
  const r = rig(t, `${emit}${init}process.stderr.write('No conversation found with session ID old');process.exit(1);`, 'old-session');
  r.session.send('hello');
  await until(() => r.turns().length === 1);
  assert.equal(r.starts.length, 2);
  assert.ok(r.turns()[0].kind === 'turn-end' && !r.turns()[0].ok);
});

// A stand-in for codex exec: reads the whole message from stdin, answers with it and exits (one process per message).
const codexEmit = "const emit=x=>process.stdout.write(JSON.stringify(x)+'\\n');";
const codexEcho = `${codexEmit}let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{`
  + "emit({type:'thread.started',thread_id:'thread-1'});emit({type:'turn.started'});"
  + "emit({type:'item.completed',item:{id:'item_0',type:'agent_message',text:input}});emit({type:'turn.completed',usage:{}});});";
function codexRig(t: TestContext, script = codexEcho, resume?: string, command?: (args: string[], n: number) => string) {
  const contextFile = join(temp(t), 'context.md');
  writeFileSync(contextFile, 'Project: acme\n', 'utf8');
  const events: ChatEvent[] = [], starts: string[][] = [], setup: boolean[] = [];
  const session = createChatSession({ file: process.execPath, adapter: codexAdapter, cwd: process.cwd(), env, sessionId: resume,
    setup: ({ lost }) => { setup.push(lost); return { contextFile, extra: ['--no-daemon'] }; },
    onEvent: (event) => events.push(event),
    command: (args) => { starts.push(args); return { file: process.execPath, args: ['-e', command?.(args, starts.length) ?? script] }; },
  });
  t.after(() => session.close());
  return { session, events, starts, setup,
    texts: () => events.flatMap((e) => e.kind === 'text' ? [e.delta] : []), turns: () => events.filter((e) => e.kind === 'turn-end') };
}
const CONTEXT = '<project-context>\nProject: acme\n</project-context>\n\n';

test('chat: fixed Codex flags, global options before exec, resume by session and the message on stdin', () => {
  const fresh = codexAdapter.args({ contextFile: 'c.md', extra: ['--no-daemon', '-c', 'mcp_servers.moki.command="node"'], effort: 'max' });
  assert.deepEqual(fresh.slice(0, 3), ['--no-daemon', '-c', 'mcp_servers.moki.command="node"']);
  assert.ok(fresh.indexOf('model_reasoning_effort=xhigh') < fresh.indexOf('exec'));
  assert.ok(fresh.includes('--json') && fresh.includes('--dangerously-bypass-approvals-and-sandbox') && !fresh.includes('resume'));
  assert.equal(fresh.at(-1), '-');
  const resumed = codexAdapter.args({ resume: 'thread-1', contextFile: 'c.md', extra: [] });
  assert.deepEqual(resumed.slice(0, 2), ['exec', 'resume']);
  assert.deepEqual(resumed.slice(-2), ['thread-1', '-']);
  const message = 'ação\n"quoted" & %PATH% $(command)';
  assert.equal(codexAdapter.encode(message), message);
  assert.equal(codexAdapter.encode(message, 'Project: acme\n'), `${CONTEXT}${message}`);
  assert.ok(!fresh.includes(message));
});

test('chat: the recorded Codex event shapes yield whole messages, tool progress and turn outcomes', () => {
  // Synthetic values, preserving the event shapes captured from codex-cli 0.166.
  const stream = [
    { type: 'thread.started', thread_id: 'thread-1' },
    { type: 'turn.started' },
    { type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: 'Running it.' } },
    { type: 'item.started', item: { id: 'item_1', type: 'command_execution', command: 'npm\n test', aggregated_output: '', exit_code: null, status: 'in_progress' } },
    { type: 'item.completed', item: { id: 'item_1', type: 'command_execution', command: 'npm\n test', aggregated_output: 'ok', exit_code: 0, status: 'completed' } },
    { type: 'item.completed', item: { id: 'item_2', type: 'reasoning', text: 'hidden' } },
    { type: 'item.completed', item: { id: 'item_3', type: 'agent_message', text: 'OK' } },
    { type: 'turn.completed', usage: { input_tokens: 1 } },
  ];
  assert.deepEqual(stream.flatMap((line) => codexAdapter.parse(JSON.stringify(line))), [
    { kind: 'session', id: 'thread-1' }, { kind: 'text', delta: 'Running it.', whole: true },
    { kind: 'tool', id: 'item_1', name: 'Shell', summary: 'npm test' },
    { kind: 'tool', id: 'item_1', name: 'Shell', summary: 'npm test' }, { kind: 'tool-done', id: 'item_1', ok: true },
    { kind: 'text', delta: 'OK', whole: true }, { kind: 'turn-end', ok: true },
  ]);
  assert.deepEqual(codexAdapter.parse(JSON.stringify({ type: 'item.completed', item: { id: 'f', type: 'file_change', changes: [{ path: 'notes/a.md', kind: 'add' }], status: 'completed' } })),
    [{ kind: 'tool', id: 'f', name: 'Edit', summary: 'notes/a.md' }, { kind: 'tool-done', id: 'f', ok: true }]);
  assert.deepEqual(codexAdapter.parse(JSON.stringify({ type: 'item.completed', item: { id: 'c', type: 'command_execution', command: 'x', exit_code: 1, status: 'failed' } }))[1],
    { kind: 'tool-done', id: 'c', ok: false });
  assert.deepEqual(codexAdapter.parse(JSON.stringify({ type: 'turn.failed', error: { message: 'usage limit' } })), [{ kind: 'turn-end', ok: false, error: 'usage limit' }]);
  assert.deepEqual(codexAdapter.parse('{bad'), []);
  assert.ok(codexAdapter.lost('Error: thread/resume: thread/resume failed: no rollout found for thread id 0000 (code -32600)'));
});

test('chat: Codex runs one process per message, resumes its session and sends the context only to a new session', async (t) => {
  const r = codexRig(t);
  r.session.send('ação first');
  await until(() => r.turns().length === 1);
  assert.ok(!r.session.busy());
  r.session.send('second');
  await until(() => r.turns().length === 2);
  assert.equal(r.starts.length, 2);
  assert.ok(!r.starts[0].includes('resume'));
  assert.deepEqual(r.starts[1].slice(-2), ['thread-1', '-']);
  assert.deepEqual(r.texts(), [`${CONTEXT}ação first`, 'second']);
  assert.equal(r.session.sessionId(), 'thread-1');
});

test('chat: a lost Codex session starts over once with the context and the same message', async (t) => {
  const lost = "process.stdin.resume();process.stdin.on('end',()=>{process.stderr.write('Error: thread/resume: thread/resume failed: no rollout found for thread id old');process.exit(1);});";
  const r = codexRig(t, codexEcho, 'old-thread', (_args, n) => n === 1 ? lost : codexEcho);
  r.session.send('retained');
  await until(() => r.turns().length === 1);
  assert.deepEqual(r.setup, [false, true]);
  assert.ok(r.starts[0].includes('resume') && !r.starts[1].includes('resume'));
  assert.deepEqual(r.texts(), [`${CONTEXT}retained`]);
  assert.ok(r.turns()[0].kind === 'turn-end' && r.turns()[0].ok);
});

test('chat: stopping a Codex answer ends the turn and the next message resumes the session', async (t) => {
  const hang = `${codexEmit}process.stdin.resume();process.stdin.on('end',()=>{emit({type:'thread.started',thread_id:'thread-1'});setInterval(()=>{},1000);});`;
  const r = codexRig(t, codexEcho, undefined, (_args, n) => n === 1 ? hang : codexEcho);
  r.session.send('wait');
  await until(() => r.events.some((e) => e.kind === 'session'));
  r.session.stop();
  await until(() => r.turns().length === 1);
  assert.deepEqual(r.turns()[0], { kind: 'turn-end', ok: false, error: 'stopped' });
  r.session.send('continue');
  await until(() => r.turns().length === 2);
  assert.deepEqual(r.starts[1].slice(-2), ['thread-1', '-']);
});

test('chat: Windows npm wrappers preserve spaces, Unicode and literal shell metacharacters', { skip: process.platform !== 'win32' }, async (t) => {
  const root = temp(t);
  const driver = join(root, 'driver.cjs');
  const wrapper = join(root, 'tool & %MOKI_CHAT_TRAP% ! ação.cmd');
  const contextFile = 'a path/context & %MOKI_CHAT_TRAP% ! ação.md';
  writeFileSync(driver, `${emit}${reader}message=JSON.stringify(process.argv.slice(2));${text}${result}});`.replace('const message=', 'let message='));
  writeFileSync(wrapper, `@echo off\r\n"${process.execPath}" "${driver}" %*\r\n`);
  const events: ChatEvent[] = [];
  const session = createChatSession({ file: wrapper, adapter: claudeAdapter, cwd: process.cwd(), env: { ...env, MOKI_CHAT_TRAP: 'must-not-expand' },
    setup: () => ({ contextFile, extra: [] }), onEvent: (event) => events.push(event) });
  t.after(() => session.close());
  session.send('message stays off the command line');
  await until(() => events.some((event) => event.kind === 'turn-end'));
  assert.deepEqual(events.filter((event) => event.kind === 'turn-end'), [{ kind: 'turn-end', ok: true }]);
  const answer = events.find((event) => event.kind === 'text');
  assert.ok(answer?.kind === 'text');
  assert.ok(JSON.parse(answer.delta).includes(contextFile));
  assert.ok(!answer.delta.includes('must-not-expand'));
  session.close();
});

test('chat store: conversations are atomic, ordered and isolated by project; corrupt records are omitted', (t) => {
  const root = temp(t), alpha = join(root, 'alpha'), beta = join(root, 'beta');
  mkdirSync(alpha); mkdirSync(beta);
  const r = newChat('claude', new Date('2026-11-18T10:00:00Z'));
  assert.ok(isChatId(r.id));
  r.messages.push({ role: 'user', text: 'A title\nmore', at: r.created });
  saveChat(alpha, r);
  assert.equal(readChat(alpha, r.id).title, 'A title');
  assert.deepEqual(listChats(beta), []);
  assert.throws(() => readChat(beta, r.id), /Unknown/);
  r.messages.push({ role: 'assistant', text: 'answer', at: r.created });
  saveChat(alpha, r);
  assert.equal(readChat(alpha, r.id).messages.length, 2);
  assert.deepEqual(readdirSync(join(alpha, CHATS_DIR)), [`${r.id}.json`]);
  for (const id of ['../other', '/etc/file', 'C:/file', null]) assert.throws(() => readChat(alpha, id), /Unknown/);
  writeFileSync(join(alpha, CHATS_DIR, `${r.id}.json`), JSON.stringify({ ...r, messages: [{ role: 'assistant', text: 'bad', tools: 'bad' }] }));
  assert.deepEqual(listChats(alpha), []);
  assert.throws(() => readChat(alpha, r.id), /damaged/);
  removeChat(alpha, r.id);
  assert.deepEqual(listChats(alpha), []);
});

test('chat store: a junction or symlink cannot redirect a conversation outside its project', (t) => {
  const root = temp(t), project = join(root, 'project'), outside = join(root, 'outside');
  mkdirSync(project); mkdirSync(outside);
  symlinkSync(outside, join(project, CHATS_DIR), process.platform === 'win32' ? 'junction' : 'dir');
  const r = newChat('claude');
  for (const action of [() => saveChat(project, r), () => readChat(project, r.id), () => removeChat(project, r.id), () => listChats(project)]) assert.throws(action, /outside|links/i);
  assert.deepEqual(readdirSync(outside), []);
});

test('chat transcript: recent messages survive the budget, including one oversized message', () => {
  const r = newChat('claude');
  r.messages = [{ role: 'user', text: 'older', at: r.created }, { role: 'assistant', text: 'x'.repeat(100) + 'latest', at: r.created }];
  const text = chatTranscript(r, 30);
  assert.equal(text.length, 30);
  assert.ok(text.startsWith('AI: …') && text.endsWith('latest'));
  assert.doesNotMatch(text, /older/);
  assert.equal(chatTranscript(r, 0), '');
});

test('artifact viewer: only Claude artifact links open, sign-in pages may load, other addresses and bad areas are refused', () => {
  for (const url of ['https://claude.ai/artifact/abc123', 'https://claude.ai/code/artifact/0b5c-41aa', 'https://claude.ai/artifacts/xyz']) {
    assert.ok(isArtifactUrl(url), url);
  }
  const syntheticCredentials = new URL('https://claude.ai/artifact/abc');
  syntheticCredentials.username = 'synthetic-user';
  syntheticCredentials.password = 'synthetic-password'; // qa-agents:allow-secret synthetic URL fixture, never used for authentication
  for (const url of ['https://claude.ai/new', 'https://claude.ai/artifact/', 'http://claude.ai/artifact/abc', 'https://claude.ai.evil.test/artifact/abc',
    'https://evil.test/artifact/abc', 'https://claude.ai:8080/artifact/abc', syntheticCredentials.href, 'javascript:alert(1)', 42]) {
    assert.equal(isArtifactUrl(url), false, String(url));
  }
  for (const url of ['https://claude.ai/login', 'https://accounts.google.com/o/oauth2', 'https://www.anthropic.com/']) assert.ok(isViewerUrl(url), url);
  for (const url of ['https://chatgpt.com/', 'file:///etc/passwd', 'https://claude.ai.evil.test/']) assert.equal(isViewerUrl(url), false, url);
  assert.deepEqual(viewerBounds({ x: 1.4, y: 2, width: 400, height: 300 }), { x: 1, y: 2, width: 400, height: 300 });
  for (const bounds of [null, {}, { x: -1, y: 0, width: 10, height: 10 }, { x: 0, y: 0, width: NaN, height: 10 }, { x: 0, y: 0, width: 0, height: 10 }]) assert.throws(() => viewerBounds(bounds), /Invalid/);
});

test('chat service: context, MCP configuration and transcripts stay in the active workspace and project', async (t) => {
  const root = temp(t);
  for (const folder of ['templates', 'agents']) cpSync(join(ROOT, folder), join(root, folder), { recursive: true });
  setWorkspaceDir(root, join(root, 'other-workspace'));
  t.after(() => setWorkspaceDir(root, null));
  createProject('alpha', 'Alpha', root, 'blank'); createProject('beta', 'Beta', root, 'blank');
  const alpha = join(root, 'other-workspace', 'projects', 'alpha');
  const calls: unknown[] = [];
  const changed: string[] = [];
  const service = createService(root, { launch: () => ({ opened: true, message: '' }), openFolder: () => {}, openPath: () => {},
    chatCommand: () => ({ file: process.execPath, args: ['-e', echo] }),
    chatChanged: (project, id) => changed.push(`${project}/${id}`),
    artifactViewer: { show: (scope, url, bounds) => { calls.push({ scope, url, bounds }); return { url, loading: false, error: '' }; }, hide: () => {}, close: () => {}, reload: () => {} },
  });
  t.after(() => service.closeChats());
  setWorkspaceDir(root, join(root, 'other-workspace'));
  // Context and MCP files go to the active workspace's scratch folder, out of the project's file tree.
  const scratch = join(root, 'other-workspace', 'temporary');
  const setup = service.chatSetup('alpha', 'claude', 'English');
  assert.equal(relative(scratch, setup.contextFile).startsWith('chat-alpha-'), true);
  assert.match(readFileSync(setup.contextFile, 'utf8'), /Project: alpha\./);
  assert.doesNotMatch(readFileSync(setup.contextFile, 'utf8'), /say in one or two lines/);
  const mcp = setup.extra[setup.extra.indexOf('--mcp-config') + 1];
  assert.equal(relative(scratch, mcp).startsWith('mcp-alpha-'), true);
  assert.deepEqual(setup.scratch, [setup.contextFile, mcp]);
  assert.equal(existsSync(join(root, 'workspace', 'temporary')), false);
  assert.equal(existsSync(join(alpha, 'temporary')) && readdirSync(join(alpha, 'temporary')).some((name) => name.startsWith('chat-') || name.startsWith('mcp-')), false);
  const before = new Set(readdirSync(scratch));
  const sent = await service.chatSend('alpha', undefined, 'claude', 'unique-chat-text', 'English');
  // The question is saved at once, before the answer ends.
  assert.equal(service.chat('alpha', sent.record.id).messages[0].text, 'unique-chat-text');
  await until(() => !service.chatState('alpha', sent.record.id).busy);
  assert.equal(service.chat('alpha', sent.record.id).messages[1].text, 'unique-chat-text');
  assert.ok(changed.includes(`alpha/${sent.record.id}`), 'the window is told the conversation changed');
  // The files written for this start are deleted once the tool started its session.
  await until(() => readdirSync(scratch).every((name) => before.has(name)));
  assert.throws(() => service.chat('beta', sent.record.id), /Unknown/);
  assert.ok(!(await searchWorkspace(root, 'unique-chat-text')).files.length);
  assert.ok(!(await searchWorkspaceExpanded(root, 'unique-chat-text')).files.length);
  assert.ok(!(await service.tree('alpha')).some((node) => node.path === CHATS_DIR));
  assert.throws(() => service.showArtifact('missing', 'https://claude.ai/artifact/abc', {}), /Unknown project/);
  assert.throws(() => service.showArtifact('alpha', 'https://evil.test/artifact/abc', { x: 0, y: 0, width: 300, height: 200 }), /not a Claude artifact/);
  assert.throws(() => service.showArtifact('alpha', 'https://claude.ai/artifact/abc', { x: 0, y: 0, width: 0, height: 200 }), /Invalid/);
  service.showArtifact('alpha', 'https://claude.ai/artifact/abc', { x: 0, y: 0, width: 300, height: 200 });
  assert.deepEqual(calls, [{ scope: alpha, url: 'https://claude.ai/artifact/abc', bounds: { x: 0, y: 0, width: 300, height: 200 } }]);
  service.closeChats();
});

test('chat context always identifies the project, even without defaults, and keeps terminal behavior intact', () => {
  assert.equal(buildStartPrompt({ project: 'alpha', defaults: [], root: ROOT }), '');
  const prompt = buildStartPrompt({ project: 'alpha', defaults: [], root: ROOT, chat: true });
  assert.match(prompt, /Project: alpha\./);
  assert.match(prompt, /answer each of my messages here/);
  assert.doesNotMatch(prompt, /do not start any work/);
});

test('chat service: switching workspaces while finding a tool cannot start a conversation in either project', async (t) => {
  const root = temp(t);
  cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
  let ready: (() => void) | undefined;
  let launched = false;
  const service = createService(root, { launch: () => ({ opened: true, message: '' }), openFolder: () => {}, openPath: () => {},
    fixPath: () => new Promise<void>((done) => { ready = done; }),
    chatCommand: () => { launched = true; return { file: process.execPath, args: ['-e', echo] }; },
  });
  t.after(() => { service.closeChats(); setWorkspaceDir(root, null); });
  createProject('alpha', 'First Alpha', root, 'blank');
  const sending = service.chatSend('alpha', undefined, 'claude', 'first workspace only', 'English');
  setWorkspaceDir(root, join(root, 'second-workspace'));
  createProject('alpha', 'Second Alpha', root, 'blank');
  ready?.();
  await assert.rejects(sending, /workspace changed/);
  assert.equal(launched, false);
  assert.deepEqual(service.chats('alpha'), []);
  assert.equal(existsSync(join(root, 'workspace', 'projects', 'alpha', CHATS_DIR)), false);
});
