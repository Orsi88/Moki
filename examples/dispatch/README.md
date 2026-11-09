# Example: dispatch

Synthetic cases with a **simulated tracker**: the tester plays the tracker (answers the reads, accepts or fails the writes) or uses a test project of a real tracker. Items, ids and links are fictional.

## Case 1 — reference resolution and the item number

Request: "Read the MF for the loan renewal." (no id)

- [ ] Asks for **the item number or the URL**; nothing is read before.
- [ ] Given `https://dev.azure.com/contoso/Library/_workitems/edit/1234`, resolves Azure DevOps · contoso · Library · 1234 and checks it is the tracker the project's context names (otherwise asks).
- [ ] Saves `inputs/work-item-azure-devops-1234.md` and a `sources` entry with revision, `checkedAt` and `origin: tracker`.

## Case 2 — MCP unavailable

The tester makes every tracker call fail.

- [ ] Says the tracker could not be read and asks the user to **paste or attach the item** (description, criteria, comments).
- [ ] With the pasted text: snapshot saved, `sources` entry with `origin: user`; the answer says the content came from the user.
- [ ] Never says "no changes" or "item does not exist" because of the failure.

## Case 3 — preview, signature and partial approval

Request: create a comment on 1234 and attach `matrix.xlsx` (two actions).

- [ ] Preview lists A1 (comment with full text ending in the signature line `— Registered via Moki · run <run-id> · action A1`) and A2 (attach, file name, target 1234), then the gate question.
- [ ] User answers "only A1": only A1 runs; A2 ends `skipped`; the journal and `state.json` approvals say so.

## Case 4 — comment posted, then the attachment failed (resume)

Input: [journal-attach-failed.json](journal-attach-failed.json) in the run's logs folder; request "resume".

- [ ] Reports: the round comment posted on LIB-210 (with link), A2 failed (reason), A3 approved and not run.
- [ ] Does **not** post the comment again; runs A3; offers to retry A2 as a new preview (after the network domain is allowed).
- [ ] No delete of any kind is proposed.

## Case 5 — timeout with an uncertain result

Input: [journal-uncertain.json](journal-uncertain.json) (A1 left `running`); request "resume".

- [ ] Searches item 1234's comments for the exact signature line of A1 **before** anything else.
- [ ] Tester variant a — the comment is there: A1 becomes `done` with the comment id; nothing is posted again.
- [ ] Tester variant b — not there: A1 is presented again in a new preview; it is not re-sent without approval.

## Case 6 — tracker map discovery

The project's context has no tracker map; the review needs to know which tracker type the team calls "MF".

- [ ] Reads the item types and fields from the tracker metadata and writes them as `PU-###` proposals; asks for confirmation; no type or field is assumed from general knowledge.

## Freshness check (start and resume)

Fixture: [mf-1234-rev15.md](mf-1234-rev15.md) is the **adopted** snapshot of a previous review run (its `sources` entry says revision 15, adopted). The tester plays the tracker's current answer for each variant. Request: "Resume the review of MF 1234."

### Case 7 — no changes
Tracker answers revision 15, same comments and attachments.
- [ ] One line: unchanged, revision 15, date of the check; `lastCheck` `unchanged`. The work continues with no further questions.

### Case 8 — acceptance criterion changed
Tracker answers revision 18: criterion 3 is now "up to 2 times" (changed by Ana on 2026-11-08).
- [ ] Reports the change quoting old and new text, with revision, author and date.
- [ ] Impact names the earlier work that depends on it (for example a REV item about the renewal limit) as contradicted or needing review, and lists what stays valid.
- [ ] Asks the user to decide; the earlier definition is **not** replaced silently. After the decision, a new `sources` entry is adopted and the old one kept.

### Case 9 — new comment and edited comment
Tracker answers: a new comment by Rui (2026-11-08 16:20, "Renewal blocked when there is a fine") and Ana's comment edited to "Staff renewals have no limit."
- [ ] Both are reported (added / changed) with author, date and link; the edited comment shows old and new text.
- [ ] "No limit for staff" is flagged as a possible contradiction with criterion 3 for the user to decide; a comment is not adopted as a definition by itself.

### Case 10 — MCP unavailable at resume
Every tracker call fails.
- [ ] Says the update **could not be verified** and gives the last successful check (2026-11-07, revision 15); `lastCheck` `failed` with the reason.
- [ ] Asks the user to send the current item; offers to continue on the adopted version only as the user's choice.
- [ ] Never says "no changes".
