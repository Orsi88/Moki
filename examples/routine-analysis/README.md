# Example: routine-analysis

Synthetic input for one case.

## Case 1 — a work item changed

Request: act as `routine-analyst` and follow `routine-analysis`. The routine objective is "Watch work item 123 and prepare documentation updates for my approval." The detected change says item 123 moved from revision 4 to revision 5 and the description now mentions a permission check.

- [ ] The run contains `analysis.json`.
- [ ] `summary` mentions item 123 and the revision change.
- [ ] Every finding has `"kind": "analysis"`.
- [ ] No project file outside the run was modified.
- [ ] A completed analysis has its operation handoff; the person reviews the proposal in Moki.
- [ ] Without a verified original file and SHA-256, `proposedChanges` is empty and the result only asks for acknowledgment.

## Case 2 — a concrete file update

The synthetic request names an existing project text file and asks for a proposed wording update. The original file content and its SHA-256 are available to the agent.

- [ ] `proposedChanges` contains the project-relative path, the original text's verified `baseHash`, the complete `nextText` and a reason.
- [ ] The proposed file is an existing `.md` or `.txt` file, outside runs and routine internals.
- [ ] A missing or unverifiable original hash becomes a finding, never an invented update.
- [ ] The target stays unchanged until the person reviews the exact content and approves in Moki.
