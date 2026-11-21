# Moki for VS Code (Moki light)

A light version of [Moki](https://github.com/Orsi88/moki) in the side bar of VS Code: start activities, use your project's agents, choose what goes to the AI and follow runs. Select your AI once per project and start a supported native agent in a separate chat tab with the request already sent. Moki gives the AI your project's context, agents, skills and MCP servers. The desktop app does not have to be open.

## Use it

1. Open the folder of your system. If it (or a folder above it) is linked to a Moki project ("Choose my folder" in the app), the panel and the status bar show **Moki: <project>**; otherwise choose the project at the top of the panel.
2. Click the Moki icon in the activity bar. With no project yet, use **Create project** and choose its folder. The panel has five tabs:

| Tab | What you do |
|---|---|
| **Activities** | Pick one (Design tests, Review user stories, Failure pre-analysis…), choose inbox files, an agent, a note and the language |
| **Agents** | The agents this project uses, with what they do; pick one to work with it |
| **Context** | Switch each context file, note or shared file on or off for the AI; the star gives it to the AI first |
| **Operations** | Start an operation with an AI selected for each step |
| **Runs** | Resume activities and follow operations step by step |

3. Choose your **AI**, open an activity or agent, and use **Start in a new chat**. The request goes directly to a newly created session; existing conversations and drafts stay intact. **Other ways to start** holds the terminal and copy routes. Copying leaves the current chat alone.

Automatic launch requires VS Code 1.147 or newer, a single matching open folder, and the AI's registered native new-session command. Integrated Copilot, Claude and Codex agents are detected at runtime; a standalone vendor extension may offer different capabilities. Cursor prompt links require manual confirmation, so the panel explains that limitation and offers the alternatives. An unconfirmed delivery is never retried automatically; check the new tab before trying again.

From an editor, **Moki: Start Activity with This File** saves a dirty file and includes its project-relative reference and the selected line range. Context exclusions still apply.

A file switched off stays out of the requests and of what the AI can read through Moki's MCP server. Choices are saved per project in `workspace/projects/<id>/companion.json`.

## Operations

A multi-agent operation linked to the project starts from **Operations**: choose the AI of each step, fill what the agents need (text and inbox files) and what you want, then **Start the operation**. Follow it in **Runs**. Each step opens in its own VS Code terminal (**Moki · <AI>**). The extension moves the run on by itself whenever the project's files change, even with the panel closed: a step is done when it writes its summary (`handoff/<slot>.md`) and its outputs, and the next one starts. Open the run to:

- **answer** a step's question (typed into its terminal when it is open, otherwise the step reopens with your answer);
- **approve**, **send back with notes** or **end** a step that waits for approval (approval arrows, and steps that execute through an MCP);
- **try again** a step whose terminal closed before its summary, with the same or another AI;
- **choose the path** when no arrow fits a result, or a step would run too many times;
- **pause**, **cancel** (its terminal is closed) and **show its terminal**.

Operations are the same as in the app (same engine and run folder, `workspace/projects/<id>/runs/`), so a run started here can be followed there and the other way round. Editing operations and linking them to a project stay in the app.

## MCP servers

- **Connections** shows the selected folder, configuration drift, missing variable names and authentication reminders. **Test** checks server initialization and tool discovery; it does not prove the AI has authenticated or enabled those tools.
- **Claude Code**, **Cursor** and **Codex** read `.mcp.json`, `.cursor/mcp.json` and `.codex/config.toml` respectively. **Connect MCPs** writes only Moki's entries after confirmation, preserves your entries and backs up the previous file. Codex requires a trusted project; unsupported settings are reported.
- **Copilot Chat** receives server definitions automatically (`MCP: List Servers`). A server with missing `${VARIABLE}` values is omitted from those definitions and identified in **Connections**.

The palette commands `Moki: Connect Claude Code` and `Moki: Sync MCP Servers to Cursor` remain available. Reconnect file-based clients after changing projects or servers. Credentials remain environment-variable references; enter authentication through the selected AI.

The servers themselves are managed in the app (Settings › MCP servers, `docs/mcp-servers.md`).

Moki's own server is read-only and bound to one project when it starts:

| Tool | What it returns |
|---|---|
| `moki_get_project` | The project: name, description, deliverable language, tags, agents, skills and MCP servers |
| `moki_list_resources` | References (id, title, description, mode), without content |
| `moki_search_knowledge` | Matching lines in the files the AI may read |
| `moki_get_resource` | The text of one resource |
| `moki_get_context` | The context pack for a task: the starred files with text (within a budget), then references to the most related ones |
| `moki_get_agent` | An agent's instructions; reading them does not run the agent |

Files of other projects are reachable only through a shared tag, and secret-looking files (`.env*`, keys, certificates, `credentials*`) are never listed or read. `Moki: Show What the AI Read` opens `workspace/projects/<id>/logs/companion.log`. Other AI tools can use the server too: `npm run mcp -- --project <id>` from the repository.

## Security

The panel is a small page (`app/companion.html`) in a webview with its own Content-Security-Policy: scripts only with the page's nonce, styles and images only from the extension, no network. It talks only to `desktop/companion-api.ts`, a closed list of calls that always use the project VS Code is connected to (a project sent by the page is ignored) and go through the same service as the desktop app. AI tools start as a command plus arguments, never through a shell.

## Build it from the source

From the repository root, with Node.js 22.18 or newer:

```bash
npm install
npm run vscode:build     # the extension, the panel, the MCP server and the framework copy in ide/vscode/dist
npm run vscode:package   # release/moki-<version>.vsix
```

Try it without installing: `code --extensionDevelopmentPath="$PWD/ide/vscode"` (build first). Install the package with `code --install-extension release/moki-<version>.vsix`. VS Code 1.101 or newer.

Validate with `npm run typecheck`, `npm test` and `npm run check`. After `npm run vscode:build`, `node tests/ide/run.mjs <absolute-path-to-Code-executable>` runs an isolated extension-host smoke test with a synthetic AI, preserving a prior tab and draft without contacting a model. The focused panel UI test is `node tests/ui/run.mjs companion.spec.ts` after `npm run app:build`.

The extension shares the desktop app's framework and workspace locations. The framework normally lives in `<Documents>/Moki` or the `QA_ROOT` override. When that location is in a Git checkout or worktree, the installed framework goes to the user's application data directory while the workspaces stay at their original paths. Keep `version` in `ide/vscode/package.json` equal to the root `package.json`; the build stops when they differ. How it fits the rest of Moki: `skills/moki-architecture/references/architecture.md` (layer 7b).
