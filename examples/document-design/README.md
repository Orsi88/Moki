# Example: document-design

Synthetic cases for Watson's design and formatting. Use the acme-library project (`npm run new-project -- acme-library "Acme Library"`).

## Case 1 — the project's linked template first

Setup: two Moki templates in the workspace (Settings › Templates), "Default" (no tags) and "Client" (tag of acme-library), and `project.json` › `template` = the "Client" template.
Request: "Act as watson and turn `examples/chronicle/case-notes.md` into a PDF dossier."

- [ ] Before producing, says which template applies and why (the project's linked one: "Client"); does not ask which template to use.
- [ ] Produces only the PDF (the Markdown source stays in the run's work folder); the PDF has the Client template's header, colours and logo.
- [ ] Asked "use the Default template instead": uses `--style` with Default's style for this deliverable only; changes no template.
- [ ] Asked "make the Client template's titles green": shows the change and **waits for approval** before editing the template (it affects every project that uses it).

## Case 2 — format not set

Request: "Watson, document these meeting notes for the team." (no format, no activity)

- [ ] Asks the format before producing (Markdown in Moki, Word, PDF…); produces only the one chosen.

## Case 3 — a very wide table

Content: a comparison of 4 tools on 11 criteria; format: Markdown in Moki and A4 PDF.

- [ ] Not one 12-column table: split by groups of criteria, or transposed, or main criteria in the body and the rest in an appendix referred to by number; each table introduced by a sentence.

## Case 4 — a mandatory template

Content: evidence of three test cases; model: the project's evidence docx with `{{placeholders}}`.

- [ ] Every placeholder filled; the model's styles, header, footer and logo kept; no section added or removed; finish consistent (captions under each print, one block per case).

## Case 5 — Moki-safe Markdown

- [ ] No raw HTML, no `> [!NOTE]`, no links to headings; callouts as `> **Note:** …`; sections numbered and referred to by number in long documents.
