# ArtCraft apps

The [ArtCraft Launcher](https://github.com/storytold/craft-launcher) installs and updates the **Craft App Suite**: desktop apps for documents, spreadsheets, slides, images, video, audio, PDFs and CAD. Moki can **download them for you**, has a **skill for each tool** so the AI knows how it works, and **agents** that pick the right one.

## The apps

| App | What it is for |
|---|---|
| **ArtCraft Launcher** | Lists, installs, updates and opens every app of the suite. Install it first. |
| **WordCraft** | Writing and document design — `.docx`, `.odt`, `.rtf` (in the spirit of Word) |
| **GridCraft** | Spreadsheets — `.xlsx`, `.ods`, `.csv`, formulas, charts (in the spirit of Excel) |
| **DeckCraft** | Presentations — `.pptx`, themes, transitions (in the spirit of PowerPoint) |
| **PhotoCraft** | Image editing — layers, masks, brushes, PSD (in the spirit of Photoshop) |
| **LightCraft** | Photo library and raw development (in the spirit of Lightroom) |
| **VectorCraft** | Vector illustration — SVG, paths (in the spirit of Illustrator) |
| **FilmCraft** | Video editing, color and sound (in the spirit of Premiere Pro) |
| **EffectCraft** | Motion graphics and visual effects (in the spirit of After Effects) |
| **DesignCraft** | Page layout and publishing (in the spirit of InDesign) |
| **PdfCraft** | Reading, organizing and protecting PDFs (in the spirit of Acrobat) |
| **SoundCraft** | Recording, editing and mixing audio (in the spirit of Pro Tools) |
| **FigCraft** | Interface design and prototyping (in the spirit of Figma) |
| **CADCraft** | Computer-aided design and drafting — DXF, DWG (in the spirit of AutoCAD) |
| **TextureCraft**, **Craft Anything** | Also in the launcher's catalog. |

## Downloading an app

1. In a project, open the **+** at the end of the tabs › **ArtCraft apps**. The 16 apps are listed, the launcher first.
2. **Download** shows the file, the release and the address, and asks you to confirm.
3. When your system has more than one format — on Linux, your distro's package (`.rpm` or `.deb`), an `.AppImage` or a `.tar.gz`; on Windows, an `.msi` or a portable `.zip` — you choose, with the best fit marked as **recommended**.
4. Moki downloads it, **checks its SHA-256**, saves it where you choose and shows the folder.

Moki **never installs or runs** the file: open it yourself (an `.rpm` or `.deb` runs its install scripts when you open it). Messages and fixes: [Troubleshooting](troubleshooting.md).

## PdfCraft and the PDFs in Moki

With **PdfCraft** installed, Moki uses it for PDF comments and page edits; without it, Moki does the same on its own. Either way, a file from the inbox, and any page edit, goes to an `-edited.pdf` copy. See [Files and the editor](files-and-editor.md#pdf).

## Asking the AI about a tool

Each tool has a **skill** (`wordcraft`, `gridcraft`, `photocraft`, `pdfcraft`… and `craft-launcher`) with what it is, its formats, how to build it, its command line, its MCP server, checks and logs — **verified against the tool's repository** before answering, never from memory.

Four agents route and specialize:

| Agent | When to call it |
|---|---|
| **artcraft-router** | You mention ArtCraft, the launcher or a Craft app — or describe a task (a spreadsheet, a video, a CAD drawing) without naming the tool: it finds the right one and loads only its skill. |
| **craft-launcher-specialist** | Installing, updating or opening Craft apps; the launcher itself. |
| **office-apps-specialist** | WordCraft, GridCraft and DeckCraft — Office features, terms and files (`.docx`, `.xlsx`, `.pptx`). |
| **adobe-apps-specialist** | PhotoCraft, LightCraft, VectorCraft, FilmCraft, EffectCraft, DesignCraft and PdfCraft — Adobe features, terms and files. |

They only read: they answer and point the way. Compatibility with Office or Adobe files is treated as something to **check**, never assumed.

> [!TIP]
> **Testing a Craft app?** QA work on a tool (reviewing its stories, designing its tests, analysing a failure) uses a project whose id is the skill's name — `wordcraft`, `pdfcraft`… — so the QA skills and the tool's skill work together.

## See also

- [Calling activities, agents and skills](call.md)
- [Troubleshooting](troubleshooting.md#downloading-artcraft-apps)
