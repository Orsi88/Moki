# AI terminals

Claude Code, Codex, Gemini CLI, Antigravity CLI and Cursor Agent run in **terminal tabs inside Moki**, in the project's folder. You talk to them as you always do; Moki gives them the project and keeps their work together.

## Opening one

- The **+** at the end of the tabs opens the **New** menu: **Terminal** (your shell), **AI** (each AI tool installed), **File** (a new empty file in the inbox) and **ArtCraft apps**.
- Or press **Call…** and choose **New terminal** — the request goes in ready. See [Calling activities, agents and skills](call.md).

An AI opened from **New › AI** starts with the project's defaults (set in the project settings): the default agent's role, the default skills and your instructions. Its tab says so — *Claude Code · failure-analyst*. **Without the project defaults** opens a plain one.

A terminal **keeps running** when you go back to the start screen or to another project; opening the project again brings its tab back. Closing the tab stops it.

## Giving the AI images and files

- 📋 **Paste a screenshot** (Ctrl+V): it is saved in the project's `temporary/pasted/` and its path is typed in the prompt, so the AI reads the image. A text paste stays a text paste.
- 🖱️ **Drag files onto the terminal** — from the computer or from the project tree: their full paths are typed in the prompt (quoted when they have spaces). Nothing is copied into the inbox.
- 📎 **Call…** with **This terminal** pastes a ready request at the cursor, without sending it — add what you want and press Enter.

## Following what the AI does

- A **file path** the AI prints becomes a link: **Ctrl+click** opens it in Moki.
- Each AI terminal is its own **group of tabs**: the files it delivers open in its group, with a dot until you look at them, without taking the screen.
- The status bar shows how much of your **AI plans** you have used.

## The AI tools

| Tool | Opens as |
|---|---|
| Claude Code, Codex, Gemini CLI, Antigravity CLI, Cursor Agent | A terminal tab in Moki |
| Cursor, VS Code | The editor, on the project's folder, with the request copied — see [Moki in the IDE](ide.md) |
| A web chat (ChatGPT, claude.ai, Gemini) | The request ready to copy, with the files listed |

Your **default AI** is set in **Settings › My AIs**, which also installs a missing terminal AI: a terminal tab shows the official command and runs it only after you type `y`.

## See also

- [Calling activities, agents and skills](call.md)
- [Troubleshooting](troubleshooting.md)
