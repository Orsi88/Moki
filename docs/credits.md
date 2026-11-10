# Credits and licenses

Moki is free software ([MIT](../LICENSE)) built on top of other free and open-source projects. This page thanks them by name, says what each one does in Moki, and points to its license. If you maintain one of them: thank you. ❤️

> [!TIP]
> Every package below is a direct dependency in [`package.json`](../package.json) or comes inside one (marked *through …*). Their full license texts are in each package's folder under `node_modules/` after `npm install`, and in the installed app.

## 🏗️ Frameworks

The foundations Moki is built on.

| Framework | What it does in Moki | License |
|---|---|---|
| [Electron](https://www.electronjs.org) | Runs Moki as a desktop app on Windows, macOS and Linux: the windows, the menus, the file dialogs and the local protocols that serve PDFs, images and HTML previews to the screen. | MIT |
| [React](https://react.dev) | Draws every screen: the project tree, the tabs, the panel, Settings, the dialogs. | MIT |
| [TipTap](https://tiptap.dev) | The formatted editor of Markdown files and notes: headings, lists, tables, images, links, comments. | MIT |
| [ProseMirror](https://prosemirror.net) *(through TipTap)* | The editing engine under TipTap: the document model, the selection and undo. | MIT |
| [Playwright](https://playwright.dev) (Microsoft) | The tests that open the real app and click through it — and take the screenshots of this wiki. | Apache-2.0 |

## 🧰 Other open-source tools

### Platform and language

| Tool | What it does in Moki | License |
|---|---|---|
| [Node.js](https://nodejs.org) | Moki's command-line scripts (`npm run new-run`, `xlsx`, `docx`, `pdf`…) and the engine inside the app. | MIT |
| [TypeScript](https://www.typescriptlang.org) | The language most of Moki is written in, and the type checks that run before every commit. | Apache-2.0 |
| [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) (`@types/node`, `@types/react`, `@types/react-dom`, `@types/vscode`) | The type definitions of Node.js, React and the VS Code API used while building. | MIT |

### Documents

| Tool | What it does in Moki | License |
|---|---|---|
| [marked](https://marked.js.org) *(through TipTap)* | Reads Markdown so the editor can draw it. | MIT |
| [PDF.js](https://mozilla.github.io/pdf.js/) (Mozilla) | Shows PDFs inside Moki with selectable text, so you can highlight, comment and create notes from a page. | Apache-2.0 |
| [pdf-lib](https://pdf-lib.js.org) | Writes into PDFs: highlights and comments every viewer shows, replies, page edits (rotate, move, insert, delete) and title and author — without needing PdfCraft. | MIT |

### Diagrams and drawings

| Tool | What it does in Moki | License |
|---|---|---|
| [Mermaid](https://mermaid.js.org) | Draws the diagrams written as ` ```mermaid ` blocks inside documents — flowcharts, sequences, timelines. | MIT |
| [Excalidraw](https://excalidraw.com) | The editable hand-drawn style drawings (` ```excalidraw ` blocks), opened in its own editor inside Moki. | MIT |

### Terminals

| Tool | What it does in Moki | License |
|---|---|---|
| [xterm.js](https://xtermjs.org) | Draws the terminals where Claude Code, Codex, Gemini and the other AI tools run. | MIT |
| [@xterm/addon-fit](https://github.com/xtermjs/xterm.js) | Keeps each terminal at the size of its tab. | MIT |
| [node-pty](https://github.com/microsoft/node-pty) (Microsoft) | Gives those terminals a real shell process on your computer. | MIT |

### Building and packaging

| Tool | What it does in Moki | License |
|---|---|---|
| [Vite](https://vite.dev) | Builds the screens of the app. | MIT |
| [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react) | Lets Vite build React screens. | MIT |
| [esbuild](https://esbuild.github.io) | Builds the app's main process and the IDE extension. | MIT |
| [electron-builder](https://www.electron.build) | Makes the installers (`.exe`, `.dmg`, `.AppImage`, `.deb`, `.rpm`). | MIT |
| [vsce](https://github.com/microsoft/vscode-vsce) (Microsoft) | Packages the [VS Code extension](ide.md). | MIT |

## 🌐 Open standards and tools Moki works with

These are not inside Moki, but Moki is designed around them.

| Project | How Moki uses it | License |
|---|---|---|
| [Model Context Protocol](https://modelcontextprotocol.io) | The protocol of the [MCP servers](mcp-servers.md) Moki gives the AI, and of Moki's own server for the IDE. | MIT |
| [OpenAI Codex CLI](https://github.com/openai/codex) | One of the AI tools Moki opens in a terminal and uses for the quick assistants and Hudson. | Apache-2.0 |
| [Gemini CLI](https://github.com/google-gemini/gemini-cli) | One of the AI tools Moki opens in a terminal. | Apache-2.0 |
| Agent Skills (`SKILL.md`) | The portable format of Moki's skills, read by Claude Code and other tools. See the [skill standard](skill-standard.md). | — |

## The images of this wiki

The screenshots are taken from the real app by a Playwright test ([`tests/ui/wiki-shots.spec.ts`](../tests/ui/wiki-shots.spec.ts)), on a sample project made up for it. The diagrams are Mermaid blocks drawn by GitHub.

---

Missing a project, or a license wrong? [Open an issue](https://github.com/Orsi88/moki/issues) and we fix it.
