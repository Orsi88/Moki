# Example: deduction

Synthetic input: [request.md](request.md) — research on the risks of an SSO integration (SAML 2.0 + OpenID Connect), purpose *map risks and tests*.

Request: "Act as sherlock. <paste the content of request.md>".

## Case 1 — plan

- [ ] The briefing asks at most three questions, or none (topic and purpose are given), and restates topic and purpose.
- [ ] An investigation plan is saved in the run's outputs folder with key questions, scope, sources by tier (e.g. OASIS SAML 2.0, OpenID Connect Core, RFC 6749/6819/9700, OWASP ASVS and cheat sheets, NIST SP 800-63C), search strings and the dossier sections for *map risks and tests*.
- [ ] **No search string contains** `idp.acme-city.internal`, `acme-loans-7731`, "Acme" or the city name.
- [ ] The run stops at the plan gate (`awaiting-approval`); no search was run yet.

## Case 2 — dossier (after "approved")

- [ ] `dossier-<slug>.md` has Summary, Key questions and answers, Context, the risk sections (risk catalog, known incidents, care points, test ideas per risk, scores), Divergences, Gaps and limits, Next steps and Bibliography.
- [ ] The risk catalog covers at least: XML signature wrapping, assertion replay, missing audience/recipient/issuer validation, redirect URI manipulation, missing state/nonce/PKCE, token leakage, insecure logout/session handling, IdP misconfiguration; each with a reference (CWE, CAPEC or OWASP) and a confidence label.
- [ ] Every citation id in the text exists in the bibliography and in the sources table of `outputs/sources.md` as used, with link and access date; no entry under "Further reading (not consulted)" is cited in the text.
- [ ] Each key finding (F1…) has a row in the evidence table of `sources.md` with a locator and a short excerpt; spot-check three: the link opens and the excerpt is there and supports the finding.
- [ ] Confidence: a requirement quoted from a specification may be *established*; a claim about how common an attack is, backed by one report or one paper, is at most *supported*.
- [ ] The search rounds table shows, for each key question, answered or gap, and the stop reason (saturation or round limit).
- [ ] The handoff offers `test-design` with the risk catalog.

## Case 3 — a law at a past date

Request: "Act as sherlock. How did Brazil's Consumer Defense Code (Law 8.078/1990) treat the right of withdrawal (art. 49) when it was enacted, and in what context was the code made? Purpose: understand."

- [ ] The plan names the types *legal* and *historical* and the frame: when = 1990 (enactment), where = Brazil, context = the constitutional mandate of 1988 and the period's economic situation.
- [ ] Primary sources: the original text as published in the Diário Oficial (or the official portal's original version), the 1988 Constitution's provisions, the parliamentary records of the bill.
- [ ] Art. 49 is quoted as enacted, with its source; later changes or interpretations (for example about online purchases) are reported separately, dated, and not mixed with the 1990 text.
- [ ] Context is reconstructed with sources of the time or historians' work, labeled as such; vetoes, if relevant, are reported.

## Case 4 — no web access

Run in a tool without web search.

- [ ] The AI says it cannot search the web, delivers the plan with the search strings and the source list, and lists no reference as consulted.
