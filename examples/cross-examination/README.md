# Example: cross-examination

Synthetic input: [dossier.md](dossier.md) — a short dossier with **planted flaws**. Request: "Act as moriarty and cross-examine `dossier.md`."

## Acceptance checklist

- [ ] The run stops at the decision gate after presenting verdict and counts; the dossier file is not modified.
- [ ] Verdict: **Not reliable as it stands** (or *Usable with fixes* with the critical findings listed first).
- [ ] Findings include, with severity, lens, location and grounds:
  - [ ] **Support/calibration**: F1 is *established* by one source; the reviewer opens S1 and reports what it actually says about expiry (the verdict on F1 depends on the page, not on memory).
  - [ ] **Calibration/time**: F2 and F3 are *established* on a 2014 personal blog and a 2017 forum thread (tier 4, old): at most *weak*.
  - [ ] **Logic**: F3 argues "no known incidents, so no risk" (absence of evidence taken as evidence of absence).
  - [ ] **Logic/bias**: F4 argues "most companies do it, so no test" (popularity is not verification; interested vendor source).
  - [ ] **Consistency**: the summary and the overall confidence ("high", "all established") are stronger than the body allows; "Divergences: none" and "Gaps: none" are implausible.
  - [ ] **Support**: S2, S3 and S4 have no link (not checkable); there is no source log with locators and excerpts.
  - [ ] **Counter-evidence**: at least one source opened in this run that weighs against F2 or F3 (for example a guide that requires high-entropy tokens or uniform reset responses), cited with link and date; or "not performed" when there is no web access.
- [ ] A "What holds up" section exists.
- [ ] No counter-source is cited without having been opened.
