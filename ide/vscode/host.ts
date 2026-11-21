// Moki light inside VS Code: finds the Moki project of the open folder and shows the
// Moki panel (app/src/companion, a webview with the app's look) where the person
// starts activities, uses the project's agents, chooses the context and follows the
// runs. The page talks only to desktop/companion-api.ts (a closed list of calls, always
// for the active project). VS Code's AI gets Moki's MCP server (ide/mcp/server.ts) and
// the servers the project has on in the MCP Manager (scripts/lib/mcp.ts). File-based
// clients receive managed settings from Connections, with a backup and confirmation.
// Multi-agent operations run here as in the app: each step in its own VS Code terminal,
// with an id the engine keeps on the step, and the loop (companion-api drive) runs on
// every change of the project's files, so an operation moves on with the panel closed.

import * as vscode from 'vscode';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, join, relative, isAbsolute, resolve } from 'node:path';
import { ROOT, workspaceDir } from '../../scripts/lib/repo.mjs';
import { TOOLS, linkedFolder, listProjects, projectSummary, projectsDir, which } from '../../scripts/lib/core.ts';
import { activeWorkspace, setWorkspaceEnv } from '../../desktop/workspaces.ts';
import { createService, LINKED } from '../../desktop/service.ts';
import { launchInTerminal, launchTool, openFolder } from '../../desktop/launcher.ts';
import type { TermSpec } from '../../desktop/terminals.ts';
import { openCompanion, projectsForFolder, type Companion } from '../../desktop/companion.ts';
import { createCompanionApi } from '../../desktop/companion-api.ts';
import { MCP_FILE, mokiServer, resolveServer, type McpServer } from '../../scripts/lib/mcp.ts';
import { createIdeChatIntegration, isIdeAi } from './chat-integrations.ts';
import type { IdeAi } from '../companion-types.ts';

const PICKED = 'moki.project'; // the project chosen for this VS Code workspace (workspaceState)

export function start(context: vscode.ExtensionContext): void {
  const dist = join(context.extensionPath, 'dist');
  const mcpScript = join(dist, 'mcp.cjs');
  const webRoot = vscode.Uri.file(join(dist, 'webview'));
  const buildId = ((): string => { try { return (JSON.parse(readFileSync(join(dist, 'build-info.json'), 'utf8')) as { buildId: string }).buildId; } catch { return '0'; } })();

  let companion: Companion | null = null;
  const preferenceKey = (kind: string) => `moki.${kind}:${workspaceDir(ROOT)}:${companion?.project ?? ''}`;
  const folders = (): string[] => (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.scheme === 'file').map((f) => f.uri.fsPath);
  const folder = (): string | null => {
    const all = folders();
    const chosen = context.workspaceState.get<string>(preferenceKey('folder'));
    if (chosen && all.includes(chosen)) return chosen;
    const project = companion?.project;
    const matching = project ? all.filter((f) => projectsForFolder(ROOT, f).includes(project)) : [];
    if (matching.length === 1) return matching[0];
    return project && linkedFolder(project, ROOT) ? null : all.length === 1 ? all[0] : null;
  };
  const selectedAi = (): IdeAi | '' => {
    const value = context.workspaceState.get<unknown>(preferenceKey('ai'));
    return isIdeAi(value) ? value : '';
  };
  const chats = createIdeChatIntegration({
    version: vscode.version,
    commands: async () => vscode.commands.getCommands(true),
    execute: async (command, options) => vscode.commands.executeCommand(command, options),
    current: (request) => companion?.project === request.project && folder() === request.folder,
    // This command's verified contract has no working-directory argument. In a multi-root
    // window the IDE can choose another root, even when Moki has a selected folder.
    workspaceIssue: () => folders().length === 1 && folder() === folders()[0] ? undefined
      : 'Open this project\'s folder in its own IDE window to start a separate chat.',
  });

  // The terminals Moki opened, by an id of this session: an operation step keeps it (markStarted), to
  // answer a question in it, close it, or learn that it closed before the step was done.
  const terminals = new Map<string, { terminal: vscode.Terminal; project: string | null }>();
  const session = Date.now().toString(36);
  let opened = 0;
  // Arguments as an array and no shell, so the request is never read as a command line.
  const openTerminal = (spec: TermSpec): string => {
    const id = `vs${session}-${++opened}`;
    const terminal = vscode.window.createTerminal({
      name: spec.title ? `Moki · ${spec.title}` : 'Moki', shellPath: which(spec.file) ?? spec.file, shellArgs: spec.args, cwd: spec.cwd,
      // VS Code terminals do not inherit this process's environment; the tools need the active workspace.
      env: spec.env ?? { QA_WORKSPACE: process.env.QA_WORKSPACE ?? null },
    });
    terminals.set(id, { terminal, project: companion?.project ?? null });
    terminal.show();
    return id;
  };
  const live = (id: string) => terminals.get(id)?.terminal;

  // The same service as the desktop app (it opens the workspace used last); the AI tools open in VS Code's terminals.
  const service = createService(ROOT, {
    launch: (tool, prompt, root, plugins = [], extra = []) => {
      if (TOOLS[tool].clipboard) return launchTool(tool, prompt, root, plugins, extra);
      const r = launchInTerminal(tool, prompt, root, openTerminal, plugins, extra);
      return { opened: r.opened, message: r.message, terminal: r.terminal };
    },
    openFolder,
    openPath: (file) => { void vscode.env.openExternal(vscode.Uri.file(file)); },
    copy: (text) => { void vscode.env.clipboard.writeText(text); },
    pickFolder: async () => {
      const current = folder();
      return (await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false,
        defaultUri: current ? vscode.Uri.file(current) : undefined, title: 'Choose the project folder' }))?.[0]?.fsPath ?? null;
    },
    onWorkspace: (dir) => setWorkspaceEnv(ROOT, dir),
    terminalAlive: (id) => { const t = live(id); return Boolean(t && t.exitStatus === undefined); },
    writeTerminal: (id, data) => { live(id)?.sendText(data, false); }, // the engine ends the answer with a carriage return itself
    killTerminal: (id) => { live(id)?.dispose(); terminals.delete(id); },
  });

  let candidates: string[] = [];
  const panels = new Set<vscode.WebviewView>();
  const mcpChanged = new vscode.EventEmitter<void>();
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  status.command = 'moki.chooseProject';
  status.show();

  const name = (id: string): string => projectSummary(id, ROOT).name;
  const refresh = (): void => { for (const p of panels) void p.webview.postMessage({ event: 'changed', project: companion?.project ?? '' }); };

  let watcher: vscode.FileSystemWatcher | null = null;
  let timer: NodeJS.Timeout | undefined;
  const later = (): void => { clearTimeout(timer); timer = setTimeout(() => { drive(); refresh(); mcpChanged.fire(); }, 400); };
  const watch = (project: string | null): void => {
    watcher?.dispose();
    watcher = null;
    if (!project) return;
    watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(join(projectsDir(ROOT), project)), '**'));
    watcher.onDidCreate(later); watcher.onDidChange(later); watcher.onDidDelete(later);
  };
  // The workspace's MCP catalog lives outside the project folder.
  const catalog = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(workspaceDir(ROOT)), MCP_FILE));
  catalog.onDidCreate(later); catalog.onDidChange(later); catalog.onDidDelete(later);

  // Another project means another context: nothing of the previous one stays visible or reachable.
  const use = (project: string | null): void => {
    if (project !== (companion?.project ?? null)) {
      companion = project ? openCompanion(ROOT, project) : null;
      watch(project);
      mcpChanged.fire();
    }
    status.text = companion ? `$(moki-cat) Moki: ${name(companion.project)}` : candidates.length > 1 ? '$(moki-cat) Moki: choose a project' : '$(moki-cat) Moki: no project';
    status.tooltip = companion ? 'Moki project of this folder. Click to change.' : 'Choose the Moki project of this folder.';
    drive();
    refresh();
  };
  const pick = (id: string): void => { void context.workspaceState.update(PICKED, id); use(id); };

  // A project chosen for this VS Code workspace wins while it exists; otherwise the one linked to the folder.
  const resolveProject = (): void => {
    // The desktop app may have switched workspaces since this window started.
    const active = activeWorkspace(ROOT);
    if (resolve(workspaceDir(ROOT)) !== resolve(active.path)) { service.selectWorkspace(active.id); companion = null; watch(null); }
    candidates = [...new Set(folders().flatMap((f) => projectsForFolder(ROOT, f)))];
    const picked = context.workspaceState.get<string>(PICKED);
    if (picked && listProjects(ROOT).includes(picked)) use(picked);
    else if (candidates.length === 1) use(candidates[0]);
    else use(null);
  };

  const chooseProject = async (): Promise<void> => {
    const known = listProjects(ROOT);
    if (!known.length) { void vscode.window.showInformationMessage('There are no Moki projects in the active workspace. Use Create project in the Moki panel.'); return; }
    const order = [...candidates, ...known.filter((p) => !candidates.includes(p))];
    const choice = await vscode.window.showQuickPick(order.map((id) => ({
      label: name(id), description: id, detail: candidates.includes(id) ? 'Linked to this folder' : projectSummary(id, ROOT).description || undefined, id,
    })), { title: 'Moki project for this folder' });
    if (choice) pick(choice.id);
  };

  const api = createCompanionApi(ROOT, service, {
    companion: () => companion,
    choose: pick,
    copy: async (text) => { await vscode.env.clipboard.writeText(text); },
    confirm: async (message, detail) => (await vscode.window.showWarningMessage(message, { modal: true, detail }, 'Write')) === 'Write',
    folder,
    tracked: (folder, file) => { try { execFileSync('git', ['ls-files', '--error-unmatch', file], { cwd: folder, stdio: 'ignore', windowsHide: true }); return true; } catch { return false; } },
    mokiServer: (project) => mokiServer(project, ROOT, mcpScript, which('node')),
    language: () => (vscode.env.language.toLowerCase().startsWith('pt') ? 'Portuguese (pt-BR)' : 'English'),
    showTerminal: (id) => { const t = live(id); t?.show(); return Boolean(t); },
    chatCapabilities: () => chats.capabilities(),
    selectedAi,
    selectAi: async (ai) => { await context.workspaceState.update(preferenceKey('ai'), ai); },
    startChat: (request) => chats.start(request),
    chooseFolder: async () => {
      const project = companion, workspace = workspaceDir(ROOT);
      const chosen = await vscode.window.showQuickPick(folders().map((path) => ({ label: basename(path), description: path })), { title: 'Moki workspace folder' });
      if (companion !== project || workspaceDir(ROOT) !== workspace) throw new Error('The project or folder changed. Try again from its project.');
      if (chosen) await context.workspaceState.update(preferenceKey('folder'), chosen.description);
    },
    createProject: async () => {
      const workspace = workspaceDir(ROOT);
      const offer = await service.pickFolder();
      if (!offer) return null;
      if (workspaceDir(ROOT) !== workspace) throw new Error('The workspace changed. Choose the folder again.');
      if (offer.project) { pick(offer.project.id); return offer.project.id; }
      const name = await vscode.window.showInputBox({ title: 'New Moki project', prompt: 'Project name', value: offer.name, ignoreFocusOut: true });
      if (!name) return null;
      if (workspaceDir(ROOT) !== workspace) throw new Error('The workspace changed. Choose the folder again.');
      const created = service.createProject(name, 'blank', offer.folder);
      pick(created.id);
      return created.id;
    },
  });
  // The operations' loop; a failure here never stops the extension (the run shows it).
  function drive(): void { try { api.drive(); } catch { /* shown in the run */ } }

  // The built page (app/companion.html) with a policy for the webview: scripts only with this page's nonce, no network.
  const page = (webview: vscode.Webview): string => {
    const nonce = randomBytes(16).toString('base64');
    const src = webview.cspSource;
    const csp = `default-src 'none'; script-src 'nonce-${nonce}'; style-src ${src} 'unsafe-inline'; img-src ${src} data:; font-src ${src}; connect-src 'none'; base-uri ${src}; form-action 'none'`;
    const lang = vscode.env.language.toLowerCase().startsWith('pt') ? 'pt-BR' : 'en';
    return readFileSync(join(webRoot.fsPath, 'companion.html'), 'utf8')
      .replace(/<html[^>]*>/, `<html lang="${lang}" data-lang="${lang}" data-theme="dark">`)
      .replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="${csp}">\n<base href="${webview.asWebviewUri(webRoot)}/">`)
      .replace(/ crossorigin/g, '') // the webview serves its files from its own origin
      .replace(/<script /g, `<script nonce="${nonce}" `);
  };

  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView: (view) => {
      view.webview.options = { enableScripts: true, localResourceRoots: [webRoot] };
      view.webview.html = page(view.webview);
      panels.add(view);
      view.onDidDispose(() => panels.delete(view));
      view.onDidChangeVisibility(() => { void view.webview.postMessage({ event: 'visible', visible: view.visible }); });
      // Messages come only from this page; each call is checked by companion-api.
      view.webview.onDidReceiveMessage(async (raw: unknown) => {
        const msg = (raw ?? {}) as { id?: unknown; method?: unknown; args?: unknown; event?: unknown; url?: unknown };
        if (msg.event === 'openLink' && typeof msg.url === 'string' && /^https?:\/\//.test(msg.url)) { void vscode.env.openExternal(vscode.Uri.parse(msg.url, true)); return; }
        // Run updates the person has not seen: a number on the Moki icon of the Activity Bar.
        if (msg.event === 'badge') {
          const count = typeof (raw as { count?: unknown }).count === 'number' ? Math.max(0, Math.floor((raw as { count: number }).count)) : 0;
          view.badge = count ? { value: count, tooltip: count === 1 ? '1 run update' : `${count} run updates` } : undefined;
          return;
        }
        if (typeof msg.id !== 'number') return;
        const reply = await api(msg.method, msg.args);
        void view.webview.postMessage({ id: msg.id, reply });
      });
    },
  };

  // The project's servers with their variables read from this environment; one whose variable is missing is left out.
  const servers = (): McpServer[] => (companion?.mcpServers() ?? []).flatMap((s) => { try { return [resolveServer(s)]; } catch { return []; } });
  // A definition's version changes only when its configuration does, so VS Code restarts only that server.
  const version = (s: McpServer): string => createHash('sha256').update(JSON.stringify(s)).digest('hex').slice(0, 16);

  context.subscriptions.push(
    status, mcpChanged, catalog, new vscode.Disposable(() => { clearTimeout(timer); watcher?.dispose(); }),
    vscode.window.registerWebviewViewProvider('moki.panel', provider, { webviewOptions: { retainContextWhenHidden: true } }),
    // VS Code's AI (Copilot) gets Moki's server, fixed to the project of this folder, and the servers the project has on.
    vscode.lm.registerMcpServerDefinitionProvider('moki', {
      onDidChangeMcpServerDefinitions: mcpChanged.event,
      provideMcpServerDefinitions: () => {
        if (!companion) return [];
        const own = servers().map((s): vscode.McpServerDefinition => (s.transport === 'http'
          ? new vscode.McpHttpServerDefinition(s.name, vscode.Uri.parse(s.url), s.headers, version(s))
          : new vscode.McpStdioServerDefinition(s.name, which(s.command) ?? s.command, s.args, s.env, version(s))));
        return [new vscode.McpStdioServerDefinition(
          'Moki', process.execPath, [mcpScript, '--project', companion.project],
          { ELECTRON_RUN_AS_NODE: '1', QA_ROOT: ROOT, QA_WORKSPACE: process.env.QA_WORKSPACE ?? null }, `${companion.project}-${buildId}`,
        ), ...own];
      },
    }),
    // Cursor opened on the linked folder reads <folder>/.cursor/mcp.json: Moki's entries go there after the person confirms.
    vscode.commands.registerCommand('moki.syncCursor', async () => {
      const r = await api('connectTool', ['cursor']);
      if (!r.ok) void vscode.window.showErrorMessage(r.error);
      else if (!(r.value as { cancelled: boolean }).cancelled) void vscode.window.showInformationMessage(`Cursor connected: ${(r.value as { file: string }).file}`);
    }),
    vscode.commands.registerCommand('moki.connectClaude', async () => {
      const r = await api('connectClaude', []);
      if (!r.ok) void vscode.window.showErrorMessage(r.error);
      else if (!(r.value as { cancelled: boolean }).cancelled) void vscode.window.showInformationMessage(`Claude Code connected: ${(r.value as { file: string }).file}`);
    }),
    vscode.commands.registerCommand('moki.showActivity', async () => {
      if (!companion) return;
      try { await vscode.window.showTextDocument(vscode.Uri.file(companion.logFile), { preview: true }); } catch {
        void vscode.window.showInformationMessage('The AI has not read anything from Moki in this project yet.');
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(resolveProject),
    // A step's terminal closed: done if it wrote its summary, else failed (the engine decides).
    vscode.window.onDidCloseTerminal((closed) => {
      for (const [id, { terminal, project }] of terminals) {
        if (terminal !== closed) continue;
        terminals.delete(id);
        if (project) { try { service.operationStepExited(project, id); } catch { /* not a step */ } }
        later();
      }
    }),
    vscode.commands.registerCommand('moki.chooseProject', chooseProject),
    vscode.commands.registerCommand('moki.refresh', () => { resolveProject(); refresh(); }),
    vscode.commands.registerCommand('moki.createProject', async () => {
      const r = await api('createProject', []);
      if (!r.ok) void vscode.window.showErrorMessage(r.error);
    }),
    vscode.commands.registerCommand('moki.startFromEditor', async () => {
      if (!companion) { void vscode.window.showInformationMessage('Choose a Moki project first.'); return; }
      const project = companion.project, targetFolder = folder();
      const editor = vscode.window.activeTextEditor;
      const linked = linkedFolder(companion.project, ROOT);
      if (!editor || editor.document.uri.scheme !== 'file' || !linked) { void vscode.window.showInformationMessage('Open a file in this project\'s linked folder first.'); return; }
      const rel = relative(resolve(linked.path), resolve(editor.document.uri.fsPath));
      if (!rel || rel.startsWith('..') || isAbsolute(rel)) { void vscode.window.showWarningMessage('This file is outside the project\'s linked folder.'); return; }
      if (editor.document.isDirty && !(await editor.document.save())) return;
      const activity = await vscode.window.showQuickPick(service.activities().activities.filter((a) => a.available && !a.needsFiles && a.id !== 'resume').map((a) => ({ label: a.label, description: a.hint, id: a.id })), { title: 'Start a Moki activity with this file' });
      if (!activity) return;
      const note = await vscode.window.showInputBox({ title: 'Moki activity', prompt: 'What should the AI do with this file?', ignoreFocusOut: true });
      if (note === undefined) return;
      if (companion?.project !== project || folder() !== targetFolder) { void vscode.window.showWarningMessage('The project or folder changed. Start again.'); return; }
      const line = editor.selection.isEmpty ? '' : `\nFocus on lines ${editor.selection.start.line + 1}-${editor.selection.end.line + 1}.`;
      const result = await api('startChat', [{ activity: activity.id, ai: selectedAi(), requestId: randomBytes(16).toString('hex'),
        note: note + line, context: [`${LINKED}/${rel.split('\\').join('/')}`], language: vscode.env.language.startsWith('pt') ? 'Portuguese (pt-BR)' : 'English' }]);
      if (!result.ok) void vscode.window.showErrorMessage(result.error);
      else void vscode.window.showInformationMessage((result.value as { message: string }).message);
    }),
    // <scheme>://orsi88.moki/open?project=<id>: the desktop app's "Moki in your IDE" right after installing. Shows
    // Moki's view, so its icon is there to use, and picks that project when the active workspace has it.
    vscode.window.registerUriHandler({
      handleUri: (uri) => {
        if (uri.path !== '/open') return;
        resolveProject(); // the app may have switched workspaces since this window started
        const project = new URLSearchParams(uri.query).get('project');
        if (project && listProjects(ROOT).includes(project)) pick(project);
        void vscode.commands.executeCommand('workbench.view.extension.moki');
      },
    }),
  );

  resolveProject();
}
