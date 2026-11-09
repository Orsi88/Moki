# QA skills and agents

A **skill** is the instructions for one activity: steps, rules, output and where to stop for your approval. The AI reads them. An **agent** is a role that uses one or more skills.

The activities that ship with Moki:

| Activity | What you get | Status |
|---|---|---|
| [Review user stories](../skills/requirements-review/SKILL.md) | Ambiguities, gaps, one question at a time, a review matrix (Excel) and a final definitions report (PDF). | ready |
| [Design tests](../skills/test-design/SKILL.md) | Scenario map, then — after your OK — manual test cases in Excel. | ready |
| [Failure pre-analysis](../skills/failure-analysis/SKILL.md) | A short note for developers, from your description and the log. | ready |
| [Build test evidence](../skills/qa-orchestrator/references/workflows/test-evidence.md) | The work item and the Jam recordings, then a spreadsheet and a Word document with the prints, in your own models when you have them. | ready |
| [Investigate with Sherlock](../agents/research/sherlock.md) | Sherlock researches any topic in depth (web, standards, papers, books, forums) and, after you approve the plan, delivers a structured dossier with references you can check. | ready |
| [Cross-examine with Moriarty](../agents/research/moriarty.md) | Moriarty attacks a finished deliverable (a dossier, a review, test cases...): checks the sources, looks for counter-evidence and logical flaws, and gives a verdict with ranked findings, without rewriting the work. | ready |
| [Write a document with Watson](../agents/documentation/watson.md) | Watson does any documentation: organizes, writes, designs and checks the deliverable in the format you ask, with the project's template and Mermaid or editable Excalidraw diagrams, faithful to the content. Sherlock calls him for every dossier. | ready |
| [Review an MF from the tracker](../skills/requirements-review/references/tracker.md) | The requirements review reads the MF by its number or URL and, with your approval, publishes each round's questions and the report on it. | ready |
| [Register items with Lestrade](../agents/quality/lestrade.md) | Lestrade registers items of any type in Azure DevOps or Jira — bugs, impediments, tasks, technical debt, improvements: asks the type, uses your template, asks only what is missing, checks duplicates and creates only after you approve the exact preview. | ready |
| [Project context](../skills/project-context/SKILL.md) | Onboarding, updates, and the plan for a blank project. | ready |
| [Automation](../skills/automation/SKILL.md) | Build, implement or evolve an automation project. | not available yet |
| [Documentation](../skills/documentation/SKILL.md), [smoke test](../skills/smoke-test/SKILL.md) | Planned. The AI will say so and stop. | not available yet |

**Ready** means usable, still being checked across AI tools. Ask in plain language ("review this story", "map the tests", "here is the log"). The built-in ones identify the project, record a run, and stop when they need a decision. "ok", "approved" or "go ahead" accepts the step in front of you. They do not invent requirements, messages or results: a gap becomes a pending item.

Chains such as "review this, and once I approve it, map the tests" go through the orchestrator, which shows the plan and waits at each gate. The definitions are in [skills/qa-orchestrator/references/workflows/](../skills/qa-orchestrator/references/workflows/).

Skills you add live with the project (`<linked folder>/.claude/skills/` or `workspace/projects/<id>/skills/`) or for every project (`~/.claude/skills/` and `~/.agents/skills/`). Agents you create follow the same split; a copy of a built-in agent stays in `workspace/library/agents/`. The request names them. Moki does not run a skill by itself. More on agents: [agents.md](agents.md).
