# Formats

What each format needs. Produce only the format asked.

## Markdown in Moki

Moki's viewer and its PDF export use a small renderer (`scripts/lib/markdown.mjs`). Write only what it shows correctly:

| Works | Does not work — avoid |
|---|---|
| Headings `#`…`######`, paragraphs, **bold**, *italic*, `code`, ~~strike~~ | Raw HTML (it is escaped and shows as text), `<br>` |
| Tables with a header row | Cells spanning rows or columns; very wide tables |
| Bullet, numbered and nested lists; task lists `- [ ]` | GitHub callouts `> [!NOTE]` (shown as text): use `> **Note:** …` |
| Block quotes (one paragraph each) | Multi-paragraph quotes: split into several `>` blocks |
| Links to web pages and to files (text in brackets, address in parentheses; or an address between angle brackets) | Links to headings (an address starting with #): headings have no anchors — refer to numbered sections instead |
| Images: relative paths inside the project or embedded PNG/JPEG | Remote images |
| ```` ```mermaid ```` and ```` ```excalidraw ```` blocks (drawn by Moki) | Mermaid with HTML labels, `click` or links (strict mode) |

## Word (.docx)

- Through `npm run docx -- write --data <document.json> --out <file.docx>`; inside the user's model with `--template <model.docx>` (its styles, header, footer and logo kept; `{{placeholders}}` filled). Read a model first with `npm run docx -- inspect <model.docx>`.
- Use the model's or template's styles (Heading 1–3, Normal, Caption, table style); never direct formatting that fights them.
- The generator writes headings (levels 0–3), paragraphs (optionally bold), tables (with a header row, or label/value rows), images with caption and width, and page breaks — nothing else. Long documents: a short contents paragraph at the top and page breaks before major parts; wide tables: split or transpose (there is no landscape section); header and footer come from the template or the model ({project}, {title}, {date}, {page}/{pages}).
- Diagrams: the Word generator does not draw Mermaid or Excalidraw blocks, but it embeds images (`image` block). When a Word deliverable needs a diagram, agree with the user how to include it (for example a picture of the diagram, produced as working data in `work/`); the Markdown source keeps the diagram.

## PDF

- From Markdown through `npm run pdf -- <file.md> <file.pdf>` (local Edge/Chrome); the project's template sets fonts, colours, header, footer, logo and watermark; Mermaid and Excalidraw blocks are drawn as pictures.
- Check page breaks: a heading never alone at the bottom of a page, tables that continue keep their header, figures not cut, nothing outside the margins.

## Spreadsheet (.xlsx)

- A skill's layout (`npm run xlsx -- write --layout <layout.json> …`) or the user's model (`npm run xlsx -- fill …`) defines sheets and columns: keep them exactly; keep the model's formulas, validations and formatting.
- Header row styled and frozen, filters on, column widths fitted to the content, wrapped text in long columns, consistent number and date formats, one fact per cell.

## Text for a tracker (Azure DevOps, Jira)

- Follow the item type's template (`templates/items/`): its fields, sections, title pattern.
- Keep to what the tracker's editor shows: headings, lists, bold, links and simple tables; no HTML or Markdown features the editor does not render (when unsure, plain structure with line breaks).
- Evidence and links as the template lists them; the `dispatch` signature at the end.
