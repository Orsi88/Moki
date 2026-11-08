# Dossier template

A dossier is read top-down: the answer first, then the ground under it. Every section answers a question; nothing is there to fill space.

## Writing rules

- **Answer first.** The summary gives the conclusions, not the history of the research.
- **One idea per paragraph**, at most four lines. Tables for anything with more than two attributes per item. Lists for parallel items.
- **Cite inline** with the source log id in brackets: "Signature wrapping lets an attacker inject an unsigned assertion [S3][S7]." The bibliography resolves the ids.
- **Confidence on every finding**: *established*, *supported*, *disputed*, *weak* or *hypothesis* (meanings in the skill's rules).
- **Diagrams** in Mermaid code blocks, at most 15 nodes, only where they explain better than text (concept map, flow, timeline, comparison of architectures).
- Quotes short, in the original language, in quotation marks, with the id.
- Labels in the deliverable language.

## Mandatory sections

```markdown
# <Topic> — investigation dossier

**Purpose:** <…> · **Date:** <YYYY-MM-DD> · **Run:** <run-id>
**Confidence overall:** <high | medium | low> — <one-line reason>

## Summary
<5 to 10 lines: the answers to the key questions, the strongest evidence, the main gap>

## Key questions and answers
| # | Question | Short answer | Confidence | Sources |
|---|---|---|---|---|

## Context
<what the reader needs to understand the rest: definitions, main parts, actors; a Mermaid concept map when useful>

<purpose sections — see below>

## Divergences
<where credible sources disagree: each position, its evidence and date; or "none found">

## Gaps and limits
<what could not be established, sources not accessible, period or language limits, where the stop criterion was reached>

## Next steps
<suggested actions: follow-up questions, who to ask, which Moki skill can continue>

## Bibliography
| Id | Source | Author / organization | Date | Tier | Link | Accessed |
|---|---|---|---|---|---|---|

### Further reading (not consulted)
<only relevant items that could not be opened; never cited above>
```

## Purpose sections

Pick the set that matches the purpose; combine when the user asked for more than one use.

### Understand
- **How it works** — the mechanism, step by step, with a flow diagram.
- **History and evolution** — a short timeline (Mermaid `timeline`) when it explains the current state.
- **Key concepts** — glossary table: term, meaning, source.
- **State of the art and consensus** — what the field agrees on today.

### Map risks and tests
- **Risk catalog** — table: Id · Risk · How it happens · Impact · Likelihood · Reference (CWE/CAPEC/OWASP, CVSS when a CVE exists) · Confidence · Sources. Group by area (for SSO, e.g. token issuance, validation, session, logout, configuration).
- **Known incidents and vulnerabilities** — real cases (CVE, advisories, reports) with date and lesson.
- **Care points and controls** — checklist of what must be true (recommended controls), each with its source.
- **Test ideas per risk** — table: Risk id · What to test · Technique (e.g. negative test, boundary, tampering, replay) · Expected secure behavior · Environment notes. Ideas, not detailed test cases; `test-design` details them.
- **Scores and criteria** — how the field rates severity (CVSS, OWASP risk rating, ASVS levels) and how it applies here.

### Decide
- **Options** — what each option is, one line each.
- **Comparison** — table: criterion × option, each cell with its evidence id.
- **Trade-offs** — what you gain and lose with each.
- **Recommendation** — the option the evidence favors, for which conditions, and what would change it. Labeled as the investigator's recommendation.

### Support a position
- **Position** — the claim, in one sentence.
- **Arguments** — each with its evidence and confidence.
- **Counter-arguments** — the strongest objections and how the evidence answers them (or does not).
