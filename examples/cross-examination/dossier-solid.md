# Password reset by e-mail link — investigation dossier (synthetic, sound)

**Purpose:** map risks and tests · **Types:** technology and security · **Frame:** today · global · **Date:** 2026-11-08 · **Run:** 20261108-0900-deduction-password-reset
**Confidence overall:** medium — the findings rest on one recognized guide (OWASP), cited at the section; no independent measurement of how common each flaw is · **Stop:** round limit (2 rounds) — question 4 left open

## Summary
OWASP's Forgot Password Cheat Sheet recommends four controls that map directly to tests: the same response for existing and non-existing accounts (F1), random and long tokens (F2), tokens that are single use and expire (F3), and protection against automated reset requests (F4). The guide gives no expiry duration and no token length, so those values must come from the project.

## Key questions and answers
| # | Question | Short answer | Confidence | Sources |
|---|---|---|---|---|
| 1 | Can the reset form reveal which accounts exist? | It can; OWASP recommends a consistent message and response time | established (as a recommendation of the guide) | S1 |
| 2 | How should tokens be generated? | Cryptographically secure random, long enough against brute force | established (as a recommendation of the guide) | S1 |
| 3 | How long should a token live? | Single use, expire "after an appropriate period"; no duration given | established that no duration is given | S1 |
| 4 | How common are these flaws in practice? | Not established in this run | gap | — |

## Findings
- **F1** — OWASP recommends returning "a consistent message for both existent and non-existent accounts" and responses in a consistent amount of time, to prevent account enumeration [S1 §Forgot Password Request]. *established* (normative: what the guide recommends)
- **F2** — Tokens should be generated with a cryptographically secure random number generator and be long enough to protect against brute force [S1 §General Security Practices]. *established* (normative)
- **F3** — Tokens should be invalidated after use and expire after an appropriate period; the guide sets no duration [S1 §Introduction][S1 §General Security Practices]. *established* (normative)
- **F4** — The guide recommends protection against excessive automated submissions, such as per-account rate limiting [S1 §Forgot Password Request]. *established* (normative)

## Test ideas per risk
| Finding | What to test | Technique | Expected secure behavior |
|---|---|---|---|
| F1 | Request a reset for an existing and a non-existing account | Comparison of message and response time | Same message; no meaningful time difference |
| F2 | Collect several tokens | Inspection of length and pattern | No visible pattern; length per project requirement |
| F3 | Reuse a token; use a token after the configured period | Negative test | Both rejected |
| F4 | Send many reset requests for one account | Automated repetition | Requests throttled or challenged |

## Divergences
None found in 2 rounds; only one source was consulted, so divergence was not really tested (see gaps).

## Gaps and limits
- Single source (S1). Values (expiry, token length) are not in it and must come from project requirements.
- Question 4 (prevalence) not answered: no study or incident data consulted.

## Bibliography
| Id | Source | Author / organization | Date | Tier | Link | Accessed |
|---|---|---|---|---|---|---|
| S1 | Forgot Password Cheat Sheet | OWASP Cheat Sheet Series | undated (living document) | 2 | https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html | 2026-11-08 |

## Source log (excerpt)
| Finding | Source | Locator | Excerpt |
|---|---|---|---|
| F1 | S1 | §Forgot Password Request | "Return a consistent message for both existent and non-existent accounts." |
| F2 | S1 | §General Security Practices | "Generated using a cryptographically secure random number generator" |
| F3 | S1 | §Introduction | "Single use and expire after an appropriate period." |
| F4 | S1 | §Forgot Password Request | "Implement protections against excessive automated submissions such as rate-limiting on a per-account basis" |
