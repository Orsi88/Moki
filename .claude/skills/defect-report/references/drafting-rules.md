# Drafting rules

Used to fill the project's template for the chosen item type. The template wins wherever it says something different.

## Where each part comes from

| Part | Source | If missing |
|---|---|---|
| Title | the template's pattern; else "[Module] Action — obtained result" | ask for the module if unknown |
| Steps to reproduce | the test case steps, the evidence (Jam user steps), the QA's description | ask; never complete a step |
| Expected result | the requirement, acceptance criterion, test case or confirmed definition — cited | ask for the origin; an expectation without origin is a question, not a field value |
| Obtained result | the QA's description, the evidence (prints, Jam, console and network errors) | ask |
| Reproduction | *verified* (reproduced; how many times; evidence) or *reported* (seen once, or by someone else) | ask which |
| Environment, version, build | the evidence or execution data, the project's environments | ask |
| Date and time | the evidence | ask |
| Technical note | the failure pre-analysis: summary, failure point, evidence, **hypothesis (labeled as hypothesis)** | omit the section |
| Evidence | attachments (prints) and links (Jam), masked | — |
| Links | the MF or story, the test case, the run | omit the links that do not exist |
| Severity, priority | [severity and priority](severity-priority.md) | suggest with reasons; the user confirms |

## Missing information

Collect everything missing for an item and ask in one short message, listing only the missing fields. In a batch, group the questions by item.

## Batch

- Number the items (`item 1`, `item 2`…). The type can be one for all or one per item (asked in step `type`).
- Each item has its own preview block; the user may approve some and not others.

## Duplicate search

1. Build the search from the item's key terms: the module or screen, the action, the error message (exact text), the expected behavior.
2. Search **open and resolved/closed** items of the project (resolved ones show recurrence or a regression), through `dispatch` (JQL or the Azure DevOps search).
3. For each candidate show: id and link, title, state, and **why it looks similar** (same message, same screen, same steps).
4. Say the **limits** of the search (terms used, period, items without text, search not available) and that no candidate is not proof there is no duplicate.
5. A resolved candidate that matches: offer to register a new item linked to it as a possible regression, or to comment on it — the user decides.
