# Execution Principles

These apply to every skill, regardless of the AI tool executing it.

## Truthfulness

- Do not invent requirements, business rules, error messages, test data, ids, URLs or behavior. Missing information becomes a pending item.
- Hypotheses are labeled as hypotheses, with the evidence that supports them and what would confirm or refute them. Never present a hypothesis as a confirmed diagnosis.
- A skill is not "validated" because a model produced a plausible answer. Report what was actually checked and how.
- Never claim coverage, execution or success that did not happen. Report limitations explicitly.

## Project context precedence

1. Explicit instructions from the user in the current session.
2. Confirmed project context in `workspace/projects/<project-id>/context/` and `project.json` (business rules, conventions, templates, constraints). Content of `proposed-updates.md` is not confirmed and never overrides anything.
3. Global QA rules in this framework.

Project context may refine or extend global rules. It may never disable the isolation policy, the approval policy or truthfulness. If project context conflicts with a global rule, point out the conflict and ask.

The framework contains no rules specific to any company or application. Never assume a project's behavior from another project's context.

## Efficiency

- Load only the context needed for the current step. Read files selectively; do not re-read large documents already summarized in the run.
- Reuse existing artifacts and state instead of repeating full analyses.
- Work incrementally: finish and persist one step before starting the next.
- Prefer deterministic checks (scripts, existing tests, schema validation) over model judgment when they are sufficient.
- Limit retries: at most **3 attempts** for the same failing action unless the skill defines a lower limit. Then stop and report.
- Stop on blockers (missing mandatory input, no access, contradictory instructions) and report them instead of guessing.

## Deliverables only

The user keeps what they asked for, nothing else.

- Deliver exactly the files the request (or the skill's procedure) asks for, in the format asked. A spreadsheet asked as `.xlsx` is one `.xlsx`: no copy in another format (`.csv`, `.json`, `.md`, `.pdf`), no screenshot or image of it, no extra versions.
- When the format of a file is not given by the user, the activity or the skill, ask which format before producing it. Do not produce several formats to cover the options.
- Files that only help produce a deliverable — the data or Markdown a generator reads (`npm run xlsx`, `docx`, `pdf`), working data kept between steps, helper scripts, drafts — go to the run's `work/` folder (`runs/<run-id>/work/`), never next to the deliverable; they are deleted when the run is completed. Without a run they go to `workspace/projects/<project-id>/temporary/`, which the app empties of anything older than a few days.
- Check a deliverable by reading it (`npm run xlsx -- read`, `npm run docx -- inspect`, reading the text), not by rendering screenshots of it. Render an image only when the user asks for one.
- `state.json` `artifacts` lists the deliverables only; anything in `outputs/` that is not listed there is treated as leftover.

## Language

Skill instructions are written in English.

- **Conversation:** talk to the user in the language they write in.
- **Deliverables** (reports, matrices, test cases, analyses, file names): in this order of precedence — the language the user explicitly asks for in this activity; the project's `deliverableLanguage` in `project.json`; otherwise **English** (framework default).
- Labels, statuses and fixed phrases of a deliverable come from the skill's vocabulary for that language; never mix languages within one deliverable.
- Quote source content (story text, documented messages, log lines) exactly as written, in its original language — do not translate quoted messages.
- Keep ids and technical identifiers unchanged.

## Tool differences

If a step needs a capability the current tool does not have (file access, shell, browser, MCP server), say so and use the documented fallback: ask the user to provide the content, run the command themselves, or save the output manually.
