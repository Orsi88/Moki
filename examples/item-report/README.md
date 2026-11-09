# Example: item-report

Synthetic inputs, with a **simulated tracker** (the tester answers the metadata, the searches and the writes):

- the pre-analysis in [../failure-analysis/complete-report.txt](../failure-analysis/complete-report.txt) (run `failure-analysis` first, or paste its result);
- the project template [jira-bug.md](jira-bug.md), saved in the project as `templates/items/jira-bug.md` and listed in conventions › Deliverable templates;
- tracker map: Jira · `acme.atlassian.net` · `LIB`; types Bug, Task, Impediment, Story; Bug has Severity and Priority.

Request: "Act as lestrade and register the renewal failure." (cases 1–5) — case 6 registers an item that is not a problem.

## Case 1 — type and template

- [ ] Asks **which item type** to create, listing Bug, Task, Impediment, Story; does not assume Bug.
- [ ] Chosen Bug: uses `jira-bug.md` (title pattern, sections, fields).
- [ ] Chosen Impediment (no template in the project): asks for the model before preparing anything; offers to register it as the project standard.

## Case 2 — missing fields and origins

- [ ] Asks in one message only for what is missing (for example environment and build), not for what the pre-analysis already gives.
- [ ] The expected result cites its origin (the acceptance criterion or test case); if none is known, it asks instead of writing one.
- [ ] Reproduction is marked *reported* unless the QA says it was reproduced (then *verified*, with evidence).
- [ ] The pre-analysis appears under "Technical note", its cause worded as a **hypothesis**.
- [ ] Severity and priority are suggested separately, each with a reason; if the project has no criteria, the generic scale is presented as a proposal.

## Case 3 — resolved duplicate

The tester's search returns LIB-388, *Resolved*, "Renewal fails on holiday dates".

- [ ] Shows LIB-388 with why it looks similar and the limits of the search; says no candidate would not prove there is none.
- [ ] Offers: new item linked to LIB-388 as a possible regression, comment on LIB-388 (with its own preview), or cancel.

## Case 4 — batch with partial approval

Request: register two problems (the renewal failure and a typo on the receipt screen).

- [ ] Asks whether one type applies to both or one per item.
- [ ] Two preview blocks (item 1, item 2), each with all fields, the full text ending with the signature, attachments and links.
- [ ] "Only item 1": only item 1 is created; item 2 stays prepared (`outputs/item-2-...md`) and `skipped` in the journal.

## Case 5 — created, attachment failed

The tester accepts the create (LIB-412) and fails the attachment.

- [ ] Reports LIB-412 with its link and the failed attachment with the reason; on resume, attaches to LIB-412 without creating it again; never deletes.

## Case 6 — not a problem: an impediment and an improvement

Request: "Register two things: we are blocked because the test environment has no SSO certificate, and a suggestion to show the renewal limit on the loan screen."

- [ ] Asks the type for each (offering the tracker's types); does not register them as bugs.
- [ ] Uses each type's template (or asks for it); no expected/obtained result, reproduction or severity fields are added when the template does not have them.
- [ ] No invented owner, effort, date or acceptance condition; asks only for what the templates require and the material lacks.
- [ ] Duplicate search and the exact preview as in the other cases.
