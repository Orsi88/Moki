# Organization rules

How to organize information so the reader finds it, understands it and trusts it. Visual design (spacing, styles, table and page layout) is `document-design`'s.

## Understand before organizing

- What question does the deliverable answer, and what will the reader do with it (decide, act, test, audit, learn)?
- Sort the content: conclusions, evidence, arguments, risks, decisions, recommendations, caveats, pending points.
- Group what belongs together; spot repetition (keep the clearest statement, keep every distinct condition).

## Order

- **Pyramid**: the answer, then the arguments that support it, then the evidence under each argument. The reader can stop at any level. When a template fixes the order, follow it.
- **Reader's order, not author's order**: never "first we searched, then we found"; start with what was found.
- **Most important first** inside every section and every list.
- **Conditions next to claims**: an exception, limit or caveat sits in the same paragraph or table row as the statement it qualifies, never in a distant section only.
- **Overview before depth**: a section opens with its point; details, data and long evidence go below or to an appendix that the text refers to by number.
- **Continuous reading**: connect paragraphs with the reasoning that links them; lists for parallel items only. A document made only of bullets loses the why.

## Form for each kind of information

| Information | Form | Avoid |
|---|---|---|
| A conclusion with its reasoning | Short prose paragraph | A list of fragments that hides the reasoning |
| Parallel items (risks, steps, options) | List; numbered when order or reference matters | Long paragraphs listing items with commas |
| Items with several attributes | Table with a header row; a sentence before it saying what it shows | Nested lists; tables with one column |
| A sequence, flow, structure or timeline | Diagram (via `blueprint`) with a caption, plus one or two sentences | A diagram without explanation; more than 15 nodes |
| A key takeaway or a warning | Callout as a quote with a bold label: `> **Note:** …`, `> **Warning:** …` | More than one or two callouts per section |
| A sequence the reader executes | Numbered steps, one action each | Steps hidden in a paragraph |
| A definition | Glossary table, or inline the first time | Defining the same term twice differently |
| A quote from a source | Short, in quotation marks, original language, with the citation | Long quotes; quotes without source |
| Numbers | Table or inline with unit, date and source | Numbers without unit, period or source |

## Headings

- Headings carry the message when possible: "Assertion replay is the main risk" rather than "Risks".
- No skipped levels (H2 → H4); no heading with a single subsection; at most three levels in most documents.
- Section numbers (1, 1.1) only in long documents that will be referenced.

## Tables

- Header row, consistent units, one fact per cell, the key column first.
- Order rows by what matters to the reader (severity, date, score), say how they are ordered.
- Long text belongs below the table, not inside a cell.

## Traceability in the text

- Findings numbered (F1, F2…), sources by id with locator ([S3 §5.2]), risks by id (R1…): ids resolve in the same document.
- Confidence next to the finding it qualifies, not in a separate list.
- Refer to sections and appendices by their number ("see 4.2", "Appendix B"); Moki's viewer has no heading anchors, so links to headings do not work.

## Plain language

- Short sentences, active voice, concrete words; the reader's vocabulary, with technical terms defined.
- No filler ("it is important to note that"), no repetition of the request, no conclusions that the evidence does not carry.
