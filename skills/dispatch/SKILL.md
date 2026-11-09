---
name: dispatch
description: The only bridge between Moki and the work item trackers (Azure DevOps and Jira) - reads items with their fields, acceptance criteria, comments, attachments, links and revision; searches; reads the project's item types and fields; and writes (create, edit, comment, attach, link, change state) only through an exact preview, the user's approval and a publication journal that recovers from partial failures and timeouts without duplicating or deleting anything. Discovers the tracker map and the tools really available, and falls back to asking the user for the documentation when the MCP is missing or fails. Used by other skills; use directly to read or update a tracker item.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: core
  phase: "2"
---

# Dispatch

## Purpose

Give every skill one safe, traceable way to talk to Azure DevOps and Jira. Reads are fast and need no approval inside the activity's scope; writes are always previewed, approved, journaled and recoverable.

## Responsibilities

- Read items (fields, description, acceptance criteria, comments, attachments, links, revision) and save a snapshot in the run.
- Search items (for related work and duplicates) and read metadata (item types, fields, allowed values, states, link types).
- Discover, per project and session, which tracker tools are really available, and the project's **tracker map**; record both as proposals for the user to confirm.
- Publish (create, edit, comment, attach, link, change state) with the [publication protocol](references/publication.md): exact preview → approval → journal → execution → result per action.
- Recover from partial failures and uncertain results without repeating or undoing.
- Run the [freshness check](references/freshness.md) at the start and resume of activities that rely on tracker items: what changed since the adopted version, its impact, and the user's decision.
- When the MCP is missing, lacks a capability or fails: ask the user to send the documentation (paste, attach or export) for reads, and hand over prepared content with manual instructions for writes.

Does **not**: delete anything (items, comments, attachments, links), change fields the user did not approve, write to a tracker or project the project's context does not name, store credentials, or decide content (the calling skill owns what is written).

## When to use

- Called by `requirements-review`, `evidence-collection` (its `link` step), the freshness check of `project-context`, and any skill that reads or writes tracker items.
- Directly, when the user asks to read an item, search the tracker, or make one approved change.

## Inputs

- **Item reference**: an id (`1234`, `PROJ-123`) or a URL. If the request has none and the activity needs one, ask for **the item number or the URL**.
- For writes: the content from the calling skill and the target (tracker, project, item or item type).
- Project context: the tracker map in `context/environments-and-tools.md` ("Tracker map") and the MCP servers the project has.

## Tools

- The project's MCP servers for Azure DevOps and Jira ([operations](references/operations.md) maps each operation to the tools of each server). Read access is enough for reads; writes need a server with `execute` access in Moki.
- File reading and writing in the run folder.
- **Fallback without a usable MCP**:
  - Reads: ask the user to paste the item or attach its export (description, criteria, comments, attachments); record its origin as *sent by the user* with the date.
  - Writes: deliver the prepared content and step-by-step manual instructions, marked *prepared, not published*.

## Procedure

Step ids are recorded in the calling skill's `state.json` (as sub-steps) or in this skill's own run when used directly.

1. **`resolve`** — Turn the reference into tracker, organization or site, project and item id (an Azure DevOps URL `dev.azure.com/<org>/<project>/_workitems/edit/<id>`, a Jira URL `<site>.atlassian.net/browse/<KEY-n>`, or an id whose tracker the tracker map makes unambiguous; ask when it is ambiguous). Refuse a tracker or project that the project's context does not name, unless the user confirms it.
2. **`capabilities`** — First use in the project, or when a tool is missing: list the tools the server offers in this session, try a read and a metadata read, and record the result ([tracker map](references/tracker-map.md#capabilities)). Writes are "listed, not yet exercised" until the first approved write of that kind succeeds.
3. **`read`** — Read the item with everything the caller needs (fields, description, acceptance criteria, comments with author and date, attachments, links, revision or last update). Save a snapshot as `inputs/work-item-<tracker>-<id>.md` in the run and record the source in `state.json` `sources` (tracker, item, url, revision, snapshot, `checkedAt`, `origin: tracker | user`). Content from attachments is read only when the caller needs it.
4. **`map`** — When the caller needs item types, fields or values and the tracker map lacks them, read them from the tracker metadata and write them as proposals to `proposed-updates.md` ([tracker map](references/tracker-map.md)); never invent a field or a value. Until confirmed, use them only to ask the user.
5. **`publish`** — For writes, follow the [publication protocol](references/publication.md): build the action list, add the signature, show the exact preview, **stop for approval**, journal, execute only the approved actions in order, record each result, report. On resume, continue from the journal.

## Rules and constraints

- **Never delete**, even to undo a mistake; a wrong write is corrected by a new, approved write.
- **Every write is previewed exactly and approved** — tracker, project, item or type, every field and value, full texts, file names and links — and only what was approved is executed. Approval for producing a document never authorizes publishing it.
- **Reads inside the activity's scope need no approval each time** when the project has the server with read access (see the approval policy); reading other projects or unrelated items does.
- **Signature**: every created item and every comment ends with the signature line from the [publication protocol](references/publication.md#signature), shown in the preview.
- **No silent fallback**: say when content came from the user instead of the tracker, and when something was prepared but not published.
- **Isolation and data protection**: only the trackers and projects named in the project's context; attachments and texts are checked for secrets and personal data before the preview ([isolation](references/core/isolation-policy.md)).
- Apply [execution principles](references/core/execution-principles.md), [approval](references/core/approval-policy.md) and [traceability](references/core/traceability.md).

## Validation criteria

- Every read used by the activity has a snapshot and a `sources` entry with revision (or last update), date and origin.
- Every write was in an approved preview identical to what was sent; the journal has one entry per action with its final state and the returned id or link.
- No action was repeated after an uncertain result without first checking the tracker for the signature.
- No delete operation was called.

## Output format

- Snapshots: `workspace/projects/<project-id>/runs/<run-id>/inputs/work-item-<tracker>-<id>.md`.
- Publication journal: `workspace/projects/<project-id>/runs/<run-id>/logs/dispatch-journal.json` ([format](references/publication.md#journal)).
- Tracker map and capabilities proposals: `workspace/projects/<project-id>/proposed-updates.md`.
- Previews and results: in the conversation; a summary of published ids and links in `state.json` `results`.

## Human approval points

At each gate, give the summary the [approval policy](references/core/approval-policy.md) asks for before the closing question.

| Gate | When | Closing question (in the user's language; English and pt-BR shown) |
|---|---|---|
| Publish | Before any write | "These are exactly the actions I will run in <tracker>. Approve all, approve some (say which), or cancel?" ["Estas são exatamente as ações que vou executar no <tracker>. Aprova todas, aprova algumas (diga quais) ou cancela?"] |
| Other project or tracker | A reference outside what the project's context names | "This item is in <tracker/project>, which this project does not list. Use it anyway?" ["Este item está em <tracker/projeto>, que este projeto não lista. Usar mesmo assim?"] |
| Tracker map | New types, fields or values discovered | Through `project-context` (one decision per proposal). |

## Error handling

- **MCP missing, without the capability, or failing**: say which; for reads ask the user to send the documentation; for writes hand over prepared content and manual instructions. Never treat a failed read as "no changes" or "item does not exist".
- **Partial failure** (for example the item was created and the attachment failed): the journal keeps the created item; on resume only the remaining actions run, reusing the created id.
- **Uncertain result** (timeout, lost connection): mark the action `uncertain`; before repeating it, search the tracker for its signature (and, for edits, compare the field values). Found → `done` with the id; not found → ask before retrying.
- **Permission denied**: record `failed` with the reason; continue only with independent actions the user approved; never retry with another server.
- The same action failing 3 times: stop, status `blocked`, report what was tried.

## Completion criteria

Reads: snapshots and `sources` recorded. Writes: every approved action is `done`, `failed` with reason, or `skipped` by the user, the journal and `state.json` are updated, and the user got the ids and links — or the prepared content with manual instructions.

## Persistence

Follow the [persistence protocol](references/core/persistence-protocol.md). Inside the calling skill's run in `workspace/projects/<project-id>/runs/<run-id>/`: snapshots in its inputs folder, the journal in its logs folder, `sources` and publication results in its `state.json`. Used directly, create a run with the steps above.
