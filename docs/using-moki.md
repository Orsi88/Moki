# Using Moki

## Inside a project

**Picking up where you left off.** Document tabs reopen in their saved order when you return to a project or reload Moki, with the active file, Markdown view mode and vertical scroll position restored. This preference belongs to the current workspace and project on this computer. Closed tabs stay closed; missing or unreadable files are skipped. Only view metadata is stored, never file contents or unsaved drafts. Scroll restoration covers Moki's document views, including text areas, spreadsheet grids and its PDF pages, but not the contents of isolated native PDF/HTML viewers. Notes opened separately and terminal processes keep their existing lifecycle.

**Inside a project.** A tree of the project: context, inbox, activities, notes. Drop files onto the window and they are copied into the inbox — up to 40 files, 200 MB each. Folders are skipped. Drag a file onto another folder to move it there, or drop a file from the computer onto a folder to copy it into that folder. Execution files stay out of both. Markdown is formatted in a TipTap editor, and a drawing or diagram there stays a card that is drawn. Any .md file can be edited there: what the editor cannot draw (HTML, the properties block at the top, footnotes, callout marks) is kept exactly as written, as a card or a tag you can edit as text, and an edit rewrites only the paragraph it touched. A file over 1 MB opens as editable text. **Ctrl+E** switches to the source, also editable, **Ctrl+S** saves, **Ctrl+W** closes. The reload button on the file reads it from disk again, so a version the AI just wrote shows up without closing the tab. The ⋯ menu and a right-click can send a file or folder to the trash; the fixed folders (context, inbox, notes, temporary, execution files) are emptied and stay, and `project.json` is not deleted that way. Deleting a project for good is on the project list and does not use the trash. The assistant card can also start by naming a skill: the request opens in the chosen AI and cites that skill. Word files are turned into text so any AI can read them. Excel files show their values and PDFs open with selectable text; with PdfCraft installed you can highlight and comment on them, and edit their pages (rotate, move, insert, delete) and their title and author (a file from the inbox, and any page edit, goes to an `-edited.pdf` copy). The button next to them opens either in its own program, and "…" lets you choose it (Excel, Word and PDF). Files the AI saves show up in the tree as they land.

**Groups and split views.** Every terminal you open starts its own group, with a name and a color, like a browser's tab groups: its tab and the files that belong to that work stay together. The deliverables of the runs an AI creates open by themselves in its group, without taking the screen, with a dot until you look at them (only deliverables: never the files it uses to get there). A file you open joins the group on screen. Right-click a group's chip to rename it, change its color or close its files; right-click a tab to move it to another group. The split button (top right) divides the screen into up to 4 views; each has its own row of groups and tabs, so one group can be on both sides (the terminal on one, the file you review on the other) or each view can show another group. Drag a tab to another view, and drag the dividers to resize.

**Call…**, in the project panel or above an AI terminal, opens one search for Activities, Agents, Skills and Operations. **Ctrl+Shift+K** (macOS: **Cmd+Shift+K**) opens the same list.

1. Choose what to call.
2. Choose inbox files, shared context and an optional agent when applicable.
3. Add an optional note, then choose **This terminal** or **New terminal**.

**This terminal** pastes at the current cursor without sending or clearing your draft. Add context and press Enter when ready. It requires a running AI terminal in this project. **New terminal** lets you choose the AI tool; your default comes from **Settings › My AIs**, and a different choice applies only to this request.

Claude Code, Codex, Gemini CLI, Antigravity CLI and Cursor Agent open in a terminal tab. Paste a screenshot there (Ctrl+V) and it is saved in the project's `temporary/pasted/` and its path typed in the prompt, so the AI reads the image; files dragged onto the terminal, from the computer or the project tree, are typed by their path. Cursor and VS Code open the folder with the request copied. Web chats and *Just show the request* prepare text to copy. An operation always opens its own start form because every step uses its own terminal; its list entry explains this.

To talk through an idea, choose an agent in **Call…** and add the subject as an optional note. No run starts unless its procedure or your request calls for one.

**Project settings** (the sliders next to the project's name in the panel, or the ⋯ menu of the project folder) hold the project's name and description and what an AI opened in it starts with. One section per kind:

- **When an AI opens here**: optional instructions, sent with the defaults below to every AI opened without choosing something.
- **Agents**: the ones the project enables; the star makes one a default.
- **Skills**, **Activities**, **Operations**: the defaults of each kind, several if you want.
- **Your activities**, **Templates**: checking one here gives it the project's tag, the same tag Settings shows (and the other way round); one reached through a shared tag, or meant for every project, is locked with the reason. The template in use styles the deliverables.
- **MCP servers**: the ones the project gets, read-only (change them in Settings).

**Bring to this project** (top of the project settings) takes skills, agents and activities, one at a time (a .md, a skill folder) or a whole .claude folder or .zip, dragged in or chosen. Moki sorts what it finds by kind, blocks what is unsafe or already there, and installs only what you confirm: skills for all projects (linked here), agents and activities among yours with this project's tag. The workspace settings list them too, with a mark saying which project they were brought from.

An AI opened in the project (New › AI) starts with them: one activity that needs no files as the only default starts right away; otherwise the AI takes the default agent's role, uses the default skills, says in a line or two what is set up and what it needs, and waits. Its tab says so ("Claude Code · failure-analyst"). An activity you choose in **Call…** goes without the defaults and the instructions, and **Call…** lists the defaults first. In New › AI, *Without the project defaults* opens one with none of them.

Then you talk in that tool as usual. The request names the project, the linked folder, and the skills and agents installed for it.

**Settings** (the gear) has seven tabs; besides My AIs, each one is a list with filters and a search field:

| Tab | What you do there |
|---|---|
| **Agents** | Roles with instructions and optional skills. Duplicate a built-in one, or create your own; tags say which projects it reaches. |
| **Activities** | The ready-made requests you pick in "Call…": the ones of Moki, and your own (what to ask, of which skill, agent, workflow or operation, with which files). See [Activities](activities.md). |
| **My AIs** | The AI tools Moki opens (terminal and editor), each with its version (the path in its tooltip). The card's icon does its main action (install, or install or update the Moki extension) and its **…** menu has the others, such as **Make default**, the one activities start in. **Install** a missing terminal AI: a terminal tab shows the official command and runs it only after you type `y`; then **Check again**. For VS Code and Cursor, **Install the Moki extension and open** installs the extension of this app's version (from its release, checked by SHA-256) and opens the editor on the project's linked folder; a missing editor gets **Download**. In Cursor the extension is marked *Not verified*. An AI not found here, chosen while starting an activity, brings you to this tab. |
| **Operations** | Agents linked by arrows into a multi-agent operation. See [Agents and operations](agents.md). |
| **Skills** | What is already installed, what ships with Moki, the app plugins (in purple), and **Add a skill**: search the public [SkillMD](https://skillmd.com) registry, describe one for your AI tool to draft, or **Upload** skills and agents from a `.claude` folder (or a `.zip`) on your computer. The same upload is in **Set up project** (for the project or for every project) and on the start screen without a project open (for every project). You choose the items and confirm before anything is installed. Caveman and superpowers stay off until you turn them on in the project panel’s Plugins section; they then load in every AI session opened from that project. |
| **MCP servers** | The tools the AI gets, global or for chosen projects. See [MCP servers](mcp-servers.md). |
| **Templates** | Font, colours, header, footer, logo and watermark for the PDF, Word and Excel files activities generate; tags say which projects use each one. |

**ArtCraft apps.** The **+** menu of the terminals ends with **Download ArtCraft apps…**: the 16 apps of the [ArtCraft Launcher](https://github.com/storytold/craft-launcher) suite (the launcher first: it installs and updates the others). **Download** shows the file, the release and the address, and asks you to confirm; Moki then downloads the file for your computer, checks its SHA-256, saves it where you choose in the system dialog and shows the folder. When your system has more than one format (on Linux, the package of your distro such as .rpm or .deb, an AppImage or a .tar.gz; on Windows, an .msi or a portable .zip), you choose which one, with the best fit marked as recommended. It never installs or runs it: open the file yourself (an .rpm or .deb runs its install scripts when you open it). Messages: [Troubleshooting](troubleshooting.md).

**Favorites.** The star on a card of Activities, Agents, Operations, Templates or Skills makes it a favorite: favorites come first in their list, and starred activities come first wherever an activity is picked. They are kept per workspace in `library/favorites.json`.

Notes on a project are Markdown files under `notes/` and open in their own window. Loose notes on the start screen stay in the app until you send one to a project. In a PDF, selecting text offers **Create a note from here**: a note in the same project's `notes/`, titled `<file> p<page>`, with the quote and a source line (file, page, rect in points); the PDF is not changed. A project note can be exported from its window as **PDF** (needs Edge, Chrome or Chromium), **Markdown** or **text**: a save dialog asks where, and the file goes there (outside the workspace, only by that choice); images embedded in the note are kept in the PDF and Markdown and left as `[description]` in text.

**Quick loose notes.** The note button at the bottom of the fixed icon rail, just above the sidebar toggle, opens a new loose note in the main area, as notes open there (on the start screen, or over a project's tabs). Over Settings, which fill the main area, it opens on top and can be resized from its corner. The ↗ button opens it in the notebook, a window of its own. Closing the note saves it and returns to the same view without replacing document tabs or terminals. It stays on this computer without a project until you explicitly use **Send to a project**. Existing notes are still listed on the start screen; its notes-section header no longer has a separate **+**.

## Projects

**Dialogs and menus.** Pop-ups use Moki's current palette and light/dark mode, independently of document and CLI colors. A theme change also updates note and search windows already open. Confirmations appear inside Moki: no action runs until you choose to continue, and Cancel has initial focus. Tab stays in a modal and Escape closes only the top dialog (or its open menu); focus returns to the control that opened it when that control still exists. Busy dialogs do not close while their operation is running. File and folder open/save pickers remain native system dialogs.

A project is one body of work. Its id is short and lowercase (`billing-portal`), and its folder is `workspace/projects/<id>/` — or `<workspace folder>/projects/<id>/` in another workspace.

A quality project looks like this. A blank project has the same skeleton and gains `context/` only after you approve `plan.json`.

```text
workspace/projects/billing-portal/
├── project.json          # name, language, linked folder, who may see data
├── context/              # confirmed knowledge only
├── proposed-updates.md   # things the AI noticed, waiting for you
├── plan.json             # blank projects: the plan, until you approve it
├── tags.json             # tags of single files
├── activity-log.md
├── inbox/                # files you hand to the AI
├── notes/
└── runs/<run-id>/        # one folder per activity
    ├── state.json        # current step, so you can stop and resume
    ├── inputs/  outputs/  evidence/  logs/
```

During an activity the AI may notice something that looks like a general rule. It writes that to `proposed-updates.md` and asks you before it becomes context. Confirmed text is the only text it may treat as known.

Deliverables are in **English** unless you set `"deliverableLanguage": "pt-BR"` in `project.json`, or ask for another language in the activity. The conversation follows the language you write in. Quoted messages stay in their original language.

## Tags

Tags connect projects of the same workspace. Give a project or a file a tag (under the project name, or in the bar above an open file); type a new name to create one.

A project with a tag can use, in its activities:

- the **confirmed context** (`context/`) of every other project with that tag — not their inbox, runs or evidence;
- every **file** tagged with it, in any project.

When you open an activity, a *Which context should the AI consider?* step lists those files, all checked. Uncheck what this activity should not use; files of the project itself can be left out there too. The request then lists exactly the shared files the AI may read. It reads them only, writes nothing in the other projects, says which project each piece came from, and proposes new knowledge in `proposed-updates.md` instead of treating it as confirmed.

The tag catalog is `tags.json` in the workspace folder; a project's tags are in its `project.json`.

## Sharing a project

To share context with a team, put **that project folder** in its own private Git repository. It already ignores `runs/`, `inbox/` and `temporary/`. Project data does not belong in this public repository.

## Come back later

Close the session whenever you want. Each activity writes `state.json` as it goes. Ask the AI to continue that run — in the same tool or another — and it reads the file, summarizes where you stopped, and goes on from there. The tools do not share a memory. The files are the memory. In a chat tool, upload `state.json` and the relevant context again.

## Only what you asked for

The AIs deliver only the files you asked for, in the format you asked; when you do not say the format and the activity does not set one, they ask. No copy in another format, no screenshot of a spreadsheet, no helper file next to it: helper files go to the run's `work/` folder and are cleared when the run is completed. If something extra still lands in a run's outputs, the run's page lists it under **Leftovers**, for you to send to the trash.

## Where things live

| What | Where |
|---|---|
| The app's library and your projects, after the installer | `Documents/Moki` |
| Other workspaces | `workspaces/<name>/` in the Moki folder, or the folder you chose; the list is `workspaces/workspaces.json` |
| One project | `workspace/projects/<id>/` (or `projects/<id>/` in another workspace) |
| Confirmed knowledge | `.../context/` |
| One activity | `.../runs/<run-id>/`: deliverables in `outputs/`; helper files in `work/`, cleared when the run is completed |
| Scratch files outside a run | `.../temporary/`: what is older than 7 days goes to the trash when the project opens |
| Skills and agents for this project | `workspace/projects/<id>/skills` and `agents`, or `<linked folder>/.claude/` |
| Skills and agents for every project | `~/.claude/skills`, `~/.agents/skills`, `~/.claude/agents` |
| Copies of built-in agents | `workspace/library/agents/` |
| Document style | `workspace/document-style.json`, or the same file inside one project |
| Tags | `workspace/tags.json` (catalog), `project.json` → `tags`, and `tags.json` inside a project (its files) |
