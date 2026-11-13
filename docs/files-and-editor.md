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

A ` ```mermaid ` block is drawn as a diagram, and a ` ```excalidraw ` block as an editable drawing — click its pencil to edit it in [Excalidraw](https://excalidraw.com). A `.excalidraw` file opens as that same drawing, filling the page, and edits are saved back into the file. Hold **Ctrl** and scroll to zoom. The AIs are told to draw diagrams this way, inside the document, instead of making images or PDFs.

### Links between project files

A link to another file of the project — a heading, a comment, a PDF page — opens that place in Moki. **Ctrl+click** opens a web link. See [Project links](internal-links.md).

## PDF

PDFs open with selectable text. You can:

- **highlight and comment** a selection, reply to comments, and change their color;
- **edit pages** — rotate, move, insert, delete — and the title and author;
- select text and **Create a note from here**: a note in the project with the quote and where it came from.

A file from the inbox, and any page edit, is saved as an `-edited.pdf` copy, so the original stays as it was.

## Word and Excel

- **Word** (`.docx`) lets you edit paragraph text. Bold, italic, underline and Enter apply to that paragraph, and the file keeps its native formatting. **Excel** (`.xlsx`) lets you edit cell values and formulas while retaining styles and merged cells. Changes save automatically; the status is beside the tag icon.
- **Comments** use the same selection button, composer, colors and cards as Markdown. In Word, select text inside one paragraph; in Excel, select a cell. Click **Comment** beside the selection, write and save. Cards sit at the height of their passage or cell, joined to it, and follow scrolling and zoom. Reply, edit, recolor or delete on the card. Closing the column leaves markers that reopen it. Word keeps the exact selected range and formatting; comment text is a native Word comment or Excel note, with colors and replies kept inside the file.
- Hold **Ctrl** and scroll to zoom; click the percentage in the file bar to reset it. Spreadsheet rows load as you scroll, up to the preview limit of 2,000 rows and 200 columns.
- Spreadsheet programs recalculate formulas when they open the saved file; Moki does not calculate them. Protected sheets, signed files, templates and macro-enabled formats remain read only. Complex fields and shared/array formulas need the original program.
- **Older files** (`.doc`, `.xls`): opening one converts it with installed Microsoft Word/Excel or LibreOffice into a new `.docx`/`.xlsx` and says so. The original stays untouched. If that copy already exists, Moki opens it instead of making another.

## HTML pages

**HTML** runs local JavaScript, modules and relative web assets in an isolated preview, without access to Moki or external network resources. The single file bar includes the width selector (fit, tablet or phone), comments, reload and open in browser.

To comment, **select a passage in the preview** and click the floating **Comment** button. The composer and cards are the same as in Markdown: choose a color, write, reply, edit or delete. Cards follow visible passages as you scroll the preview; clicking one brings its passage into view. The speech-bubble icon shows the total count and toggles the column; with it closed, markers reopen the comments. Comments are stored with the project, separately from the HTML source; copy the project to take them with you. If the page changes and a passage no longer matches, its comment stays with a notice.

## Diagram files

Mermaid (`.mmd`, `.mermaid`), PlantUML (`.puml`, `.plantuml`), D2 (`.d2`) and Graphviz DOT (`.dot`, `.gv`) open in a diagram viewer. Mermaid can render offline using the renderer included in Moki. The viewer's provider settings can instead use a configured [Kroki server](https://docs.kroki.io/kroki/setup/usage/) for these four languages. Opening a file does not send it to a public service: a server outside this computer requires an explicit authorization for that project's configured address. No public endpoint is enabled by default.

Use **Ctrl + scroll** to zoom around the pointer, normal scroll to move vertically, **Shift + scroll** horizontally, or the hand tool to drag. The toolbar also fits the diagram to the view or its width, restores the view, shows the source, enters full screen, and exports SVG or PNG. Copying an image uses the system clipboard.

The comment tool marks a point or a dragged region. Its composer, colors, replies and comment cards are shared with the other document viewers. Comments can be resolved and reopened; the comments panel filters open and resolved discussions. Their coordinates, the view's zoom and its scroll position are kept with the project in the existing external document comment storage. Reviewing a diagram never changes its source. Renaming or moving a file in Moki carries that metadata with it.

When the source changes, the viewer updates through the existing file watcher. Comments are retained; positions that cannot be confirmed against the new drawing are marked for review. Positional comments do not imply that every renderer provides stable semantic node identifiers. Freehand drawing tools and semantic version comparison are not added by this viewer.

Kroki is a separate service, not a JavaScript dependency embedded in Moki. Its official [deployment guide](https://docs.kroki.io/kroki/setup/about-docker-podman/) covers Docker on Windows and Docker or Podman on Linux; some engines use companion containers. Moki does not install or start those services automatically. If a configured server is unavailable, the file's source and the rest of Moki remain accessible.

## Images and other files

**Images** open in a viewer. The ↗ button opens a file in its own program; **⋯ › Open with…** lets you choose which one for Excel, Word and PDF, and remembers it.

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
