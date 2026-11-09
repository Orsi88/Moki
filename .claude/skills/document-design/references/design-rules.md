# Design rules

Editorial design for documents: the reader sees the structure before reading a word.

## Hierarchy

- One title. Sections (level 2) for the big parts, subsections (level 3) only when a section has several parts; a fourth level is a sign to split or use a table.
- Headings say what the section holds ("Tokens are not single use"), not just a topic ("Tokens").
- Captions and notes are smaller and quieter than body text (the template's styles in Word/PDF; italics or a "Figure n —" line in Markdown).

## Rhythm and spacing

- Short paragraphs (up to about four lines on screen); a blank line between blocks.
- Group what belongs together; separate what does not with space or a heading, not with lines everywhere.
- Lists for parallel items only; no list of one item; no deep nesting (two levels at most).

## Alignment and balance

- Text left-aligned; numbers right-aligned in tables; centered only for figures and short captions.
- Equivalent elements look the same (every finding block, every risk row, every step).
- Avoid walls: break a long section with a table, a figure or a subsection when it carries different kinds of information.

## Tables

- A sentence before the table says what it shows and how it is ordered.
- Header row; the key column first; one fact per cell; units in the header, not in every cell.
- Up to about six columns on screen and A4 portrait; wider → split into two tables, transpose, move secondary columns to an appendix, or use landscape in Word/PDF.
- Long text does not belong in cells: keep cells short and put the explanation below.

## Emphasis

- Bold for the few words the reader must not miss; not for whole sentences.
- At most one or two callouts per section (`> **Note:** …`, `> **Warning:** …`).
- Colour comes from the template; a colour or symbol keeps one meaning in the whole document (e.g. red = blocking) and is always paired with a word or icon, so readers who do not distinguish colours get it too.

## Figures

- Every figure has a number and a caption ("Figure 2 — Renewal flow, staff portal (F1, F3)") and is mentioned in the text before it appears.
- Figures sit next to the text that explains them, never in a pile at the end (unless the document type puts them in an appendix).

## Navigation

- Long documents (more than about five sections): a short contents list at the top and numbered sections ("3.2"); refer to sections by number.
- Ids (F1, S3, R2, REV-004) are consistent and resolve inside the document.

## Fit to the reader

- Executive readers: fewer sections, a summary that stands alone, tables over prose, details in appendices.
- Technical readers: complete steps, exact values, references at hand.
