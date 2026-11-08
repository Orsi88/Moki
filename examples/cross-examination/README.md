# Example: cross-examination

Three synthetic deliverables test both sides: finding real flaws, and **not** inventing them.

| Case | Input | What it tests |
|---|---|---|
| 1 | [dossier.md](dossier.md) | Planted flaws are found |
| 2 | [dossier-solid.md](dossier-solid.md) | A sound deliverable is recognized as sound (no false alarms) |
| 3 | [dossier-unreachable.md](dossier-unreachable.md) | "I could not verify" is kept apart from "it is wrong" |

Request for each: "Act as moriarty and cross-examine `<file>`."

## Case 1 — planted flaws

- [ ] The run stops at the decision gate after presenting verdict and counts; the dossier file is not modified.
- [ ] Verdict: **Not reliable as it stands** (F1 is a confirmed critical finding on a main conclusion), not *provisional* — S1 is reachable; S2–S4 lacking links is a finding of the dossier, not a limit of the review.
- [ ] Findings include, with severity, lens, location and grounds:
  - [ ] **Support**: F1 cites `S1 §Token expiry`; the reviewer opens S1 and reports that the cheat sheet has no such section and gives no duration (it asks for tokens that are "single use and expire after an appropriate period"): *does not support* the 24-hour claim.
  - [ ] **Calibration/time**: F2 and F3 are *established* on a 2014 personal blog and a 2017 forum thread (tier 4, old): at most *weak*.
  - [ ] **Logic**: F3 argues "no known incidents, so no risk" (absence of evidence taken as evidence of absence).
  - [ ] **Logic/bias**: F4 argues "most companies do it, so no test" (popularity is not verification; interested vendor source).
  - [ ] **Consistency**: the summary and the overall confidence ("high", "all established") are stronger than the body allows; "Divergences: none" and "Gaps: none" are implausible.
  - [ ] **Support**: S2, S3 and S4 have no link (not checkable); there is no source log with locators and excerpts.
  - [ ] **Counter-evidence**: at least one source opened in this run that weighs against F2 or F3 (for example a guide that requires high-entropy tokens or uniform reset responses), cited with link and date; or "not performed" when there is no web access.
- [ ] A "What holds up" section exists.
- [ ] No counter-source is cited without having been opened.

## Case 2 — sound deliverable (false alarms)

- [ ] Verdict: **Solid**, not provisional (S1 is reachable and every key finding was checked).
- [ ] Support checks F1–F4 against S1 at the cited sections: all *supports* (the excerpts are on the page).
- [ ] No critical or major findings. Acceptable minor findings: the single-source limit and the open question 4 — both already declared by the dossier itself, so at most noted, not counted against it.
- [ ] No invented objection: nothing claims S1 says something it does not; no counter-source cited without being opened.
- [ ] "What holds up" lists F1–F4 and the test ideas.

## Case 3 — one source unreachable

- [ ] S2 (an intranet link) is classified **not checkable** with the reason (cannot be opened), never *does not support*.
- [ ] No finding against F2 because of S2 being unreachable; at most a question to the author (provide the standard's excerpt).
- [ ] Verdict: **Solid (provisional)**, with F2 listed under "Checks not performed" — not *Inconclusive* (only one of four main conclusions is unchecked) and not *Not reliable*.
- [ ] F1, F3 and F4 are checked against S1 as in case 2.
