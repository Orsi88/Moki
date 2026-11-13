# MCP servers (MCP Manager)

Moki keeps the MCP servers your agents, operations and the IDE use in one list per workspace (`workspace/mcp-servers.json`), managed in **Settings › MCP servers**. Each server says where it applies:

| Where it applies | Who gets it |
|---|---|
| **Global** | Every project of the workspace |
| **Specific projects** | Only the projects chosen for it |

Where a server applies is set in its row of the list: the **Global** switch, or, with it off, the folder button beside it, which opens the list of projects to tick; the projects chosen show as small chips under the row (the × of a chip takes that project out). Turning Global off changes nothing until a first project is chosen, and a server for specific projects keeps at least one (to give it to every project, turn Global on). The same choice is in the server's form.

A server can also be switched **off**: it stays in the list and no project gets it.

## Connect a server, step by step

1. Open the workspace that owns the project. Open **Settings › MCP servers › Add server**.
2. Give the connection a name you recognize. Choose **Global** to make it available to every project in this workspace, or choose the specific projects that may use it.
3. Select the transport provided by the MCP server. For **stdio**, enter its **Command** and **Arguments**, one argument per line. For **HTTP**, enter its MCP endpoint in **URL**. Use the server's documented command or endpoint; a service's normal web address is not necessarily an MCP endpoint.
4. Choose **Reads data** for a connection that routines will use, and keep **On** checked. This declaration does not change the account's permissions at the provider; select read tools for monitoring.
5. Open the environment/headers tab if authentication needs variables. Enter references such as `API_TOKEN=${MY_API_TOKEN}` for stdio or `Authorization=Bearer ${MY_API_TOKEN}` for HTTP, then set that variable on the computer. Restart Moki after changing the environment so its process can receive the variable. Never paste the credential value into Moki.
6. If the provider requires interactive sign-in, complete it using the provider's supported flow. The optional HTTP OAuth client fields are for Claude Code; see [Azure DevOps and Jira](trackers.md) for provider-specific setup and limitations.
7. Click **Save**, then **Test**. Success lists the tools the server offers. If the test fails, correct the reported command, variable, authentication or timeout problem before continuing. Testing lists tools; it does not execute your saved query or prove every tool has permission to read its target.
8. Confirm that the connection is on and includes the intended project. Open a new AI session from that project to receive the updated configuration, or continue with [Create a routine](routines.md#create-a-routine).

### Example: local Azure DevOps MCP

With Node.js and `npx` installed, choose stdio and use command `npx` (on Windows, use the installed `npx.cmd` path if needed). Enter these arguments, one per line:

```text
-y
@azure-devops/mcp
YOUR_ORGANIZATION
```

`YOUR_ORGANIZATION` is a placeholder for the organization's actual name. Complete the provider's sign-in with your own account, save and test the connection. The installed server version determines its tool names: the version used for Moki 0.5.7 verification offered `wit_query` for query reads and `wit_work_item` for item reads. Reuse the names your **Test** result actually lists. A successful connection can then feed a [saved-query routine](routines.md#example-follow-a-saved-azure-devops-query).

### Import an existing connection

1. In **Settings › MCP servers**, choose **Import JSON** to paste a supported Claude Code, Cursor or VS Code configuration, or select **Import into Moki** under **Found in the AI tools**.
2. Choose where the imported connection applies. Import brings its definition into the workspace catalog; it does not import the provider's sign-in session.
3. Set any environment variables Moki reports, review access and project scope, then save and test the connection.

## Rules

| Situation | What happens |
|---|---|
| Add a global server | Every project of the workspace gets it, new projects included |
| Add a server for specific projects | Only those projects get it |
| Change a server | Every project it applies to uses the new definition |
| Switch a server off, or delete it | No project gets it any more |
| A project is deleted | It is left out of the servers that listed it |
| Switch workspace | The other workspace's list |
| An operation is running | Its steps keep the servers they had when it started |

- **Ids** are made from the name, never change on rename and are unique in the list (a second server with the same name gets `-2`). Agents name servers by id in their `mcps` contract (`docs/agents.md`).
- **Access:** `read` queries data; `execute` changes something outside Moki, so an operation step that uses it waits for your approval.
- **An agent gets only what its contract names and its project has.** A global server never gives any agent unrestricted access.

## Credentials

Moki never stores credential values. In Environment and Headers, write `${VARIABLE}` (for example `Authorization=Bearer ${GITHUB_TOKEN}`) and set the variable on the computer. Values that look like a token, password or key, written as is, are refused; an imported configuration that has them gets `${VARIABLE}` names instead, which Moki lists so you can set them. The variables are read only when a server starts or is tested, and are never written to Moki's files or logs.

## OAuth sign-in

An HTTP server can carry an optional **OAuth client** (Headers tab: client id and callback port) for servers that sign in with your own app registration, such as the Azure DevOps remote server in Claude Code. A client id is public; a client secret is never accepted, and one in an imported configuration is left out. The block is written only into Claude Code's configuration (Cursor and Codex do not get it; Codex lists it as skipped). Setup of Azure DevOps and Jira: [trackers.md](trackers.md).

## Testing

**Test** starts the server once (stdio, without a shell) or calls it (HTTP), asks for its tools and stops it. The result is kept in `workspace/mcp-status.json` and every action in `workspace/logs/mcp.log`, without values. A failure says why: command not found, a variable not set, credentials refused, no answer in 15 seconds.

## Where the servers reach the AI tools

| Tool | How |
|---|---|
| Claude Code started from Moki | `--mcp-config` with the project's servers that are on and Moki's own server for the project (your own Claude Code servers still load) |
| Cursor and Cursor Agent started from Moki | The `moki` and `moki-*` entries of `<Moki folder>/.cursor/mcp.json`; your entries stay. It holds the last project started in Cursor |
| Cursor opened on the system's folder | `Moki: Sync MCP Servers to Cursor` in VS Code writes the same entries to `<linked folder>/.cursor/mcp.json` after you confirm; `writeAllowed: false` refuses it and the current file is backed up to `.moki-backup/` first |
| VS Code with the Moki extension | Copilot Chat: Moki's server and the project's servers that are on, registered automatically (a server whose variable is not set is left out). Claude Code in VS Code: **Connect Claude Code** in the Moki panel writes the same entries to the folder's `.mcp.json` after you confirm. **Open in Claude Code** in the panel starts it with `--mcp-config` |
| Codex started from Moki | `--no-daemon` and `-c` overrides for the project's servers that are on and Moki's own server. The session does not attach to Codex's shared daemon, which would keep only the servers from the home config. The home `~/.codex/config.toml` (where the login lives) is not changed. A variable is passed by name, never written as a value. OAuth sign-in stays on Claude Code |
| Gemini CLI and Antigravity started from Moki | The `moki` and `moki-*` entries of `<Moki folder>/.gemini/settings.json` (Gemini's workspace settings; `httpUrl` for an HTTP server). Your entries stay. It holds the last project started in either tool. The home `~/.gemini` login and `~/.gemini/antigravity/mcp_config.json` are not changed |

Moki's own server (`ide/mcp/server.ts`) is read-only and bound to one project: the AI reads the project's files through it, context first (it prevails when it disagrees with another folder), then the other folders, notes, shared context, agents and skills. A PDF is returned as its text (`ide/vscode/README.md`).

**Found in the AI tools** lists the servers already configured in the tools' own files (`.mcp.json`, `~/.claude.json`, `.cursor/mcp.json`, `.vscode/mcp.json`, `.gemini/settings.json`); **Import into Moki** brings one into the catalog.
