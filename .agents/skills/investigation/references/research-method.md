# Research method

How to dig. Apply it in the `research` step, in order, and loop while new relevant information appears.

## 1. Map the ground

- Read one or two tier 1–2 overviews (the standard itself, a reference guide, a survey or systematic review) to learn the vocabulary, the main parts and the authorities of the field.
- Write down the field's own terms and synonyms, in each relevant language (for example "SSO" / "federated identity" / "identity federation" / "autenticação única"). Better terms make better searches.

## 2. Search in layers

| Layer | Where | What you look for |
|---|---|---|
| Primary | Standards bodies, official sites, legislation portals, vendor specifications and advisories, CVE/NVD | The rule, the definition, the official requirement, known vulnerabilities |
| Academic | Google Scholar, Semantic Scholar, arXiv, PubMed, SciELO, IEEE, ACM, USENIX | Studies, measurements, attacks and defenses, surveys |
| Reference | OWASP, NIST, CWE/CAPEC, ISTQB, books (publisher pages, previews, tables of contents) | Recognized syntheses, checklists, taxonomies |
| Practice | Vendor docs, engineering blogs, conference talks, bug bounty reports, post-mortems | How it fails in real life, what teams actually do |
| Signals | Forums, issues, Q&A | Recurring pitfalls, open questions, workarounds |

Useful search operators: exact phrase in quotes, `site:` (for example `site:owasp.org`, `site:rfc-editor.org`, `site:gov.br`), `filetype:pdf`, a year range, excluding a word with `-`.

## 3. Follow the trail

- **Backwards**: from a good source, open what it cites for the key claims and find the origin.
- **Forwards**: look for newer work that cites it (Google Scholar "cited by", later versions of a standard, errata, newer advisories) to see if it was confirmed, refined or refuted.
- **Sideways**: who else covers the same point independently?

## 4. Record as you go

Every source opened goes into the source log right away: id (S1, S2…), title, author or organization, publication date, tier, link or identifier (DOI, ISBN, RFC, standard id), accessed on (date), used or discarded and why. The dossier cites these ids.

## 5. Know when to stop

Stop and say which criterion applied:

- **Saturation**: the last searches across layers bring no new relevant fact, risk or position.
- **Limit**: the plan's time, period or number of sources was reached; list what remains as next questions.
- **Plan change needed**: the findings show the plan was wrong — stop and ask (plan change gate).

## Search hygiene

- Queries contain only generic terms. Never project data (see the skill's rules).
- Prefer the original language of the field for the search and read the result in it; report in the deliverable language.
- Distrust a result that only appears on one site or only in AI-written pages.
