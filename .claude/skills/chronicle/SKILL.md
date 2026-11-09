---
name: chronicle
description: Builds analysis and investigation documents with real command of document construction and information layout - investigation dossiers, analysis reports, executive summaries, technical notes, decision memos, incident reports - from content the author provides (findings, sources, data), with the answer first, a clear hierarchy, the right form for each piece of information (prose, list, table, callout, diagram via blueprint), citations and confidence kept intact. Writes Markdown by default (Word or PDF only when asked) and never adds facts of its own. Use when a document must be written or restructured so its readers find and trust what matters.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: documentation
  phase: "2"
---

# Chronicle

## Purpose

Turn content into a document people can use: the reader finds the answer in the first lines, understands how sure it is and why, and can go down to the evidence when needed. The author owns the facts; this skill owns the construction.

## Responsibilities

- Understand the reader, what they will do with the document, and how they will read it (skim, study, decide, audit).
- Choose the document type and its structure ([document types](references/document-types.md)), or follow the structure the calling skill fixed (for example the `deduction` dossier template).
- Lay out each piece of information in the form that fits it ([layout rules](references/layout-rules.md)): prose, list, table, callout, diagram (through `blueprint`).
- Keep every fact, figure, citation, locator and confidence label exactly as the author gave it.
- Check the document with the [quality checklist](references/quality-checklist.md) before handing it over.

Does **not**: research, decide or add facts; change a citation, a number or a confidence label; produce formats nobody asked for.

## When to use

- Called by Sherlock (`deduction`) to write the investigation dossier; by other skills or agents that need a well-built report.
- The user asks to write, structure, restructure or improve an analysis or investigation document, report, summary, memo or technical note.

Do not use for: the research itself (`deduction`), critique (`cross-examination`), evidence spreadsheets and documents with a fixed model (`evidence-sheet`, `evidence-document`).

## Inputs

Required:
- **The content**: findings, data, sources, decisions — a file (for example the case notes Sherlock leaves in the run's work folder), several files, or text.

Optional:
- Reader and use; a fixed structure (template from the calling skill or the project's conventions); deliverable language; format (Markdown by default); length limit; the user's own model for Word.

## Tools

- File reading and writing. `blueprint` for diagrams.
- Word only when asked: `npm run docx -- write --data <document.json> --out <file.docx> [--template <model.docx>]`. PDF only when asked: `npm run pdf -- <document.md> <document.pdf>` (Moki draws the diagrams in it). Fallback: deliver the Markdown and say which format could not be produced.

## Procedure

Step ids are used in `state.json` (when called by another skill, they are recorded as sub-steps of its `dossier` or equivalent step).

1. **`brief`** — Read all the content. Identify reader, use and reading mode; the document type; the fixed structure if any. Ask only what is missing and matters (at most two questions); when called by another skill, take these from its plan.
2. **`outline`** — Build the outline: title, the one-paragraph answer, the sections in the order the reader needs them, and for each section its form (prose, table, list, diagram). With a fixed structure, map the content onto it and note content that has no place (it goes to an appendix or back to the author as a question, never silently dropped). **Gate** only when there is no fixed structure and the document is long (more than about five sections) or new for the project: show the outline and wait.
3. **`write`** — Write top-down with the [layout rules](references/layout-rules.md): answer first, then support, then detail. Diagrams through `blueprint`. Citations and confidence labels copied exactly.
4. **`check`** — Go through the [quality checklist](references/quality-checklist.md); compare against the content: every finding, figure, citation and label present and unchanged; nothing added. Fix and recheck.
5. **`deliver`** — Save the document; produce Word or PDF only if asked. Report the path and, in one or two lines, anything that did not fit or needs the author's decision.

## Rules and constraints

- **Fidelity first.** No new facts, no softened or strengthened claims, no changed numbers, citations, locators or confidence labels. A claim without a citation in the content stays without one and is pointed out to the author.
- **Answer first** (bottom line up front): the first screen tells the reader what matters and how sure it is.
- **One idea per paragraph**, short paragraphs; headings that say something ("Tokens are not single use" rather than "Tokens").
- **Right form for the information**: comparisons and catalogs in tables; parallel items in lists; sequences and structures in diagrams; reasoning in prose; warnings and key takeaways in callouts written as a quote with a bold label (`> **Note:** …`, `> **Warning:** …`), which every Markdown viewer shows correctly.
- **Consistent vocabulary**: one term per concept, defined once (glossary when there are many).
- **Navigable**: numbered findings and sections when the document is long; internal links to sections and appendices; ids (F1, S3, R2) that resolve.
- **Deliverables only**: Markdown unless another format was asked; no copies in other formats ([execution principles](references/core/execution-principles.md)).
- Deliverable language per `AGENTS.md`; quotes stay in their original language.

## Validation criteria

- The first section answers the reader's question in at most ten lines, with the overall confidence when the content has one.
- Every finding, figure, citation, locator and confidence label of the content is present and identical; nothing was added (spot-check against the content).
- Every table has a header and a sentence before it saying what it shows; every diagram has a caption; no diagram over 15 nodes.
- Headings form a clean hierarchy (no skipped levels); every internal id and link resolves.
- Only the formats asked for were produced.

## Output format

- Markdown document: `workspace/projects/<project-id>/runs/<run-id>/outputs/<document-name>.md` (for a dossier, the name the calling skill sets, e.g. `dossier-<slug>.md`), with tables, callouts and diagram blocks.
- Word or PDF only when asked, beside it in the same outputs folder.

## Human approval points

At each gate, before the closing question, give the summary the [approval policy](references/core/approval-policy.md) asks for: what was done, what happens next, what it depends on and what remains open.

| Gate | When | Closing question (in the user's language; English and pt-BR shown) |
|---|---|---|
| Outline | Step `outline`, only without a fixed structure and for a long or new kind of document | "Outline ready. Approve it or tell me what to change before I write." ["Estrutura pronta. Aprove ou me diga o que ajustar antes de eu escrever."] |

## Error handling

- Content contradicts itself → do not choose; keep both, flag it to the author.
- Content too thin for the requested document → write what is supported and list what is missing.
- A requested format cannot be produced (no Node, no browser for PDF) → deliver the Markdown and say why.
- Content does not fit the fixed structure → appendix, or a question to the author; never drop it silently.

## Completion criteria

The document is saved in the requested format, passed the quality checklist, and the author or user got the path and the open points.

## Persistence

When called by another skill, work inside that skill's run (its outputs and work folders) and record the steps in its `state.json`. Called alone: follow the [persistence protocol](references/core/persistence-protocol.md) with a run in `workspace/projects/<project-id>/runs/<run-id>/` (steps `brief`, `outline`, `write`, `check`, `deliver`), the content files in `inputs`, the document in its outputs folder (listed in `artifacts`) and drafts in its work folder.
