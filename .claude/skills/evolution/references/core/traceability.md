# Traceability Rules

Preserve, whenever possible, the chain:

```text
Requirement → Business rule → Scenario → Test case → Automation → Execution → Evidence → Defect
```

## Rules

- Use identifiers that exist in the user's material (user story ids, rule ids, scenario ids, ticket keys). Copy them exactly.
- **Never fabricate references.** If an item has no id in the source, say so and use a local, clearly provisional id with the prefix `TMP-` (for example `TMP-RULE-03`). Provisional ids are never presented as official.
- Never renumber or reuse existing official ids. When an item is removed, mark it obsolete instead of reusing its id.
- Every derived item states its source: document name plus section, line, or id.
- An item taken from another project's shared context (through tags) also names that project, for example `[docnix] context/business-rules.md#BR-04`.
- When a link in the chain is unknown (for example, no evidence yet), leave it explicitly empty or `pending`; do not infer it.
- Distinguish explicit rules (written in the source) from inferred rules (deduced by the agent). Inferred rules are marked `inferred` and need approval before they are treated as requirements.

## Clickable project references

- In Markdown, use a descriptive label and a standard link to an existing source or output. Resolve the path from the referring document, not the repository root. For example, a report in `runs/r1/outputs/report.md` links to an input as follows:

  ```markdown
  [US-12](../../../inbox/US-12.md)
  ```
- Prefer the specific place when verified: `#regras-de-frete` for a Markdown heading (lowercase, spaces become hyphens, punctuation removed; repeated headings have numbered suffixes), `#comment-<id>` for a Markdown comment's stored id or a PDF annotation's NM id, and `#page=3` for PDF page 3. Percent-encode spaces and reserved characters, including characters in comment ids.
- Check the target and anchor in the source. Never manufacture a heading or comment id. If the source moved or is unavailable, state that the reference needs checking.
- Moki also accepts paths rooted at the active project, such as `/inbox/US-12.md`, and legacy project-relative note mentions. New authored documents use document-relative paths so they remain portable in Markdown viewers.
- Use native hyperlinks in other deliverable formats when supported. Do not put raw Markdown into spreadsheet or Word hyperlink fields.
- Chat references follow the current tool's clickable-file convention. Deliverable links must not embed a computer-specific absolute path, a secret, or an unauthorized reference to another project. Shared context keeps its source project named; it does not grant navigation or access to that project.
