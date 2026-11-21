# App plugins

Plugins the desktop app loads **only in the sessions it opens** (`desktop/launcher.ts`); the same tool started outside the app is not affected.

| Plugin | What it does | Claude Code | Codex | Needs |
|---|---|---|---|---|
| `ponytail/` | simplest code that works | `--plugin-dir` (skills + hooks) | `-c developer_instructions` pointing to `ponytail/skills/ponytail/SKILL.md` | Node.js for the Claude hooks |
| `rtk/` | shorter shell output | `--plugin-dir` (PreToolUse hook `rtk hook claude`) | `-c developer_instructions` asking for the `rtk` prefix | the `rtk` CLI on the PATH |
| `caveman/` | terse replies, fewer tokens | `--plugin-dir` (skills + hooks) | `-c developer_instructions` pointing to `caveman/skills/caveman/SKILL.md` | Node.js for the Claude hooks; **only in projects that turn it on** (the Skill tab of the project panel, or Settings → Skills → Plugins, saved as `"plugins": ["caveman"]` in `project.json`) |
| `codegraph/` | code index of the linked folder | `--plugin-dir` (the MCP server `codegraph serve --mcp --no-telemetry`) | `-c mcp_servers.codegraph.*` + one line of `developer_instructions` | the `codegraph` command on the PATH; a linked folder; **only in projects that turn it on** (`"plugins": ["codegraph"]`) |
| `superpowers/` | development workflow skills | `--plugin-dir` (skills + SessionStart hook) | `-c developer_instructions` pointing to `superpowers/skills/using-superpowers/SKILL.md` | bash for the Claude hook (Git Bash on Windows; without it the skills load but the hook is skipped); **only in projects that turn it on** (`"plugins": ["superpowers"]`) |

A plugin whose requirement is missing is skipped. ponytail and rtk are always on; caveman, codegraph and superpowers are per project (`PROJECT_PLUGINS` in `scripts/lib/core.ts`).

`package.json` here sets `"type": "commonjs"`: the plugins' hooks use `require()`, and the framework's own `package.json` is an ES module.

`ponytail/` is a trimmed copy of [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) 4.10.0 (MIT, see its `LICENSE`): `.claude-plugin/`, `hooks/` (Claude files only) and `skills/`. To update, copy the same files from a newer release.

`caveman/` is a trimmed copy of [juliusbrussee/caveman](https://github.com/juliusbrussee/caveman) 4.0.1 (Apache-2.0, see its `LICENSE` and `NOTICE`): `.claude-plugin/plugin.json` (hook commands pointed at `hooks/`), `src/hooks/` → `hooks/` (activate, config, mode-tracker, parse, stats, statusline) and the skills `caveman`, `ultracave`, `megacave`, `caveman-commit`, `caveman-review`, `caveman-help`, `caveman-stats`. Left out: the engine, proxy, cavecrew agents and `caveman-compress` (needs Python). To update, copy the same files from a newer release.

`codegraph/` was written for Moki (nothing is vendored from upstream: only `.claude-plugin/plugin.json`, which declares the MCP server of [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph)). Telemetry is off: the server runs with `--no-telemetry` and `CODEGRAPH_TELEMETRY=0` / `DO_NOT_TRACK=1`, and so does the indexing Moki starts (`codegraph init --local-only --yes <folder>`, once, when the plugin is turned on or at a launch when `.codegraph/` is missing); the person's global setting is not changed. When the person already registered a `codegraph` server in the AI tool (`mcpServers.codegraph` in `~/.claude.json`, or `[mcp_servers.codegraph]` in Codex's `config.toml`), the plugin does not load it a second time and only decides the indexing. The index lives in `<linked folder>/.codegraph/`, kept out of Git. Turning it on needs a linked folder and is refused when `project.json` has `writeAllowed: false`. Without the `codegraph` command the choice is saved and the plugin is skipped; the launch message says how to install it (`npm i -g @colbymchenry/codegraph`). Moki never installs it.

`superpowers/` is a trimmed copy of [obra/superpowers](https://github.com/obra/superpowers) 7.0.1 (MIT, see its `LICENSE`): `.claude-plugin/plugin.json`, `hooks/` (`hooks.json`, `run-hook.cmd`, `session-start`) and `skills/` except `diagnosing-superpowers`. Left out: the docs, tests, scripts, the other harnesses' plugin files (Cursor, Codex, Gemini, OpenCode...) and `skills/diagnosing-superpowers` (it reads the AI session transcripts and files public GitHub issues). Patched: `skills/brainstorming/scripts/server.cjs` never loads the remote brand image (`SUPERPOWERS_TELEMETRY_DISABLED = true`). To update, copy the same files from a newer release and reapply both.
