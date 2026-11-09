---
name: document-quality
description: Final quality check of a deliverable before it reaches the user - fidelity to the source content (facts, numbers, dates, ids, citations, confidence labels, conditions and the difference between fact, hypothesis and decision), completeness, consistency of terms, structure and the model's mandatory fields, presentation in the actual format (cut text, overlapping elements, unreadable tables or diagrams, bad page breaks), working links and references, the file opening, and only the formats asked. Fixes what it can, reports exactly what it could not verify. Use as the last step of producing any document (Watson runs it), or to check a document someone else produced.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: documentation
  phase: "2"
---

# Document Quality

## Purpose

Nothing reaches the user with a lost condition, a wrong number, a broken table or a diagram nobody can read. This is the check of the **deliverable** — fidelity and presentation — not a critique of the content's reasoning (that is `cross-examination`).

## Responsibilities

- Compare the deliverable with its source content: nothing lost, changed or added.
- Check structure, terminology, the model's mandatory fields and the formats produced.
- Inspect the presentation in the format the reader will use, with the viewer or renderer available.
- Fix the presentation problems it can; send content problems back to their author.
- Say exactly which checks could not be done.

Does **not**: judge whether the content's conclusions are right, rewrite meaning, or claim an inspection it did not do.

## When to use

- The last step of producing any document (Watson; any skill that wants its deliverable checked).
- Checking a document produced elsewhere before sending it.

## Inputs

- The deliverable (file) and its source content (case notes, matrix data, evidence, the author's text).
- The purpose, the reader, the format asked and the model or template that applies.

## Tools

- File reading; `npm run doc-check -- <file.md>` for Markdown (what Moki renders wrongly, broken tables, heading links, diagram blocks, cited sources without a bibliography row, missing local files); the generators' own checks (`npm run xlsx -- read`, `npm run docx -- inspect`).
- Visual inspection: `npm run doc-render -- <file.md>` renders a Markdown deliverable as Moki's PDF export does (template and diagrams included) into the project's `temporary/inspection/` folder — never next to the deliverable — as a PDF and A4 page pictures (`page-1.png`…); look at the pictures (or the PDF), then remove them with `npm run doc-render -- --clean <file.md>` (the app also empties old temporary files). A PDF deliverable is looked at as it is. Requires an Edge/Chrome/Chromium browser and an AI tool that can read images.
- Fallback without a renderer or image reading: the structural checks only, and the report names the visual checks not done.

## Procedure

1. **`fidelity`** — List the source's checkable items (findings and their ids, numbers with units, dates and periods, citations with locators, confidence labels, conditions and exceptions, decisions vs proposals vs hypotheses) and confirm each in the deliverable. A summary may select and condense, but keeps the essential conditions and limits.
2. **`structure`** — For Markdown, run `npm run doc-check -- <file.md>` and fix every error (warnings are judged). Then run the [checklist](references/checklist.md): purpose clear early, order, headings, terminology, tables, figures and captions, ids and references resolving, mandatory fields and sections of the model, only the formats asked.
3. **`presentation`** — Render and look (`npm run doc-render`), then inspect the deliverable in its format ([checklist § presentation](references/checklist.md#presentation)): cut or overlapping text, wide tables, page breaks, diagram legibility (labels, crossings, connectors), the file opens.
4. **`fix`** — Correct the presentation problems found and check again (at most three passes per problem). Content problems — a contradiction, a missing source, an ambiguous claim — go back to the author or the user with the exact place; they are never solved by guessing.
5. **`report`** — In the hand-over: what was checked, what was fixed, what was sent back, and **exactly which checks were not possible** (for example "visual inspection not done: no renderer available").

## Rules and constraints

- Never mark a check as done that did not run; "not verified" is a valid, required answer.
- Fix presentation, never meaning; a meaning problem goes back to its owner.
- Inspection files (page pictures, temporary exports) live only in the project's `temporary/inspection/` folder (the render tool puts them there by itself), never next to the deliverable, and are removed after the check ([execution principles](references/core/execution-principles.md)).
- Apply [traceability](references/core/traceability.md).

## Validation criteria

- Every checkable source item is present and unchanged in the deliverable, or listed as a problem.
- The checklist was run; the presentation was inspected in the format or the report says why not.
- No extra file or format remains next to the deliverable.

## Output format

The corrected deliverable in place, and a short check report in the hand-over (inside the producing run: in `state.json` `results`, or the step's handoff in an operation). No separate report file unless the user asks.

## Human approval points

None of its own; content problems are returned to the author or the user as questions.

## Error handling

- The source content is not available → check structure and presentation only; say fidelity could not be checked.
- The renderer or image reading is unavailable → structural checks only; name the visual checks not done.
- A problem keeps coming back after three fixes → stop and report it with the place and what was tried.

## Completion criteria

The deliverable passed fidelity, structure and presentation checks — or every remaining problem and every check not done is reported.

## Persistence

Inside the producing run: follow the [persistence protocol](references/core/persistence-protocol.md); inspection files only in the project's temporary folder, removed after the check.
