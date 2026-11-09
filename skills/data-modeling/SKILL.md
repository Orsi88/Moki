---
name: data-modeling
description: Designs and reviews conceptual, logical and physical data models from confirmed domain rules, keeping relationships, dictionaries and SQL consistent. Use when modeling entities, drawing an ERD or reviewing a database structure; database execution belongs to database-engineering.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: engineering
---

# Data Modeling

## Purpose

Turn domain knowledge into an explainable data model whose relationships and constraints represent confirmed rules, with uncertainties visible before implementation.

## Responsibilities

- Design new models, reconstruct an existing structure or propose an evolution; distinguish these modes.
- Define entities, identity, attributes, cardinality, optionality, integrity and lifecycle.
- Reconcile the requested diagrams, dictionary and physical specification.
- Do not apply SQL, infer business rules from sample data or choose a database vendor without context. Use `database-engineering` for executable changes.

## When to use

Use for entity-relationship diagrams, conceptual/logical/physical models, data dictionaries and structural reviews. A request about one query or an existing migration belongs to `database-engineering`.

## Inputs

Required: project identity, the domain or existing schema to model, and the user's objective. Identify the model level and requested deliverables/format; ask only for missing decisions that affect the work. A physical model also needs the database engine and version.

Optional: confirmed requirements, representative queries, existing DDL/ORM definitions, naming conventions, volume, tenancy, retention and access rules. Record unknowns rather than supplying defaults as requirements.

## Tools

Read/write project files. For existing structures use supplied DDL or an authorized read-only database connector. Use a diagram renderer/parser when available; never send project data to a public diagram editor. Without database access, work from supplied sources and state their age. Without rendering, label the diagram visually unverified.

## Procedure

1. **Scope** (`scope`). Identify the project through `project-context`; load only relevant domain, rules, permissions, flows and conventions. Create/resume the run. Agree on mode, model level and requested formats. Record source versions and the last successful tracker refresh when a linked item can be read through the project's configured, authorized connector. Compare changes with the previously accepted basis; do not adopt them silently. A failed refresh leaves freshness unknown.
2. **Discover** (`discover`). Read [model review](references/model-review.md). Build a glossary and map source-backed entities, identities, relationships and lifecycle rules. Inspect schema constraints separately from sampled contents. Ask focused questions about ambiguity; proposed rules remain pending.
3. **Model** (`model`). Choose the minimum useful model level. Define cardinality and optionality at both ends, keys and candidate uniqueness, types where applicable, deletion/history semantics and ownership. Explain deliberate normalization or denormalization. Separate existing facts from proposed changes.
4. **Review** (`review`). Exercise the model with representative allowed and forbidden situations. Reconcile relationships, keys, nullability and identifiers across every requested representation. Show the draft and unresolved decisions; stop for approval before treating proposed domain rules or the model as the implementation basis.
5. **Deliver** (`deliver`). Incorporate the user's decision, validate syntax and rendering with available tools, and deliver only the requested files. State what was source-checked, rendered or not verified. Offer `database-engineering` for implementation; its execution approval is separate.
6. **Close** (`close`). Record delivered paths, model decisions, source versions and open items. Offer confirmed reusable definitions to `project-context` as proposals; do not edit confirmed context automatically.

## Rules and constraints

- Follow [isolation](references/core/isolation-policy.md), [approval](references/core/approval-policy.md), [traceability](references/core/traceability.md) and [execution principles](references/core/execution-principles.md).
- Never invent cardinalities, uniqueness, retention, tenancy or deletion rules. A surrogate key does not establish business uniqueness.
- Do not expose real rows or sensitive identifiers in examples. Use explicitly synthetic values.
- A diagram shows the chosen level: distinguish a business entity from a table, a conceptual attribute from a physical column and a proposed relationship from an enforced FK.
- Drawings must carry readable names, relationship meaning and a consistent legend; split a dense model by domain while preserving cross-domain references.
- Use Mermaid in Markdown when that is the requested format; use editable Excalidraw only when requested and supported. Preserve manual edits. The technical owner verifies meaning after presentation changes.

## Validation criteria

- Every material relationship and constraint has a source or is labeled proposed/pending.
- Cardinality, requiredness, keys and types agree across requested diagrams, dictionary and physical specification.
- Allowed/forbidden situations reveal no unexplained contradiction; observations from sample data are not promoted to rules.
- The delivery names the source basis, unresolved decisions and actual validation limits.

## Output format

Confirm the requested format; produce only that selection under `workspace/projects/<project-id>/runs/<run-id>/outputs/`. A Markdown model can include purpose, source basis, ERD, dictionary, decisions and pending items in one document. A requested SQL specification is not an execution receipt. No automatic PDF/image copies or standalone dictionary unless requested.

## Human approval points

- `review`: confirm proposed domain rules and the model before making it an implementation basis.
- Changes to a linked repository, database or official document require their own concrete plan and approval; this skill does not execute them.

## Error handling

Conflicting sources: show the conflict and ask the responsible person; do not choose silently. Missing engine/version: continue conceptual/logical work, hold physical SQL. Missing renderer: deliver source only with the verification limit. Same operation failing three times: persist `blocked` and report attempts.

## Completion criteria

The requested model is delivered with its approval status, consistency checks and limitations; pending decisions remain visible and the run is persisted.

## Persistence

Follow [persistence](references/core/persistence-protocol.md). Store state, source paths/versions, selected model level, approvals and results under `workspace/projects/<project-id>/runs/<run-id>/`. Keep intermediate representations in its work folder; only requested deliverables enter artifacts. Resume from the recorded step and reassess source changes before reusing an approval.
