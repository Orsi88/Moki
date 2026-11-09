# Connecting Azure DevOps and Jira

The tracker skills (`dispatch` and the agents that use it) read and write work items through the **MCP servers** you add in **Settings › MCP servers** ([mcp-servers.md](mcp-servers.md)). Moki never stores a credential: tokens stay in environment variables (`${NAME}`), and OAuth sign-in happens in your AI tool.

Without a server, or when it fails, the agents ask you to paste or attach the item instead and say that the content was **sent by you**, not read from the tracker.

> **Note:** what each server can do depends on your organization (sign-in method, scopes, permission groups an admin enabled). The first time an agent uses a server in a project it lists the tools it really has, and each kind of write is confirmed separately the first time it succeeds.

Checked against the vendors' documentation in November 2026: Atlassian *Rovo MCP Server — Getting started* and *Supported tools*; Microsoft *Remote Azure DevOps MCP Server* and the `microsoft/azure-devops-mcp` README.

## Jira Cloud (Atlassian Rovo MCP Server)

| Field in Moki | Value |
|---|---|
| Transport | HTTP |
| URL | `https://mcp.atlassian.com/v2/mcp` |
| What it can do | **Executes** (it creates and edits items; every write still waits for your approval in the skills) |

1. Save the server and give it to the project.
2. Open Claude Code from Moki in the project and run `/mcp`: the browser opens the Atlassian sign-in (OAuth 2.1, the recommended method).
3. Attachments: if Claude Code restricts network access, add `api.media.atlassian.com` and `*.frontend.public.atl-paas.net` to its `network.allowedDomains`.

API token sign-in is an alternative only when your organization admin enabled it. Delete tools are disabled by default, and Moki's skills never delete anyway.

## Azure DevOps — remote server (recommended by Microsoft)

The remote server needs **your own Microsoft Entra app registration** to sign in from Claude Code:

1. In the Azure portal, register an application:
   - Add the redirect URI `http://localhost:3118/callback` under *Mobile and desktop applications*.
   - Turn on *Allow public client flows*.
   - Add the API permission *Azure DevOps MCP* (delegated).
   - Grant admin consent. A tenant admin may have to do this step.
2. Copy the *Application (client) ID*.
3. In Moki, add the server:

| Field in Moki | Value |
|---|---|
| Transport | HTTP |
| URL | `https://mcp.dev.azure.com/<organization>` |
| Headers › OAuth client id | the Application (client) ID (public, not a secret) |
| Headers › Callback port | `3118` |
| Headers (optional) | `X-MCP-Insiders=true` to enable WIQL queries (`wit_query_by_wiql` is Insiders-only) |
| What it can do | Executes |

4. Open Claude Code from Moki and run `/mcp` to sign in.

The OAuth block is written only for Claude Code. Microsoft does not support Codex or Claude Desktop with the remote server. The organization must be backed by a Microsoft Entra tenant.

## Azure DevOps — local server (when an app registration is not possible)

| Field in Moki | Value |
|---|---|
| Transport | stdio |
| Command | `npx` |
| Arguments | `-y`, `@azure-devops/mcp`, `<organization>` (optionally `-d`, `core`, `work`, `work-items` to load only those domains; always keep `core`) |
| What it can do | Executes |

It needs Node.js 20 or later. By default it opens a browser to sign in. Other methods are chosen with the `--authentication` argument:

| Method | Argument | Environment |
|---|---|---|
| Interactive browser sign-in | (none) | — |
| Azure CLI | `--authentication`, `azcli` | an active `az login` |
| Personal access token | `--authentication`, `pat` | `PERSONAL_ACCESS_TOKEN=${PERSONAL_ACCESS_TOKEN}`, where the variable holds base64 of `<email>:<pat>` |

Microsoft states that the local server remains supported but new features go to the remote one first.
