# Context files

Structure created from `templates/project-context/` (by `npm run new-project` or manually):

| Path | Contents |
|---|---|
| `project.json` | Identity, `onboardingStatus`, repositories, environments, tools, constraints, `externalDataSharingAllowed` |
| `context/index.md` | Catalog of context files and last confirmed update — always read first |
| `context/overview.md` | Purpose, users, scope, out of scope |
| `context/glossary.md` | Domain terms |
| `context/modules.md` | Modules, screens, main features |
| `context/actors-and-permissions.md` | Profiles, roles, permission/assignment model |
| `context/business-rules.md` | Confirmed rules with ids, interactions and sources |
| `context/flows.md` | Flows, states, transitions |
| `context/system-characteristics.md` | Cross-cutting traits and project-specific review checks |
| `context/integrations.md` | External systems and their contracts |
| `context/environments-and-tools.md` | Environments, repositories, log locations, test tools — no credentials |
| `context/conventions.md` | Deliverable language, id formats, documentation standards, templates, automation architecture |
| `proposed-updates.md` | Unconfirmed knowledge (`PU-###`) |
| `activity-log.md` | One line per run |
| `inbox/`, `runs/`, `temporary/` | Inputs, run folders, scratch (never versioned, even in a private context repository) |

## Retrieval map

Load only what the activity needs. Within a file, load only the sections for the modules involved.

| Activity | Load | Load if relevant |
|---|---|---|
| requirements-review | glossary, system-characteristics, business-rules (affected modules), actors-and-permissions, conventions | modules, flows, integrations |
| test-design | glossary, business-rules (affected modules), flows, conventions, system-characteristics | actors-and-permissions, integrations |
| failure-analysis | environments-and-tools (logs section), modules (affected module), integrations | flows |
| api-testing | environments-and-tools (environments, credentials source), integrations (APIs), conventions | business-rules, modules |
| api-assessment | integrations (contracts), business-rules, actors-and-permissions, conventions | flows, environments-and-tools, modules |
| data-modeling | glossary, business-rules, flows, conventions | actors-and-permissions, integrations, environments-and-tools (engine/version) |
| database-engineering | environments-and-tools (engine/version, target, credential source), conventions, integrations | business-rules, flows, actors-and-permissions |
| solution-design | overview, modules, business-rules, conventions | actors-and-permissions, flows, integrations, system-characteristics, environments-and-tools |
| interface-prototyping | overview, modules, actors-and-permissions, flows, conventions (design system) | integrations (contracts), business-rules, system-characteristics, environments-and-tools |
| deduction | overview, glossary (only what scopes the topic) | system-characteristics, integrations |
| cross-examination | — (the deliverable and its inputs) | the context files the deliverable relies on |
| chronicle, blueprint, document-design, document-quality | conventions (deliverable language, deliverable templates and models), `project.json` (template) | glossary |
| dispatch | environments-and-tools (tracker map, MCP servers), conventions (item templates) | glossary (names of item types) |
| item-report | environments-and-tools (tracker map, environments), conventions (item templates, severity and priority criteria) | modules, glossary |
| evidence-collection | environments-and-tools (trackers, MCP servers, whether the tracker MCP can write), conventions (id formats, deliverable templates) | modules |
| evidence-sheet, evidence-document | conventions (deliverable language, deliverable templates) | — |
| documentation (planned) | conventions, business-rules, flows | modules |
| automation (pending migration) | `project.json` (repositories, knowledgeSources), conventions (automation architecture), environments-and-tools | modules, flows, business-rules, actors-and-permissions, integrations |
| smoke-test (planned) | environments-and-tools, flows, modules | conventions |
