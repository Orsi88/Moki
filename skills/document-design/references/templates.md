# Templates and models

Two kinds of "template" decide how a deliverable looks and what it must contain.

| Kind | Where | Decides | Who may change it |
|---|---|---|---|
| **Moki template** (Settings › Templates) | `<workspace>/templates/<id>.json`: `name`, `tags` (projects it applies to; none = every project), `style` (font, colours, table colours, background, header, footer, logo, watermark) | The look of PDF, Word and Excel files | Create: Watson may create a new one when needed (and says so). Change an existing one: only after the user's approval (it changes every project that uses it). |
| **Project model** | The project's `templates/` folder, listed in `context/conventions.md` › Deliverable templates (evidence xlsx/docx, item templates `templates/items/<tracker>-<type>.md`, document models) | The mandatory structure: fields, columns, sections, placeholders | Only with the user's approval; a new model is offered as the project's standard. |

## Choosing

1. **First, the project's linked template**: `project.json` › `template` (chosen in the project settings). If it still applies, use it.
2. Else the template without tags, else the first that applies to the project (the generators do this by themselves).
3. Another Moki template only when the user asks for it or the deliverable requires it: write that template's `style` to the run's `work/` folder and pass it with `--style`.
4. The model required by the activity or the producing skill (for example the evidence models) always applies to its structure.

All Moki templates of the workspace may be read and used; models of other projects only through shared context (tags) the request lists.

## Creating a template

When no template fits (for example a client-facing look): create `<workspace>/templates/<new-id>.json` with a name, no tags unless the user says which projects, and a `style` with the template fields. Tell the user it was created and how to link it to the project (project settings › Templates).
