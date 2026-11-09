# Tracker map

What a project's tracker looks like, recorded in the project's `context/environments-and-tools.md` under **Tracker map**, confirmed by the user. Skills use it to ask the right questions and fill the right fields; nothing in it is invented.

## Content

| Part | Example |
|---|---|
| Tracker and location | Azure DevOps · organization `contoso` · project `Library`; or Jira · `acme.atlassian.net` · space key `LIB` |
| MCP server (Moki id) and access | `azure-devops` (execute) |
| Item types | Bug, Task, User Story, Feature, Impediment… (as the tracker names them) |
| Per type: required fields and allowed values | Bug: Title, Repro Steps, Severity (1 - Critical … 4 - Low), Priority (1–4), Area Path, Iteration |
| States per type | New → Active → Resolved → Closed |
| Severity and priority | which fields hold each one and their values; the project's criteria for choosing them, when defined |
| Link types | Related, Parent/Child, Tested By… |
| Item templates | per type, the template file in the project's `templates/items/` (see conventions › Deliverable templates) |
| Glossary of item names | what the team calls each type (MF, US, história…) and which tracker type it is |

## Discovery

1. Read the metadata with the [operations](operations.md) for types, fields, values, states and link types.
2. Write each discovered part as a proposal (`PU-###`) in `proposed-updates.md`, with the source "tracker metadata, <date>".
3. Ask the user to confirm through `project-context`. Only confirmed parts go to the context.
4. Never fill a gap from general knowledge of the tracker: a project's Bug type may have custom fields and different values.

## Capabilities

Record per server, with the date, in the same section:

| Capability | Status |
|---|---|
| Read item, comments, history | verified on <date> |
| Metadata | verified on <date> |
| Search | verified on <date> (WIQL: needs Insiders header) |
| Create / edit / comment / attach / link / change state | listed, not yet exercised → verified on <date> after the first approved write of that kind |

A capability that fails is recorded with the error and date, and the fallback is used until it works again.
