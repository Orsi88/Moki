# Activities

An **activity** is a reusable request: the entry you pick in **Call…** (also available from a note or the VS Code panel). It can be text alone, an agent with or without skills, one or more skills, a workflow or an operation. It says **what to ask, of whom and with what**.

| Piece | What it is | In a kitchen |
|---|---|---|
| **Skill** | The procedure: steps, rules, output, where to stop for approval | The recipe |
| **Agent** | A role with instructions and optional skills | The cook |
| **Operation** | Agents chained by arrows, each step in its own terminal | The kitchen line |
| **Activity** | The reusable request: its name, inbox files, optional skills, agent, workflow or operation, and the text sent to the AI | The menu item, which becomes the order |

## Call from the panel or a conversation

**Call…** opens one searchable list of Activities, Agents, Skills and Operations in the project panel and above a running AI terminal. Use **Ctrl+Shift+K** (macOS: **Cmd+Shift+K**) for the same list.

Choose an item, then supply its inbox files, shared context and optional note. **This terminal** pastes the prepared request at the current cursor without sending it or clearing your draft; add context and press Enter when ready. The terminal must be a running AI terminal in this project. **New terminal** uses the usual tool selection and launch.

An operation, including an activity that points to one, always opens its own start form: each step uses its own terminal. The list explains this before you choose it. A pasted request remains *prepared* until an actual matching run registers; Moki does not infer that you sent it.

## Three sources, one list

| Source | Where | Can you change it? |
|---|---|---|
| **Moki actions** | In the app's code: *Just open the project*, *Project context*, *Prepare the project*, *Plan the project with the AI*, *Resume a run* | No: their requests depend on the app (the project's plan, the run to resume). You can star them |
| **Comes with Moki** | [activities/](../activities/) in the framework: *Review user stories*, *Design tests*, *Review, then design tests*, *Failure pre-analysis*, *Build test evidence*, *Investigate a topic*, *Automation* | Read-only: **Duplicate to edit** makes a copy that is yours |
| **Yours** | `workspace/library/activities/<id>.md` | Yes, in **Settings › Activities** |

Your activities reach projects by **tags**, like agents and templates: no tag means every project of the workspace; a project's own tag or a shared tag limits it to those projects.

## Settings › Activities

The tab lists every activity with filters (All, Favorites, Comes with Moki, Your activities, Moki actions) and a search field.

- **New activity**: a name, a description, a category, its model (Text only, Agent, Skills, Workflow or Operation), which inbox files it needs (required, optional or none), the request sent to the AI, a hint for the note and the tags. Skills allows one or several selections.
- **The star** makes an activity a favorite: favorites come first wherever activities are picked.
- An activity of an **operation** opens the operation's start form instead of a request.
- An activity of an **agent** asks the AI to act as that agent, unless you choose another agent when you open it.
- The agent keeps its own instructions and skill list; an empty skill list is valid. Selecting skills in an activity does not edit an agent.
- **Text only** needs a request. It does not force a skill or an agent.

## The file

Each activity is a Markdown file: a frontmatter, then the request.

```markdown
---
label: "Design tests"
description: "scenario mapping, then test cases"
category: "QA"
uses: skill:test-design
files: required
note: ""
tags: ""
---

Use the test-design skill to map the test scenarios for: {files}.
```

| Field | Values |
|---|---|
| `label` | The name in the list (required) |
| `description`, `category`, `note` | Free text (the note is the hint shown for the person's note) |
| `uses` | Optional: `skill:<name>`, several distinct skills separated by commas (`skill:requirements-review, skill:test-design`), `agent:<name>`, `workflow:<id>` (a workflow of `qa-orchestrator`) or `operation:<id>`. Omit it for text only; then the request is required. Mixing target kinds is refused |
| `files` | `required`, `optional` or `none` |
| `tags` | Tags separated by commas; empty = every project |

In the request, `{files}` becomes the chosen inbox files (a line with `{files}` is left out when there are none), a line that starts with `{no-files}` is kept only when there are none, and `{project}` becomes the project id. An empty request asks for the skill, the workflow or the agent the activity uses. The app adds the rest of the request as for any activity: the project, the linked folder, the agent, the shared context, the files left out, your note and the language.

With several skills, the request always names all of them and preserves each one's procedure and approval gates, even when you supply custom text. If any selected framework skill is unavailable, the activity cannot start. Existing files with a single `uses` entry keep working without migration.

`npm run check` validates the files of `activities/`: each one parses, has an id that is not a Moki action, and either has a text-only request or references existing skills, a workflow or an agent of the framework (an operation lives in a workspace, so only your own activities can use one).

## Exceptions

| What you see | Why | What to do |
|---|---|---|
| *An activity that comes with Moki cannot be changed: duplicate it.* | Activities of the framework are read-only | **Duplicate to edit** |
| *There is no agent "…"* / *There is no workflow "…"* / *There is no operation "…"* | What the activity uses does not exist | Choose one from the list |
| *This activity needs at least one file from the inbox.* | Its `files` is `required` | Choose a file, or change it to `optional` |
| *The activity "…" starts the operation …* | An activity of an operation does not become a request | Pick it in the app: it opens the operation's form |
| The activity does not appear in a project | Its tags do not reach that project, or what it uses is not available yet | Check its tags; an operation must exist on this computer |
| An activity is shown as *Not available yet* | Its skill is planned, or its agent is not usable | Wait for the skill, or choose another target |
