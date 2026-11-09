---
name: deduction
description: Deep investigation of any topic - laws and regulation (including how a law was at a past date and the context it was made in), history, markets, tools and products, technology and security, science, business domains, organizations - by searching the web, standards, scientific and educational articles, books, vendor documentation and forums, following citations to primary sources and cross-checking every key claim. Agrees the research plan with the user first, then delivers a well-structured dossier shaped by the purpose of the research (understand, map risks and tests, decide, support a position) with every statement traceable to a source actually opened. Never invents a reference and never sends project data to the web. Use when the user wants a topic researched in depth, with grounded references.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: research
  phase: "2"
---

# Deduction

## Purpose

Act as an **expert investigator**: find, dig and go deep until the relevant sources are exhausted, and hand the user a dossier they can rely on — well-grounded references and well-structured information — to understand a topic and act on it.

## Responsibilities

- Understand what the user wants to know and **why** (the purpose shapes the dossier), which [type of investigation](references/investigation-types.md) it is, and the **time and context frame**: when, where, and the context to reconstruct.
- Agree a research plan (questions, source types, search terms) before searching, using each type's playbook.
- Answer a question about the past with what was true then, and reconstruct the context (actors, motives, circumstances, consequences).
- Search broadly and deeply: primary sources first, citations followed back to their origin, more than one language when the topic is studied in another one.
- Evaluate every source (who, when, evidence, interests) and cross-check key claims.
- Separate facts, consensus, divergences, hypotheses and gaps.
- Deliver a structured dossier with a bibliography in which every entry was actually opened.
- Offer the next step (for example test design from a risk catalog).

Does **not**: invent or "remember" references, present a hypothesis as a fact, send project or customer data to the web, give legal, medical or financial advice as a conclusion (it reports what the sources say), or produce exploit code against systems the user does not own.

## When to use

- "Investigate / research / dig into / find references about …", on any subject.
- Before designing tests or mapping risks of an unfamiliar technology or integration (for example SSO between services: vulnerabilities, risks, care points, scores).
- "How was law X at that time, and in what context was it made?" — the text in force then, its legislative history and its context.
- Market research, choosing tools or providers, understanding a business domain or an organization.
- To compare options, understand a regulation or standard, trace the history of a problem, or support a position with sources.

Do not use for: a pre-analysis of a failure from a log (`failure-analysis`), reviewing user stories (`requirements-review`), writing test cases (`test-design`).

## Inputs

Required:
- **Topic**: what to investigate.
- **Purpose**: what the research is for — *understand*, *map risks and tests*, *decide*, *support a position*, or another stated use.

Optional:
- **Reference date or period** and **place** (country, jurisdiction, market) when the topic depends on them — ask if missing and relevant (a law, a market, a price).
- Specific questions the user already has; known context (versions, protocols, vendors, sector, country); sources to include or avoid; depth limits (period, languages); material the user attaches (read it first and treat it as a source).
- Project context that helps scope the research (load through `project-context` only what the topic needs).

Ask only for what is missing and needed to plan well, one short message, at most three questions. If the purpose is not stated, ask it — it is mandatory.

## Tools

- **Web search and page reading** (required for a full investigation). Use the AI tool's search and fetch capabilities. Open each source before citing it.
- Optional: academic search pages (Google Scholar, Semantic Scholar, arXiv, PubMed, SciELO), standards bodies' sites, book previews and publisher pages, an MCP server configured for the project.
- File reading for the user's attachments; `npm run xlsx -- write` for an optional spreadsheet.
- The `watson` agent (or the `chronicle`, `blueprint`, `document-design` and `document-quality` skills) to write the dossier from the case notes.

**Fallback without web access:** say so in one line, deliver the approved plan with the exact search strings and the list of sources to consult, and offer to build the dossier from material the user brings. Never fill the gap from model memory: anything not verified in this run is marked *not verified* and never appears as a reference.

## Procedure

Step ids are used in `state.json`.

1. **`briefing`** — Identify the project and create the run (a new or empty project needs no onboarding for this skill; facts the user states are offered to `project-context` at `handoff`). **Check that web search and page reading are available**; if not, say so now and follow the [fallback](#tools). Read the request and any attachment. Ask only the missing information ([Inputs](#inputs)). Identify the [investigation types](references/investigation-types.md) involved and the time and context frame. Assumptions you make instead of asking are written in the plan for the user to confirm at the gate. The restatement of topic, purpose, types and frame (two or three lines) opens the plan gate message; there is no separate gate for the briefing.
2. **`plan`** — Write the investigation plan with the [plan template](references/plan-template.md): types and the time and context frame, key questions (including each type's "always cover" items that apply), scope and out of scope, **candidate** sources by tier (named from what is known before searching; each is verified, corrected or dropped during research and only opened sources reach the dossier), search strings (sanitized, see [rules](#rules-and-constraints)), languages, the dossier sections chosen for the purpose, and the stop criterion (question coverage plus a round limit; default: 3 search rounds per key question). Save it, set `awaiting-approval` and **stop** with the [plan gate](#human-approval-points).
3. **`research`** — Follow [research method](references/research-method.md):
   - start from primary and reference sources ([source tiers](references/source-tiers.md)), then practice, then signals;
   - follow citations backwards to the origin and forwards to newer work that confirms, refines or contradicts it;
   - read laterally: check who publishes a source and whether others corroborate it;
   - record every source opened in the source log (used or discarded, and why) and, for each key finding, the exact place that supports it (section, page or paragraph, and a short excerpt);
   - assign confidence by the [confidence rules](#rules-and-constraints): the kind of claim, the quality of the evidence, contradictions and whether it applies to the user's context;
   - work in search rounds and log each one; stop when **every key question is answered or declared a gap** and either no new relevant information appeared in the last round (saturation) or the plan's round limit was reached — say which, and list what remains open.
   If the research shows the plan was wrong (the topic is different, a key question is missing), stop and propose the change before continuing.
4. **`dossier`** — The investigator owns the content; the documentation specialist writes the document.
   - Write the **case notes** in the run's work folder (`case-notes.md`): the frame and stop reason, the sections chosen for the purpose and types, every finding with its id, confidence label and citations with locators, the data of each table, the diagrams that would help (what each must show), divergences, gaps and next steps. This is the whole substance of the dossier; the source log stays as it is.
   - Hand the case notes to **Watson** to write the dossier with the [dossier template](references/dossier-template.md): where the AI tool can call another agent (Claude Code subagents), call the `watson` agent with the case notes, the template, the deliverable language and the output path; otherwise act as Watson yourself and follow the `chronicle`, `blueprint`, `document-design` and `document-quality` skills.
   - **Check the dossier against the case notes**: every finding, figure, citation, locator and confidence label present and unchanged; nothing added; ids resolve to the source log. Fix it or send it back to Watson with the list of differences.
   - Optional spreadsheet only when the user asks or approved it in the plan.
5. **`handoff`** — Present a summary (5 to 10 lines: what was found, the strongest evidence, the main gaps), the file paths and the possible next steps (for example `cross-examination` to have the dossier challenged before relying on it, `test-design` with the risk catalog, `requirements-review` with the open questions, proposals for `project-context`). Record results and close the run.

## Rules and constraints

- **Never invent a reference.** Cite only what was opened in this run, with title, author or organization, date of publication (or "undated") and date of access, and a link. A paper known only by its abstract is cited as such. A book not accessible is listed under *Further reading (not consulted)*, never as a source of a statement.
- **No project data on the web.** Search strings use only generic terms (protocol, technology, standard, error class). Never put customer names, internal hosts or URLs, ids, people's names, logs or confidential text in a query or in any external service, unless `project.json` has `externalDataSharingAllowed: true` and the user authorizes it for this task ([isolation](references/core/isolation-policy.md)). Show the search strings in the plan.
- **Confidence rules.** Judge each finding by the kind of claim, not only by the tier of its source:
  - *Normative* claims ("the standard requires X", "the law says Y") are *established* by the version of the text applicable at the reference date (today's version for a question about today), cited at the exact clause. They say what is required, not what happens in practice.
  - *Empirical or general* claims ("X is common", "Y prevents Z", "most implementations…") need corroboration: *established* only with independent agreement of good sources (for example several studies, or a systematic review) and no credible contradiction; one study or one authority alone is at most *supported*.
  - Labels: *established* (as above), *supported* (good evidence, little or no contradiction, not yet broad agreement), *disputed* (credible sources disagree — show both sides), *weak* (single low-tier source, indirect or outdated evidence), *hypothesis* (the investigator's inference — say from what).
  - Lower the label when the evidence is old for a fast-moving topic, comes from an interested party, or was observed in a context different from the user's (other version, protocol, sector, country); say why.
- **Critical reading of every source**, including social media and forums: they are not proof, but read critically (original post, author, date, pattern across independent reports) they reveal what official sources omit and point to what to verify ([source tiers](references/source-tiers.md)).
- **Original over repetition.** When ten pages repeat one claim, find and cite the origin; count them as one source.
- **Time and context.** Every source has its date. For "today" questions on fast-moving topics (security, versions, prices, law) prefer the latest and flag outdated ones. For past questions use what was valid then (the text in force at that date, sources of the time), mark later sources as later interpretation, and report what changed afterwards separately.
- **Interests.** Note when a source sells what it recommends or is otherwise interested.
- **Quotes** stay in the original language, short, in quotation marks, with their source; the rest is in the deliverable language.
- **Sensitive topics** (security, health, law, finance): describe risks, controls and how to test them in authorized environments; no step-by-step attack against third parties; conclusions are framed as "according to the sources", with a recommendation to consult a qualified professional where it applies.
- **Structured, not long.** Tables for comparisons and catalogs, Mermaid diagrams (at most 15 nodes) for maps, timelines and flows, short paragraphs. No filler, no repetition of the request.
- Apply [execution principles](references/core/execution-principles.md), [approval](references/core/approval-policy.md), [traceability](references/core/traceability.md) and [isolation](references/core/isolation-policy.md).

## Validation criteria

- The plan was approved before any search was run, names the investigation types and the time and context frame, and its search strings contain no project data.
- The dossier covers the "always cover" items of each type, or says which ones could not be established.
- A question about a past date is answered with the version or state valid at that date, with its source, and changes after that date are reported separately.
- The dossier was written from the case notes (by Watson or following his skills) and checked against them: no finding, citation, locator or label lost or changed, nothing added.
- Every entry in the dossier's bibliography appears in the source log's sources table as *used*, with a working link or a precise identifier (DOI, ISBN, RFC number, standard id) and the access date.
- Every finding has a confidence label and at least one citation with a locator (section, clause, page or paragraph); a normative finding marked *established* cites the clause of the version applicable at the reference date; an empirical finding marked *established* cites at least two independent sources.
- Every key finding has a row in the source log's evidence table with the locator and a short excerpt that actually supports it.
- The source log's rounds table shows the stop criterion was met: each key question answered or declared a gap, and saturation or the round limit stated.
- The dossier has the mandatory sections of the template plus the sections of the chosen purpose; divergences and gaps are explicit (even if "none found").
- No statement in the dossier comes from a source marked *not consulted* or from memory.

## Output format

Deliverables (language: deliverable language; see `AGENTS.md`):

- Investigation plan: `workspace/projects/<project-id>/runs/<run-id>/outputs/investigation-plan.md` ([plan template](references/plan-template.md)).
- Dossier: `workspace/projects/<project-id>/runs/<run-id>/outputs/dossier-<slug>.md` ([dossier template](references/dossier-template.md)), Markdown with tables, Mermaid diagrams and links.
- Source log: `workspace/projects/<project-id>/runs/<run-id>/outputs/sources.md`, delivered with the dossier so anyone can audit it, in three tables:
  - **Sources** — one row per source opened: id, title, author/organization, date, tier, link or identifier, accessed on, used or discarded and why;
  - **Evidence for key findings** — finding id, source id, locator (section, clause, page or paragraph), short excerpt in the original language (at most about 25 words);
  - **Search rounds** — round, key question, queries run, new relevant sources, outcome (answered, gap, continue).
- Optional spreadsheet (decided in the plan: produced only when the approved plan says yes; if a large table appears that the plan did not foresee, offer it at `handoff`), for a large table such as a risk catalog: `npm run xlsx -- write --layout skills/deduction/assets/risk-catalog.layout.json --data <data.json> --lang <pt-BR|en> --out workspace/projects/<project-id>/runs/<run-id>/outputs/<file>.xlsx`; the data file goes to the run's work folder. Layout: [risk-catalog.layout.json](assets/risk-catalog.layout.json). Other tables: a Markdown table in the dossier.

Chat-only tools: present the plan and the dossier in the conversation and tell the user where to save them.

## Human approval points

At each gate, before the closing question, give the summary the [approval policy](references/core/approval-policy.md) asks for: what was done, what happens next, what it depends on and what remains open.

| Gate | When | Closing question (in the user's language; English and pt-BR shown) |
|---|---|---|
| Plan | End of `plan` | "Investigation plan ready. Approve it, or tell me what to change before I start searching." ["Plano de investigação pronto. Aprove, ou me diga o que ajustar antes de eu começar a pesquisar."] |
| Plan change | During `research`, when the plan proves wrong | State what changed and why; wait for OK. |
| External data | Before any query that would include project data (only when allowed by `project.json`) | Show the exact query; wait for OK. |

## Error handling

- No web access → [fallback](#tools); status stays `awaiting-input` until the user brings material or accepts the plan only.
- Source behind a paywall or login → use the abstract, preprint or official summary and say so; never cite content not read.
- Few or no reliable sources → say it in the dossier's gaps section, lower the confidence, never pad with weak sources.
- Sources contradict each other → present both sides in *Divergences* with each one's evidence and date; do not pick a side without saying why.
- The topic turns out to be much larger than planned → deliver what is solid, list what remains as next questions, propose a second run.
- The same search or page failing 3 times → move on, record it in the source log.

## Completion criteria

The dossier and the source log are saved, every bibliography entry is traceable to the log, the summary and next steps were given, and `state.json` is `completed` — or the run is `awaiting-input` with the plan delivered and the reason stated (no web access, missing purpose).

## Persistence

Follow the [persistence protocol](references/core/persistence-protocol.md). Run in `workspace/projects/<project-id>/runs/<run-id>/` with `state.json` (steps `briefing`, `plan`, `research`, `dossier`, `handoff`; the plan approval in `approvals`; open questions in `pending`), the user's attachments listed in `inputs`, the plan, the dossier and the source log in its outputs folder (all listed in `artifacts`) and working data (including `case-notes.md`) in its work folder. Offer confirmed general definitions to `project-context` as proposals in `workspace/projects/<project-id>/proposed-updates.md`.
