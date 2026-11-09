# Persistence and Resume Protocol

Activities may span several sessions and several AI tools. There is **no shared memory between tools, sessions or models**. Continuity exists only through files the agent reads explicitly.

## What is stored where

| Record | File |
|---|---|
| Confirmed project knowledge | `workspace/projects/<project-id>/context/*.md` |
| Knowledge awaiting confirmation | `workspace/projects/<project-id>/proposed-updates.md` |
| History of activities | `workspace/projects/<project-id>/activity-log.md` |
| Progress, pending items, approvals, artifacts of one execution | `workspace/projects/<project-id>/runs/<run-id>/state.json` |
| Deliverables, evidence, logs of one execution | `workspace/projects/<project-id>/runs/<run-id>/{outputs,evidence,logs}/` |
| Files that only help produce a deliverable (generator data, working data between steps, drafts) | `workspace/projects/<project-id>/runs/<run-id>/work/`, deleted when the run is completed |
| Scratch files outside any run | `workspace/projects/<project-id>/temporary/` (the app empties what is older than a few days) |

Keep these separate: activity results never go into `context/`, and context is never edited from inside a run folder.

## Run folder

Run id format: `YYYYMMDD-HHMM-<skill-or-workflow>-<short-slug>` (lowercase, hyphens), for example `20261020-0930-requirements-review-login-mfa`.

Create a run with `npm run new-run -- --project <project-id> --skill <name> --slug <slug>` (or `--workflow <id>`; add `--activity <id>` when the request names the Moki activity it came from) when a shell is available. Otherwise create the folder and `state.json` manually following `schemas/execution-state.schema.json`. After creating a run, append one line to `activity-log.md`; update that line's outcome when the run ends.

## state.json

Required fields: `schemaVersion`, `id`, `project`, `skill` or `workflow`, `createdAt`, `updatedAt`, `status`, `currentStep`, `completedSteps`, `pending`, `approvals`, `inputs`, `results`, `artifacts`.

- `project` must equal the project folder the run lives in.
- `status`: `in-progress` | `awaiting-approval` | `awaiting-input` | `blocked` | `paused` | `completed` | `cancelled`. `paused` is set by the user (a multi-agent operation started from the desktop app): nothing new starts until it is resumed.
- `inputs`: every input actually used, with path and a short description. Never list a document you did not read.
- `artifacts`: paths of the deliverables — the files the user asked for (and the evidence the skill keeps) — relative to the framework root (starting with `workspace/projects/<project-id>/`) or to a target repository (`<target-repo>/...`). Working files are never listed: they go to the run's `work/` folder and are deleted when the run is completed ([deliverables only](execution-principles.md#deliverables-only)).
- `pending`: open questions and missing information, each with an id.
- `terminal` (optional): the Moki desktop terminal the run was created in; `npm run new-run` records it by itself (from `QA_TERMINAL`). The app opens the run's deliverables next to that terminal. Never write it by hand.
- `activity` (optional): the id of the Moki activity the request came from, when the request names one (the desktop app says it). It is how the app shows each run under its activity; a request that did not come from an activity has none.

Update `state.json` at the end of every step and before every approval gate. Keep it small: store decisions and paths, not full document contents.

## Resuming

When the user asks to resume (for example "resume run 20261020-0930-..." or "continue the review"):

1. Identify the project. Read `workspace/projects/<project-id>/runs/<run-id>/state.json`. If the run id is unknown, list the project's runs (`npm run runs -- <project-id>` or the folder listing) and ask which one.
2. Load the project context the current step needs (see the `project-context` skill), not all of it. If the run relies on tracker items (`sources` in `state.json`), run the freshness check (`dispatch` skill) before continuing: report what changed since the adopted version and its impact, or that the update could not be verified and when it was last checked.
3. Read only the artifacts needed for the current step.
4. Summarize to the user: current step, completed steps, pending items, last approval.
5. Continue from `currentStep`. Do not redo completed steps unless the user asks or their inputs changed (a tracker change the user decided to adopt counts: redo only the affected parts).

## Chat-only environments

Without file access, output the updated `state.json` content in a fenced `json` block at each gate and ask the user to save it. To resume, the user uploads or pastes `state.json` plus the relevant context files.
