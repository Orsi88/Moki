# Document types

Each type answers a different reader need. Pick one; combine sections only when the reader really needs both. For deliverables owned by another skill (review, test cases, evidence, tracker items, dossiers), that skill's structure and fixed labels are a contract: organize and write inside it, never change it.

| Type | Reader and use | Structure |
|---|---|---|
| **Investigation dossier** | Someone who must understand and rely on a researched topic | Follow the `deduction` dossier template exactly (summary, key questions and answers, context, purpose and type sections, divergences, gaps, next steps, bibliography) |
| **Analysis report** | A team that must understand a situation and act | Summary (conclusion + confidence) → Scope and method → Findings (numbered, each with evidence) → Implications → Recommendations → Appendices (data, sources) |
| **Executive summary** | A decision maker with five minutes | One page: the situation in two lines → what we found (3 to 5 bullets) → what we recommend → what we need from you → risks of doing nothing |
| **Technical note** | Engineers who will implement or test | Context → How it works (diagram) → Requirements or rules (numbered) → Edge cases → Open questions → References |
| **Decision memo** | People choosing between options | The decision to make → Options (one line each) → Criteria → Comparison table → Recommendation and conditions → What would change it |
| **Incident or failure report** | Team and stakeholders after a problem | Summary (impact, duration, status) → Timeline (diagram) → Cause (confirmed vs hypothesis) → Impact → Actions (owner, date) → Lessons |
| **Briefing** | Someone who needs to get up to speed | What it is → Why it matters now → Key facts (table) → Who is involved → What happens next |
| **Requirements review** | The team that answers the questions; then everyone who builds and tests | The `requirements-review` contract: the matrix layout (sheets, columns, statuses) and the final definitions report structure are fixed; organize within them (clear questions with their REV ids, definitions stated as rules, pending points visible) |
| **Test scenarios and cases** | Testers who execute; reviewers who check coverage | The `test-design` contract: the scenario map and the official template (Source, Context, Scenario, Steps, Expected Result) are fixed; steps executable one action each, expected results observable and traced |
| **Test evidence** | Auditors, the team, the client | The `evidence-*` models (the user's xlsx/docx or the project standard) are fixed; one block per test case, prints next to their step, results as confirmed by the QA |
| **Tracker item** | The team that will act on it | The item type's template (`templates/items/`) is fixed; a title that states the subject, the fields in the template's order, evidence and links |
| **Other** | Whoever the user names | Ask the purpose and the reader when unclear; choose the closest type above and adapt |

## Choosing

- The reader decides → executive summary or decision memo.
- The reader must understand and trust → dossier or analysis report.
- The reader implements or tests → technical note.
- Something went wrong → incident report.
- Several readers → one document with an executive summary on top and the detail below, not several documents.
