// Charts in a chat answer: a ```chart block holding JSON - {"type":"bar"|"line"|"pie","title","labels":[...],
// "series":[{"name","values":[...]}]} - is drawn as an SVG with its title, labels and values, and "View data" shows
// the same numbers as a table to check them. A block that is not a valid chart stays as code, with the reason.
// Mermaid diagrams keep their own rendering. Every text is set with textContent (never as markup).

import { t } from './i18n';

export { parseChart, type ChartSpec } from './chat-chart-spec';
import { parseChart, type ChartSpec } from './chat-chart-spec';

const SVG = 'http://www.w3.org/2000/svg';
const el = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
};
const number = (v: number) => new Intl.NumberFormat(document.documentElement.lang || undefined, { maximumFractionDigits: 2 }).format(v);
const color = (i: number) => `var(--chart-${(i % 8) + 1})`;

function axes(spec: ChartSpec, draw: (svg: SVGSVGElement, x: (i: number, n: number) => number, y: (v: number) => number, band: number) => void): SVGSVGElement {
  const W = 640, H = 300, left = 52, right = 16, top = 16, bottom = 56;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', class: 'chat-chart-svg' });
  const all = spec.series.flatMap((s) => s.values);
  const max = Math.max(0, ...all), min = Math.min(0, ...all);
  const span = max - min || 1;
  const y = (v: number) => top + (H - top - bottom) * (1 - (v - min) / span);
  const band = (W - left - right) / spec.labels.length;
  const x = (i: number) => left + band * i + band / 2;
  for (let k = 0; k <= 4; k++) {
    const v = min + (span * k) / 4;
    svg.append(el('line', { x1: left, x2: W - right, y1: y(v), y2: y(v), class: 'chat-chart-grid' }), el('text', { x: left - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'chat-chart-tick' }, number(v)));
  }
  spec.labels.forEach((label, i) => {
    const short = label.length > 14 ? `${label.slice(0, 13)}…` : label;
    const text = el('text', { x: x(i), y: H - bottom + 18, 'text-anchor': 'middle', class: 'chat-chart-tick' }, short);
    text.append(el('title', {}, label));
    svg.append(text);
  });
  draw(svg, x, y, band);
  return svg;
}

function bars(spec: ChartSpec): SVGSVGElement {
  return axes(spec, (svg, x, y, band) => {
    const n = spec.series.length, width = Math.min(48, (band * 0.75) / n);
    spec.series.forEach((s, j) => s.values.forEach((v, i) => {
      const cx = x(i, n) - (width * n) / 2 + width * j;
      const bar = el('rect', { x: cx, y: Math.min(y(v), y(0)), width: Math.max(1, width - 2), height: Math.max(1, Math.abs(y(0) - y(v))), fill: color(j), rx: 2 });
      bar.append(el('title', {}, `${s.name} · ${spec.labels[i]}: ${number(v)}`));
      svg.append(bar);
      if (spec.labels.length * n <= 24) svg.append(el('text', { x: cx + width / 2 - 1, y: Math.min(y(v), y(0)) - 4, 'text-anchor': 'middle', class: 'chat-chart-value' }, number(v)));
    }));
  });
}

function lines(spec: ChartSpec): SVGSVGElement {
  return axes(spec, (svg, x, y) => {
    spec.series.forEach((s, j) => {
      svg.append(el('polyline', { points: s.values.map((v, i) => `${x(i, 1)},${y(v)}`).join(' '), fill: 'none', stroke: color(j), 'stroke-width': 2.5 }));
      s.values.forEach((v, i) => {
        const dot = el('circle', { cx: x(i, 1), cy: y(v), r: 4, fill: color(j) });
        dot.append(el('title', {}, `${s.name} · ${spec.labels[i]}: ${number(v)}`));
        svg.append(dot);
        if (spec.labels.length <= 12 && spec.series.length === 1) svg.append(el('text', { x: x(i, 1), y: y(v) - 9, 'text-anchor': 'middle', class: 'chat-chart-value' }, number(v)));
      });
    });
  });
}

function pie(spec: ChartSpec): SVGSVGElement {
  const values = spec.series[0].values;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const svg = el('svg', { viewBox: '0 0 300 300', role: 'img', class: 'chat-chart-svg pie' });
  let angle = -Math.PI / 2;
  values.forEach((v, i) => {
    const share = v / total, end = angle + share * 2 * Math.PI;
    const [x1, y1, x2, y2] = [150 + 120 * Math.cos(angle), 150 + 120 * Math.sin(angle), 150 + 120 * Math.cos(end), 150 + 120 * Math.sin(end)];
    const slice = share >= 0.9999
      ? el('circle', { cx: 150, cy: 150, r: 120, fill: color(i) })
      : el('path', { d: `M150 150 L${x1} ${y1} A120 120 0 ${share > 0.5 ? 1 : 0} 1 ${x2} ${y2} Z`, fill: color(i) });
    slice.append(el('title', {}, `${spec.labels[i]}: ${number(v)} (${Math.round(share * 100)}%)`));
    svg.append(slice);
    angle = end;
  });
  return svg;
}

// The legend: one entry per series (bar, line) or per slice (pie), with its value for a pie.
function legend(spec: ChartSpec): HTMLElement {
  const list = document.createElement('ul');
  list.className = 'chat-chart-legend';
  const total = spec.series[0].values.reduce((a, b) => a + b, 0) || 1;
  const entries = spec.type === 'pie'
    ? spec.labels.map((label, i) => `${label}: ${number(spec.series[0].values[i])} (${Math.round((spec.series[0].values[i] / total) * 100)}%)`)
    : spec.series.map((s) => s.name);
  entries.forEach((text, i) => {
    const item = document.createElement('li');
    const swatch = document.createElement('span');
    swatch.style.background = color(i);
    item.append(swatch, document.createTextNode(text));
    list.append(item);
  });
  return list;
}

// The numbers behind the chart, to check them: one row per label, one column per series.
function table(spec: ChartSpec): HTMLTableElement {
  const tbl = document.createElement('table');
  tbl.className = 'chat-chart-data';
  const head = tbl.createTHead().insertRow();
  for (const text of ['', ...spec.series.map((s) => s.name)]) { const th = document.createElement('th'); th.textContent = text; head.append(th); }
  const body = tbl.createTBody();
  spec.labels.forEach((label, i) => {
    const row = body.insertRow();
    const th = document.createElement('th'); th.textContent = label; row.append(th);
    for (const s of spec.series) row.insertCell().textContent = number(s.values[i]);
  });
  return tbl;
}

// Every ```chart block of a rendered answer becomes its chart (once); an invalid one keeps its code and says why.
export function dressCharts(root: HTMLElement): void {
  for (const pre of root.querySelectorAll<HTMLElement>('pre[data-lang="chart"]:not([data-chart])')) {
    pre.dataset.chart = 'done';
    const source = pre.querySelector('code')?.textContent ?? '';
    const spec = parseChart(source);
    if ('error' in spec) {
      const note = document.createElement('p');
      note.className = 'chat-chart-error';
      note.textContent = t('This chart could not be drawn: {reason}', { reason: t(spec.error, spec.values) });
      pre.after(note);
      continue;
    }
    const figure = document.createElement('figure');
    figure.className = 'chat-chart';
    if (spec.title) { const cap = document.createElement('figcaption'); cap.textContent = spec.title; figure.append(cap); }
    const svg = spec.type === 'pie' ? pie(spec) : spec.type === 'line' ? lines(spec) : bars(spec);
    svg.setAttribute('aria-label', spec.title || t('Chart'));
    figure.append(svg);
    if (spec.type === 'pie' || spec.series.length > 1) figure.append(legend(spec));
    const data = table(spec);
    data.hidden = true;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'link small chat-chart-toggle';
    toggle.textContent = t('View data');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      data.hidden = !data.hidden;
      toggle.textContent = data.hidden ? t('View data') : t('Hide data');
      toggle.setAttribute('aria-expanded', String(!data.hidden));
    });
    figure.append(toggle, data);
    pre.replaceWith(figure);
  }
}
