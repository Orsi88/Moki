// Two fenced blocks that read as cards wherever Moki shows Markdown: in the chat, in the files the app opens and in
// the PDF export (markdown.mjs draws them, doc-check.mjs checks them).
//   ```kpi    one indicator per line: label | value | note | tone   (note and tone may be left out; tone: good, bad, warn)
//   ```steps  one step per line, in order; a leading "1." or "-" is dropped and Markdown inside a step is kept
// Plain lines, like a table, so a person writes them by hand and an AI rarely gets them wrong. A block with nothing
// valid stays a code block.

export const KPI_TONES = ['good', 'bad', 'warn'];
const MAX_KPIS = 12;
const MAX_STEPS = 50;

const filled = (source) => source.replace(/\r\n?/g, '\n').split('\n').map((text, line) => ({ text: text.trim(), line })).filter((l) => l.text);
const cells = (text) => text.replace(/^\||(?<!\\)\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

// Each problem names the line of the block it is on (0 = the first line after the fence).
export function parseKpis(source) {
  const items = [];
  const problems = [];
  for (const { text, line } of filled(source)) {
    const [label = '', value = '', note = '', tone = ''] = cells(text);
    if (!label || !value) { problems.push({ line, message: 'An indicator needs a label and a value: label | value | note | tone.' }); continue; }
    const t = tone.toLowerCase();
    if (t && !KPI_TONES.includes(t)) problems.push({ line, message: `Unknown tone "${tone}": use good, bad or warn, or leave it out.` });
    items.push({ label, value, note, tone: KPI_TONES.includes(t) ? t : '' });
  }
  if (items.length > MAX_KPIS) problems.push({ line: 0, message: `More than ${MAX_KPIS} indicators: only the first ${MAX_KPIS} show.` });
  return { items: items.slice(0, MAX_KPIS), problems };
}

export function parseSteps(source) {
  const steps = filled(source).map(({ text }) => text.replace(/^(\d+[.)]|[-*])\s+/, '')).filter(Boolean);
  const problems = steps.length > MAX_STEPS ? [{ line: 0, message: `More than ${MAX_STEPS} steps: only the first ${MAX_STEPS} show.` }] : [];
  return { steps: steps.slice(0, MAX_STEPS), problems };
}

// The card of a block, or null (not one of these blocks, or nothing valid in it). `inline` formats a line of
// Markdown with its HTML escaped (markdown.mjs), so nothing in the block becomes markup.
export function renderBlock(lang, source, inline) {
  if (lang === 'kpi') {
    const { items } = parseKpis(source);
    return items.length ? `<div class="md-kpis">${items.map((k) => `<div class="md-kpi${k.tone ? ` md-kpi-${k.tone}` : ''}">`
      + `<span class="md-kpi-label">${inline(k.label)}</span><span class="md-kpi-value">${inline(k.value)}</span>`
      + `${k.note ? `<span class="md-kpi-note">${inline(k.note)}</span>` : ''}</div>`).join('')}</div>` : null;
  }
  if (lang === 'steps') {
    const { steps } = parseSteps(source);
    return steps.length ? `<ol class="md-steps">${steps.map((s) => `<li>${inline(s)}</li>`).join('')}</ol>` : null;
  }
  return null;
}
