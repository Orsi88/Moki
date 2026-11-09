# Example: chronicle

Synthetic input: [case-notes.md](case-notes.md) — the case notes Sherlock would leave in a run's work folder.

Request: "Act as watson and write the investigation dossier from `case-notes.md` with the deduction dossier template."

## Acceptance checklist

- [ ] The dossier follows the `deduction` dossier template (summary, key questions and answers, context, risk sections, divergences, gaps and limits, next steps, bibliography); no outline gate (the structure is fixed).
- [ ] The summary answers first, in at most ten lines, with the overall confidence (medium) and the stop reason.
- [ ] **Fidelity**: F1–F5 are all present with the same citations and locators (`[S1 §Forgot Password Request]`, …) and the same confidence labels; the quotes are identical; no new fact, number or source appears (for example no expiry duration and no token length).
- [ ] The test ideas are a table with a header and a sentence before it.
- [ ] The reset flow is a ```` ```mermaid ```` (or ```` ```excalidraw ````) block with a caption, at most 15 nodes, citing F1–F3; no image or PDF file was created.
- [ ] "Divergences" and "Gaps and limits" keep the case notes' honesty (single source, question 4 open).
- [ ] Only the Markdown file was produced.
