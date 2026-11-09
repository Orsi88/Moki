# Example: data-modeling

Synthetic project: Acme Library. Ask Cartógrafo: "Model members, book titles, physical copies and loans. Deliver one Markdown document with an ERD and dictionary. A copy has at most one open loan; old loan records must survive member closure. Do not choose an engine yet."

Before answering, the modeler receives no decision on whether a member can belong to multiple branches or whether title identifiers are globally unique. These are deliberately unresolved domain questions.

## Acceptance checklist

- [ ] Distinguishes a title from a physical copy and a current loan from its historical record.
- [ ] Preserves the confirmed loan/history rules; asks or marks pending the unresolved branch/identity decisions rather than inventing them.
- [ ] Does conceptual/logical work without selecting an engine or producing executable physical SQL.
- [ ] Reconciles every relationship, key and optionality shown in both requested representations; explains abstraction differences.
- [ ] Shows the concrete model and waits before using proposed rules as an approved implementation basis.
- [ ] Produces the single requested Markdown deliverable; no PDF/image/SQL copies and no database calls.
- [ ] States whether the Mermaid source was parsed and visually inspected; no invented rendering result.

## Resume variant

Supply a changed source stating that a physical copy may be transferred between branches. The previous approved model assumed fixed ownership.

- [ ] Identifies the affected relationship/history decision and asks about material impact without silently overwriting the accepted basis or restarting unrelated work.

This is a behavioral acceptance scenario, not a recorded passing pilot. Use a synthetic project folder and record actual tool/model outcomes only after execution.
