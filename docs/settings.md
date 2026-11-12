# Settings

## Settings (the ⚙️ of the icon rail)

Settings uses a sidebar grouped into **Your workspace**, **Connections** and **Preferences**. Choose a section with the mouse or the Up/Down keys; Home/End moves to the first/last section. The sidebar becomes an icon rail in a narrow window. Each section keeps its own task-specific search and actions. The ☆ on a card makes it a favorite: favorites come first in their list.

**Configurador** (below the sections, and in each project's settings): say in your own words what you want set up — a routine that watches a folder, an activity, an agent, a connection, a template, tags. Your AI prepares a plan with what really exists; you check the steps you want and **Apply**, and each one goes through the same checks as these screens. Nothing changes before you apply. In a terminal, ask for the `configurador` agent: it shows the plan in the chat and applies it with `npm run configure` after your OK.

| Tab | What you do there |
|---|---|
| **Agents** | Roles with instructions and optional skills. Duplicate a built-in one, or create your own; tags say which projects it reaches. See [Agents and operations](agents.md). |
| **Activities** | The ready-made requests of **Call…**: Moki's, and your own — what to ask, of which skill, agent, workflow or operation, with which files. See [Activities](activities.md). |
| **My AIs** | The AI tools Moki opens, each with its version. **Make default** sets the one requests start in. **Install** a missing terminal AI (it shows the official command and runs it only after you type `y`). For VS Code and Cursor, install the Moki extension — see [Moki in the IDE](ide.md). |
| **Operations** | Agents linked by arrows into a multi-agent operation. See [Agents and operations](agents.md). |
| **Skills** | What is installed, what ships with Moki, and **Add a skill**: search the public [SkillMD](https://skillmd.com) registry, describe one for your AI to draft, or **upload** skills and agents from a `.claude` folder (agents in subfolders included) or a `.zip`. With a project open you choose **all projects** or **this project only**. You choose and confirm before anything is installed. |
| **MCP servers** | The tools the AI gets — browsers, databases, trackers — for every project or for chosen ones. See [MCP servers](mcp-servers.md). |
| **Templates** | Font, colors, header, footer, logo and watermark of the PDF, Word and Excel files activities generate; tags say which projects use each one. **Upload a base file** (.docx, .xlsx, .md or .pdf; .doc and .xls are converted) and the AI follows its structure and formatting for new documents, like a model attached in a chat, with an optional note on what to keep. |
| **Themes** | Moki's palette and appearance, plus independent themes for terminals and documents. |
| **Routines and notifications** | Scheduled project checks, completed analyses awaiting review, execution history and workspace preferences. |

### Routines and notifications

**Routines** lists the project, schedule, next check and state. Open a routine to edit its objective, sources, schedule and response mode. A source is a **query in a connection** (called again on every run; every record it returns is followed), **project files** or a **project folder**: each run shows what is new, what changed and what is gone. Weekly schedules show weekdays; monthly schedules show the day; intervals are entered in minutes. **Run now** starts one check; the additional actions pause, resume, duplicate or archive it. Archiving preserves history.

**Approvals** shows completed analyses and the exact proposed file contents. A finding without file changes asks for acknowledgment. A file update requires explicit approval, validates every original file before writing, and recovers interrupted applications through a journal. Analyses still being prepared cannot be approved.

**History** shows execution progress, warnings and errors. A routine waiting on its AI stays waiting until the analysis and operation handoff arrive. **Preferences** controls scheduling, background execution, startup, concurrent analyses (0 pauses AI analysis) and history retention. In-app and system notifications are chosen independently inside each routine. A notification opens its routine or proposal without approving it.

## Project settings

The sliders next to the project's name in the panel (or the ⋯ of the project folder) open the project's own settings — one section per kind:

| Section | What it sets |
|---|---|
| **Project** | The name and the description. |
| **When an AI opens here** | Optional instructions sent to every AI opened without choosing something. |
| **Agents** | The agents the project enables; the ★ makes one a default. |
| **Skills, Activities, Operations** | The defaults of each kind — several if you want. |
| **Your activities, Templates** | Checking one gives it the project's tag (the same tag Settings shows); the template in use styles the deliverables. |
| **MCP servers** | The ones the project gets (read-only here; change them in Settings). |

An AI opened in the project starts with these defaults: with **one activity that needs no files** as the only default it starts right away; otherwise it takes the default agent's role, uses the default skills, says in a line what is set up, and waits. An activity you choose in **Call…** goes without them.

### Bring to this project

At the top of the project settings: drop a `.md`, a skill folder, a whole `.claude` folder (agents in subfolders included) or a `.zip`. Moki sorts what it finds — skills, agents, activities — blocks what is unsafe or already there, and installs only what you confirm. **Select all** and **Clear selection** work per kind and per folder.

Choose where it goes:

- **All projects** (the default) — skills go to your user folder and are linked here; agents and activities go among yours, so every project has them;
- **This project only** — everything goes into this project's own folders.

What the project has then shows in the **Skills and agents** card of its panel.

## See also

- [Calling activities, agents and skills](call.md)
- [AI terminals](ai-terminals.md)
