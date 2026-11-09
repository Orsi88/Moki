# Engineering specialists

Four agents connect solution design, data, interfaces and API validation. They are usable **drafts**: framework validation is not a recorded behavioral pilot or certification in two AI tools.

| Agent | Activity | Procedure | Access |
|---|---|---|---|
| [Cartógrafo](../agents/engineering/cartografo.md) (`cartografo`) | Model data with Cartógrafo | [data-modeling](../skills/data-modeling/SKILL.md), [database-engineering](../skills/database-engineering/SKILL.md) | Project files; approved linked-repository edits; database calls require an approved target plan |
| [Inventor](../agents/engineering/inventor.md) (`inventor`) | Design a solution with Inventor | [solution-design](../skills/solution-design/SKILL.md); formal story review when requested | Project files; design approval does not authorize implementation |
| [Artesão](../agents/engineering/artesao.md) (`artesao`) | Prototype an interface with Artesão | [interface-prototyping](../skills/interface-prototyping/SKILL.md) | Project files and approved linked-repository edits |
| [Sentinela](../agents/quality/sentinela.md) (`sentinela`) | Validate an API with Sentinela | [api-assessment](../skills/api-assessment/SKILL.md), existing [api-testing](../skills/api-testing/SKILL.md); formal case design when requested | Project files; HTTP calls keep the existing plan/verdict gates |

Pick the activity in **Call…**, or ask the AI to read the agent's file. Input files are optional: a description can start discovery. Missing information becomes a focused question or pending item. The agent agrees on the requested output format instead of producing every possible document. Accents appear in activity labels; machine identifiers have no accents.

## Cartógrafo: domain meaning through implementation

Use conceptual/logical modeling before physical decisions when the engine is undecided. The model must explain identity, cardinality, optionality, integrity and lifecycle. Requested ERDs, dictionaries and SQL must agree at their respective levels.

For implementation or diagnosis identify engine, product and version, preserve established tooling and distinguish generated SQL, static review, isolated testing and applied changes. Migrations need preconditions, compatibility, lock/data considerations, restart behavior and recovery limits. Uncertain execution is reconciled before retrying.

Example: "Model reservations in one Markdown ERD and dictionary. We have not selected a database yet." A later SQL request is a separate mode, not automatic permission to connect or apply it.

## Inventor: requirements, alternatives and decisions

Begin with the problem, people, outcomes and constraints. Connect requirements to solution responsibilities and verification. Compare viable options on common criteria and show trade-offs and unknowns. Keep observed facts, assumptions, proposed requirements and approved decisions distinct.

Use only diagrams and decision records that help the actual decision. Quality targets need meaningful conditions and measures; unknown thresholds remain pending. A delivery increment has an observable result and dependencies. Formal story review still follows its own procedure when requested.

Example: "Compare ways to add reservations to the existing application; deliver a proposal with architecture and a phased plan. Do not implement."

## Artesão: visual composition and working behavior

The agent owns hierarchy, typography, spacing, responsive composition and routine design iteration. It preserves the established design system and implementation stack, builds scoped interactions and relevant success/error/empty/loading states, and identifies synthetic data and simulated integrations.

Build checks do not replace browser review. Verify the agreed flows, representative widths, content extremes, forms, keyboard and focus when tools allow; state precisely what was not inspected. A prototype is not automatically production-ready or fully accessibility-certified.

Example: "Build one local HTML prototype with filtering, a details modal and a validated form. Synthetic data only, no API or new dependency."

## Sentinela: guarantees and evidence

Review the actual contract/dialect, business expectations, identity/permissions and relevant workflow risks before execution. Distinguish specification gaps, demonstrated mismatches, execution problems and risks awaiting verification.

Sentinela reuses the existing executor; [api-tester](../agents/quality/api-tester.md) remains available for focused execution. Documented negative 401/403 cases are evaluated against their expectations. A JSON parser alone does not validate a schema; required incomplete checks prevent a Passed verdict. Mock success is not verification of the real provider.

Example: "Assess this OpenAPI contract and supplied masked responses. Deliver only findings and coverage; do not call the API."

## Cooperation and source freshness

Each specialist works independently. When a chain is useful, Inventor supplies accepted requirements, Cartógrafo owns data meaning, Artesão owns UI behavior and Sentinela verifies the API guarantees. A documentation specialist may improve presentation, but the technical owner rechecks meaning afterward. No research/documentation agent is a required dependency of this set.

When work references a tracker item, use configured and authorized reads on entry/resume to compare its current content with the previously accepted basis. Record source version/time and material impacts. New comments or changed criteria are not silently adopted as confirmed rules; a failed read does not mean nothing changed. This is an AI procedure, not a background polling service or a new tracker connector.

No MCP ids are hard-coded. To use a project connector inside an operation, duplicate/configure the agent contract with that project's server ids and access modes as described in [agents and operations](agents.md). A live database/API operation and external publication still need the specific plan/authorization.

## References and validation

Each skill has a focused reference with applicable maintainer documentation and external candidate skills. They are research inputs, not downloaded dependencies or copied instruction bundles. Preserve licensing, project isolation, chosen stack, approval gates and sharing configuration before any future incorporation.

Synthetic acceptance scenarios: [modeling](../examples/data-modeling/README.md), [database engineering](../examples/database-engineering/README.md), [solution design](../examples/solution-design/README.md), [interfaces](../examples/interface-prototyping/README.md), [API assessment](../examples/api-assessment/README.md). They cover ambiguity, source changes, partial execution, visual/interaction limits and planted API issues. Execute them with the actual AI tools and record outcomes in [compatibility tests](compatibility-tests.md); their presence alone is not a passing pilot.
