# Freshness check

Before working on an activity that relies on tracker items (an MF, a user story, a bug, a test case), check whether they changed since the version the work is based on. It runs when an activity **starts** and when a run is **resumed**, for every agent, through `project-context`.

## Which items

- **New activity**: the items named in the request. If the activity relies on an item and none was named, ask for **the item number or the URL**. If the user says there is none, record that and skip the check.
- **Resume**: the items in the run's `state.json` `sources`; ask only if there are none and the activity relies on one.
- Linked items (parent, children, related) only when the earlier work used them. Never sweep the tracker.

## Which version to compare with

The **adopted** version (`sources[].adopted: true`) of the same item: in this run, or else in the most recent run of this project that used it. No earlier version → this is the first read: snapshot and adopt it with the user's go-ahead of the activity; no comparison.

## Steps

1. **Read** the item through `dispatch` (fields, description, acceptance criteria, relevant fields such as state and assigned area, comments with author and date, attachments, links, revision). No approval is needed for this read when the project has the server with read access (approval policy).
2. **Unchanged** (same revision, same comments and attachments): say so in one line with the revision and date; record `lastCheck` `unchanged`.
3. **Changed**: compare with the adopted snapshot and list, per part, what was **added**, **changed** and **removed**: description, each acceptance criterion, relevant fields, comments (new or edited; author, date, link), attachments, links. Quote the changed text briefly.
4. **Impact**: for each change, which existing work it touches (review items `REV-XXX`, definitions, scenarios, test cases, evidence, reports) and how: still valid, needs review, contradicted. Preserve everything that remains valid.
5. **Decide**: present the changes and their impact to the user. A change, or a comment, never replaces a confirmed definition silently. Contradictions, pending functional decisions and scope changes are the user's decision. After the decision, adopt the new version (`adopted: true` on a new `sources` entry, the old one kept as history) and re-evaluate only the affected parts.
6. **Record** in `state.json`: the check (`lastCheck` with date, result and the revision seen), the snapshot of the new version, and in `results` the changes found and what was adopted.

## When the check cannot be done

- MCP missing or failing: say that **the update could not be verified**, give the date of the last successful check (from `sources`), record `lastCheck` `failed` with the reason, and ask the user to send the current item (paste or attach) to compare. Never treat a failed read as "no changes".
- The user can choose to continue on the adopted version; record that choice.

## Report format

```text
MF 1234 (Azure DevOps) — checked 2026-11-09 10:05, revision 18 (adopted: 15, 2026-11-07)
Changed:
- Acceptance criterion 3: "up to 3 renewals" → "up to 2 renewals" (rev 17, by Ana, 2026-11-08)
Added:
- Comment by Rui, 2026-11-08 16:20: "Renewal blocked when there is a fine" (link)
Impact:
- REV-004 (renewal limit) — answered "3" in round 1: contradicted, needs your decision
- Scenarios CT-07, CT-08 — depend on the limit: need review after the decision
Still valid: REV-001 to REV-003, REV-005; scenarios CT-01 to CT-06
```
