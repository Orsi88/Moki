---
name: item-report
description: Prepares and registers items in Azure DevOps or Jira - bugs and defects, but also tasks, impediments, technical debt, improvements, suggestions, test cases or any type the project's tracker has. Asks which item type to create (no default), loads that type's template, fills it from the material the QA gives (description, test evidence, failure pre-analysis, notes), asks only for what is missing, never fills fields by assumption, applies the extra rules of problem items (expected and obtained results with their origin, reproduction, severity and priority) when the type is a problem, searches for open and resolved duplicates, and publishes through dispatch only after the exact preview is approved. Use when the QA wants to register one or more tracker items.
license: MIT
metadata:
  version: "0.2.0"
  status: draft
  category: quality
  phase: "2"
---

# Item Report

## Purpose

Turn what the QA has — a failure, an impediment, a task, an idea, a piece of technical debt — into tracker items the team can act on at once: the right type, the project's own template, facts with their origin, the right links, and nothing invented.

## Responsibilities

- Ask which item type to create, among the types the project's tracker has; load that type's template.
- Fill the template from the material given; ask only for what is missing.
- For **problem items** (bug, defect, incident or any type the tracker map marks as a problem): the expected result with its origin, the obtained result, reproduction *verified* or *reported*, the pre-analysis as a technical note, severity and priority separately.
- Search for duplicates (open and resolved) and let the user choose.
- Link the item to what it relates to (MF or story, parent item, test case, run, evidence).
- Publish through `dispatch` (preview, approval, journal), or hand over the prepared item.

Does **not**: choose the item type, decide that a test failed, invent fields, values or facts, change existing items without a preview and approval, or delete anything.

## When to use

- A problem was found and the QA wants it registered (after `failure-analysis`, `evidence-collection` or from their own description).
- The QA wants to register an impediment, a task, technical debt, an improvement, a suggestion, a test case or any other item type.
- Several items at once (batch).

Do not use to analyze a failure (`failure-analysis`), build evidence (`evidence-collection`) or review requirements (`requirements-review`).

## Inputs

Required:
- **What the item is about**, from at least one source: the QA's description or notes, a run's evidence (`evidence.json`, prints, Jam links), a pre-analysis (`pre-analysis.txt`), a document.
- **The item type** (asked in step `type`).

Optional:
- The MF, story, parent item or test case it relates to (number or URL); environment, version, build, date and time; owner, area or iteration when the template has them.

## Tools

- `dispatch` for metadata, duplicate search and publication; `project-context` for the tracker map and the item templates (`templates/items/<tracker>-<type>.md`, listed in conventions › Deliverable templates).
- Fallback without a usable MCP: the prepared item (file) and manual instructions; the user may send the tracker's types and fields if the map is missing.

## Procedure

Step ids are used in `state.json`.

1. **`intake`** — Identify the project, create the run, read the material. If an MF, story or parent item is referenced, read it through `dispatch` (freshness check when earlier work used it). List the items to register (one per subject).
2. **`type`** — Ask **which item type to create**, offering the types of the project's tracker map (from `dispatch` metadata if the map is missing; never a default). In a batch, ask whether one type applies to all or which type per item. Load the template of each chosen type; if a type has no template, **ask for the model before preparing it** (and offer to register it as the project's standard).
3. **`draft`** — Fill each template with the [drafting rules](references/drafting-rules.md): the general rules for every item, plus the problem-item rules when the type is a problem. Collect what is missing and ask for it in one short message (only the missing fields). For problem items, suggest severity and priority with the [criteria](references/severity-priority.md); for other types, only the fields their template has (priority, effort, area…), suggested only when the material supports a value.
4. **`duplicates`** — Search open and resolved items with the [duplicate search](references/drafting-rules.md#duplicate-search); present candidates with why they look similar and the limits of the search. For each item the user chooses: create a new one, comment on an existing one (shown in the preview), or cancel.
5. **`review`** — Present each item exactly as it will be created (type, every field and value, full text ending with the signature, attachments, links) together with the actions on existing items; this is the `dispatch` publication preview. **Stop for approval**: all, some, or changes.
6. **`publish`** — Through `dispatch`: journal, execute only the approved actions, record ids and links. Partial failures and uncertain results follow its recovery rules. Report what was created, linked, attached, failed or only prepared.

## Rules and constraints

- **Template first**: the project's template for the type defines structure, fields, sections, title pattern and wording; the drafting rules only fill gaps the template leaves.
- **No assumption**: every field comes from the material or the user. Missing → ask; unknown → the field says so ("not informed") only if the template allows it.
- **Problem items**: the expected result cites its origin (requirement, acceptance criterion, test case or confirmed definition); reproduction is *verified* (reproduced, with evidence) or *reported*; the pre-analysis goes into a technical note with its hypotheses labeled; severity (impact) and priority (order of handling) are separate, with reasons, from the project's criteria — a generic scale is only a proposal until the user confirms it.
- **Other items**: keep to what the material says — the need or problem it addresses, the expected outcome or acceptance condition when given, the links; no invented estimates, owners or dates.
- **Duplicates**: no candidate does not prove there is no duplicate — say so. Changing an existing item is a write like any other: preview and approval.
- **Traceability**: link the MF or story, the parent item, the test case, the run and the evidence when they exist.
- **Data protection**: no secrets or personal data in texts or attachments; mask or ask ([isolation](references/core/isolation-policy.md)).
- Apply [execution principles](references/core/execution-principles.md), [approval](references/core/approval-policy.md) and [traceability](references/core/traceability.md).

## Validation criteria

- The item type was chosen by the user; the template of that type was used (or the user provided it).
- Every field has a value from the material or the user, or is marked as not informed where the template allows; no invented value.
- Problem items: the expected result cites its origin; the reproduction is marked verified or reported; the pre-analysis is in a technical note with hypotheses labeled; severity and priority are separate, each with a reason, using the project's values.
- The duplicate search listed its candidates and limits; the user's choice is recorded.
- Nothing was written before the approved preview; the journal has the result of every action.

## Output format

- Prepared items: `workspace/projects/<project-id>/runs/<run-id>/outputs/item-<n>-<slug>.md` (the exact content shown in the preview).
- Published ids and links: `state.json` `results`; journal in `workspace/projects/<project-id>/runs/<run-id>/logs/dispatch-journal.json`.
- Language: the template's language, else the deliverable language.

## Human approval points

At each gate, give the summary the [approval policy](references/core/approval-policy.md) asks for before the closing question.

| Gate | When | Closing question (in the user's language; English and pt-BR shown) |
|---|---|---|
| Type | Step `type` | "Which item type should I create? The project's tracker has: <types>." ["Qual tipo de item devo criar? O tracker do projeto tem: <tipos>."] |
| Duplicates | Step `duplicates`, when candidates exist | "These items look similar. For each one: create new, comment on an existing one, or cancel?" ["Estes itens parecem semelhantes. Para cada um: criar um novo, comentar em um existente ou cancelar?"] |
| Publish | Step `review` | The `dispatch` publish question. |

## Error handling

- No item types known and no MCP → ask the user for the types and fields (or the template) of the tracker.
- Template missing for the chosen type → ask for it; do not fall back to a generic layout without the user's agreement.
- The user cannot provide a required field → keep the item prepared, not published, and list what blocks it.
- Publication failures → `dispatch` recovery (reuse created items; check uncertain ones by signature).

## Completion criteria

Every item ended as published (with id and link), prepared for manual registration, merged as a comment on an existing item, or cancelled by the user; `state.json` `completed`.

## Persistence

Follow the [persistence protocol](references/core/persistence-protocol.md). Run in `workspace/projects/<project-id>/runs/<run-id>/` with `state.json` (steps `intake`, `type`, `draft`, `duplicates`, `review`, `publish`; the type choices, duplicate decisions and publish approval in `approvals`; `sources` for the items read), the material in its inputs folder, the prepared items in its outputs folder and the journal in its logs folder.
