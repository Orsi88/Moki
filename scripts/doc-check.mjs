#!/usr/bin/env node
// Checks a Markdown deliverable against what Moki's viewer and PDF export
// really render (scripts/lib/markdown.mjs) and against basic document
// structure, so a document never reaches the user with a broken table, a
// link that goes nowhere or a diagram block that cannot be drawn. It checks
// text only: how the page looks is document-quality's visual inspection.
//
// Usage: node scripts/doc-check.mjs <file.md> [--json]
// Exit code 1 when there is at least one error; warnings alone exit 0.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MERMAID_TYPES = /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|quadrantChart|requirementDiagram|gitGraph|mindmap|timeline|sankey-beta|xychart-beta|block-beta|packet-beta|kanban|architecture-beta|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment)\b/;
const MAX_NODES = 15;
const MAX_COLUMNS = 7; // more is hard to read on screen and A4 portrait (the dossier bibliography has 7)

// Problems of one document: { line, level: 'error' | 'warning', rule, message }.
export function checkMarkdown(text, { file = '', exists = existsSync } = {}) {
  const problems = [];
  const add = (line, level, rule, message) => problems.push({ line, level, rule, message });
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  // Fenced blocks first: their content is not Markdown.
  const blocks = [];
  let open = null;
  lines.forEach((l, i) => {
    const fence = /^(\s*)(```+|~~~+)\s*([\w-]*)/.exec(l);
    if (!open && fence) { open = { start: i, lang: fence[3].toLowerCase(), marker: fence[2], body: [] }; return; }
    if (open && l.trim().startsWith(open.marker)) { blocks.push({ ...open, end: i }); open = null; return; }
    if (open) open.body.push(l);
  });
  if (open) add(open.start + 1, 'error', 'fence', 'A code block is never closed.');
  const inBlock = (i) => blocks.some((b) => i >= b.start && i <= b.end) || (open && i >= open.start);

  // Headings: one title, no skipped levels.
  let last = 0;
  let titles = 0;
  lines.forEach((l, i) => {
    if (inBlock(i)) return;
    const h = /^(#{1,6})\s+\S/.exec(l);
    if (!h) return;
    const level = h[1].length;
    if (level === 1) titles++;
    if (last && level > last + 1) add(i + 1, 'warning', 'heading-level', `Heading level ${level} right after level ${last}: a level is skipped.`);
    last = level;
  });
  if (titles > 1) add(1, 'warning', 'title', `${titles} level-1 headings: a document has one title.`);

  // Inline problems Moki's renderer shows wrongly.
  lines.forEach((l, i) => {
    if (inBlock(i)) return;
    const code = l.replace(/`[^`]*`/g, '');
    if (/^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.test(code)) add(i + 1, 'error', 'callout', 'GitHub callout syntax is shown as text in Moki: write "> **Note:** ..." instead.');
    if (/<\/?(br|div|span|p|b|i|u|table|tr|td|img|a|details|summary|sup|sub)\b[^>]*>/i.test(code)) add(i + 1, 'error', 'html', 'Raw HTML is escaped by Moki and shows as text.');
    for (const m of code.matchAll(/(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = m[3];
      if (target.startsWith('#')) { add(i + 1, 'error', 'anchor-link', `Link to "${target}": headings have no anchors in Moki; refer to the numbered section instead.`); continue; }
      if (/^[a-z][a-z0-9+.-]*:/i.test(target)) {
        if (m[1] && !/^data:image\/(png|jpeg|gif|webp|bmp);base64,/.test(target)) add(i + 1, 'warning', 'remote-image', 'Remote images are not shown by Moki; embed the picture or keep it in the project.');
        continue;
      }
      const path = decodeURI(target.split('#')[0]);
      if (path && file && !exists(resolve(dirname(file), path))) add(i + 1, 'error', 'missing-file', `"${path}" does not exist next to the document.`);
    }
  });

  // Tables: the separator row and the same number of cells in every row.
  const cells = (row) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).length;
  for (let i = 0; i < lines.length; i++) {
    if (inBlock(i) || !/^\s*\|.*\|\s*$/.test(lines[i])) continue;
    const start = i;
    while (i + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[i + 1]) && !inBlock(i + 1)) i++;
    const rows = lines.slice(start, i + 1);
    if (rows.length < 2 || !/^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$/.test(rows[1])) { add(start + 1, 'error', 'table', 'A table needs a header row followed by a separator row (| --- |).'); continue; }
    const width = cells(rows[0]);
    rows.forEach((r, k) => { if (cells(r) !== width) add(start + k + 1, 'error', 'table', `This row has ${cells(r)} cells; the header has ${width}.`); });
    if (width > MAX_COLUMNS) add(start + 1, 'warning', 'wide-table', `${width} columns: hard to read on screen and A4; split, transpose or move columns to an appendix.`);
  }

  // Diagram blocks.
  for (const b of blocks) {
    const at = b.start + 1;
    if (b.lang === 'mermaid') {
      const body = b.body.filter((l) => l.trim() && !l.trim().startsWith('%%'));
      if (!body.length || !MERMAID_TYPES.test(body[0].trim())) { add(at, 'error', 'mermaid-type', `The first line of a Mermaid block must name the diagram type (flowchart, sequenceDiagram, stateDiagram-v2, ...).`); continue; }
      const text = body.join('\n');
      if (/<\/?[a-z][^>]*>/i.test(text)) add(at, 'error', 'mermaid-html', 'HTML inside Mermaid labels is not drawn (Moki uses strict mode without HTML labels).');
      if (/^\s*click\s/m.test(text)) add(at, 'error', 'mermaid-click', '"click" is not allowed in strict mode.');
      if (/^(flowchart|graph)\b/.test(body[0].trim())) {
        const ids = new Set();
        for (const l of body.slice(1)) {
          if (/^\s*(subgraph|end|classDef|class|style|linkStyle|direction)\b/.test(l)) continue;
          for (const m of l.matchAll(/(?:^|-->|---|-\.->|==>|--[^->]*-->|\|[^|]*\|)\s*([A-Za-z][\w-]*)\s*(?=[[({>]|-->|---|-\.->|==>|&|$|\s)/g)) ids.add(m[1]);
        }
        if (ids.size > MAX_NODES) add(at, 'warning', 'mermaid-size', `About ${ids.size} nodes: more than ${MAX_NODES}; split into complementary views.`);
      }
    }
    if (b.lang === 'excalidraw') {
      try {
        const scene = JSON.parse(b.body.join('\n'));
        if (scene?.type !== 'excalidraw' || !Array.isArray(scene.elements)) add(at, 'error', 'excalidraw', 'An Excalidraw block must hold a scene with "type": "excalidraw" and an "elements" list.');
      } catch { add(at, 'error', 'excalidraw', 'The Excalidraw block is not valid JSON.'); }
    }
  }

  // Source ids: a citation [S3 ...] needs a bibliography row for S3.
  const cited = new Set();
  lines.forEach((l, i) => { if (!inBlock(i)) for (const m of l.matchAll(/\[(S\d+)\b[^\]]*\]/g)) cited.add(m[1]); });
  if (cited.size) {
    const listed = new Set(lines.flatMap((l) => { const m = /^\s*\|\s*(S\d+)\s*\|/.exec(l); return m ? [m[1]] : []; }));
    if (listed.size) for (const id of cited) if (!listed.has(id)) add(1, 'error', 'source-id', `${id} is cited but has no row in the bibliography.`);
  }

  return problems.sort((a, b) => a.line - b.line);
}

function main(argv) {
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) { process.stderr.write('Usage: node scripts/doc-check.mjs <file.md> [--json]\n'); return 2; }
  if (!existsSync(file)) { process.stderr.write(`${file} does not exist.\n`); return 2; }
  const problems = checkMarkdown(readFileSync(file, 'utf8'), { file: resolve(file) });
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify({ file, problems }, null, 2)}\n`);
  else if (!problems.length) process.stdout.write(`${file}: no problems found.\n`);
  else for (const p of problems) process.stdout.write(`${file}:${p.line}: ${p.level} [${p.rule}] ${p.message}\n`);
  return problems.some((p) => p.level === 'error') ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2));
