// What the Moki panel inside the IDE (app/src/companion, a webview) may ask for.
// A closed list of calls over the desktop service and the Companion, always for
// the project the IDE is connected to: a project id sent by the page is never
// used. Requests and context exclusions come from the desktop service; the host
// dispatches native chats, while terminal alternatives use service.launch.
// Multi-agent operations run on the same engine as in the app (scripts/lib/operation-runs.ts):
// drive() is the app's loop — advance every open run, start the steps that are ready —
// and runs after each action and whenever the project's files change.

import { linkedFolder, listProjects, projectSummary, type ProjectSummary } from '../scripts/lib/core.ts';
import { enabledServers, generatedEntries, mcpIssues, syncToolFolder, toolConfigState, toolFile, type McpServer } from '../scripts/lib/mcp.ts';
import { createHash } from 'node:crypto';
import { relative, isAbsolute } from 'node:path';
import { workspaceDir, workspaceLabel } from '../scripts/lib/repo.mjs';
import { probeServer } from './mcp-probe.ts';
import type { IdeAi, IdeChatCapability, IdeChatRequest, IdeChatResult, IdeConnections } from '../ide/companion-types.ts';
import { folderOf, type Companion, type Resource } from './companion.ts';
import { AGENT_AIS } from '../scripts/lib/agents.ts';
import type { Service } from './service.ts';
import { allFavorites, allMostUsed, isFavoriteKind, recordUse, setFavoriteOf } from '../scripts/lib/favorites.ts';

// What the extension host gives: the active project, the clipboard, the chat, a confirmation dialog, the open folder.
export interface CompanionHost {
  companion: () => Companion | null;
  choose: (project: string) => void;
  copy: (text: string) => Promise<void> | void;
  confirm: (message: string, detail: string) => Promise<boolean>;
  folder: () => string | null; // the folder open in the IDE (its .mcp.json for Claude Code)
  tracked: (folder: string, file: string) => boolean; // the file is versioned in the folder's Git repository
  mokiServer: (project: string) => McpServer;
  language: () => string; // the language the agents talk in (one of LANGUAGES)
  showTerminal: (id: string) => boolean; // brings a step's terminal to the front; false when it is not open here
  chatCapabilities?: () => Promise<IdeChatCapability[]>;
  selectedAi?: () => IdeAi | '';
  selectAi?: (ai: IdeAi) => Promise<void> | void;
  startChat?: (request: IdeChatRequest) => Promise<IdeChatResult>;
  chooseFolder?: () => Promise<void>;
  createProject?: () => Promise<string | null>;
}

// folder: the project folder it belongs to ('' for a loose file), the unit the panel switches; size in bytes, for the estimate.
export interface ContextFile { id: string; path: string; title: string; description: string; kind: string; source: string; included: boolean; priority: boolean; folder: string; size: number }
export interface CompanionState { project: ProjectSummary | null; projects: { id: string; name: string }[]; folder: string | null; mcp: { id: string; name: string; access: string; transport: string }[] }
export interface LaunchInput { activity?: unknown; files?: unknown; note?: unknown; language?: unknown; run?: unknown; agent?: unknown; ai?: unknown; requestId?: unknown; context?: unknown }

// The panel lists every project file the person can hand to the AI, grouped later by folder.
// Agents and skills stay on their own tabs.
const PANEL_KINDS = new Set(['context', 'note', 'file', 'shared']);
const included = (r: Resource): boolean => r.mode === 'auto' || r.selected;
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function createCompanionApi(root: string, service: Service, host: CompanionHost) {
  const active = (): Companion => {
    const c = host.companion();
    if (!c) throw new Error('Choose the Moki project of this folder first.');
    return c;
  };
  const contextFiles = (c: Companion): ContextFile[] => c.allResources().filter((r) => PANEL_KINDS.has(r.kind)).map((r) => {
    const path = r.id.replace(/^.*?\/projects\/[^/]+\//, '');
    return {
      id: r.id, path, title: r.title, description: r.description, kind: r.kind, source: r.source,
      included: included(r), priority: r.selected, folder: r.kind === 'shared' ? '' : folderOf(path), size: r.size ?? 0,
    };
  });
  const context = (id: unknown): Resource => {
    const r = active().allResources().find((x) => x.id === id && PANEL_KINDS.has(x.kind));
    if (!r) throw new Error('This file is not in the project.');
    return r;
  };

  const guard = (c: Companion, folder: string | null, workspace: string) => {
    if (host.companion() !== c || host.folder() !== folder || workspaceDir(root) !== workspace) throw new Error('The project or folder changed. Try again from its project.');
  };
  const aiOf = (value: unknown): IdeAi => {
    if (value !== 'claude' && value !== 'codex' && value !== 'copilot' && value !== 'cursor') throw new Error('Choose an AI first.');
    return value;
  };
  const connections = async (): Promise<IdeConnections> => {
    const c = active(), folder = host.folder(), workspace = workspaceDir(root);
    const choices = await host.chatCapabilities?.() ?? [];
    guard(c, folder, workspace);
    const ai = host.selectedAi?.() ?? '';
    const entries = generatedEntries(host.mokiServer(c.project), enabledServers(c.project, root));
    const configuration = !ai ? 'missing' : ai === 'copilot' ? 'automatic' : !folder ? 'missing' : toolConfigState(folder, entries, ai);
    return { ai, choices, folder, workspace: workspaceLabel(root), configuration, servers: entries.map(({ server }) => ({
      id: server.id, name: server.name, transport: server.transport, access: server.access,
      authentication: Boolean(server.oauth), issues: ai ? mcpIssues(server, ai) : [],
    })) };
  };

  const prepareRequest = (input: LaunchInput, c: Companion) => {
    const choice = service.contextChoice(c.project);
    const offered = new Set([...choice.own, ...choice.shared.flatMap((g) => g.sources.flatMap((s) => s.paths))]);
    const exclude = contextFiles(c).filter((f) => !f.included && (offered.has(f.id) || f.kind === 'file' || f.kind === 'note')).map((f) => f.id);
    return {
      project: c.project, activity: String(input.activity ?? 'open'), files: strings(input.files), note: String(input.note ?? ''),
      language: String(input.language ?? 'English'), run: input.run ? String(input.run) : undefined, agent: input.agent ? String(input.agent) : undefined,
      exclude: input.activity === 'resume' ? [] : exclude, context: strings(input.context),
    };
  };
  const record = (input: LaunchInput) => {
    if (input.agent) recordUse('agents', String(input.agent), root);
    else if (input.activity !== 'resume') recordUse('activities', String(input.activity ?? 'open'), root);
  };

  // The request as the desktop app builds it; files left out of the context go as exclusions.
  const request = (input: LaunchInput, tool: 'claude' | 'codex' | 'cursor-agent' | 'print') => {
    const c = active();
    const result = service.launch({ ...prepareRequest(input, c), tool });
    // Counts as a use (the panel's "most used"): the card's agent, or the activity; resuming a run does not.
    record(input);
    return result;
  };

  // Repeated messages from a timed-out webview join the original attempt, including uncertain deliveries.
  const attempts = new Map<string, { hash: string; result: Promise<IdeChatResult> }>();

  // The app's operation loop. One pass at a time; a step that cannot start is marked failed by the engine.
  let driving = false;
  const drive = (): { run: string; step: string; opened: boolean; message: string }[] => {
    const c = host.companion();
    if (!c || driving) return [];
    driving = true;
    try {
      return service.advanceOperations(c.project).map(({ run, step }) => {
        try {
          const r = service.startOperationStep(c.project, run, step, host.language());
          return { run, step, opened: r.opened, message: r.message };
        } catch (e) { return { run, step, opened: false, message: e instanceof Error ? e.message : String(e) }; }
      });
    } finally { driving = false; }
  };
  // An action on a run, then the loop, so a step made ready starts at once.
  const act = <T>(fn: (project: string) => T): T => { const r = fn(active().project); drive(); return r; };
  const runOf = (runId: unknown) => service.operationRun(active().project, runId);

  const calls: Record<string, (...a: unknown[]) => unknown> = {
    state: (): CompanionState => {
      const c = host.companion();
      return {
        project: c ? projectSummary(c.project, root) : null,
        projects: listProjects(root).map((id) => ({ id, name: projectSummary(id, root).name })),
        folder: host.folder(),
        mcp: c ? enabledServers(c.project, root).map(({ id, name, access, transport }) => ({ id, name, access, transport })) : [],
      };
    },
    chooseProject: (id) => {
      if (typeof id !== 'string' || !listProjects(root).includes(id)) throw new Error('Unknown project.');
      host.choose(id);
      return true;
    },
    createProject: async () => {
      if (!host.createProject) throw new Error('Creating a project is not available here.');
      return host.createProject();
    },
    connections,
    selectAi: async (value) => { const ai = aiOf(value); await host.selectAi?.(ai); return connections(); },
    chooseFolder: async () => { await host.chooseFolder?.(); return connections(); },
    testMcp: async (id) => {
      const c = active();
      const server = id === 'moki' ? host.mokiServer(c.project) : enabledServers(c.project, root).find((s) => s.id === id);
      if (!server) throw new Error('This MCP server is not enabled in this project.');
      return id === 'moki' ? probeServer(server) : service.testMcpServer(server.id);
    },
    startChat: (raw) => {
      const input = (raw ?? {}) as LaunchInput, c = active(), folder = host.folder(), workspace = workspaceDir(root);
      if (!folder) throw new Error('Choose a workspace folder before starting a chat.');
      const ai = aiOf(input.ai);
      const requestId = input.requestId;
      if (typeof requestId !== 'string' || !/^[a-f0-9]{32}$/.test(requestId)) throw new Error('Invalid request identifier.');
      const prepared = prepareRequest(input, c);
      const { prompt } = service.chatRequest({ ...prepared, tool: 'print', trackingId: prepared.activity === 'resume' ? undefined : requestId });
      const key = `${workspace}\0${c.project}\0${requestId}`;
      const hash = createHash('sha256').update(JSON.stringify({ prompt, ai, folder })).digest('hex');
      const old = attempts.get(key);
      if (old) { if (old.hash !== hash) throw new Error('This request identifier already belongs to another request.'); return old.result; }
      if (attempts.size >= 256) throw new Error('Reload the IDE window before starting more chats.');
      let dispatched = false;
      const result = (async (): Promise<IdeChatResult> => {
        const details = await connections();
        guard(c, folder, workspace);
        const choice = details.choices.find((v) => v.id === ai);
        const blocked = (message: string): IdeChatResult => ({ status: 'blocked', requestId, message });
        if (!host.startChat || !choice?.automatic) return blocked(choice?.reason || 'Automatic launch is not available for this AI.');
        const entries = generatedEntries(host.mokiServer(c.project), enabledServers(c.project, root));
        if (ai !== 'copilot' && toolConfigState(folder, entries, ai) !== 'current') return blocked('Connect this AI to Moki before starting a chat.');
        const target = service.activities().activities.find((a) => a.id === prepared.activity)?.target;
        const agentName = prepared.agent ?? (target?.kind === 'agent' ? target.name : '');
        const required = service.agents().find((a) => a.name === agentName)?.mcps ?? [];
        for (const need of [{ name: 'moki' }, ...required]) {
          const server = entries.find((e) => e.server.id === need.name)?.server;
          if (!server) return blocked(`Required MCP server is not enabled: ${need.name}.`);
          const issues = mcpIssues(server, ai);
          if (issues.length) return blocked(`${server.name}: ${issues.join(' ')}`);
        }
        dispatched = true;
        const sent = await host.startChat({ project: c.project, folder, ai, prompt, requestId });
        if (sent.status !== 'blocked') record(input);
        return sent;
      })().catch((error: unknown): IdeChatResult => ({ status: dispatched ? 'unconfirmed' : 'blocked', requestId,
        message: dispatched ? 'Chat delivery could not be confirmed. Check the chat before trying again.'
          : error instanceof Error ? error.message : 'Could not check the AI connection. Refresh the panel and try again.' }));
      attempts.set(key, { hash, result });
      return result;
    },
    activities: () => service.activities(),
    // Only the agents this project uses, ready to run.
    agents: () => {
      const on = new Set(service.projectAgents(active().project));
      return service.agents().filter((a) => a.usable && on.has(a.name));
    },
    inbox: () => service.inbox(active().project),
    openRuns: () => service.openRuns(active().project),
    operationRuns: () => service.operationRuns(active().project),
    // ---- multi-agent operations (the same calls the app's Operations panel makes)
    // Every operation of the workspace (the example one is created when there is none, as in the app),
    // the ones this project already uses first, each marked.
    operations: () => {
      const linked = new Set(service.projectOperations(active().project).map((o) => o.id));
      const all = service.operations(host.language().startsWith('Portuguese') ? 'pt-BR' : 'en').map((o) => ({ ...o, linked: linked.has(o.id) }));
      return [...all.filter((o) => o.linked), ...all.filter((o) => !o.linked)];
    },
    // Opening an operation to start it here links it to the project (project.json "operations"), as the app does.
    operationPlan: (id) => {
      const project = active().project;
      const linked = service.projectOperations(project).map((o) => o.id);
      if (!linked.includes(String(id))) service.setProjectOperations(project, [...linked, String(id)]);
      return service.operationPlan(project, id);
    },
    // The AI tools a step can run in: the terminal ones the agents may name, and whether each is installed.
    aiTools: async () => (await service.integrations()).filter((t) => (AGENT_AIS as readonly string[]).includes(t.id)),
    startOperation: (id, request) => act((p) => { const r = service.startOperation(p, id, request); recordUse('operations', String(id), root); return r; }),
    // Stars (shared with the app) and the most used, for the lists that show only those until you search.
    favorites: () => allFavorites(root),
    setFavorite: (kind, id, on) => {
      if (!isFavoriteKind(kind)) throw new Error('Unknown list.');
      return setFavoriteOf(kind, String(id ?? ''), on === true, root);
    },
    mostUsed: () => allMostUsed(root),
    operationRun: (runId) => runOf(runId),
    approveOperationStep: (runId) => act((p) => service.approveOperationStep(p, runId)),
    rejectOperationStep: (runId, notes, redo) => act((p) => service.rejectOperationStep(p, runId, notes, redo)),
    retryOperationStep: (runId, ai) => act((p) => service.retryOperationStep(p, runId, ai)),
    answerOperationStep: (runId, text) => act((p) => service.answerOperationStep(p, runId, text)),
    reopenOperationStep: (runId) => act((p) => service.reopenOperationStep(p, runId)),
    chooseOperationPath: (runId, to) => act((p) => service.chooseOperationPath(p, runId, to)),
    pauseOperation: (runId, paused) => act((p) => service.pauseOperation(p, runId, paused)),
    cancelOperation: (runId) => act((p) => service.cancelOperation(p, runId)),
    // The running step's terminal, in front.
    showTerminal: (runId) => {
      const v = runOf(runId).visits.at(-1);
      if (!v?.terminal || !host.showTerminal(v.terminal)) throw new Error('The terminal of this step is not open in VS Code.');
      return true;
    },
    context: () => contextFiles(active()),
    // "Goes to the AI": on = the AI may read it and requests include it; off = left out of both.
    setIncluded: (id, on) => {
      const r = context(id);
      const c = active();
      if (on === true) c.setMode(r.id, 'auto');
      else { c.select(r.id, false); c.setMode(r.id, 'manual'); }
      return contextFiles(c);
    },
    // A whole folder of the project in or out (the panel's checkbox); its files' own exceptions go.
    setFolder: (folder, on) => {
      const c = active();
      c.setFolder(folder, on === true);
      return contextFiles(c);
    },
    // "Priority": moki_get_context gives it first (and it counts as included).
    setPriority: (id, on) => {
      const r = context(id);
      active().select(r.id, on === true);
      return contextFiles(active());
    },
    // The AI tool in a terminal of the IDE, with the request and the project's MCP servers (--mcp-config).
    launch: (input) => {
      const value = (input ?? {}) as LaunchInput;
      const tool = value.ai === 'codex' ? 'codex' : value.ai === 'cursor' ? 'cursor-agent' : 'claude';
      return request(value, tool);
    },
    // The request copied for the IDE's chat, which Moki cannot fill by itself.
    copyRequest: async (input) => {
      const { prompt } = request((input ?? {}) as LaunchInput, 'print');
      await host.copy(prompt);
      return { prompt, chat: '' }; // copying never changes another conversation or its draft
    },
    // An AI tool opened on this folder reads its MCP servers from a file there (Claude Code: .mcp.json;
    // Cursor: .cursor/mcp.json; Codex: .codex/config.toml): Moki's entries go there after the person confirms.
    connectTool: async (tool: unknown) => {
      if (tool !== 'claude' && tool !== 'cursor' && tool !== 'codex') throw new Error('Unknown AI tool.');
      const c = active();
      const folder = host.folder();
      const workspace = workspaceDir(root);
      if (!folder) throw new Error('Open a folder in the IDE first.');
      const linked = linkedFolder(c.project, root);
      const child = linked ? relative(linked.path, folder) : '..';
      if (linked?.writeBlocked && (child === '' || !child.startsWith('..') && !isAbsolute(child))) throw new Error('This project does not allow writing AI settings (writeAllowed: false).');
      const file = toolFile(folder, tool);
      const rel = tool === 'cursor' ? '.cursor/mcp.json' : tool === 'codex' ? '.codex/config.toml' : '.mcp.json';
      const label = { claude: 'Claude Code', cursor: 'Cursor', codex: 'Codex' }[tool];
      const versioned = host.tracked(folder, rel);
      const ok = await host.confirm(
        `Write Moki's MCP servers to ${file}?`,
        `${label} opened on this folder reads its MCP servers from this file. Only Moki's entries change; yours stay, and the current file is backed up to .moki-backup/ first.${tool === 'codex' ? ' Codex reads a project\'s .codex/config.toml only when the project is trusted.' : ''}${versioned ? ' This file is versioned in Git: the change will show in your commits.' : ''}`,
      );
      if (!ok) return { changed: false, cancelled: true, file, tool };
      guard(c, folder, workspace);
      const r = syncToolFolder(folder, generatedEntries(host.mokiServer(c.project), enabledServers(c.project, root)), tool);
      c.log(`connect-${tool}`, { changed: r.changed });
      return { ...r, cancelled: false, tool };
    },
    connectClaude: () => calls.connectTool('claude'),
  };

  // One message from the page: only names in the list, never the whole service.
  const call = async (method: unknown, args: unknown): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> => {
    if (typeof method !== 'string' || !Object.hasOwn(calls, method)) return { ok: false, error: 'Unknown action.' };
    try {
      return { ok: true, value: await calls[method](...(Array.isArray(args) ? args : [])) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };
  // drive: for the host, when the project's files change (a step wrote its handoff, a question…).
  return Object.assign(call, { drive });
}
