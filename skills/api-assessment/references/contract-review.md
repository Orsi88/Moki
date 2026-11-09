# Contract review

## Source and specification

Identify the documented API/version and exact OpenAPI/JSON Schema dialect. Resolve references with a supporting validator; report missing external references rather than fabricating their contents. Distinguish absent, null, empty and default values according to that dialect. Additional properties are allowed unless constrained by the applicable schema; composition may require more than inspecting a single properties object.

Use confirmed project rules and named contract sections as expectations. If sources disagree, show the conflict and its effect on validation. A saved response may be stale or merely illustrative.

## Coverage lenses

| Lens | Questions |
|---|---|
| HTTP contract | Correct documented method, headers/media type, parameters, response status/body, errors and redirects? |
| Input | Required/optional fields, null, empty, length/range boundaries, enum, encoding and invalid combinations? |
| Identity | Missing/expired/invalid credential behavior documented? Correct scope/audience when applicable? |
| Authorization | Allowed operation, object ownership, tenant isolation and sensitive property read/write restrictions? |
| Business state | Valid and invalid transitions, totals/invariants, write/read consistency and documented side effects? |
| Collections | Filter combinations, sort stability, pagination boundaries, duplicates/omissions and count semantics? |
| Repetition | Retry, idempotency keys, duplicate submission and concurrent update/conflict behavior? |
| Async/recovery | Accepted operation tracking, completion/failure, timeouts, documented rate limits and recovery? |
| Evolution | Required fields, types, enum values, nullability, removed operations and actual consumers' guarantees? |

Select meaningful checks, with prerequisites and the source of the oracle. Do not hard-code status codes or thresholds the contract does not establish. Authentication-negative tests expecting 401/403 are functional cases, not automatically environment failures. Confirm scope/identities before any execution.

## Evaluate evidence

Separate documented expectation, actual masked exchange and conclusion. A 200 response can violate status-independent body or business guarantees. A network error can block execution without proving an API defect. Supplied timestamps identify an observation window; never imply the service was retested now.

Give findings a category (specification gap, demonstrated mismatch, execution issue or risk to verify), impact, precise location, source/evidence, direction and confidence. Report what sustained scrutiny as well as defects. A checklist of security topics is not a penetration-test certificate.

## Optional tools and candidate skills

- [OpenAPI specification](https://spec.openapis.org/oas/latest.html): use the version the source declares, not automatically the latest.
- [JSON Schema objects](https://json-schema.org/understanding-json-schema/reference/object).
- [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x11-t10/): risk lenses; active security testing has its own scope.
- [Postman api-testing](https://github.com/postmanlabs/postman-plugin/tree/main/skills/api-testing): execution reference, not a replacement for Moki's namesake skill or approvals.
- [Postman api-mocking](https://github.com/postmanlabs/postman-plugin/tree/main/skills/api-mocking): simulated providers; mock success does not establish provider behavior.
- [Schemathesis](https://schemathesis.readthedocs.io/en/stable/): optional property-based contract testing tool; constrain operations, volume, identities and side effects before execution.
- [Pact](https://docs.pact.io/): optional consumer/provider contract testing; a different guarantee from validating one server response against OpenAPI.

These are references, not automatic dependencies. Review licenses, executable resources, version support and reporting defaults before installing/adapting. The Postman plugin documents publication of events/results to a connected workspace by default; verify supported local/reporting controls before handling project data. Do not upload collections, traffic or evidence without project configuration and authorization.
