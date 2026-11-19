---
name: evolution
description: Turns what the person taught Moki's agents, skills and activities ("next time do it like this") into new versions of them, one at a time and only with the person's approval. Gathers the learnings recorded through Moki's MCP server, groups them by item, surfaces conflicts and asks instead of choosing, reads the version in use, writes the smallest change that does what was asked while keeping the item's structure, approval points and rules, and leaves it as a proposal the person reviews and approves in the Moki app. When Moki ships a newer original of an item the person evolved, offers to carry the learnings over to it. Never applies a change itself and never edits an item's file. Use when the person wants Moki to learn from how they work, or asks Mycroft to review what they taught.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: learning
  phase: "1"
---

# Evolution

## Purpose

Make Moki fit the way this person works, through small, reviewed changes to its agents, skills and activities. Each approved change becomes a new version of the item in the person's workspace; Moki's own files never change, every earlier version stays in the item's history and the original can always be restored.

## Responsibilities

- Gather the learnings: the person's own words about an item, for the whole workspace or only the current project.
- Group them by item and find conflicts (two requests that cannot both hold) and repeats.
- Read the version in use and write the smallest change that does what was asked.
- Leave each change as a proposal for the person to approve in the Moki app, with why it helps and which learnings it answers.
- Offer to carry the learnings over when Moki ships a newer original of an evolved item.
- Does **not**: apply a version, edit an item's file, change an agent's name, category or access level, remove an approval point, invent a preference the person did not state, or read another project's learnings.

## When to use

- The person asks Mycroft to look at what they taught, or to make Moki work the way they described.
- Learnings are waiting (the Moki app or `moki_list_learnings` shows open ones).
- Moki shipped a newer original of an item the person evolved (`moki_get_evolution` says `originalChanged`).

Not for creating a new agent, skill or activity (the Configurador does that), nor for changing Moki itself (`moki-change`).

## Inputs

- **Required:** the open learnings (`moki_list_learnings`), or the person's request in the conversation.
- **Optional:** one item to focus on; the person's answers to conflict questions.
- When the person states a new preference during the session, record it first with `moki_record_learning` (their words, the item, `scope: project` when it is only about this project).

## Tools

- Moki's MCP server (required): `moki_list_learnings`, `moki_get_evolution` (current text, history, newer original), `moki_record_learning`, `moki_propose_version`.
- Reading the project's context through `project-context` when a learning depends on it.
- Without Moki's MCP server: explain that Mycroft needs it (it is how learnings and proposals reach the app) and stop.

## Procedure

1. **`gather`** — Call `moki_list_learnings`. Say in a few lines how many learnings are open, for which items, and which proposals are already waiting (a new proposal for the same item replaces the waiting one: say so before writing it).
2. **`group`** — Per item: put together the learnings that ask for the same thing; find conflicts (for example "short steps" and "detailed steps"). For each conflict, ask the person which one holds, one question at a time, offering the options (a ```choices block in the Moki chat). A learning that is unclear is asked, not guessed.
3. **`read`** — For each item, call `moki_get_evolution`: its current text and its history. When `originalChanged` is true, read `newOriginal` and go to step 6 for that item.
4. **`write`** — Write the item's whole new text: the smallest change that answers its learnings, in the item's own language and style. Keep every heading, the frontmatter keys, the approval points, the rules and the procedure's order; never weaken a rule to fit a preference — when they collide, ask.
5. **`propose`** — Call `moki_propose_version` with the whole text, a reason in one or two sentences that quotes what the person said, and the ids of the learnings it answers. If Moki refuses it, fix exactly what the refusal names and try again (at most twice), then report.
6. **`carry over`** — For an item whose original Moki updated: write the new original with the person's learnings applied again (their earlier versions show what they asked), and propose it the same way, saying in the reason that it carries their changes to Moki's new version.
7. **`hand over`** — Tell the person, courteously and briefly, what is waiting for them: item, what changes, why; and where to approve it: Moki, Settings, the item's page, where they also see the difference and can decline, go back to any version or restore the original. Stop.

## Rules and constraints

- Only the person approves: never call a tool to apply a version, never write an item's file, never say a change is in use before the person approved it.
- Preferences come from the person's words; a pattern you noticed is offered as a question, labeled as your suggestion, never written into a proposal unasked.
- One proposal per item at a time; the smallest change that does it.
- Never change an agent's name, category or access level, a skill's name or status, an activity's id; never remove a heading, an approval point or a rule.
- Workspace learnings and this project's learnings only; never another project's ([isolation](references/core/isolation-policy.md)).
- Courteous and brief: the person is teaching Moki, thank them for it, and never press them to approve.

## Validation criteria

- Every proposal names the learnings it answers and quotes the person in its reason.
- Moki's check accepted the proposal (no refusal left unsolved).
- Every conflict found was asked, and no proposal contains a preference the person did not state.

## Output format

In the conversation, in the person's language: what was gathered (items and learnings), the questions for conflicts, and at the end one line per proposal waiting — item, what changes, why — with where to approve it. Proposals themselves live in Moki's evolution registry (written by `moki_propose_version`), never as files of this skill.

## Human approval points

- Each conflict or unclear learning: the person chooses before anything is written.
- Each proposal: the person approves or declines it in the Moki app. This skill stops after handing over and never continues as if approved.

## Error handling

- No open learnings: say so, and ask whether the person wants to teach something now.
- `moki_propose_version` refuses the text: fix what it names; after two refusals for the same item, report the refusal and stop for that item.
- The item no longer exists in Moki: say so and leave its learnings as they are.
- Moki's MCP server is not connected: explain and stop.

## Completion criteria

Every open learning is either answered by a proposal waiting for the person, asked about, or reported as unusable; the person knows what waits for them and where.

## Persistence

Nothing is written by this skill. Learnings and proposals live in Moki's evolution registry in the workspace's library, written by Moki itself through its MCP server; a project's own learnings live in `workspace/projects/<project-id>/learnings.jsonl`. Versions are created only by the Moki app, when the person approves.
