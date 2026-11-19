# Moki

🇧🇷 [Leia em português](README.pt-BR.md)

<p align="center"><img src="app/public/hero.png" alt="Moki" width="280" /></p>

<p align="center">
  <a href="https://github.com/Orsi88/Moki/releases/download/v0.6.1/Moki.Setup.0.6.1.exe"><b>⬇️ Download Moki for Windows</b></a>
  &nbsp;·&nbsp; <a href="https://github.com/Orsi88/Moki/releases">releases</a>
  &nbsp;·&nbsp; <a href="https://github.com/Orsi88/moki/wiki">documentation</a>
</p>

Moki is a local workspace for AI-assisted work. It turns a folder into a living project with context, files, notes, reusable activities, skills, agents, external tools and a record of what has been delivered.

You choose the work and the AI tool. Moki prepares the request, keeps the project organized and lets you continue later — even in another tool. There is no Moki account, no Moki server and no lock-in.

Moki works with the AI you already use: Claude Code, Codex, Gemini, Cursor, Antigravity, Copilot Chat or a web chat.

## What Moki gives you

### Projects and context

- Organize several projects inside independent workspaces.
- Keep confirmed context, inbox files, notes, temporary files and delivered outputs together.
- Link an existing folder without copying it.
- Use tags to share selected context between projects while keeping projects isolated.
- Resume work from the files and state recorded by each run.
- Merge a project into another when two turn out to be one: nothing is overwritten, and note titles, links, comments and tags follow.
- Move files and folders in the tree by dragging them, or Ctrl+click several to move or delete them together.

### Notes and quick assistants

Notes are a first-class place to think, plan and collect material before it becomes a deliverable.

- Create loose notes or notes inside a project; they save automatically.
- Write formatted Markdown, use `/` commands, mention project files with `@` and paste images.
- Open notes in their own notebook window, mark them as favorites and share project notes through tags.
- Move a project note to another project with its title, tags and star.
- Send a note to an AI terminal as context, export it as PDF, Markdown or text, or create a note from a selected passage in a PDF.
- Use one-click assistants to improve writing, summarize, research or review a note critically.
- Review the proposed changes before accepting them: nothing changes until you approve it.

See [Notes and quick assistants](https://github.com/Orsi88/moki/wiki/Notes-and-quick-assistants).

### AI work, activities and operations

Moki turns reusable instructions into work you can start from the app, a terminal or the IDE:

- **Activities** are ready-made requests with their files, context and instructions.
- **Skills** are procedures with rules, outputs and approval points.
- **Agents** are roles that combine instructions and skills.
- **Operations** chain several agents, each in its own terminal, passing work to the next step.
- **Runs** record what happened, where the work stopped and which files were delivered.
- Important steps wait for your approval instead of silently changing the project or publishing something.

You can use the built-in workflows or create your own activities, skills and agents.

### Project chat

Open the project's single **Chat** tab with the ribbon icon or **Ctrl+L**. The chat runs your installed Claude Code with direct access to the project's files, skills and MCP tools, and a Claude artifact it links (a presentation, spreadsheet or page) opens inside the tab. **Call… › In the chat** sends the request at once, in a new conversation. See [AI terminals and project chat](docs/ai-terminals.md).

### Documents, PDFs and diagrams

Moki is also a workspace for reading, editing and reviewing the material your AI works with:

- Open and edit Markdown and text files, preview HTML, and work with Word, Excel, PDF and image files.
- Read PDFs, select passages, create notes, add comments and make page edits through PdfCraft.
- Comment on Markdown, HTML, Word, Excel, PDFs and diagrams, with comments anchored to the relevant passage or region.
- Open, inspect, zoom, pan, export and comment on Mermaid, PlantUML, D2 and Graphviz diagrams.
- Create and edit Excalidraw drawings and diagrams inside documents and notes.
- Read code files with your editor's colors, comment on lines, tie notes to them and open the file in your IDE in one click.
- Mark passages, blocks or areas with your own markers (an icon, a name and what it means) by right-clicking — in Markdown, code, PDFs and HTML pages. The AI reads what each marker means.

### Routines, notifications and integrations

- Schedule read-only checks over project files, folders or MCP sources.
- See what is new, changed or gone, with a baseline that is replaced only by a successful complete check.
- Review the result as a notification, compare the old and new versions in a report and start the update activity from it when you are ready.
- Connect project tools through MCP, including browsers, trackers and other external services.
- Use the same project context, agents, skills and MCP servers in VS Code or Cursor through Moki in the IDE.

### Workflows for many kinds of work

Moki includes ready-made workflows for software quality, requirements, research, documentation, engineering, APIs, data, interfaces and evidence. Quality workflows are one part of the library — the project model, notes, AI orchestration, document workspace and integrations are useful beyond QA.

## How it works

1. Choose or create a **workspace**.
2. Create a **project**, or open an existing folder as one.
3. Add files, notes and confirmed context.
4. Choose **Call…**, an activity, agent, skill or operation, then select the AI tool.
5. Review the result, approve the important steps and continue whenever you want.

## Install

1. Download [Moki.Setup.0.6.1.exe](https://github.com/Orsi88/Moki/releases/download/v0.6.1/Moki.Setup.0.6.1.exe) (or the latest file on [Releases](https://github.com/Orsi88/Moki/releases)).
2. Install at least one AI tool you want to use.
3. For VS Code, download [moki-0.6.1.vsix](https://github.com/Orsi88/Moki/releases/download/v0.6.1/moki-0.6.1.vsix) and install it with `code --install-extension moki-0.6.1.vsix`.

Your projects live in **Documents\Moki** by default. A newer installer refreshes the app without touching your workspaces. For macOS, Linux and running from source, see [Getting started](https://github.com/Orsi88/moki/wiki/Getting-started).

## Documentation

The full documentation is in the [wiki](https://github.com/Orsi88/moki/wiki):

| Guide | What it covers |
|---|---|
| [What is Moki](https://github.com/Orsi88/moki/wiki/What-is-Moki) | The model, the vocabulary and how Moki behaves |
| [Getting started](https://github.com/Orsi88/moki/wiki/Getting-started) | Installation, workspaces and your first project |
| [Projects and workspaces](https://github.com/Orsi88/moki/wiki/Projects-and-workspaces) | Context, tags, linked folders and isolation |
| [Notes and quick assistants](https://github.com/Orsi88/moki/wiki/Notes-and-quick-assistants) | Notes, the notebook, exports and one-click AI assistants |
| [Files and the editor](https://github.com/Orsi88/moki/wiki/Files-and-the-editor) | Documents, previews, comments, PDFs and diagrams |
| [Calling activities, agents and skills](https://github.com/Orsi88/moki/wiki/Calling-activities,-agents-and-skills) | Reusable requests and how to start them |
| [Runs and deliverables](https://github.com/Orsi88/moki/wiki/Runs-and-deliverables) | Execution state, outputs and continuation |
| [Moki in the IDE](https://github.com/Orsi88/moki/wiki/Moki-in-the-IDE) | VS Code, Cursor and project-aware AI |
| [MCP servers](https://github.com/Orsi88/moki/wiki/MCP-servers) | External tools available to each project |
| [Routines and notifications](https://github.com/Orsi88/moki/wiki/Routines-and-notifications) | Scheduled checks, baselines and proposals |
| [Specialized workflows](https://github.com/Orsi88/moki/wiki/QA-skills-and-agents) | Built-in QA, research, documentation and engineering workflows |

## Privacy

Projects stay on your computer and are never part of this repository. The AI reads the active project and only the shared files you allow through tags. Moki does not store your project in a cloud service.

## Contributing

```bash
git clone https://github.com/Orsi88/moki.git
cd moki
npm run setup
npm run qa
```

Before a commit: `npm run build`, `npm run typecheck`, `npm run check` and `npm test`. Documentation changes go in [docs/](docs/), which is the source for the wiki. Keep [README.md](README.md) and [README.pt-BR.md](README.pt-BR.md) in sync. More: [Contributing](https://github.com/Orsi88/moki/wiki/Contributing).

## License

[MIT](LICENSE)
