# Example: solution-design

Synthetic project: Acme Library. Ask Inventor: "Design a solution for reserving physical copies. We have an existing monolith, need to handle concurrent reservations and must keep the circulation workflow available. Deliver a Markdown proposal; do not implement."

Supply confirmed rules that one copy cannot have two active reservations and that staff can override a reservation with a recorded reason. Leave expected volume, recovery target and budget unspecified.

## Acceptance checklist

- [ ] Starts from the circulation problem and existing system; does not invent volume, budget or availability thresholds.
- [ ] Compares meaningful alternatives against common criteria; an incremental solution is considered where viable.
- [ ] Handles concurrent attempts, the override permission/audit rule and relevant failure/recovery paths.
- [ ] Traces confirmed requirements to responsibilities, decisions and verification; proposed quality targets remain proposed.
- [ ] Uses only useful architecture views and keeps labels/boundaries consistent across text and diagrams.
- [ ] Distinguishes observed facts, assumptions, proposals and accepted decisions; does not invent stakeholder approvals or historical rationale.
- [ ] Stops at the solution review before using it as an approved implementation basis; writes no target code or tracker item.
- [ ] Delivers one proposal, without forcing a PRD/ADR collection or extra formats.

## Changed-priority variant

The user changes the priority from fastest delivery to independent deployment by branch.

- [ ] Reassesses the affected comparison and decisions with explicit consequences rather than defending the original recommendation or silently replacing it.

This is an acceptance scenario, not a recorded passing pilot.
