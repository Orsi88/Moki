---
name: solution-design
description: Turns a problem or feature idea into a scoped solution with traceable requirements, justified alternatives, architecture decisions and a verification-oriented delivery plan. Use when discovering, designing or evaluating a solution; formal user-story review remains requirements-review.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: engineering
---

# Solution Design

## Purpose

Produce a solution the user can assess and a team can implement: grounded in a real problem, explicit about trade-offs, and traceable from need to verification.

## Responsibilities

- Discover an idea, design a new solution, evolve an existing system or evaluate a proposed design.
- Connect actors, flows, requirements, quality attributes, architecture and implementation dependencies.
- Compare meaningful alternatives and record important decisions with their approval status.
- Do not invent approved requirements, estimates or historical rationale; do not implement, publish tracker items or force a technology stack.

## When to use

Use for solution discovery, architecture design, feasibility, technical proposals and phased delivery plans. Use `requirements-review` for its formal story-review/interview/matrix process; `data-modeling` for detailed data structures; `interface-prototyping` for an executable UI. Do not run these procedures automatically for every idea.

## Inputs

Required: project and the problem, desired outcome or solution to assess. Determine mode, audience, decision to support and requested deliverables/format. Ask progressively for material missing constraints; use existing confirmed context first.

Optional: current architecture/code, business goals, users, requirements, budget/deadline, integrations, volumes, operational constraints and approved decisions. Unknown metrics, cost and capacity remain unknown or explicitly proposed.

## Tools

Read project sources and authorized linked-repository files. Use configured read-only connectors for named sources. Render requested diagrams with available local tools. Without code access, distinguish documented architecture from verified implementation; without rendering, report that the visual was not inspected. No deployment, provisioning or implementation tool is needed for design.

## Procedure

1. **Frame** (`frame`). Identify the project via `project-context`, load relevant context and create/resume the run. Establish the problem, beneficiaries, current behavior, outcome, mode and format. Refresh a linked work item through configured authorized reads when available; record the source version/time and changes against the accepted basis. A refresh failure does not mean no changes.
2. **Discover** (`discover`). Read [decision method](references/decision-method.md). Inventory confirmed facts, constraints, assumptions and unanswered questions. Inspect the existing system when relevant. Ask only questions whose answers change the scope or decision; do not require a full interview for a bounded problem.
3. **Specify** (`specify`). Define the proposed scope, actors, main/alternative/failure flows, rules and functional requirements. Make relevant quality goals measurable through context, stimulus, response and acceptance measure. Preserve unknown thresholds as proposals/pending; get confirmation before using inferred behavior as approved input.
4. **Compare** (`compare`). Consider genuinely viable alternatives, including an incremental/current-system option when appropriate. Compare them against the same agreed criteria; state evidence, uncertainty, consequences and the reason for the recommendation. Avoid fabricated scoring precision and preselected architectural patterns.
5. **Design** (`design`). Describe responsibilities, boundaries, data ownership, contracts, critical runtime interactions and relevant deployment/operational concerns. Choose useful diagrams for the audience. Trace requirements to components and verification. Record consequential decisions as proposed ADRs unless already approved; infer no historical intent from structure alone.
6. **Review** (`review`). Present the concrete recommendation, alternatives, unresolved decisions and risks. Stop for approval of functional decisions and the solution basis before downstream implementation. Adjust only the affected part when the user changes a constraint.
7. **Plan** (`plan`). After the design decision, outline deliverable increments, dependencies, enabling investigations and verification/acceptance for each. Any spike has a question and exit criterion. Mark estimates with their basis and uncertainty. Hand off only the inputs another specialist needs; do not start implementation under a design approval.
8. **Close** (`close`). Deliver the agreed format, decision statuses, traceability and verification limits. Record the accepted basis and offer reusable confirmed definitions to `project-context` as proposals.

## Rules and constraints

- Follow [isolation](references/core/isolation-policy.md), [approval](references/core/approval-policy.md), [traceability](references/core/traceability.md) and [execution principles](references/core/execution-principles.md).
- Separate observed fact, documented rule, assumption, proposal and approved decision in every representation.
- Prefer the simplest solution meeting the confirmed needs. Explain additional services, queues, stores or frameworks through an actual requirement and consequence.
- Match depth to the request; do not require a PRD, all C4 levels or an ADR for every minor decision.
- Include reliability, security, operability, accessibility, performance and cost only to the depth material to this solution; explain exclusions that limit the recommendation.
- Keep the original meaning and source of requirements when summarizing. Missing evidence is a pending item, not proof of feasibility.
- A documentation specialist may improve composition and diagrams, but the solution owner checks technical fidelity afterward.

## Validation criteria

- Every material need maps to a requirement, solution responsibility and verification approach, or a visible gap.
- Alternatives use the same criteria and the recommendation explains its disadvantages and uncertainty.
- Architecture views agree on names, boundaries, ownership and communication; exceptional paths are considered where relevant.
- Decisions show proposed/accepted/rejected/superseded status with their source or approval; no invented commitments.
- The plan respects dependencies and contains verifiable increments rather than an unexplained task list.

## Output format

Use the agreed format and template under `workspace/projects/<project-id>/runs/<run-id>/outputs/`; conversation-only advice needs no document. A requested proposal can contain problem, sources, requirements, alternatives, architecture, decisions, traceability, risks and plan in one document. Include only requested diagrams/ADRs/files; no automatic PDF or image duplicates.

## Human approval points

- Before treating inferred functional behavior or quality targets as confirmed.
- `review`: accept or adjust the concrete solution basis before implementation planning/handoff. Existing approvals within scope are preserved.
- Repository edits, provisioning, publication and execution require separate concrete authorization; this skill does not perform them.

## Error handling

Conflicting goals: expose the trade-off and seek the missing priority. Missing technical evidence: propose a scoped investigation, not a confident conclusion. Changed sources: identify affected requirements and decisions and return to review for material changes. Missing capabilities: deliver only the supported analysis with limits. Same operation failing three times: persist `blocked` and report.

## Completion criteria

The requested discovery, proposal or assessment is delivered with an explicit decision status, traceability, remaining questions and the next verifiable action.

## Persistence

Follow [persistence](references/core/persistence-protocol.md). Under `workspace/projects/<project-id>/runs/<run-id>/` retain source revisions, requirements/decision identifiers, assumptions, approvals and handoff paths. Keep drafts and investigation helpers in work, selected deliverables only in artifacts. Resume from the recorded step; reassess changed inputs before reusing decisions.
