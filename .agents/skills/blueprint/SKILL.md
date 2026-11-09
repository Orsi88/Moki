---
name: blueprint
description: Draws diagrams that live inside the document - Mermaid blocks (flowchart, sequence, timeline, state, mind map, entity-relationship, Gantt, quadrant) and editable Excalidraw drawings built from a small spec by a script - choosing the diagram type by what must be explained, keeping it small and readable, and never turning it into an image or PDF unless asked. Use when a document, dossier, report or note needs a diagram, or when the user asks for a diagram, flow, map, timeline or drawing.
license: MIT
metadata:
  version: "0.1.0"
  status: draft
  category: documentation
  phase: "2"
---

# Blueprint

## Purpose

Explain with a picture what text explains badly — a flow, a sequence, a structure, a timeline, a comparison — with diagrams that stay **inside the Markdown** as source: Moki draws them, the user can read and edit them, and no separate image file is needed.

## Responsibilities

- Decide whether a diagram helps at all, and which type ([diagram types](references/diagram-types.md)).
- Write it as a Mermaid block, or as an Excalidraw drawing generated from a spec when the user wants a drawing to edit freely.
- Keep it small, labeled and faithful to the content it illustrates.

Does **not**: invent content that is not in the document or the source material; export to PNG, SVG or PDF unless asked (Moki's PDF export already draws the diagrams); draw decorative pictures.

## When to use

- Called by `chronicle` (Watson) while building a document, or by any skill whose deliverable has a diagram.
- The user asks for a diagram, flow, map, timeline, sequence, organization chart, architecture sketch or drawing.

Do not use when a table or a list says it better (a comparison of attributes is a table, not a diagram).

## Inputs

- What the diagram must show (the content, from the document or the user) and where it goes (the Markdown file and section).
- Optional: the kind of diagram the user wants; "editable drawing" (→ Excalidraw).

## Tools

- **Mermaid**: plain text; no tool needed. Moki draws ```` ```mermaid ```` blocks in Markdown (also in its PDF export).
- **Excalidraw**: `npm run excalidraw -- --spec <spec.json> --fence` prints an ```` ```excalidraw ```` block ready to paste into the Markdown (Moki draws it and opens it for editing); `--out <file.excalidraw>` writes a standalone file instead. The spec format is in [excalidraw-spec.md](references/excalidraw-spec.md). Fallback without a shell: use Mermaid; never hand-write Excalidraw element JSON.

## Procedure

1. **`decide`** — Check that a diagram adds understanding. Choose the type from [diagram types](references/diagram-types.md) by the question it answers (how does it flow? who talks to whom, in which order? how is it organized? when did it happen? how do options compare on two axes?). Default to **Mermaid**; use **Excalidraw** when the user wants a drawing to rearrange by hand, a free-form sketch, or asks for it.
2. **`draw`** —
   - Mermaid: write the block following the [Mermaid rules](references/diagram-types.md#mermaid-rules).
   - Excalidraw: write the spec (in the run's work folder), run the script with `--fence`, paste the block into the document.
   Give the diagram a one-line caption above it that says what it shows; if it summarizes sources, cite them in the caption.
3. **`check`** — Re-read the diagram against the text: every node and arrow corresponds to something stated; nothing the text does not say. Check the limits (at most 15 nodes; short labels). If the tool can render Mermaid or the user opens the file in Moki and it fails to draw, fix the syntax.

## Rules and constraints

- **Inside the Markdown, as source.** Diagrams are fenced blocks in the `.md` deliverable. No PNG/SVG/PDF copies unless the user asks ([deliverables only](references/core/execution-principles.md)).
- **Small and readable**: at most 15 nodes; labels of a few words; one idea per diagram. Bigger content → split into two diagrams or use a table.
- **Faithful**: a diagram never adds facts. In a dossier, a node that states a finding carries its finding id (F3) so it traces to the citation.
- **Accessible**: the caption and the surrounding text carry the meaning too; never rely on color alone.
- Excalidraw only through the script; Mermaid only with the syntax in the rules (no HTML labels, no click handlers, no external links — Moki draws Mermaid in strict mode).

## Validation criteria

- Each diagram is a ```` ```mermaid ```` or ```` ```excalidraw ```` block inside the Markdown deliverable, with a caption.
- At most 15 nodes; every node and edge traceable to the text.
- An Excalidraw block was produced by `npm run excalidraw` (its scene has `"source":"moki"`).
- No image or PDF file was created unless the user asked.

## Output format

The diagram blocks go inside the Markdown deliverable of the calling skill (for example `workspace/projects/<project-id>/runs/<run-id>/outputs/dossier-<slug>.md`). A standalone drawing, only when asked: `workspace/projects/<project-id>/runs/<run-id>/outputs/<name>.excalidraw`. Specs used to generate drawings stay in `workspace/projects/<project-id>/runs/<run-id>/work/`.

## Human approval points

None of its own. The calling skill's gates apply. When the user asked for a diagram on its own, show it and accept corrections.

## Error handling

- The content is too large for one diagram → split it, or propose a table instead.
- The script refuses the spec → it lists the reasons; fix the spec (ids, labels, shapes) and run again.
- No shell → Mermaid only, and say so if an editable drawing was requested.
- A Mermaid block fails to draw → simplify (quote labels with special characters, remove unsupported syntax) and check again.

## Completion criteria

The diagram is in the document, captioned, within the limits, faithful to the text, and in the format chosen.

## Persistence

No run of its own when called by another skill: the diagrams are part of that skill's deliverable and the specs go to that run's work folder. Called alone: follow the [persistence protocol](references/core/persistence-protocol.md) with a run in `workspace/projects/<project-id>/runs/<run-id>/` (steps `decide`, `draw`, `check`) and the Markdown file with the diagram in its outputs folder.
