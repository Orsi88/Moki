# 🐾 Moki

**Your QA desk, on your computer, for the AI you already use.**

Moki keeps each project — its context, files, notes and deliverables — in a folder on your machine, and opens Claude Code, Codex, Gemini, Cursor or a web chat with the request already written. The AI does the work following Moki's skills; you approve each important step; the files are the memory, so you can stop today and continue tomorrow in any tool.

[![Latest release](https://img.shields.io/github/v/release/Orsi88/moki?label=download&color=c99a22)](https://github.com/Orsi88/moki/releases/latest) [![License](https://img.shields.io/github/license/Orsi88/moki?color=4b8c58)](https://github.com/Orsi88/moki/blob/main/LICENSE)

```mermaid
flowchart LR
  you([You]) -->|pick what to do| moki[Moki]
  moki -->|request with project and files| ai[Your AI tool]
  ai -->|reads skills and context| files[(Project folder)]
  ai -->|delivers what you asked| files
  files -->|opens, edits, comments| moki
```

*Moki prepares the request; your AI does the work in the project folder; Moki shows and edits what it delivered.*

---

## 🚀 Start in 5 minutes

1. **[Install Moki](getting-started.md)** — one installer on Windows; macOS and Linux from the source.
2. **Create a project** — give it a name and drop the story, log or document you are working on.
3. **Press Call…**, choose what you want (review a story, design tests, analyse an error…) and the AI opens with everything ready.

New here? Read **[What is Moki](what-is-moki.md)** and take the **[tour of the screen](tour.md)**.

---

## 🧭 What do you want to do?

| | I want to… | Go to |
|---|---|---|
| 📝 | Review a user story before development | [QA skills and agents](qa-skills.md) |
| 🧪 | Map scenarios and write test cases | [QA skills and agents](qa-skills.md) |
| 🐞 | Pre-analyse an error from a log | [QA skills and agents](qa-skills.md) |
| 📸 | Build test evidence (spreadsheet and Word) | [QA skills and agents](qa-skills.md) |
| 🎫 | Open bugs and tasks in Azure DevOps or Jira | [Azure DevOps and Jira](trackers.md) |
| 🔎 | Research a subject in depth, with sources | [QA skills and agents](qa-skills.md) |
| ✍️ | Improve a note's writing with one click | [Notes and quick assistants](notes.md) |
| 🧹 | Clean up the files the AI left behind | [Runs and deliverables](runs.md) |
| 🖥️ | Use Moki inside VS Code or Cursor | [Moki in the IDE](ide.md) |
| 🔌 | Give the AI tools such as a browser or a database | [MCP servers](mcp-servers.md) |

---

## 👀 A look inside

![The project screen: the project's folders on the left, a user story open in the editor, the project panel with Call… on the right](assets/wiki/en/project.png)

*A project: its folders on the left, a story open in the editor (what the editor cannot draw, such as HTML or footnotes, stays exactly as written), and the project panel with **Call…** on the right.*

---

## ❤️ Built with open source

Moki stands on the shoulders of free and open-source projects. **Thank you** to every person who builds and maintains them.

| Project | What it does in Moki | License |
|---|---|---|
| [Electron](https://www.electronjs.org) | The desktop app itself, on Windows, macOS and Linux | MIT |
| [React](https://react.dev) | Every screen of the app | MIT |
| [TipTap](https://tiptap.dev) and [ProseMirror](https://prosemirror.net) | The Markdown editor of documents and notes | MIT |
| [marked](https://marked.js.org) | Reading Markdown for the editor | MIT |
| [xterm.js](https://xtermjs.org) and [node-pty](https://github.com/microsoft/node-pty) | The terminals where the AI tools run | MIT |
| [PDF.js](https://mozilla.github.io/pdf.js/) and [pdf-lib](https://pdf-lib.js.org) | Reading, highlighting and commenting PDFs | Apache-2.0 · MIT |
| [Mermaid](https://mermaid.js.org) | Diagrams drawn inside documents | MIT |
| [Excalidraw](https://excalidraw.com) | Hand-drawn style drawings you can edit | MIT |
| [Vite](https://vite.dev), [esbuild](https://esbuild.github.io) and [TypeScript](https://www.typescriptlang.org) | Building the app | MIT · MIT · Apache-2.0 |
| [Playwright](https://playwright.dev) | The automated tests that click through the app | Apache-2.0 |
| [electron-builder](https://www.electron.build) and [vsce](https://github.com/microsoft/vscode-vsce) | The installers and the VS Code extension | MIT |
| [Node.js](https://nodejs.org) | Moki's scripts and the app's engine | MIT |

The full list, with what each one does and where its license is: **[Credits and licenses](credits.md)**.

---

## 🗺️ Find your way

- **Start here** — [What is Moki](what-is-moki.md) · [Getting started](getting-started.md) · [A tour of the screen](tour.md)
- **Everyday use** — [Projects and workspaces](projects.md) · [Files and the editor](files-and-editor.md) · [Notes and quick assistants](notes.md) · [AI terminals](ai-terminals.md) · [Calling activities, agents and skills](call.md) · [Runs and deliverables](runs.md) · [Settings](settings.md)
- **QA work** — [QA skills and agents](qa-skills.md) · [Activities](activities.md) · [Agents and operations](agents.md)
- **Help** — [Troubleshooting](troubleshooting.md) · [Privacy and isolation](privacy-and-isolation.md)

Something unclear or missing? [Open an issue](https://github.com/Orsi88/moki/issues) — the documentation is part of the product.
