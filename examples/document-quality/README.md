# Example: document-quality

Synthetic cases for Watson's final check. Each case says which kind of proof it gives: **structure** (the text and the file), **generator** (a tool's own test), **presentation** (looking at the rendered result).

| # | Situation | Expected | Proof |
|---|---|---|---|
| 1 | Disorganized notes ([../chronicle/case-notes.md](../chronicle/case-notes.md) shuffled, with a repeated finding) | A document with a clear sequence; the repetition merged without losing any condition; every F id, citation and confidence label identical | structure |
| 2 | Executive summary of the full dossier | A one-page summary for a manager; the single-source limit and the open question are still there | structure |
| 3 | A flow diagram with many crossings | Reordered so arrows do not cross, or split into an overview and a detail view, each captioned | presentation |
| 4 | An Excalidraw drawing the user already rearranged by hand, and the content gains one step | The new step added without moving the user's boxes; nothing regenerated over their adjustments | generator + presentation |
| 5 | Content with a contradiction (two different renewal limits) | The contradiction named and sent back to the author or the user; no limit chosen | structure |
| 6 | A PDF export where a table breaks badly and a heading sits alone at the bottom of a page | Fixed before delivery (page break moved, table split or header repeated) | presentation |
| 7 | No renderer, or an AI tool that cannot read images | The report says exactly which visual checks were not done; nothing claims a visual inspection | structure |
| 8 | A mandatory template (evidence docx) | All fields and sections of the model present and unchanged | structure |
| 9 | Only Markdown asked | No PDF, picture or copy left next to the deliverable; inspection files (if any) removed from the work folder | structure |

## Checklist for every case

- [ ] The check report says what was checked, what was fixed, what went back to the author and which checks were not possible.
- [ ] Nothing in the deliverable is new compared with the source; numbers, ids, citations and labels unchanged.
