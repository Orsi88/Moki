# Critique template

Answer first: the verdict and the findings that matter. Labels in the deliverable language.

```markdown
# Cross-examination — <deliverable title>

**Deliverable:** <path or "pasted"> · **Type:** <dossier | requirements review | test cases | …> · **Depth:** <quick | full> · **Date:** <YYYY-MM-DD> · **Run:** <run-id>

## Verdict
**<Solid | Usable with fixes | Not reliable as it stands | Inconclusive>** <(provisional)> — <two or three lines: why, and what must change first>
Checks not performed: <e.g. external sources (no web access), claims C9–C20 (quick depth); or "none">

| Critical | Major | Minor |
|---|---|---|
| <n> | <n> | <n> |

## Findings
| Id | Severity | Lens | Where | Problem | Grounds | Status | Direction for the fix |
|---|---|---|---|---|---|---|---|
| X1 | critical | support | §Risk catalog, R4 | <what is wrong> | <source + locator, quote, or reasoning> | confirmed | <what the author should do> |

## Support checks
| Claim | Source and locator | Result | Note |
|---|---|---|---|
| C1 | S3 §5.2 | supports | |
| C2 | S7 p. 4 | does not support | the page says … |

## Counter-evidence found
<sources opened in this run that weigh against a conclusion: id, link, date, what they say, which claim they affect; or "none found after <n> rounds">

## What holds up
<the conclusions and parts that survived the examination, briefly>

## Questions to the author
<what must be clarified to close suspected findings>
```

## Verdict rules

The verdict judges **the version examined**, as it is. Whether and how it can be repaired goes in each finding's direction for the fix, never in the verdict. Apply the rules in this order and take the first that matches:

1. **Inconclusive**: the support of most main conclusions could not be checked (sources inaccessible, no web access). A deliverable that cites nothing is not inconclusive: its missing support is a finding. Say what would be needed to conclude.
2. **Not reliable as it stands**: at least one *confirmed* critical finding affects a main conclusion, or at least a third of the checked key claims came out *does not support* or *contradicts*.
3. **Usable with fixes**: at least one *confirmed* major finding, or a critical finding confined to a secondary part.
4. **Solid**: only minor findings, or none.

Checks not performed never count as findings against the work ("I could not verify" is not "it is wrong"). When the support of any main conclusion could not be checked, the verdict (2–4) gets the qualifier **provisional** and lists those conclusions under "Checks not performed". *Suspected* findings do not decide the verdict; they go to "Questions to the author".
