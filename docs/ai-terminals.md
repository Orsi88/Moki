# AI terminals

Claude Code, Codex, Gemini CLI, Antigravity CLI and Cursor Agent run in **terminal tabs inside Moki**, in the project's folder. You talk to them as you always do; Moki gives them the project and keeps their work together.

## Opening one

- The **+** at the end of the tabs opens the **New** menu: **Terminal** (your shell), **AI** (each AI tool installed), **File** (a new empty file in the inbox) and **ArtCraft apps** (see [ArtCraft apps](artcraft.md)).
- Or press **Call…** and choose **New terminal** — the request goes in ready. See [Calling activities, agents and skills](call.md).

An AI opened from **New › AI** starts with the project's defaults (set in the project settings): the default agent's role, the default skills and your instructions. Its tab says so — *Claude Code · failure-analyst*. **Without the project defaults** opens a plain one.

A terminal **keeps running** when you go back to the start screen or to another project; opening the project again brings its tab back. Closing the tab stops it.

## Giving the AI images and files

- 📋 **Paste a screenshot** (Ctrl+V): it is saved in the project's `temporary/pasted/` and its path is typed in the prompt, so the AI reads the image. A text paste stays a text paste.
- 🖱️ **Drag files onto the terminal** — from the computer or from the project tree: their full paths are typed in the prompt (quoted when they have spaces). Nothing is copied into the inbox.
- 📎 **Call…** with **This terminal** pastes a ready request at the cursor, without sending it — add what you want and press Enter.
- 📄 **Use in the terminal** — right-click a file of **Context** or **Notes** (or the button of an open note): the AI is asked to read it and use it as context for what you ask next. It goes to the AI terminal in focus, or opens a new one; a file that looks like it holds a credential is refused.
- 🧩 In the **Skills and agents** card of the project panel, ▶ asks the AI to use that skill or agent, the same way.

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

Your **default AI** is set in **Settings › My AIs**, which also installs a missing terminal AI: a terminal tab shows the official command and runs it only after you type `y`. Codex and Gemini CLI install with npm: without Node.js, the tab offers to install it first (winget on Windows, Homebrew where it is installed), with its own `y`; elsewhere it shows nodejs.org. Moki never uses sudo; `npm install -g` with a system Node on Linux may need permissions.

## Claude accounts

Each Claude account is a Claude Code profile folder in your user folder: `~/.claude` (the default) or `~/.claude-<name>`, each with its own sign-in. **Settings › My AIs › Claude account** lists them by e-mail and sets the one Moki uses; with more than one account, the status bar's **Usage** also switches it. Every Claude that Moki opens afterwards (terminal tabs, the external terminal, the project chat) uses that account, and the plan usage shows it; a Claude already running keeps the account it started with. **Add account** creates an empty profile, makes it active and opens Claude in a terminal tab so you sign in. Skills and agents you installed for all projects live in `~/.claude`, so another profile does not see them; Moki's and the project's own still work.

## Project chat

Use the **Chat** ribbon icon or **Ctrl+L** (Cmd+L on macOS). When a terminal has the keyboard focus, Ctrl+L stays with the terminal (clear screen). There is one chat tab per project. Open it repeatedly to focus the same tab, move it between split views like a terminal, or close it and reopen it later.

The chat uses an installed **Claude Code** or **Codex** (shown as ChatGPT), with the project's instructions, skills, plugins and MCP tools: the same access as a terminal of that AI. A conversation stays with the AI it started with: the header names it, and there is no switch inside it. With both installed, **+** (new conversation) asks which AI; Call… uses the AI chosen there. Claude's answer appears as it is written; Codex shows each message when it is complete. Responses appear as they arrive, tool calls can be expanded, and **Stop** interrupts the response. New conversation and history stay inside the same tab. Transcripts are stored in the project's hidden `.chats/` folder and stay out of the file tree and document search. Closing a tab hides it; a running answer continues until it finishes, is stopped, or Moki exits. The next message can resume the tool session; if it is gone, the saved transcript supplies context for a new session.

When an answer links a Claude artifact (a presentation, spreadsheet or page on claude.ai), the link opens in a viewer inside the chat tab, with **Back to the conversation** and **Open in the browser**. Sign in to your claude.ai account once in the viewer to see private artifacts; if the sign-in is blocked there, use **Open in the browser**. The viewer is an isolated browser surface with no access to Moki or the project's files, and other links open in the browser as before.

**Call… › In the chat** is available with an installed Claude Code or Codex. It sends the validated project request at once, in a new conversation of the chat tab (like a new terminal); a draft you were writing stays in the message box. The request shows folded as *Request from Moki: <what was called>*, open it to read the full text the AI got, and that name titles the conversation.

## See also

- [Calling activities, agents and skills](call.md)
- [Troubleshooting](troubleshooting.md)
