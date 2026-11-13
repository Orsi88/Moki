# Moki

🇧🇷 [Leia em português](README.pt-BR.md)

<p align="center"><img src="app/public/hero.png" alt="Moki" width="280" /></p>

<p align="center">
  <a href="https://github.com/Orsi88/moki/releases/latest"><b>⬇️ Download Moki for Windows</b></a>
  &nbsp;·&nbsp; <a href="https://github.com/Orsi88/moki/releases/download/v0.5.5/Moki.Setup.0.5.5.exe">Moki.Setup.0.5.5.exe</a>
  &nbsp;·&nbsp; <a href="https://github.com/Orsi88/moki/wiki">documentation</a>
</p>

Moki is a local app for the AI tool you already use. It keeps a project on your computer — files, confirmed knowledge, skills and the record of each activity — and opens Claude Code, Cursor, Codex, Gemini or a chat with the request ready.

Your AI tool does the work. Moki prepares the request and keeps the files. There is no account and no server.

It started as software quality work: review a story, design tests, look at a failure, assemble evidence. That still ships with the app. A project can also be a folder you already have, a blank project the AI plans with you, or skills and agents you add yourself.

---

## Install

1. Download [Moki.Setup.0.5.5.exe](https://github.com/Orsi88/moki/releases/download/v0.5.5/Moki.Setup.0.5.5.exe) (or the latest file on [Releases](https://github.com/Orsi88/moki/releases)).
2. If Windows says it protected your PC, choose **More info → Run anyway**. The installer is not digitally signed yet.
3. Install an AI tool too (Claude Code, Cursor, Codex, Gemini, or a chat you already use).

For VS Code, download [moki-0.5.5.vsix](https://github.com/Orsi88/moki/releases/download/v0.5.5/moki-0.5.5.vsix) and run `code --install-extension moki-0.5.5.vsix`: [Moki in the IDE](https://github.com/Orsi88/moki/wiki/Moki-in-the-IDE).

Your projects live in **Documents\Moki**, and a newer installer never touches them. macOS, Linux and running from the source: [Getting started](https://github.com/Orsi88/moki/wiki/Getting-started).

## First steps

1. Open Moki and choose a **workspace** (a folder of projects, like an Obsidian vault).
2. Create a **project** (only a name, or customized with tags and setup) or open a folder you already have as one.
3. Drop the stories, logs or documents onto the window: they go to the project's inbox.
4. Press **play**, choose the activity and your AI tool. The request opens there, ready.
5. Talk to the AI as usual. Each activity records where it stopped, so you can come back later, in the same tool or another.

## What it does

| Activity | What you get |
|---|---|
| [Review user stories](skills/requirements-review/SKILL.md) | Ambiguities, gaps, one question at a time, a review matrix (Excel) and a final definitions report (PDF) |
| [Design tests](skills/test-design/SKILL.md) | Scenario map, then — after your OK — manual test cases in Excel |
| [Failure pre-analysis](skills/failure-analysis/SKILL.md) | A short note for developers, from your description and the log |
| [Build test evidence](skills/qa-orchestrator/references/workflows/test-evidence.md) | The work item and the Jam recordings, then a spreadsheet and a Word document with the prints |
| [Project context](skills/project-context/SKILL.md) | Onboarding, updates, and the plan for a blank project |
| [Engineering specialists](docs/engineering-specialists.md) | Cartógrafo for data, Inventor for solutions, Artesão for working interface prototypes and Sentinela for API assessment/validation |

Agents chain these into **multi-agent operations**, MCP servers give the AI your tools (Playwright, Azure DevOps, Jira…), and the **VS Code extension** brings the project's context to the AI of your editor.

## New in 0.5.5

- **Codex reads the project.** A session starts on its own, so the project's MCP servers arrive, including Moki's. Moki returns the text of a PDF. `context/` stays first when it disagrees with another folder; the project's other folders stay available.
- **Drawings and diagrams.** A `.excalidraw` file opens to look at; the pencil in the file bar shows the tools, and the canvas follows the document theme. A diagram or drawing inside a note can be resized, and its pencil opens the editor. Hold Ctrl and scroll to zoom. A comment rail you minimize stays minimized when you return to that file.
- **Notes in the project.** Project notes have their own section at the bottom of the sidebar, in the same list as the loose notes on the workspace.
- **The IDE sees every folder.** Context comes first, then notes, inbox, runs, temporary files and the rest. A description already written on a card is not repeated in a bubble. The workspace menu uses the same soft gold edge as the notification panel.

## New in 0.5.4

- **Routines and notifications.** Schedule a check on a project: a read-only MCP query, project files or a folder. Moki reports what is new, changed or gone and leaves a proposal waiting for your approval. The bell shows it.
- **Diagram review.** Open `.mmd`, `.puml`, `.d2` and `.dot` with zoom, pan, fit, export and comments on a region. Mermaid draws offline. PlantUML, D2 and Graphviz use a Kroki server only when you configure one.
- **The same comments on Word, Excel and HTML.** They use the comment column already used for PDF and Markdown. Click a comment to land on the passage.
- **Codex, Gemini and Antigravity get the project.** A session receives the project's MCP servers, skills and agents, as Claude already did. Code blocks are colored by language, and a note sent to a project leaves the loose notes.
- **Templates and Configurador.** Upload a base file (`.docx`, `.xlsx`, `.md`, `.pdf`) for the AI to follow in structure. Configurador sets Moki up from plain words and applies only the plan you approve.

## Documentation

The full documentation is in the [wiki](https://github.com/Orsi88/moki/wiki):

| Guide | What is in it |
|---|---|
| [What is Moki](https://github.com/Orsi88/moki/wiki/What-is-Moki) | The idea, the words you will see, how Moki behaves |
| [Getting started](https://github.com/Orsi88/moki/wiki/Getting-started) | Install, workspaces, projects, running from the source |
| [A tour of the screen](https://github.com/Orsi88/moki/wiki/A-tour-of-the-screen) | Every part of the window, explained |
| [Projects and workspaces](https://github.com/Orsi88/moki/wiki/Projects-and-workspaces) | Context, tags, sharing, coming back later, where things live |
| [Notes and quick assistants](https://github.com/Orsi88/moki/wiki/Notes-and-quick-assistants) | Notes, and improving them with the AI in one click |
| [Calling activities, agents and skills](https://github.com/Orsi88/moki/wiki/Calling-activities,-agents-and-skills) | Everything **Call…** can do, and the activities that come with Moki |
| [Runs and deliverables](https://github.com/Orsi88/moki/wiki/Runs-and-deliverables) | What the AI delivers, and Hudson, who organizes it |
| [QA skills and agents](https://github.com/Orsi88/moki/wiki/QA-skills-and-agents) | The activities, their status, your own skills |
| [Agents and operations](https://github.com/Orsi88/moki/wiki/Agents-and-operations) | Agents, contracts and multi-agent operations |
| [MCP servers](https://github.com/Orsi88/moki/wiki/MCP-servers) | The tools the AI gets, per project |
| [Moki in the IDE](https://github.com/Orsi88/moki/wiki/Moki-in-the-IDE) | The VS Code extension: install, configure, every way to use it |
| [Troubleshooting](https://github.com/Orsi88/moki/wiki/Troubleshooting) | Common problems and what to do |
| [Credits and licenses](https://github.com/Orsi88/moki/wiki/Credits-and-licenses) | The open-source projects Moki is built with — thank you |

The wiki is published from [docs/](docs/), where the documentation is edited.

## Privacy

Projects stay on your computer and are never part of this repository. The AI reads the active project, plus only the shared files the request lists because of tags you set. Passwords and tokens do not belong in any file: refer to an environment variable by name. Details: [Privacy and isolation](https://github.com/Orsi88/moki/wiki/Privacy-and-isolation).

## Contributing

```bash
git clone https://github.com/Orsi88/moki.git
cd moki
npm run setup
npm run qa
```

Before a commit: `npm run build`, `npm run typecheck`, `npm run check` and `npm test`. Documentation changes go in `docs/` (the wiki is generated from it); keep `README.md` and `README.pt-BR.md` in step. More: [Contributing](https://github.com/Orsi88/moki/wiki/Contributing).

## License

[MIT](LICENSE)
