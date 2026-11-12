# Templates and models

Two kinds of "template" decide how a deliverable looks and what it must contain.

| Kind | Where | Decides | Who may change it |
|---|---|---|---|
| **Moki template** (Settings › Templates) | `<workspace>/templates/<id>.json`: `name`, `tags` (projects it applies to; none = every project), `style` (font, colours, table colours, background, header, footer, logo, watermark) | The look of PDF, Word and Excel files | Create: Watson may create a new one when needed (and says so). Change an existing one: only after the user's approval (it changes every project that uses it). |
| **Base file** (Settings › Templates › Upload a base file) | `<workspace>/templates/<id>.json` with `model.file` = `<id>.model.<docx\|xlsx\|md\|pdf>` next to it, `tags` and an optional `guidance` (what the person wants kept) | Structure **and** formatting of a new document, like an example the person attached in a chat | Only the person (upload, replace, delete). Never edit the base file itself. |
| **Project model** | The project's `templates/` folder, listed in `context/conventions.md` › Deliverable templates (evidence xlsx/docx, item templates `templates/items/<tracker>-<type>.md`, document models) | The mandatory structure: fields, columns, sections, placeholders | Only with the user's approval; a new model is offered as the project's standard. |

## Choosing

1. **First, the project's linked template**: `project.json` › `template` (chosen in the project settings). If it still applies, use it.
2. Else the template without tags, else the first that applies to the project (the generators do this by themselves).
3. Another Moki template only when the user asks for it or the deliverable requires it: write that template's `style` to the run's `work/` folder and pass it with `--style`.
4. The model required by the activity or the producing skill (for example the evidence models) always applies to its structure.

## Base files

A base file is the person's own example of the document they want. Before producing a document, list the templates of `<workspace>/templates/` that have a `model` and apply to the project (no tags = every project; otherwise the project's tag or a tag the project shares).

1. **Pick** the one whose name, `guidance` and format fit what was asked. When more than one fits, ask which one. When none fits, go on without a base file.
2. **Follow it** like an example attached in a chat: the same sections and their order, headings, tables and their columns, fields, tabs, numbering and wording of fixed labels; the same formatting (fonts, colours, header, footer, logo, page layout). Put the new content in it. Apply `guidance` above the general rules here.
3. **Never copy its data as facts**: names, dates, ids, results and text of the example are placeholders for the new content. A field the new content does not fill stays empty or marked pending; never invented.
4. **By format**: `.docx` → build the new file inside it (`npm run docx -- write --data <document.json> --out <file.docx> --template <base file>`; when its structure needs more than that, copy it to the run's `work/` folder and edit the copy). `.xlsx` → `npm run xlsx -- fill` on a copy, keeping its sheets, columns and formatting. `.md` → the same headings, order, tables and fixed text. `.pdf` → a reference only: read it and reproduce its structure and look in the format asked (default: the format of the request or the producing skill).
5. A base file never changes the mandatory structure of a skill's own model (for example the evidence models); when they conflict, say so and ask.
6. Record in the hand-over which base file was followed.

All Moki templates of the workspace may be read and used; models of other projects only through shared context (tags) the request lists.

## Creating a template

When no template fits (for example a client-facing look): create `<workspace>/templates/<new-id>.json` with a name, no tags unless the user says which projects, and a `style` with the template fields. Tell the user it was created and how to link it to the project (project settings › Templates).
