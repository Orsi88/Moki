// The chat of a project (one tab per project, phase 2 of the chat plan): the person picks an AI tool and talks to it
// in the app, with the same access a terminal of that tool gets (Moki folder, the project's MCP servers and plugins,
// the project's start context). This file is the tool-neutral engine: one live process per conversation, fed one
// message at a time on stdin, its stdout read as events. Each tool has an adapter: Claude Code keeps one process for
// the conversation; Codex runs one process per message and resumes its session (`oneShot`).
// The person's text never goes on a command line: messages travel on stdin, the project context in a file.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { readFileSync, rm } from 'node:fs';
import type { Effort } from '../scripts/lib/activities.ts';

export type ChatTool = 'claude' | 'codex';
export const CHAT_TOOLS: ChatTool[] = ['claude', 'codex'];
export const isChatTool = (v: unknown): v is ChatTool => CHAT_TOOLS.includes(v as ChatTool);

export type ChatEvent =
  | { kind: 'session'; id: string } // the tool's session id, kept for --resume
  | { kind: 'text'; delta: string; whole?: boolean } // answer text as it arrives; `whole`: a complete message (its own paragraph)
  | { kind: 'tool'; id: string; name: string; summary: string } // "Read relatorio-bugs.md", "Bash npm test"
  | { kind: 'tool-done'; id: string; ok: boolean }
  | { kind: 'turn-end'; ok: boolean; error?: string };

export interface ChatArgs { resume?: string; contextFile: string; extra: string[]; effort?: Effort }

export interface ChatAdapter {
  args(o: ChatArgs): string[]; // never the person's text
  encode(text: string, context?: string): string; // one stdin message; `context`: see contextInMessage
  parse(line: string): ChatEvent[]; // one stdout line → its events ([] for lines the chat does not show)
  lost(stderr: string): boolean; // the session to resume no longer exists (other computer, cleared cache)
  oneShot?: boolean; // one process per message: stdin closes after it and the next message resumes the session
  contextInMessage?: boolean; // no system-prompt file: the first message of a new session carries the project context
}

const SUMMARY_LIMIT = 120;
// The input field that says best what a tool call does, in order of preference.
const SUMMARY_KEYS = ['file_path', 'notebook_path', 'path', 'command', 'pattern', 'url', 'query', 'description', 'prompt', 'skill'];

export function toolSummary(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const fields = input as Record<string, unknown>;
  const key = SUMMARY_KEYS.find((k) => typeof fields[k] === 'string' && (fields[k] as string).trim());
  const text = key ? (fields[key] as string).replace(/\s+/g, ' ').trim() : '';
  return text.length > SUMMARY_LIMIT ? `${text.slice(0, SUMMARY_LIMIT - 1)}…` : text;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {});
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// Claude Code in print mode with stream-json in and out (claude --help, 2.1.x). Events of subagents
// (parent_tool_use_id set) stay out: the chat shows the main conversation and the subagent's tool call.
export const claudeAdapter: ChatAdapter = {
  args: ({ resume, contextFile, extra, effort }) => [
    '-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
    '--dangerously-skip-permissions', // the person chose "everything allowed" for the chat (2026-11-18)
    '--append-system-prompt-file', contextFile,
    ...(effort ? ['--effort', effort] : []),
    ...(resume ? ['--resume', resume] : []),
    ...extra,
  ],
  encode: (text) => `${JSON.stringify({ type: 'user', message: { role: 'user', content: text } })}\n`,
  parse: (line) => {
    let data: Json;
    try { data = obj(JSON.parse(line)); } catch { return []; }
    if (data.parent_tool_use_id) return [];
    if (data.type === 'system' && data.subtype === 'init' && typeof data.session_id === 'string') return [{ kind: 'session', id: data.session_id }];
    if (data.type === 'stream_event') {
      const delta = obj(obj(data.event).delta);
      return obj(data.event).type === 'content_block_delta' && delta.type === 'text_delta' && typeof delta.text === 'string' ? [{ kind: 'text', delta: delta.text }] : [];
    }
    // The whole assistant message carries each tool call with its complete input (the stream has it in pieces).
    if (data.type === 'assistant') {
      return list(obj(data.message).content).map(obj).filter((c) => c.type === 'tool_use' && typeof c.id === 'string')
        .map((c) => ({ kind: 'tool' as const, id: String(c.id), name: String(c.name ?? ''), summary: toolSummary(c.input) }));
    }
    if (data.type === 'user') {
      return list(obj(data.message).content).map(obj).filter((c) => c.type === 'tool_result' && typeof c.tool_use_id === 'string')
        .map((c) => ({ kind: 'tool-done' as const, id: String(c.tool_use_id), ok: c.is_error !== true }));
    }
    if (data.type === 'result') {
      const ok = data.subtype === 'success' && data.is_error !== true;
      return [ok ? { kind: 'turn-end', ok } : { kind: 'turn-end', ok, error: typeof data.result === 'string' && data.result.trim() ? data.result.trim() : String(data.subtype ?? 'error') }];
    }
    return [];
  },
  lost: (stderr) => /No conversation found with session ID/i.test(stderr),
};

// Codex CLI in exec mode with JSON events (codex exec --help, codex-cli 0.166; shapes captured on 2026-11-18). Global
// options (--no-daemon and the -c overrides for MCP servers and plugin instructions from the launcher) go before
// `exec`; `exec resume` takes no -C or -s, so the folder is the process's and the sandbox is off, as the person chose
// for the chat. The message is read from stdin (`-`). Agent messages arrive whole, never in pieces.
const CODEX_TOOLS: Record<string, (item: Json) => { name: string; input: Json }> = {
  command_execution: (item) => ({ name: 'Shell', input: { command: item.command } }),
  file_change: (item) => ({ name: 'Edit', input: { path: list(item.changes).map((c) => obj(c).path).filter((p) => typeof p === 'string').join(', ') } }),
  mcp_tool_call: (item) => ({ name: [item.server, item.tool].filter((v) => typeof v === 'string').join('.') || 'MCP', input: {} }),
  web_search: (item) => ({ name: 'WebSearch', input: { query: item.query } }),
};
const codexTool = (item: Json): (ChatEvent & { kind: 'tool' }) | null => {
  const shape = typeof item.type === 'string' ? CODEX_TOOLS[item.type] : undefined;
  if (!shape || typeof item.id !== 'string') return null;
  const { name, input } = shape(item);
  return { kind: 'tool', id: item.id, name, summary: toolSummary(input) };
};
const CODEX_EFFORT: Record<Effort, string> = { low: 'low', medium: 'medium', high: 'high', max: 'xhigh' };

export const codexAdapter: ChatAdapter = {
  oneShot: true,
  contextInMessage: true,
  args: ({ resume, extra, effort }) => [
    ...extra,
    ...(effort ? ['-c', `model_reasoning_effort=${CODEX_EFFORT[effort]}`] : []),
    'exec', ...(resume ? ['resume'] : []),
    '--json', '--skip-git-repo-check',
    '--dangerously-bypass-approvals-and-sandbox', // the person chose "everything allowed" for the chat (2026-11-18)
    ...(resume ? [resume] : []), '-',
  ],
  encode: (text, context) => (context?.trim() ? `<project-context>\n${context.trim()}\n</project-context>\n\n${text}` : text),
  parse: (line) => {
    let data: Json;
    try { data = obj(JSON.parse(line)); } catch { return []; }
    const item = obj(data.item);
    if (data.type === 'thread.started') return typeof data.thread_id === 'string' ? [{ kind: 'session', id: data.thread_id }] : [];
    if (data.type === 'item.started') { const tool = codexTool(item); return tool ? [tool] : []; }
    if (data.type === 'item.completed') {
      if (item.type === 'agent_message') return typeof item.text === 'string' && item.text.trim() ? [{ kind: 'text', delta: item.text, whole: true }] : [];
      const tool = codexTool(item);
      if (!tool) return [];
      const ok = item.status === 'completed' && (item.exit_code === undefined || item.exit_code === null || item.exit_code === 0);
      return [tool, { kind: 'tool-done', id: tool.id, ok }]; // the call again, for items reported only when done
    }
    if (data.type === 'turn.completed') return [{ kind: 'turn-end', ok: true }];
    if (data.type === 'turn.failed') {
      const message = obj(data.error).message;
      return [{ kind: 'turn-end', ok: false, error: typeof message === 'string' && message.trim() ? message.trim() : 'error' }];
    }
    return [];
  },
  lost: (stderr) => /no rollout found for thread id/i.test(stderr),
};

export const CHAT_ADAPTERS: Record<ChatTool, ChatAdapter> = { claude: claudeAdapter, codex: codexAdapter };

export interface ChatSessionOptions {
  file: string; // the tool's resolved path
  adapter: ChatAdapter;
  cwd: string;
  env: NodeJS.ProcessEnv;
  // Called at each start of the process: a fresh context file and the tool's extra arguments (MCP config, plugins).
  // `lost`: the session to resume is gone, so the context must also carry the conversation so far.
  // `scratch`: files written for this start (context, MCP config), deleted once the tool has read them (its session
  // started) or the process ended, so they never pile up.
  setup: (o: { lost: boolean }) => { contextFile: string; extra: string[]; effort?: Effort; scratch?: string[] };
  sessionId?: string; // an existing conversation to resume
  onEvent: (event: ChatEvent) => void;
  command?: (args: string[]) => { file: string; args: string[] }; // tests run a small script instead of an AI
}

export interface ChatSession {
  send(text: string): void;
  stop(): void; // ends the answer in progress; the next message resumes the conversation
  close(): void; // ends the conversation's process for good; no event after it
  busy(): boolean;
  sessionId(): string | undefined;
}

const STDERR_KEEP = 4000;

// Stop the tool and its children too: killing only an npm .cmd wrapper leaves the AI running on Windows.
function terminate(child: ChildProcessWithoutNullStreams): void {
  if (process.platform === 'win32' && child.pid) {
    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    killer.on('error', () => child.kill());
    killer.on('close', (code) => { if (code !== 0) child.kill(); });
  } else {
    try { if (child.pid) process.kill(-child.pid, 'SIGTERM'); else child.kill(); }
    catch { child.kill(); } // the process group may already have ended
  }
}

export function createChatSession(o: ChatSessionOptions): ChatSession {
  let child: ChildProcessWithoutNullStreams | null = null;
  let session = o.sessionId;
  let working = false;
  let closed = false;
  let stopped = false;
  let pending = ''; // the message being answered, sent again when a lost session starts over
  let retried = false;
  let resuming = false; // started with --resume and nothing heard yet: a failure may be a lost session
  let held: ChatEvent | null = null; // the turn-end of such a start, until the exit says whether it was lost
  let context = ''; // contextInMessage: the project context of a start without a session, for its first message

  const emit = (event: ChatEvent) => { if (!closed) o.onEvent(event); };
  const finish = (event: ChatEvent & { kind: 'turn-end' }) => { if (!working) return; working = false; pending = ''; retried = false; emit(event); };

  const start = (lost: boolean): ChildProcessWithoutNullStreams => {
    const { contextFile, extra, effort, scratch = [] } = o.setup({ lost });
    const clean = () => { for (const file of scratch.splice(0)) rm(file, { force: true }, () => { /* already gone */ }); };
    const resume = lost ? undefined : session;
    try { context = o.adapter.contextInMessage && !resume ? readFileSync(contextFile, 'utf8') : ''; } catch (e) { clean(); throw e; }
    const args = o.adapter.args({ resume, contextFile, extra, effort });
    const run = o.command ? o.command(args) : { file: o.file, args };
    const shell = !o.command && process.platform === 'win32' && /\.(cmd|bat)$/i.test(run.file);
    // Expand quoted environment variables once, with delayed expansion off. Paths containing %, ! or & then
    // stay literal; neither the path nor an argument is interpolated into cmd.exe's command string.
    const values = [run.file, ...run.args];
    if (shell && values.some((value) => /["\r\n\0]/.test(value))) { clean(); throw new Error('Invalid AI tool argument.'); }
    const names = values.map((_, i) => `MOKI_CHAT_ARG_${i}`);
    const proc = spawn(shell ? (process.env.ComSpec || 'cmd.exe') : run.file,
      shell ? ['/d', '/v:off', '/s', '/c', `"${names.map((name) => `"%${name}%"`).join(' ')}"`] : run.args,
      { cwd: o.cwd, env: shell ? { ...o.env, ...Object.fromEntries(names.map((name, i) => [name, values[i]])) } : o.env,
        windowsHide: true, windowsVerbatimArguments: shell, detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'] });
    child = proc;
    resuming = Boolean(session) && !lost;
    held = null;
    let buffer = '';
    let stderr = '';
    const consume = (line: string) => {
      if (!line || child !== proc || stopped || closed) return;
      for (const event of o.adapter.parse(line)) {
        if (event.kind === 'turn-end' && resuming && !event.ok && o.adapter.lost(`${stderr}\n${event.error ?? ''}`)) { held = event; continue; }
        if (event.kind !== 'session') resuming = false;
        if (event.kind === 'session') { session = event.id; clean(); }
        // A one-shot process is done with this turn: the next message starts (and resumes) a new one.
        if (event.kind === 'turn-end' && o.adapter.oneShot) child = null;
        if (event.kind === 'turn-end') finish(event); else emit(event);
      }
    };
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      let at: number;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, at).trim();
        buffer = buffer.slice(at + 1);
        consume(line);
      }
    });
    proc.stdout.on('end', () => { consume(buffer.trim()); buffer = ''; });
    proc.stderr.setEncoding('utf8');
    proc.stderr.on('data', (chunk: string) => { stderr = (stderr + chunk).slice(-STDERR_KEEP); });
    proc.stdin.on('error', () => { /* the tool may exit before reading everything */ });
    proc.on('error', (e) => onExit(e.message));
    proc.on('close', (code) => onExit(code === 0 ? '' : `exit ${code}`));
    let ended = false;
    function onExit(reason: string) {
      if (ended || child !== proc) return;
      ended = true;
      child = null;
      clean();
      const wasResuming = resuming;
      resuming = false;
      if (closed) return;
      // The conversation to resume is gone: start a new one carrying it, and send the message again (once).
      if (wasResuming && working && !stopped && !retried && o.adapter.lost(`${stderr}\n${held?.kind === 'turn-end' ? held.error ?? '' : ''}`)) {
        retried = true;
        session = undefined;
        try { deliver(start(true), pending); } catch (e) { finish({ kind: 'turn-end', ok: false, error: e instanceof Error ? e.message : String(e) }); }
        return;
      }
      if (!working) return;
      if (stopped) { stopped = false; finish({ kind: 'turn-end', ok: false, error: 'stopped' }); return; }
      const tail = stderr.trim().split('\n').slice(-3).join('\n');
      finish(held?.kind === 'turn-end' ? { ...held, error: tail || held.error } : { kind: 'turn-end', ok: false, error: tail || reason || 'The AI tool stopped.' });
    }
    return proc;
  };

  // The message on stdin; the context goes with the first one only, and a one-shot tool reads until stdin closes.
  function deliver(proc: ChildProcessWithoutNullStreams, text: string): void {
    proc.stdin.write(o.adapter.encode(text, context));
    context = '';
    if (o.adapter.oneShot) proc.stdin.end();
  }

  return {
    send(text) {
      if (closed) throw new Error('This conversation is closed.');
      if (working) throw new Error('Wait for the answer, or stop it first.');
      if (typeof text !== 'string' || !text.trim()) throw new Error('Write a message first.');
      if (text.length > 1_000_000) throw new Error('This message is too long.');
      working = true;
      stopped = false;
      pending = text;
      try {
        deliver(child ?? start(false), text);
      } catch (e) {
        working = false;
        pending = '';
        throw e;
      }
    },
    stop() {
      if (!child || !working) return;
      stopped = true;
      terminate(child);
    },
    close() {
      closed = true;
      working = false;
      if (child) terminate(child);
      child = null;
    },
    busy: () => working,
    sessionId: () => session,
  };
}
