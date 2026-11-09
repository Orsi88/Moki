---
name: api-assessment
description: Assesses API contracts and technical validation coverage, tracing expectations to sources and separating specification gaps from implementation defects. Use when reviewing REST/HTTP/OpenAPI behavior or preparing an API validation strategy; approved request execution stays in api-testing.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: quality
---

# API Assessment

## Purpose

Determine what an API promises, what needs verification and what the available evidence actually establishes, with explicit expectations, permissions, coverage and limits.

## Responsibilities

- Review documented contracts, HTTP semantics, authentication/authorization requirements, business invariants and compatibility.
- Prepare risk-based validation coverage and assess supplied masked exchanges/results.
- Distinguish contract ambiguity, demonstrated defect, execution problem and unverified risk.
- Do not send requests, generate unapproved credentials, invent endpoints/expected behavior or perform a security/load assessment under a general validation request.

## When to use

Use for API specification review, technical validation strategy, coverage analysis and interpretation of existing evidence. Execute approved requests with `api-testing`; use `test-design` when formal scenario mapping/detailed test cases are requested, preserving its gates. Use `failure-analysis` for a failure's probable cause.

## Inputs

Required: project, assessment question and at least one usable source (contract, documented requests, approved cases or supplied exchanges). Determine requested deliverables/format and assessment mode. Missing expected behavior remains a specification gap; execution requires additional inputs owned by `api-testing`.

Optional: OpenAPI/JSON Schema version, collections, business rules, role/tenant matrix, compatibility policy, environment description and prior results. Do not ask for secret values. A sample response alone is evidence of an observation, not a complete contract.

## Tools

Read project files and use local contract/schema validators when available. A JSON parser is not a schema validator; use one supporting the actual specification/dialect and reference resolution. Without it, state the check was manual or incomplete. Configured source connectors can read named contract/work-item sources within their authorization. This skill does not call the target API.

## Procedure

1. **Frame** (`frame`). Identify the project with `project-context`, load relevant integration, rules, roles and conventions, and create/resume the run. Establish scope, source revisions, mode and requested format. For a linked tracker item refresh through configured authorized reads when possible, compare with the accepted basis and report stale/unknown freshness if unavailable.
2. **Inspect** (`inspect`). Read [contract review](references/contract-review.md). Inventory the documented operations, methods, auth requirements, inputs, responses, errors and workflow links. Check specification/dialect support and unresolved references. Separate observed implementation from documented expectation and confirmed business rule.
3. **Assess** (`assess`). Evaluate applicable contract, boundary, permission, state, pagination, idempotency, concurrency and compatibility concerns. Derive each expectation from a named source. Classify a missing guarantee as a gap, not a failed API. Use risk to select checks; do not manufacture requests to fill a coverage count.
4. **Map** (`map`). If requested, prepare validation coverage: operation/flow, risk, source-backed expectation, data/identity prerequisites, relevant side effects and verification method. Include absent/invalid credentials, other-owner/tenant access and failure/recovery only as applicable and authorized. Missing permission to test does not imply a pass.
5. **Review** (`review`). Present findings by impact with location, source/evidence, consequence, direction and confidence. State which guarantees held in supplied evidence and what remains unverified. Confirm inferred expectations before adopting them. Ask whether to proceed to formal case design or execution; do not call anything under assessment approval.
6. **Handoff** (`handoff`). When requested, pass the accepted source basis and selected coverage to `test-design` for formal cases or documented requests/expectations to `api-testing`. The receiving skill owns its plan and approvals. Do not overwrite an existing collection or auto-publish results.
7. **Close** (`close`). Deliver the selected assessment/coverage format and record decision status, evidence limits and remaining questions. Offer failure analysis or evidence preparation only when relevant.

## Rules and constraints

- Follow [isolation](references/core/isolation-policy.md), [approval](references/core/approval-policy.md), [traceability](references/core/traceability.md) and [execution principles](references/core/execution-principles.md).
- A successful HTTP exchange, valid JSON or a mock pass does not prove correct business behavior.
- Do not assume extra response properties violate a schema, every error uses one status, all lists are ordered or a missing requirement means the implementation is wrong.
- Review ownership/tenant/property authorization separately from authentication. Ordinary functional permission checks need defined scope/identities; exploit scanning, credential attacks and load need separate authorization and a suitable specialist/tool.
- Record response-time observations with conditions; performance acceptance requires a confirmed criterion and appropriate execution design.
- Keep test cases, assertions and sample data independent of the current implementation's mistakes; never derive the oracle solely from the response being judged.
- Preserve the existing `api-testing` execution and verdict-confirmation gates; no automatic replay of writes, cleanup or external publication.

## Validation criteria

- Each finding/coverage item has a source or an explicitly pending expectation, plus its scope and impact.
- Static contract review, supplied evidence, real execution and mock execution remain distinguishable.
- Authorization, business state and negative paths are considered where material; exclusions are visible.
- Schema checks report dialect/ref-resolution support and actual verification method.
- A handoff contains sufficient known inputs and leaves unresolved behavior pending instead of inventing it.

## Output format

Only the agreed assessment, coverage matrix or technical note in the requested format under `workspace/projects/<project-id>/runs/<run-id>/outputs/`. Findings contain location, classification, evidence/source, impact, correction direction and confidence. Do not generate collections, cases, evidence packs or extra formats unless requested; conversation-only assessment needs no mandatory report file.

## Human approval points

- `review`: confirmation before adopting inferred behavior/criteria; retain already confirmed definitions.
- Formal test design and HTTP execution follow the receiving skill's gates; sharing, publication and collection/repository changes require their own approval.

## Error handling

Missing contract: assess supplied observations only, ask for the missing guarantees and state coverage limits. Unsupported dialect/unresolved references: report incomplete validation; do not claim schema validity. Contradictory sources: preserve both and seek a decision. Unmasked secrets in inputs: do not reproduce them. Same source/tool action failing three times: persist `blocked` and report.

## Completion criteria

The requested assessment or coverage is delivered with traceable findings, supported conclusions, specification gaps and an explicit handoff/verification limit.

## Persistence

Follow [persistence](references/core/persistence-protocol.md). Under `workspace/projects/<project-id>/runs/<run-id>/` retain source revisions, assessment scope, approved expectations, findings and handoff paths. Helpers stay in work; only requested deliverables and required masked evidence enter artifacts. Resume by checking changed contracts and invalidating only affected conclusions.
