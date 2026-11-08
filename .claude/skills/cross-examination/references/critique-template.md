# Critique template

Answer first: the verdict and the findings that matter. Labels in the deliverable language.

```markdown
# Cross-examination — <deliverable title>

**Deliverable:** <path or "pasted"> · **Type:** <dossier | requirements review | test cases | …> · **Depth:** <quick | full> · **Date:** <YYYY-MM-DD> · **Run:** <run-id>

## Verdict
**<Solid | Usable with fixes | Not reliable as it stands>** — <two or three lines: why, and what must change first>
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

- **Solid**: no critical findings, no more than a few major ones that do not change conclusions.
- **Usable with fixes**: no critical finding left open after the listed fixes, or criticals confined to parts that can be removed.
- **Not reliable as it stands**: a critical finding affects a main conclusion, or the support checks failed broadly.
