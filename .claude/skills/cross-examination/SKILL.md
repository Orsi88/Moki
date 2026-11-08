---
name: cross-examination
description: Adversarial critical review of a finished deliverable - an investigation dossier, a report, a requirements review, a test plan or test cases, a failure pre-analysis, any document that makes claims. Checks that each cited source really says what is attributed to it, hunts for counter-evidence, exposes logical leaps, biases, overconfidence, gaps against the request and contradictions, and returns a ranked critique with a verdict - without rewriting the work. Never invents an objection or a counter-source. Use when the user wants a deliverable challenged before relying on it or sending it.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: research
  phase: "2"
---

# Cross-examination

## Purpose

Act as an **independent, adversarial reviewer**: attack the case to find its weak points before someone else does, so the author can fix them and the user can rely on what remains. The author of a work tends to defend its conclusions; this skill exists to be the other side.

## Responsibilities

- Understand what the deliverable claims, for whom and for what.
- Test the deliverable through the [lenses](references/lenses.md): support, counter-evidence, logic, calibration, bias, completeness, consistency, and the lens of its type.
- Back every objection with evidence or explicit reasoning, and rank it by severity.
- Say what holds up as well as what does not.
- Deliver a critique and a verdict; hand the fixes back to the author.

Does **not**: rewrite or edit the deliverable, decide for the user, invent objections to look thorough, invent counter-sources, attack people instead of the work, or bury the important points under a flood of nitpicks.

## When to use

- A dossier from `deduction` (Sherlock offers it at the end) or any research or analysis report.
- A requirements review, a test scenario map or test cases, a failure pre-analysis, evidence, a proposal, a decision memo — anything that makes claims someone will rely on.
- The user asks to "criticize", "challenge", "play devil's advocate", "find the holes", "review critically".

Do not use for: proofreading or style only (say so and do it briefly), producing the work itself, reviewing source code for bugs.

## Inputs

Required:
- **The deliverable**: a file in the project (often a run's outputs folder) or pasted text.

Optional:
- The original request or source material (story, briefing, plan) — needed to judge completeness; read it when it is in the same run.
- For a dossier: its source log (`sources.md`) — the evidence table makes the support check precise.
- Audience and use ("goes to the client", "basis for the test plan"), depth (*quick*: the summary and the key claims; *full*: every claim — default *full* for short deliverables, *quick* for long ones unless asked), lenses to stress.

Ask only what is missing and needed, in one short message.

## Tools

- File reading for the deliverable, its sources and the original request.
- **Web access** to open cited sources and to search for counter-evidence. Without it: say so, check support only against material available locally (the source log excerpts, attached documents), mark the external checks as *not performed*, and never claim a source was checked.

## Procedure

Step ids are used in `state.json`.

1. **`intake`** — Identify the project, create the run, read the deliverable and, when available, the original request and the source log. Ask only what is missing. State in two lines what the deliverable claims, its type, the audience and the depth.
2. **`claims`** — List the key claims and conclusions (the ones a reader would act on), numbered C1, C2… with their location in the deliverable. In *quick* depth, keep the summary's claims and those with the highest stakes.
3. **`examination`** — Apply the [lenses](references/lenses.md) to the claims and to the whole:
   - **Support**: open the cited source at the locator and compare. Classify: *supports*, *partially supports*, *does not support*, *contradicts*, *not checkable* (inaccessible, no locator).
   - **Counter-evidence**: for the most important conclusions, search for evidence against them (sanitized queries, see rules); at most 2 rounds per conclusion unless the user asked for more.
   - **Logic, calibration, bias, completeness, consistency**, and the lens of the deliverable's type.
   Record each problem as a finding with its evidence. Stop at the round limit or when the claims are covered.
4. **`critique`** — Write the critique with the [critique template](references/critique-template.md): verdict, findings ranked by severity, what holds up, questions to the author. Present a summary (verdict, counts by severity, the 3 most important findings) and stop at the [decision gate](#human-approval-points).
5. **`handoff`** — With the user's choice, hand the selected findings to the author (the agent or skill that produced the deliverable, for example `deduction`) as a list of fixes. Record the decision and close the run. Never apply the fixes yourself.

## Rules and constraints

- **Every objection has grounds**: a source opened (with locator), a quote from the deliverable, or explicit reasoning anyone can follow. "I feel" is not a finding.
- **Never invent** objections, counter-sources or facts. A counter-source follows the same rules as in `deduction`: opened in this run, cited with link, date and locator.
- **Severity** is about the consequence for the reader, not the size of the error: *critical* (a conclusion is wrong or unsupported and the reader would act on it), *major* (a conclusion is weaker than stated, or an important gap), *minor* (a local flaw that does not change conclusions). Notes on style or wording only when they cause misunderstanding.
- **Rank, do not flood.** Critical and major findings first; group repetitive minor issues into one finding.
- **Steelman first.** Before objecting to a conclusion, state its strongest reading; criticize that, not a weaker version.
- **Your own uncertainty is labeled.** A finding can be *confirmed* (the evidence shows it) or *suspected* (worth checking; say what would confirm it). A source you could not open is *not checkable* — a limit of the review, not a flaw of the work.
- **No findings is a valid result.** If the deliverable holds up, say so; never manufacture objections to fill the critique.
- **No project data on the web**: counter-evidence queries use generic terms only, unless `project.json` has `externalDataSharingAllowed: true` and the user authorizes it ([isolation](references/core/isolation-policy.md)).
- **Critique the work, not the author.** Neutral, precise, useful wording.
- Apply [execution principles](references/core/execution-principles.md), [approval](references/core/approval-policy.md) and [traceability](references/core/traceability.md).

## Validation criteria

- Every finding has a severity, a lens, a location in the deliverable, the problem, its grounds and a suggested direction for the fix.
- Every support check names the claim, the source and locator, and one of the five classifications; *not checkable* is never reported as *supports*.
- Every counter-source was opened in this run and is cited with link and date.
- The verdict follows the [verdict rules](references/critique-template.md#verdict-rules): it judges the examined version, decided only by *confirmed* findings; any main conclusion whose support could not be checked makes it *provisional* (listed), and most of them unchecked makes it *Inconclusive*.
- *Not checkable* is never reported as a flaw; a sound deliverable can receive *Solid* with no findings.
- The critique contains a "What holds up" section and does not modify the deliverable.

## Output format

- Critique: `workspace/projects/<project-id>/runs/<run-id>/outputs/critique-<slug>.md` ([critique template](references/critique-template.md)), in the deliverable language.
- The examined deliverable is listed in `inputs` of `state.json`, never copied or changed.

Chat-only tools: present the critique in the conversation and tell the user where to save it.

## Human approval points

At each gate, before the closing question, give the summary the [approval policy](references/core/approval-policy.md) asks for: what was done, what happens next, what it depends on and what remains open.

| Gate | When | Closing question (in the user's language; English and pt-BR shown) |
|---|---|---|
| Decision | End of `critique` | "Critique ready: verdict <verdict>, <n> critical, <n> major, <n> minor. Which findings should go back to the author to fix — all, only critical and major, or a list?" ["Crítica pronta: veredito <veredito>, <n> críticos, <n> maiores, <n> menores. Quais achados devem voltar para o autor corrigir — todos, só críticos e maiores, ou uma lista?"] |
| External data | Before any query that would include project data (only when allowed by `project.json`) | Show the exact query; wait for OK. |

## Error handling

- Deliverable missing or unreadable → ask for it; status `awaiting-input`.
- No citations at all in a deliverable that makes factual claims → that is a finding (support lens); check the most important claims yourself as far as possible.
- No web access → see [Tools](#tools); the verdict says which checks were not performed.
- Source behind a paywall, login or a dead link → *not checkable*, with the reason; do not guess what it says and do not report it as unsupported (a missing link or locator in the deliverable itself is a support finding, an unreachable page is not).
- The deliverable is very long → *quick* depth by default; say what was not examined.
- The same page failing 3 times → *not checkable*, move on.

## Completion criteria

The critique is saved, the summary and decision gate were presented, the user's decision is recorded and the selected findings were handed to the author (or the user chose not to) — `state.json` `completed`.

## Persistence

Follow the [persistence protocol](references/core/persistence-protocol.md). Run in `workspace/projects/<project-id>/runs/<run-id>/` with `state.json` (steps `intake`, `claims`, `examination`, `critique`, `handoff`; the decision in `approvals`), the examined deliverable and the original request in `inputs`, the critique in its outputs folder (listed in `artifacts`) and working notes in its work folder.
