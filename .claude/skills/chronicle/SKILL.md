---
name: chronicle
description: Information architecture and writing of any deliverable - investigation dossiers, analysis reports, executive summaries, technical notes, decision memos, incident reports, requirements reviews, test scenarios and cases, evidence documents, tracker items and any other document - turning the content the specialists produced into a coherent reading sequence for its reader - the question it answers, what the reader must do with it, the answer early, related information grouped, conditions next to what they qualify, overview apart from depth, headings that orient, appendices with traceability - while keeping every fact, figure, citation and confidence label as given and respecting the mandatory structure of templates and of the producing skill. Use when a document must be written, organized or restructured (Watson runs it, with document-design, blueprint and document-quality).
license: MIT
metadata:
  version: "0.2.0"
  status: draft
  category: documentation
  phase: "2"
---

# Chronicle

## Purpose

Turn content into a document people can follow and use: the reader knows early what it answers and what to do with it, the reading flows, and every statement can be traced back. The author owns the facts; this skill owns the organization and the writing.

## Responsibilities

- Understand the deliverable: its kind ([document types](references/document-types.md)), its purpose, its reader and how it will be read (skim, study, decide, audit, execute).
- Identify in the content: conclusions, evidence, arguments, risks, decisions, recommendations, caveats and pending points.
- Organize ([organization rules](references/organization-rules.md)): group related information, choose the order, keep conditions and exceptions next to what they qualify, separate overview from depth, remove needless repetition without losing information, use appendices with traceability.
- Write: connected prose where reasoning matters, the right form for each piece of information, headings that orient, consistent terms.
- Keep every fact, number, id, citation, confidence label, condition and the difference between fact, hypothesis, proposal and decision.

Does **not**: research, decide or add facts; change a mandatory structure; style or format the file (`document-design`); draw diagrams (`blueprint`); do the final check (`document-quality`).

## When to use

- Any document Watson writes or restructures, from any specialist's content (dossiers from `deduction`, reviews from `requirements-review`, scenarios and cases from `test-design`, evidence from `evidence-*`, tracker items, notes, reports).
- The user asks to organize, rewrite, summarize or restructure a document.

## Inputs

Required:
- **The content**: findings, data, decisions, the author's text — a file (for example Sherlock's case notes in the run's work folder), several files, or text.

Optional:
- The reader and the use; the structure the producing skill or the template fixes; the kind of edition (full, or a summary for a given reader); length limits; the deliverable language.

## Tools

- File reading and writing. `blueprint` for diagrams, `document-design` for format and look, `document-quality` for the final check.

## Procedure

Step ids are used in `state.json` (as sub-steps of the producing skill's step when called by another skill).

1. **`brief`** — Read all the content. Identify the kind of deliverable, the purpose, the reader and the reading mode; the mandatory structure if any (template, model, producing skill's contract). Ask only what is missing and matters (purpose or reader unclear, ambiguous content, a change of meaning, a change of an approved standard, a large change of scope); otherwise decide.
2. **`organize`** — Classify the content (conclusions, evidence, risks, decisions, caveats, pending points), choose the order and the sections, and for each piece of information its form (prose, list, numbered steps, table, callout, diagram). With a fixed structure, map the content onto it; content without a place goes to an appendix or back to the author as a question, never dropped silently. Show the outline for approval **only** for a long document of a new kind with no fixed structure; routine decisions are taken without asking.
3. **`write`** — Write top-down with the [organization rules](references/organization-rules.md): the answer early when the purpose allows, connected paragraphs for reasoning (no document made only of fragments), the forms chosen in step 2. Diagrams through `blueprint`.
4. **`hand-over`** — Pass the text to `document-design` for format and look, then to `document-quality` for the final check (Watson runs them in sequence).

## Rules and constraints

- **Fidelity**: no new facts; nothing softened or strengthened; numbers, units, dates, ids, citations with locators, confidence labels, conditions and caveats kept; fact, hypothesis, proposal, recommendation and approved decision stay distinct. A claim without a citation in the content stays without one and is pointed out to the author.
- **Summaries** may select and condense for their reader, but keep the essential conditions and limitations; a **full edition** keeps every relevant point.
- **Ambiguities and contradictions** that need interpretation go back to the author or the user; never resolve them by guessing.
- **Mandatory structures** (templates, models, the producing skill's sections and fixed labels) are kept exactly; organization works inside them.
- **Proportional effort**: a small correction is made directly; a new document gets the full procedure.
- Deliverable language per `AGENTS.md`; quotes stay in their original language.

## Validation criteria

- The first section says what the document answers (and the answer, when the purpose allows), with the overall confidence when the content has one.
- Every fact, figure, id, citation, locator, confidence label and condition of the content is present and identical; nothing was added.
- The reading flows: related information together, conditions next to what they qualify, overview before depth; no section is only disconnected fragments.
- A fixed structure is complete and unchanged.

## Output format

The organized and written text of the deliverable, handed to `document-design` (which produces the file in the asked format in the run's outputs folder, for example `workspace/projects/<project-id>/runs/<run-id>/outputs/<document-name>.md`). Drafts stay in `workspace/projects/<project-id>/runs/<run-id>/work/`.

## Human approval points

| Gate | When | Closing question (in the user's language; English and pt-BR shown) |
|---|---|---|
| Outline | Step `organize`, only for a long document of a new kind with no fixed structure | "Outline ready. Approve it or tell me what to change before I write." ["Estrutura pronta. Aprove ou me diga o que ajustar antes de eu escrever."] |

Questions about purpose, reader, ambiguous content or changes of meaning are asked when they come up, never as a routine gate.

## Error handling

- Content contradicts itself → keep both, flag it to the author; never choose.
- Content too thin for the requested document → write what is supported and list what is missing.
- Content does not fit the fixed structure → appendix, or a question to the author; never drop it silently.

## Completion criteria

The text is organized and written, faithful to the content, inside the mandatory structure, and handed to `document-design` and `document-quality`.

## Persistence

When called by another skill, work inside that skill's run and record the steps in its `state.json`. Called alone: follow the [persistence protocol](references/core/persistence-protocol.md) with a run in `workspace/projects/<project-id>/runs/<run-id>/` (steps `brief`, `organize`, `write`, `hand-over`), the content in `inputs`, drafts in its work folder.
