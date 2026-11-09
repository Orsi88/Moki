# Drafting rules

Used to fill the project's template for the chosen item type. The template wins wherever it says something different.

## Every item

| Part | Source | If missing |
|---|---|---|
| Title | the template's pattern; else a short statement of the subject ("[Module] what" for problems) | ask for what the title needs |
| Description | the material: the need, the problem it addresses or the work to do, in the material's terms | ask; never fill with general knowledge |
| Acceptance condition or expected outcome | the material, a requirement or a confirmed definition — cited | leave it out if the template allows; else ask |
| Fields of the template (area, iteration, owner, priority, effort, parent…) | the material or the user | ask; never estimate effort or choose an owner |
| Links | the MF or story, the parent item, the test case, the run, related items | omit the links that do not exist |
| Attachments | files the QA names (masked) | — |

## Problem items

Types the tracker map marks as problems (bug, defect, incident…), in addition to the above:

| Part | Source | If missing |
|---|---|---|
| Steps to reproduce | the test case steps, the evidence (Jam user steps), the QA's description | ask; never complete a step |
| Expected result | the requirement, acceptance criterion, test case or confirmed definition — cited | ask for the origin; an expectation without origin is a question, not a field value |
| Obtained result | the QA's description, the evidence (prints, Jam, console and network errors) | ask |
| Reproduction | *verified* (reproduced; how many times; evidence) or *reported* (seen once, or by someone else) | ask which |
| Environment, version, build, date and time | the evidence, the execution data, the project's environments | ask |
| Technical note | the failure pre-analysis: summary, failure point, evidence, **hypothesis (labeled as hypothesis)** | omit the section |
| Severity, priority | [severity and priority](severity-priority.md) | suggest with reasons; the user confirms |

## Missing information

Collect everything missing for an item and ask in one short message, listing only the missing fields. In a batch, group the questions by item.

## Batch

- Number the items (`item 1`, `item 2`…). The type can be one for all or one per item (asked in step `type`).
- Each item has its own preview block; the user may approve some and not others.

## Duplicate search

1. Build the search from the item's key terms: the module or screen, the subject, the error message (exact text) for problems.
2. Search **open and resolved/closed** items of the project (resolved ones show recurrence or a regression), through `dispatch` (JQL or the Azure DevOps search).
3. For each candidate show: id and link, title, state, and **why it looks similar** (same message, same screen, same subject).
4. Say the **limits** of the search (terms used, period, items without text, search not available) and that no candidate is not proof there is no duplicate.
5. A resolved candidate that matches: offer to register a new item linked to it (a possible regression, for problems), or to comment on it — the user decides.
