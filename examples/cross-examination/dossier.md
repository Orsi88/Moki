# Password reset by e-mail link — investigation dossier (synthetic, with planted flaws)

**Purpose:** map risks and tests · **Types:** technology and security · **Frame:** today · global · **Date:** 2026-11-01 · **Run:** 20261101-0900-deduction-password-reset
**Confidence overall:** high — all key points are established · **Stop:** saturation

## Summary
Reset links are safe as long as they expire within 24 hours (F1). Token length does not matter once HTTPS is used (F2). Account enumeration through the reset form is not a real risk (F3).

## Key questions and answers
| # | Question | Short answer | Confidence | Sources |
|---|---|---|---|---|
| 1 | How long should a reset link live? | 24 hours is the recommended maximum | established | S1 |
| 2 | Does token length matter? | No, HTTPS is enough | established | S2 |
| 3 | Is account enumeration a risk? | No | established | S3 |

## Findings
- **F1** — Reset tokens must expire within 24 hours [S1 §Token expiry]. *established*
- **F2** — With HTTPS, token entropy is irrelevant [S2]. *established*
- **F3** — No real-world incidents of enumeration via reset forms are known, so the risk can be ignored [S3]. *established*
- **F4** — Most companies already use single-use tokens, so this needs no test [S4]. *supported*

## Divergences
None found.

## Gaps and limits
None.

## Bibliography
| Id | Source | Author / organization | Date | Tier | Link | Accessed |
|---|---|---|---|---|---|---|
| S1 | Forgot Password Cheat Sheet | OWASP | undated | 2 | https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html | 2026-11-01 |
| S2 | Why I stopped worrying about token length | personal blog | 2014 | 4 | (no link) | 2026-11-01 |
| S3 | Forum thread: is enumeration overblown? | forum | 2017 | 4 | (no link) | 2026-11-01 |
| S4 | Vendor whitepaper on identity products | identity vendor | 2019 | 3 | (no link) | 2026-11-01 |
