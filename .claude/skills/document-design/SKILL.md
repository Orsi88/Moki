---
name: document-design
description: Editorial design and formatting of any deliverable in the format asked - Markdown in Moki, Word, PDF, spreadsheet or text for a tracker - visual hierarchy, typography and spacing through the Moki template and the project's models, tables that read well, moderate and meaningful emphasis, figures and captions, navigation in long documents, legibility where it will be read. Checks first which template the project has linked, uses Moki's templates (Settings › Templates) and the project's own models, and never breaks a mandatory structure. Use when a document is being produced or finished, usually by Watson after chronicle has organized the content.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: documentation
  phase: "2"
---

# Document Design

## Purpose

Make the deliverable look finished and read easily in the medium it will be read in, consistent with the project's visual identity, without the user having to decide alignment, spacing or where each table goes.

## Responsibilities

- Settle the **format** and the **look** before producing: the format asked, the project's linked template, the model or template the activity requires.
- Apply editorial design: hierarchy (title, sections, subsections, body, captions), consistent typography through the template, spacing that groups and separates, consistent alignment, balanced distribution, moderate emphasis with a consistent meaning, accessible contrast.
- Shape tables, figures, captions and navigation for the format ([formats](references/formats.md)).
- Use Moki's templates and the project's models ([templates](references/templates.md)); create a template when one is needed; never change an existing one without approval.

Does **not**: change the content's meaning (that is the author's and `chronicle`'s), produce formats nobody asked for, or alter a mandatory structure (fields, columns, sections) of a model or a skill's contract.

## When to use

- Producing or finishing any document in Markdown, Word, PDF, spreadsheet or tracker text — for Watson, or for any skill that generates a deliverable and wants it finished.
- Restyling a document to the project's template.

## Inputs

- The organized content (from `chronicle` or the producing skill) and the deliverable's purpose and reader.
- The format: from the request, the activity, the producing skill's documented output or the model; **if none sets it, ask**.
- Optional: a model file, a template name, constraints of the destination (screen, print, tracker editor).

## Tools

- Generators that already apply the project's template: `npm run pdf -- <file.md> <file.pdf>`, `npm run docx -- write --data <document.json> --out <file.docx> [--template <model.docx>]`, `npm run xlsx -- write|fill ...`. A different Moki template: pass `--style <file>` with that template's style.
- Moki's templates: `<workspace>/templates/<id>.json` (`name`, `tags`, `style`); the project's choice: `project.json` › `template`.
- Fallback: when a generator is missing, deliver the Markdown and say which format could not be produced.

## Procedure

1. **`format`** — Settle the format (ask only when nothing sets it) and the destination (Moki viewer, screen, print, tracker editor).
2. **`look`** — Check **first** whether the project has a template linked in its settings (`project.json` › `template`, Settings › Templates with the project's tag); use it. Then the model the activity or skill requires. A different Moki template only when the user or the deliverable asks. Record which template and model were used.
3. **`compose`** — Apply the [design rules](references/design-rules.md) and the rules of the format ([formats](references/formats.md)): hierarchy, tables, figures and captions, emphasis, navigation, page layout.
4. **`produce`** — Write the file in the format, through the generator when there is one; working data (generator JSON, intermediate Markdown) goes to the run's `work/` folder.
5. **`hand-over`** — Pass the file to `document-quality` for the final check (Watson does both).

## Rules and constraints

- **Format**: only the format asked; if it is not set by the request, the activity, the skill or the model, ask before producing. No extra copies in other formats.
- **Mandatory structures win**: a model's or a skill's fields, columns, sheet names, sections and fixed labels are kept exactly; design works inside them. An improvement that would change a mandatory structure is proposed, not applied.
- **Template**: the project's linked template first; any Moki template may be used when asked; **creating** a template is allowed (a new `<workspace>/templates/<id>.json`, said in the hand-over); **changing** an existing template needs the user's approval, because it changes every project that uses it.
- **Emphasis with meaning**: bold, colour, borders and callouts are moderate and mean the same everywhere in the document; meaning never relies on colour alone.
- **Proportional effort**: a small fix needs no redesign; a new document gets the full treatment.
- Apply [execution principles](references/core/execution-principles.md) (deliverables only) and [isolation](references/core/isolation-policy.md) (other projects' models only through shared context).

## Validation criteria

- The format is the one asked or set by the activity/skill/model; no other format was produced.
- The project's linked template (or the one asked) was applied; a model's mandatory structure is intact.
- Headings form a clean hierarchy; every table has a header and an introducing sentence; every figure a caption; emphasis is consistent and never colour-only.
- The format's own checks in [formats](references/formats.md) are met.

## Output format

The deliverable in the asked format, in the producing run's outputs folder (for example `workspace/projects/<project-id>/runs/<run-id>/outputs/<name>.md`, `.docx`, `.pdf`, `.xlsx`); generator data in `workspace/projects/<project-id>/runs/<run-id>/work/`; a new Moki template, when created, in the workspace templates folder and named in the hand-over.

## Human approval points

- Changing an existing Moki template or a project's model: show what changes and wait.
- Format not set: ask before producing.

## Error handling

- The model cannot hold the content (a column too narrow, a missing field) → keep the model, put the overflow in a note or appendix, and tell the author.
- A generator fails → report it with its message; deliver the Markdown; never claim the file was produced.
- The template referenced by the project does not exist → use the template without tags, say so.

## Completion criteria

The file exists in the asked format, styled with the right template, mandatory structure intact, and handed to `document-quality`.

## Persistence

Inside the producing skill's run (or Watson's own run when used alone): follow the [persistence protocol](references/core/persistence-protocol.md); record the format, template and model used in `state.json` `results` (or the step's handoff inside an operation).
