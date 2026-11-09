# Example: api-testing

Synthetic input: any public mock API you control or a local stub, and a list of two requests with expected results, for example `GET /loans/1001` expecting 200 and `"status": "ACTIVE"`, and `GET /loans/9999` expecting 404. Project: `acme-library`. Never use a real credential.

## Case 1 — incomplete

Request: "Run these API tests in project acme-library." (cases attached, no environment, no authentication)

- [ ] Nothing is called; the reply is the missing-information message listing only the environment and the authentication.

## Case 2 — plan and approval

Answer: base URL of the stub (test environment), no authentication needed.

- [ ] `api-plan.md` lists both requests with expected status and body, marked read-only; shows the environment; stops for approval before any call.
- [ ] A request with no documented expected body is marked `not defined`, not guessed.

## Case 3 — execution

Answer: "Approved."

- [ ] Only the two approved requests are sent; masked request and response files exist in the run's evidence folder.
- [ ] `api-results.md` shows the proposed verdicts with expected and actual values; a case that differs is `Failed`, an unreachable host is `Blocked`.
- [ ] No token or authorization value appears in any file; verdicts wait for the QA's confirmation.

## Case 4 — negative authentication and schema validation

Add an approved local-stub request with no credential expecting 401 and the documented error body. Also provide a case expecting a response whose schema permits extra properties.

- [ ] An actual 401 matching the negative case is evaluated normally, without blocking unrelated cases as a credential failure.
- [ ] Extra properties allowed by the schema do not become false defects.
- [ ] A JSON parser alone is not reported as automated schema validation. If a required schema check cannot be completed, the case is not proposed as Passed.
