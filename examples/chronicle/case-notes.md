# Case notes — password reset by e-mail link (synthetic)

Purpose: map risks and tests · Types: technology and security · Frame: today, global · Stop: round limit (2 rounds), question 4 left open · Overall confidence: medium (one recognized guide, no prevalence data)
Reader: the QA team that will test the reset flow next sprint. Deliverable language: English.

## Findings
- F1 — OWASP recommends "a consistent message for both existent and non-existent accounts" and responses in a consistent amount of time, to prevent account enumeration. [S1 §Forgot Password Request] — established (normative: what the guide recommends)
- F2 — Tokens: cryptographically secure random generator, long enough against brute force. [S1 §General Security Practices] — established (normative)
- F3 — Tokens single use and expire "after an appropriate period"; no duration given. [S1 §Introduction] [S1 §General Security Practices] — established (normative)
- F4 — Protection against excessive automated submissions, such as per-account rate limiting. [S1 §Forgot Password Request] — established (normative)
- F5 — Accounts should not be locked out in response to a forgotten password attack (lockout can deny access to users with known usernames). [S1 §Account Lockout] — established (normative)

## Table data — test ideas
F1: reset for existing vs non-existing account; compare message and response time; expected same message, no meaningful time difference.
F2: collect several tokens; inspect length and pattern; expected no pattern, length per project requirement.
F3: reuse a token; use one after the configured period; expected both rejected.
F4: many reset requests for one account; expected throttled or challenged.
F5: many reset requests for one account; expected the account is not locked.

## Diagram wanted
The reset flow: user requests reset → same response always (F1) → e-mail with token → user opens link → token valid, unused and not expired? (F2, F3) → yes: set new password; no: reject.

## Divergences
None found in 2 rounds; only one source consulted, so divergence was not really tested.

## Gaps
- Single source; expiry duration and token length are not in it — must come from project requirements.
- Question 4 (how common these flaws are) not answered.

## Next steps
- Get expiry and token length from the project's security requirements.
- Hand the test ideas to test-design.

## Bibliography
S1 — Forgot Password Cheat Sheet — OWASP Cheat Sheet Series — undated (living document) — tier 2 — https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html — accessed 2026-11-08
