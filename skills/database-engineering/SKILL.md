---
name: database-engineering
description: Builds and reviews engine-specific schemas, SQL, queries and migrations, with measured diagnostics and an approved execution plan. Use when implementing a data model, evolving a database or investigating query behavior; domain modeling belongs to data-modeling.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: engineering
---

# Database Engineering

## Purpose

Translate an approved structure or a concrete database problem into correct, verifiable SQL and a controlled change or diagnostic procedure for the actual engine and version.

## Responsibilities

- Implement schemas and migrations, review SQL, inspect queries and explain measured performance findings.
- Assess data preservation, application compatibility, locking, retry and recovery for requested changes.
- Separate generated, statically reviewed, isolated-tested and target-applied results.
- Do not redesign business rules without confirmation, administer unrelated infrastructure or execute a live change merely because SQL was requested.

## When to use

Use for DDL, migrations, SQL review, query analysis and database implementation. Use `data-modeling` when the domain structure is the unresolved question. This skill is not a generic instruction to provision a database or conduct load/security testing.

## Inputs

Required: project, objective, engine/version and the relevant schema, approved model, SQL or diagnostic evidence. For execution also require the named environment, connection/credential source, exact operation and authority to execute. Ask which deliverable and format the user wants if unspecified.

Optional: ORM/migration tooling, query plans, representative volumes, workload, current application versions, service window, recovery constraints and test fixtures. Never guess production sizing or availability guarantees.

## Tools

Read/write project files; use the project's SQL client, CLI or MCP if configured. Preserve the existing migration framework and driver. Use an isolated engine compatible with the target for execution tests when available and authorized. Without it, review statically and list unverified behaviors. Credentials come from the tool's secret store or environment, never from generated files.

## Procedure

1. **Scope** (`scope`). Load `project-context`, identify the engine, version, mode (generate/review/diagnose/apply), environment and requested formats. Create/resume the run; record source revisions and existing approvals. For a linked work item refresh authorized tracker data when possible and assess changes against the accepted basis; otherwise disclose the last successful refresh or unknown freshness.
2. **Inspect** (`inspect`). Read [engine guidance](references/engine-guidance.md). Inspect schema, relevant SQL, actual tooling and available evidence. Separate documented constraints, observed behavior and hypotheses. A supplied connection string does not authorize a database call.
3. **Plan** (`plan`). Describe the exact files/statements, affected objects, data transformations, runtime/lock concerns, application compatibility, checks and recovery strategy. Identify read-only diagnostics, calls that execute a workload and writes. Show uncertainty and request approval before any repository edit, database execution or external sharing. Reuse an existing explicit approval only within its scope.
4. **Prepare** (`prepare`). Produce requested scripts or approved repository edits. Use engine-correct syntax, explicit constraints, parameterized application values and reviewed identifier handling. For migrations include preconditions, serialized application, restart behavior, data validation and phased deployment where needed. Do not call a guard alone an idempotency guarantee.
5. **Verify** (`verify`). Perform approved static/isolated checks. When available, inspect the resulting schema against the model, exercise relevant constraints and compare pre/post data invariants. For performance compare plans and measurements under stated conditions; a hypothetical index is not a measured improvement. Report failures before target execution.
6. **Apply** (`apply`). Only when requested and explicitly approved for this target: recheck the source/schema revision and preconditions, execute once, record masked receipts and verify the approved postconditions. If the outcome is uncertain, reconcile it before retrying. Changed SQL or preconditions require a revised approval.
7. **Close** (`close`). Deliver the selected artifacts, validation level, actual operations and unresolved risks. Preserve logs needed to reconcile partial execution. Record completed work without claiming unperformed application or performance verification.

## Rules and constraints

- Follow [isolation](references/core/isolation-policy.md), [approval](references/core/approval-policy.md), [traceability](references/core/traceability.md) and [execution principles](references/core/execution-principles.md).
- No automatic DROP, truncation, destructive correction, index creation or production plan execution while diagnosing.
- An actual plan or EXPLAIN ANALYZE may execute the query; assess side effects and obtain the required approval first.
- SQL dialects, null semantics, DDL transactionality and online operations vary. Verify against the selected engine/version.
- A downgrade script does not guarantee data recovery. State irreversible transformations and the actual restore/forward-fix strategy.
- Do not overwrite user scripts, manual edits or established migration history. Proposed tuning must retain correctness and permissions.
- Do not invent benchmark numbers or promise zero downtime. Keep secret values and sensitive rows out of artifacts.

## Validation criteria

- The selected engine/version, source revision, environment and validation level are explicit.
- Scripts agree with the approved model; execution receipts correspond to the approved statements only.
- Relevant constraints and data invariants are checked, or the missing capability is named.
- A migration documents compatibility, recovery and partial/repeated execution behavior.
- Performance conclusions distinguish observations, estimates and untested proposals.

## Output format

Only the selected SQL scripts or assessment in the requested format under `workspace/projects/<project-id>/runs/<run-id>/outputs/`; approved repository changes go under `<target-repo>/`. Keep masked execution evidence and statement receipts in the run's evidence folder. Do not add benchmark reports, diagrams or backup copies unless requested.

## Human approval points

- `plan`: before target-repository changes, database calls, shared-environment diagnostics or data transfer.
- `apply`: confirm the exact target plan if a prior approval covered only preparation or isolated checks.
- Any changed statement, destructive operation, new dependency or recovery action outside that approval requires a new decision. Routine preparation within an existing approval continues.

## Error handling

Unknown version: hold executable SQL and ask. Drift from the planned schema: stop and replan. Timeout or dropped connection: mark outcome unknown and inspect authorized receipts/state before any retry. Failed migration: preserve the applied boundary and report; do not launch rollback automatically. Repeated infrastructure failure: stop after three attempts and persist `blocked`.

## Completion criteria

The requested generation/review/execution is finished at its stated verification level, with exact changes, evidence, remaining uncertainty and resumable state.

## Persistence

Follow [persistence](references/core/persistence-protocol.md). Store sources, engine/version, plan approval, statement identities, applied boundary and validation results under `workspace/projects/<project-id>/runs/<run-id>/`. List only deliverables and retained evidence as artifacts; keep helpers in work. Resume by reconciling the recorded boundary with the target before executing anything again.
