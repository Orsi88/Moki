# Projects and workspaces

## Workspaces

A **workspace** is a folder with its own projects, tags and settings — one per company, client or area, for example. The first screen lists them; the last one opened is marked.

- **Create a workspace** — in `workspaces/<name>/` inside the Moki folder, or in a folder you choose.
- **Open a folder as a workspace** — Moki adds a `projects/` folder inside it.
- **Switch** at the bottom of the project list, or go back to the list with *Manage workspaces…*.

Projects of one workspace never see another one.

## Projects

A project is one body of work. Its id is short and lowercase (`billing-portal`) and its folder is `workspace/projects/<id>/`.

**Create one** with the **+** of the project list:

| You press | What happens |
|---|---|
| **Enter** (*Create project*) | It opens right away with its standard folders and nothing to set up. Context files appear as activities need them. |
| **Create and customize…** | Name, optional tags, and how the context starts: **Empty**, or **Planned with the AI** — the AI asks what it needs and writes a plan; context files appear only after you approve it. |

**Open a folder** you already have (the system's code, its documentation): a folder already linked opens its project; a new one asks a name, creates the project and links it. The linked folder shows first in the tree, live — its files are the originals, `.md` and `.txt` are edited in place, and `.git`, `node_modules`, build folders and hidden files are left out. AI settings found in the folder are copied to `.moki-backup/` inside it; nothing else changes.

On the start screen, **pin** a project to keep it on top, or **hide** one (its files stay; it moves under *Hidden*). **Deleting a project for good** asks you to type a word, and does not use the trash.

### Inside a project folder

```text
workspace/projects/billing-portal/
├── project.json          # name, language, linked folder, tags, defaults
├── context/              # confirmed knowledge only
├── proposed-updates.md   # what the AI noticed, waiting for you
├── activity-log.md
├── inbox/                # files you hand to the AI
├── notes/
├── temporary/            # scratch files, cleared after 7 days
└── runs/<run-id>/        # one folder per piece of work that delivered something
```

## Skills and agents in the project panel

The **Skills and agents** card lists this project’s own items, linked global skills and enabled/default agents. Click an item to use it with the AI, or drag it onto an open AI terminal to paste its request without sending it. An AI opened in the project is also told which project items are available. Context files and saved notes have **Use in the terminal** in their menu; a saved note also has that icon in its header.

## Context: what is known

`context/` holds only what is **confirmed** about the system — business rules, glossary, flows, permissions, environments. It is the only text the AI treats as known.

- When you confirm a definition in the conversation, the AI asks in one line: *Save this to the project context?* — answer yes and it is written there.
- Something the AI noticed but you did not confirm goes to **proposed updates** (under *Tracking*) and waits for your decision.
- [Hudson](runs.md#hudson-organizes-what-runs-leave-behind) can also bring documents from runs into the context.

## Tags: sharing between projects

Tags connect projects of the same workspace. Give a project or a single file a tag (under the project name, or in the bar above an open file); type a new name to create one.

A project with a tag can use, in its activities:

- the **confirmed context** of every other project with that tag — never their inbox, runs or evidence;
- every **file** tagged with it, in any project.

When you start an activity, a step *Which context should the AI consider?* lists those files, all checked; uncheck what this activity should not use. The AI reads them only, writes nothing in the other projects, and says which project each piece came from.

## Language

The conversation follows the language you write in. Deliverables are in **English** unless the project sets `"deliverableLanguage": "pt-BR"` in `project.json` or you ask for another language. Quoted messages stay in their original language.

## Coming back later

Close the app whenever you want. A run that stops at an approval or a question records where it is; ask the AI to continue it — in the same tool or another — and it reads that, tells you where you stopped, and goes on. The AI tools do not share a memory: **the files are the memory**.

## Sharing a project with a team

Put **that project folder** in its own private Git repository. It already ignores `runs/`, `inbox/` and `temporary/`. Project data never goes in Moki's public repository.

## Where things live

| What | Where |
|---|---|
| The app and your projects, after the installer | `Documents/Moki` |
| Other workspaces | `workspaces/<name>/` in the Moki folder, or the folder you chose |
| One project | `workspace/projects/<id>/` |
| One piece of work | `.../runs/<run-id>/` — deliverables in `outputs/` |
| Skills and agents of one project | `workspace/projects/<id>/skills` and `agents`, or `<linked folder>/.claude/` |
| Skills and agents of every project | `~/.claude/skills`, `~/.agents/skills`, `~/.claude/agents` |
| Your copies of built-in agents | `workspace/library/agents/` |
| Tags | `workspace/tags.json`, `project.json` → `tags`, and `tags.json` inside a project |

## See also

- [Privacy and isolation](privacy-and-isolation.md) — what the AI can and cannot read.
- [Runs and deliverables](runs.md) — what happens in `runs/`.
