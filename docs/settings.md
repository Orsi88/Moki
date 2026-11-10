# Settings

## Settings (the ⚙️ of the icon rail)

Seven tabs; besides *My AIs*, each is a list with filters and a search field. The ☆ on a card makes it a favorite: favorites come first in their list.

| Tab | What you do there |
|---|---|
| **Agents** | Roles with instructions and optional skills. Duplicate a built-in one, or create your own; tags say which projects it reaches. See [Agents and operations](agents.md). |
| **Activities** | The ready-made requests of **Call…**: Moki's, and your own — what to ask, of which skill, agent, workflow or operation, with which files. See [Activities](activities.md). |
| **My AIs** | The AI tools Moki opens, each with its version. **Make default** sets the one requests start in. **Install** a missing terminal AI (it shows the official command and runs it only after you type `y`). For VS Code and Cursor, install the Moki extension — see [Moki in the IDE](ide.md). |
| **Operations** | Agents linked by arrows into a multi-agent operation. See [Agents and operations](agents.md). |
| **Skills** | What is installed, what ships with Moki, and **Add a skill**: search the public [SkillMD](https://skillmd.com) registry, describe one for your AI to draft, or **upload** skills and agents from a `.claude` folder or a `.zip`. You choose and confirm before anything is installed. |
| **MCP servers** | The tools the AI gets — browsers, databases, trackers — for every project or for chosen ones. See [MCP servers](mcp-servers.md). |
| **Templates** | Font, colors, header, footer, logo and watermark of the PDF, Word and Excel files activities generate; tags say which projects use each one. |

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

At the top of the project settings: drop a `.md`, a skill folder, a whole `.claude` folder or a `.zip`. Moki sorts what it finds — skills, agents, activities — blocks what is unsafe or already there, and installs only what you confirm.

## See also

- [Calling activities, agents and skills](call.md)
- [AI terminals](ai-terminals.md)
