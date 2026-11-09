---
name: interface-prototyping
description: Designs and builds polished, responsive, accessible interface prototypes with working scoped interactions, explicit mocks and browser verification. Use when creating or evolving HTML/CSS/JavaScript interfaces or reviewing a prototype; preserve the project's design system and stack.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: engineering
---

# Interface Prototyping

## Purpose

Make a coherent interface that communicates the product clearly and demonstrates its agreed behavior, with the agent owning composition, formatting and routine design decisions through visual and functional verification.

## Responsibilities

- Design information architecture, navigation, layout, visual hierarchy, reusable components and interaction states.
- Build scoped working prototypes using HTML/CSS/JavaScript and the established framework where applicable.
- Inspect rendered results and exercise the agreed flows, responsive behavior and keyboard interaction.
- Do not invent confirmed business behavior, imply a mock is a real integration or declare production readiness from a prototype.

## When to use

Use for a new interface, an existing UI improvement, an interactive prototype or a prototype review. Follow a supplied design system/reference. A general architecture decision belongs to `solution-design`; API validation belongs to `api-testing`. This procedure does not depend on the pending `automation` skill.

## Inputs

Required: project, user task or interface objective and scope. Establish build/evolve/review mode, primary users, requested artifact/format and implementation destination. Ask for missing product choices that change behavior; resolve routine visual choices autonomously.

Optional: design system, brand/reference screens, existing code, supported devices/browsers, accessibility target, contracts and approved content. Use clearly marked synthetic content where authorized; label proposed product copy and rules rather than inventing them as facts.

## Tools

Read/write project files; use the existing build system and browser/Playwright capability when available. Use Figma only when configured and relevant to the requested source/destination, not as a requirement. Without a browser, provide code with an explicit unverified visual/interaction limit. Do not install a new framework or fetch external assets without the relevant authorization.

## Procedure

1. **Brief** (`brief`). Identify the project with `project-context`, load relevant flows, actors, conventions and design system, and create/resume the run. Establish the requested formats and destination. Refresh linked item sources through configured authorized reads if available; compare changes with the accepted brief and report unknown freshness on failure.
2. **Inspect** (`inspect`). For existing code inspect components, tokens, routes and build/run instructions before proposing changes. Read [interface quality](references/interface-quality.md). Define the primary task and required success, failure and recovery paths; identify which services/data are real or simulated.
3. **Design** (`design`). Propose the flow, composition, component/state inventory and coherent visual direction. Reuse established tokens and patterns. Present the concrete screens/behaviors and file/change plan; stop for approval of new functional decisions and target-repository edits. Do not request approval for every spacing, color or typographic adjustment within that direction.
4. **Build** (`build`). Implement the approved scope. Use semantic HTML, maintainable CSS/JS, reusable tokens/components and deliberate responsive behavior. Model loading, success, error, empty and permission states where relevant. Make the actions needed by the agreed demo work; disclose incomplete actions rather than wiring misleading success messages.
5. **Verify** (`verify`). Run applicable build checks and inspect in the browser at representative widths and with short/long/empty content. Exercise navigation, forms, state transitions and keyboard/focus behavior. Use observable readiness checks rather than fixed sleeps/network silence. Correct design/code defects within scope and repeat the affected check. Separate automated accessibility findings from human/visual checks and untested criteria.
6. **Deliver** (`deliver`). Provide the requested prototype and the precise run/open instructions, verified flows, mock boundaries and remaining gaps. Do not produce a screenshot pack, PDF, design-system document or duplicate format unless requested. If browser verification was unavailable, say so plainly.
7. **Close** (`close`). Record approved direction, changed paths, validation results, current limitations and dependencies. Preserve user edits and remove only this run's disposable work under the persistence protocol.

## Rules and constraints

- Follow [isolation](references/core/isolation-policy.md), [approval](references/core/approval-policy.md), [traceability](references/core/traceability.md) and [execution principles](references/core/execution-principles.md).
- Match the product and audience; novelty, decorative effects and a fashionable stack are not acceptance criteria.
- Treat typography, alignment, spacing, density, feedback and responsive composition as engineering responsibilities.
- Prefer native HTML controls and established accessible components before custom ARIA behavior.
- Preserve source facts, data labels, requirements, citations and permission boundaries. Simulated content is explicit and cannot become a confirmed API contract.
- Never send real forms to a backend, create accounts or publish/deploy as a side effect of previewing. Use local mocks for unapproved integrations.
- Do not call a design accessible solely because an automated score passed, or claim a prototype is browser-tested from a build alone.

## Validation criteria

- Agreed primary flows and relevant error/recovery states work, or limitations are explicit.
- Visual hierarchy, components and tokens are coherent; inspected widths have no unexplained overflow, clipping or unusable controls.
- Labels, keyboard operation, visible focus and relevant announcements/dialog behavior are verified to the stated extent.
- Build/run instructions are accurate; real integration and mock behavior are distinguished.
- Reported checks actually ran; no invented screenshots, accessibility certification or production guarantee.

## Output format

Requested prototype files live under `workspace/projects/<project-id>/runs/<run-id>/outputs/` unless an approved edit targets `<target-repo>/`. Confirm whether the user wants a self-contained HTML file, source project or edits to existing code. Keep internal capture/log/build helpers in the run's work folder; list only requested deliverables as artifacts.

## Human approval points

- `design`: functional choices and target-repository edits before implementation; an explicit build request covering an established design is authorization within that scope.
- New dependencies, external asset/data sharing, publication or real integration effects need their own authorization. Routine design iteration within the approved scope continues.

## Error handling

Missing product behavior: ask the material question; continue independent layout work. Missing browser/build tooling: state the limit and provide exact verification instructions. Conflicting reference and existing design system: show the conflict before changing direction. Same action failing three times: persist `blocked` and report attempts.

## Completion criteria

The scoped prototype/review is delivered in the agreed format with actual validation results, runnable instructions, explicit simulations and unresolved product questions.

## Persistence

Follow [persistence](references/core/persistence-protocol.md). Under `workspace/projects/<project-id>/runs/<run-id>/` retain the brief/source revisions, approved direction, state inventory, paths and checks. Helpers and visual inspection captures stay in work unless requested as evidence/deliverables. On resume compare source revisions and preserve manual edits before continuing.
