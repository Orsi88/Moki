# Files and the editor

## Adding and organizing files

- **Drop files on the window** and they are copied into **Inbox** — up to 40 files, 200 MB each (folders are skipped).
- **Drop a file on a folder** of the tree to copy it there; **drag a file** of the tree onto another folder to move it.
- **Right-click** (or the ⋯ menu) for: new file or folder, **rename** (F2), show in the folder, copy the path or a link, **use in the terminal** (Context and Notes files: the AI reads it as context for what you ask next), and **delete** — to the trash.
- The fixed folders (Context, Inbox, Notes, Temporary, Execution files) are emptied, never removed. Files the AI saves show up in the tree as they land.

## Markdown: one editor for reading, writing and commenting

A `.md` file opens in a formatted editor ([TipTap](https://tiptap.dev)): headings, lists, checklists, tables, images, links, code and diagrams. It **saves on its own** as you type.

- **Any `.md` can be edited**, even one an AI wrote with HTML, a properties block at the top (`---`), footnotes or callouts. What the editor cannot draw is kept **exactly as written** — a block becomes a card you edit as text, an inline piece becomes a small tag — and saving rewrites only the paragraph you changed.
- **Type `/`** for the commands menu: titles, lists, table, quote, divider, link, code block, a Mermaid **diagram** or an Excalidraw **drawing**.
- **Tables**: with the caret in a table, a bar adds or removes rows and columns.
- **The source**: **Ctrl+E** shows the Markdown source, also editable; Ctrl+E again goes back.
- **The reading view**: the eye button shows the file as a reader sees it.
- **A large file** (over 1 MB) opens as editable text, so it stays fast; a note says so.
- **Changed outside Moki**: if the AI changes a file while you edit it, nothing is overwritten — a notice offers **See the new version** or **Keep mine**.

### Comments

Select text inside one paragraph and a **Comment** button floats next to it. Comments sit beside the text, joined to their words, with a color, replies, edit and delete. They live inside the file itself, invisible to other Markdown viewers, so they travel with it.

### Diagrams and drawings

A ` ```mermaid ` block is drawn as a diagram, and a ` ```excalidraw ` block as an editable drawing — click its pencil to edit it in [Excalidraw](https://excalidraw.com). Hold **Ctrl** and scroll to zoom. The AIs are told to draw diagrams this way, inside the document, instead of making images or PDFs.

### Links between project files

A link to another file of the project — a heading, a comment, a PDF page — opens that place in Moki. **Ctrl+click** opens a web link. See [Project links](internal-links.md).

## PDF

PDFs open with selectable text. You can:

- **highlight and comment** a selection, reply to comments, and change their color;
- **edit pages** — rotate, move, insert, delete — and the title and author;
- select text and **Create a note from here**: a note in the project with the quote and where it came from.

A file from the inbox, and any page edit, is saved as an `-edited.pdf` copy, so the original stays as it was.

## Word and Excel

`.docx` and `.xlsx` files open **with their formatting** — fonts, sizes, colors, alignment, fills — and can be **edited and commented** right in Moki:

- **Word**: click a paragraph to change its text; the rest of the document, its styles and its other parts stay as they were.
- **Excel**: click a cell to change its value or formula; formats, other cells and other sheets stay as they were.
- **Comments**: select a paragraph or a cell and **Add comment**. They are real Word and Excel comments, saved inside the file, so Word and Excel show them too.
- It **saves on its own**, and never over a version someone else saved meanwhile. The zoom is at the top of the file.
- A protected sheet, or a protected or digitally signed file, opens for reading only. Paragraphs with tracked changes or fields are edited in Word.

**Old formats** (`.doc`, `.xls`): **Convert and edit a copy** makes an editable `.docx` or `.xlsx` copy with Microsoft Office or LibreOffice installed on your computer. The original is kept.

## HTML pages

An `.html` file opens **running**, JavaScript included, with the CSS, scripts and images next to it — like a small browser inside Moki:

- the page runs **isolated**: it cannot reach Moki, your files outside the project, or the internet (pages that load libraries from a CDN need them saved next to the page);
- choose the width — **Fit to the panel**, **Tablet** or **Phone** — to check a layout, **reload** it, or **open it in your browser**;
- **select a passage and comment on it**: comments are kept next to the page, without changing its code, and follow the passage when the page changes.

## Images and other files

- **Images** open in a viewer.
- The ↗ button opens a file in its own program; **⋯ › Open with…** lets you choose which one (Excel, Word and PDF), and remembers it.

## Tabs, groups and split views

- Tabs **reopen** in their order when you come back to a project, with the active file, the view mode and the scroll position.
- Every AI terminal starts its own **group**, with a name and a color; the files it delivers open in its group with a dot until you look at them. Right-click a group to rename it, change its color or close its files; right-click a tab to move it to another group.
- The **split** button (top right) divides the screen into up to four views, each with its own groups and tabs — the terminal on one side and the file you review on the other. Drag tabs between views and the dividers to resize.

| Shortcut | What it does |
|---|---|
| Ctrl+S | Save (most files save on their own) |
| Ctrl+W | Close the tab |
| Ctrl+E | Markdown source ↔ formatted |
| Ctrl+Shift+K | **Call…** |
| Ctrl+Shift+F | Search the workspace |

## See also

- [Notes and quick assistants](notes.md)
- [AI terminals](ai-terminals.md)
