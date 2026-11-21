// Small Markdown-to-HTML renderer shared by the PDF generator and the desktop
// app. HTML in the source is escaped, so the output never contains raw markup
// from the document. No dependencies.

import { headingSlugger } from './heading-anchors.ts';
import { renderBlock } from './md-blocks.mjs';

export const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// A backslash keeps a punctuation character literal (\* is "*", not emphasis).
const hide = (text) => text.replace(/\\([!-/:-@[-`{-~])/g, (_, c) => String.fromCharCode(0xe000 + c.charCodeAt(0)));
const unhide = (html) => html.replace(/[\ue000-\ue07f]/g, (c) => escHtml(String.fromCharCode(c.charCodeAt(0) - 0xe000)));

// Set only while markdownToHtml runs (it is synchronous): turns a relative image path into a data: URI, or null.
let resolveImage = null;

function inline(text) {
  return unhide(escHtml(hide(text))
    // Relative images become data: URIs through the caller's resolver; the line below still accepts only raster data: URIs.
    // The path it came from rides along in hex (no Markdown character can touch it) and becomes data-ref, so the
    // app can open or save the file behind the picture.
    .replace(/!\[([^\]]*)\]\(([^)\s:]+)(?: &quot;((?:w=\d+(?: center| right)?)|center|right)&quot;)?\)/g, (m, alt, src, title) => {
      const path = src.replace(/&amp;/g, '&');
      const uri = resolveImage?.(path);
      if (!uri) return m;
      return `![${alt}](${uri}${title ? ` &quot;${title}&quot;` : ''}${Buffer.from(path, 'utf8').toString('hex')})`;
    })
    // Only embedded raster images (Word previews); no remote or file images.
    // A title is only the editor's size and alignment (w=400, center, right), never free text.
    .replace(/!\[([^\]]*)\]\((data:image\/(?:png|jpeg|gif|webp|bmp);base64,[A-Za-z0-9+/=]+)(?: &quot;((?:w=\d+(?: center| right)?)|center|right)&quot;)?(?:([0-9a-f]+))?\)/g, (_m, alt, src, title, ref) => {
      const width = title?.match(/w=(\d+)/)?.[1];
      const align = title?.match(/(center|right)/)?.[1];
      return `<img alt="${alt}" src="${src}"${width ? ` width="${width}"` : ''}${align ? ` data-align="${align}"` : ''}${ref ? ` data-ref="${ref}"` : ''}>`;
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    // <https://...>: an autolink (http and https only; the text is already escaped).
    .replace(/&lt;(https?:\/\/[^\s<>]+?)&gt;/g, '<a href="$1">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>'));
}

// A cell that is just << joins the cell on its left and ^^ the cell above (merged cells in Word previews),
// so the merged area is drawn as one cell. "\<<" is a literal "<<".
function table(head, rows) {
  const grid = [head, ...rows].map((cells, r) => cells.map((text, c) => ({ text, r, c, colspan: 1, rowspan: 1, owner: null })));
  for (const row of grid) {
    for (const cell of row) {
      const near = cell.text === '<<' ? row[cell.c - 1] : cell.text === '^^' && cell.r > 1 ? grid[cell.r - 1][cell.c] : null; // no rowspan out of the header
      if (!near) continue;
      cell.owner = near.owner ?? near;
      if (cell.text === '<<' && cell.owner.r === cell.r) cell.owner.colspan++;
      if (cell.text === '^^' && cell.owner.c === cell.c) cell.owner.rowspan++;
    }
  }
  const tr = (row, tag) => `<tr>${row.filter((cell) => !cell.owner).map((cell) => `<${tag}${cell.colspan > 1 ? ` colspan="${cell.colspan}"` : ''}${cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : ''}>${/^(<<|\^\^)$/.test(cell.text) ? '' : inline(cell.text)}</${tag}>`).join('')}</tr>`;
  return `<table><thead>${tr(grid[0], 'th')}</thead><tbody>${grid.slice(1).map((row) => tr(row, 'td')).join('')}</tbody></table>`;
}

// Small Markdown subset: headings (# and setext), paragraphs, nested lists, tables,
// blockquotes, code blocks, horizontal rules. Enough for generated reports.
// options.image: (src) => data: URI or null, for relative image paths (the desktop app reads them inside the project).
// options.comments: draw the commented text (app/src/md-comments.ts) as <mark data-c>; otherwise, as
// in a generated report, nothing of the comments shows. Their block at the end never shows.
/** @param {string} md @param {{ image?: ((src: string) => string | null) | null, comments?: boolean }} [options] */
export function markdownToHtml(md, { image = null, comments = false } = {}) {
  resolveImage = image;
  // The marks become private-use characters (kept through escaping and inline formatting), then tags.
  const source = md.replace(/\n*<!-- moki-comments\n[\s\S]*?\n-->\s*$/, '')
    .replace(/<!--c:([a-z0-9]+)-->/g, comments ? '\ue100$1\ue101' : '').replace(/<!--\/c:[a-z0-9]+-->/g, comments ? '\ue102' : '');
  try {
    return render(source).replace(/\ue100([a-z0-9]+)\ue101/g, '<mark class="md-comment" data-c="$1">').replace(/\ue102/g, '</mark>');
  } finally { resolveImage = null; }
}

const LIST_ITEM = /^\s*([-*]|\d+\.)\s+/;

function render(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const headingId = headingSlugger();
  const heading = (level, text) => {
    const html = inline(text);
    const visible = html.replace(/<[^>]*>/g, '').replace(/\ue100[a-z0-9]+\ue101|\ue102/g, '')
      .replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" })[entity]);
    return `<h${level} id="${headingId(visible)}">${html}</h${level}>`;
  };
  let i = 0;
  const isTableSep = (l) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);
  const cells = (l) => l.trim().replace(/^\||(?<!\\)\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      // Only these two languages become diagrams. Anything else stays a code block, and the
      // language is a fixed token so it cannot become an attribute. A fence may be indented (a code block inside a
      // list item): its lines lose that indentation, as the fence finder of the app (diagram-source.ts) reads them.
      const pad = line.match(/^\s*/)[0].length;
      const info = line.trim().slice(3).trim();
      const lang = info.split(/\s+/)[0].toLowerCase();
      const height = Number(/(?:^|\s)height=(\d{2,4})\b/.exec(info)?.[1]);
      const heightAttr = height >= 120 && height <= 1200 ? ` data-height="${height}"` : '';
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++].replace(new RegExp(`^ {0,${pad}}`), ''));
      i++;
      // Indicator cards and a flow of steps (md-blocks.mjs).
      const card = renderBlock(lang, buf.join('\n'), inline);
      if (card) { out.push(card); continue; }
      const code = escHtml(buf.join('\n'));
      const diagram = lang === 'mermaid' || lang === 'excalidraw' ? lang : '';
      // A language is kept only as a fixed token, so it cannot become markup.
      const token = /^[a-z0-9_+-]+$/.test(lang) ? lang : '';
      out.push(diagram
        ? `<pre class="diagram" data-diagram="${diagram}"${heightAttr}><code>${code}</code></pre>`
        : `<pre${token ? ` data-lang="${token}"` : ''}><code>${code}</code></pre>`);
    } else if (/^#{1,6}\s/.test(line)) {
      const level = line.match(/^#+/)[0].length;
      out.push(heading(level, line.slice(level).trim()));
      i++;
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push('<hr>');
      i++;
    } else if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      out.push(table(head, rows));
    } else if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      // Paragraphs, lists and bold labels inside a quote ("> **Note:** …" callouts of several lines).
      out.push(`<blockquote>${render(buf.join('\n'))}</blockquote>`);
    } else if (LIST_ITEM.test(line)) {
      const html = [];
      const stack = []; // open lists: { tag, indent }
      const indentOf = (l) => l.match(/^\s*/)[0].replace(/\t/g, '    ').length;
      // The next line that is not blank, so a blank line between items keeps one list (numbering goes on) and an
      // indented paragraph after a blank line stays in its item.
      const nextFilled = (from) => { let j = from; while (j < lines.length && !lines[j].trim()) j++; return j; };
      const continues = (j) => j < lines.length && !/^\s*```/.test(lines[j]) && indentOf(lines[j]) >= stack.at(-1).indent + 2 && !LIST_ITEM.test(lines[j]);
      while (i < lines.length && LIST_ITEM.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        const indent = m[1].replace(/\t/g, '    ').length;
        const tag = /\d/.test(m[2]) ? 'ol' : 'ul';
        // A numbered list keeps the number it starts at ("3. …" after a paragraph shows 3).
        const open = () => `<${tag}${tag === 'ol' && parseInt(m[2], 10) !== 1 ? ` start="${parseInt(m[2], 10)}"` : ''}><li>`;
        // Deeper by 2+ spaces opens a nested list; less indented closes lists back to that level.
        while (stack.length > 1 && indent < stack.at(-1).indent) html.push(`</li></${stack.pop().tag}>`);
        const top = stack.at(-1);
        if (!top || indent >= top.indent + 2) { html.push(open()); stack.push({ tag, indent }); }
        else if (top.tag !== tag) { html.push(`</li></${stack.pop().tag}>${open()}`); stack.push({ tag, indent }); }
        else html.push('</li><li>');
        i++;
        // The item's text goes on in indented lines below it; after a blank line, as a new paragraph of the item.
        const parts = [[m[3]]];
        while (i < lines.length) {
          const j = nextFilled(i);
          if (!continues(j)) break;
          if (j > i) parts.push([]);
          parts.at(-1).push(lines[j].trim());
          i = j + 1;
        }
        // "- [ ] item" / "- [x] item": a checklist item (the box is drawn, not editable here).
        const task = parts[0][0].match(/^\[([ xX])\]\s+(.*)$/);
        if (task) parts[0][0] = task[2];
        const text = parts.map((p) => inline(p.join(' '))).join('<br><br>');
        html.push(task ? `<input type="checkbox" class="task" disabled${task[1] === ' ' ? '' : ' checked'}> ${text}` : text);
        // A blank line between two items of the list does not end it.
        const j = nextFilled(i);
        if (j > i && j < lines.length && LIST_ITEM.test(lines[j])) i = j;
      }
      while (stack.length) html.push(`</li></${stack.pop().tag}>`);
      out.push(html.join(''));
    } else if (!line.trim()) {
      i++;
    } else {
      const buf = [];
      let level = 0;
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*```|>|\s*([-*]|\d+\.)\s+)/.test(lines[i])) {
        // Setext heading: text underlined with === (level 1) or --- (level 2). A lone --- is a rule (handled above).
        if (buf.length && /^ {0,3}(=+|-+)\s*$/.test(lines[i])) { level = lines[i].trim()[0] === '=' ? 1 : 2; i++; break; }
        buf.push(lines[i++]);
      }
      if (level) { out.push(heading(level, buf.join(' ').trim())); continue; }
      // A line ending in two spaces is a line break inside the paragraph.
      out.push(`<p>${inline(buf.join('\n')).replace(/ {2,}\n/g, '<br>').replace(/\n/g, ' ')}</p>`);
    }
  }
  return out.join('\n');
}
