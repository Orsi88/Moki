# What is Moki

Moki is a **local workspace for AI-assisted work**. It does not bring an AI of its own: it works with the one you already use — Claude Code, Codex, Gemini, Cursor, Antigravity, Copilot Chat or a web chat — and gives it the project's context, files, notes, tools and a clear request.

Everything stays **on your computer**, in plain folders and Markdown files you can open with any program. Moki organizes the work; your AI tool does the work.

## The idea

A workspace contains projects. A project keeps what is known, what you hand over, what you write down and what the AI delivers. When you choose an activity, agent, skill or operation, Moki prepares a request with the right project material. The AI works in that project and the result stays there.

## The words you will see

| Word | What it means |
|---|---|
| **Workspace** | A folder with its own projects, tags and settings — for example one per company, client or area of work. Projects of one workspace never see another one. |
| **Project** | One body of work: a product, codebase, client, research subject or system. It has a folder with `context/`, `inbox/`, `notes/` and `runs/`. |
| **Context** | What is *confirmed* about the project: rules, glossary, decisions, flows, environments and other knowledge. The AI treats only this as known. |
| **Inbox** | The files you hand to the AI: a document, log, spreadsheet, PDF, image or anything else the project needs. |
| **Note** | A place to think, draft, summarize, research or collect material. Notes can be loose or part of a project. |
| **Skill** | A procedure the AI follows step by step, with its rules, output and approval points. |
| **Agent** | A role with instructions and optional skills. |
| **Activity** | A ready-made request you pick in **Call…**: what to ask, of whom and with which files or context. |
| **Operation** | Several agents linked by arrows, each in its own terminal, handing work to the next. |
| **Run** | One piece of work that produced a result or waits for your approval. Its deliverables are what you see in the tree. |
| **Routine** | A read-only check over project files, folders or an MCP source that can notify you about changes. |

## How Moki behaves

- 🏠 **Local first.** Projects live in `Documents\Moki` or the folder you choose. Nothing is sent anywhere unless your AI tool or an explicitly configured integration sends it.
- 🧱 **Projects are isolated.** The AI reads the active project and only the shared files you allow through tags. See [Privacy and isolation](privacy-and-isolation.md).
- 📝 **Notes are part of the workspace.** They save automatically, can be sent to a project or an AI terminal, exported and improved through quick assistants.
- ✋ **You approve the important steps.** Activities and operations stop at their approval points instead of silently changing or publishing something.
- 💬 **Answers come in the conversation.** Questions, definitions and small changes can stay in the chat. A file is created when you ask for one or when the work produces a deliverable.
- 🗂️ **The files are the memory.** AI tools do not share a memory. A run records where it stopped, so you can continue tomorrow or in another tool.
- 🧭 **Nothing is invented.** Missing information becomes a question or a pending item, never a guess presented as fact.

## What Moki is not

- It is **not an AI** and does not need an account of its own: your AI tool keeps its own login and plan.
- It is **not a cloud service**: there is no Moki server holding your projects.
- It is **not a replacement for your AI tools**: it prepares the project and the request, while the selected AI performs the work.
- It is **not limited to one domain**: quality workflows come with it, alongside workflows for research, documentation, engineering, APIs, data, interfaces and other work.

## Next

➡️ [Getting started](getting-started.md) — install Moki and create your first project.
