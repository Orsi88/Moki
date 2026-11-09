# Decision method

## Discovery proportional to the request

Find the problem, affected people, desired result, current workflow, constraints and evidence already available. Ask one focused question at a time when an interview is necessary. Do not repeat answered questions or invent personas, deadlines, KPIs or stakeholder approvals. A small integration change may need one flow and a decision table; a new system may need broader discovery.

## Traceability

Keep the chain readable: need/source → requirement → acceptance criterion → solution responsibility/decision → verification. Use existing project IDs; introduce local document IDs only when useful and label them as such. An unconfirmed source change does not overwrite the accepted requirement.

For quality goals specify the situation and stimulus, expected response and measure. A latency goal also needs the operation, data/workload and measurement conditions. A number used as an example is never a project commitment.

## Compare alternatives

Choose criteria from project priorities: fit, complexity, delivery effort, integration, maintainability, operational burden, security, cost or reversibility as relevant. Compare the same scope. Explain where evidence is missing. Prefer qualitative judgments with reasons over a weighted score with invented weights.

Consider modifying the existing solution, building a new component or adopting an existing capability only when these are viable choices. Do not manufacture alternatives to justify a decision already made.

## Architecture views

- Context: people, system boundary and external systems.
- Containers: separately running applications/stores and their responsibilities; a C4 container is not necessarily a Docker container.
- Components: internal detail when it helps the implementation decision.
- Runtime/sequence: critical success and failure interactions, retries, authorization and state changes.
- Deployment: runtime placement, operational dependencies and trust boundaries when relevant.

Use consistent labels and meaningful arrows. Do not mix current and proposed structure without a legend. Check that diagrams, text and contracts agree. For an existing repository, cite the files inspected and distinguish documented intent from observed implementation.

## Decisions and delivery

An important ADR records context, options, chosen direction, reasons, positive/negative consequences, status and source/approval. Use ADRs for structural, quality-sensitive or hard-to-reverse choices. Preserve prior decisions and supersede explicitly rather than silently rewriting their history.

Each delivery increment needs an observable result, dependencies and acceptance. Unknown feasibility can become a bounded spike with a question and exit criterion. Do not promise dates or cost from an unmeasured task count.

## Sources and reusable candidates

These references inform this method; their templates and defaults are not mandatory Moki contracts:

- [C4 diagrams](https://c4model.com/diagrams): choose only useful levels.
- [arc42 quality scenarios](https://docs.arc42.org/section-10/): measurable situations and responses.
- [Microsoft ADR guidance](https://learn.microsoft.com/en-us/azure/well-architected/architect-role/architecture-decision-record).
- [PRD skill](https://github.com/github/awesome-copilot/tree/main/skills/prd): discovery and requirements; adapt fixed structure and example metrics to the project.
- [Architecture Blueprint Generator](https://github.com/github/awesome-copilot/tree/main/skills/architecture-blueprint-generator): existing-code architecture investigation; inferred rationale stays labeled.
- [ADR skill](https://github.com/github/awesome-copilot/tree/main/skills/create-architectural-decision-record): adapt its fixed directory and conventions to Moki's project isolation.

The GitHub collection contains community contributions. Read candidate instructions and license before incorporation; do not install a bundle or adopt its stack, paths or data-sharing behavior automatically.
