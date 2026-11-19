// What makes a ```chart block a chart (chat-charts.ts draws it). No app imports, so tests read it directly. An
// invalid block gives an English message and its values, which the window translates.

export interface ChartSpec { type: 'bar' | 'line' | 'pie'; title: string; labels: string[]; series: { name: string; values: number[] }[] }

const MAX_LABELS = 60;
const MAX_SERIES = 8;

// The chart a block describes, or why it is not one.
export type ChartError = { error: string; values?: Record<string, number> };

export function parseChart(source: string): ChartSpec | ChartError {
  let data: unknown;
  try { data = JSON.parse(source); } catch { return { error: 'The chart data is not valid JSON.' }; }
  const d = (data ?? {}) as Record<string, unknown>;
  if (d.type !== 'bar' && d.type !== 'line' && d.type !== 'pie') return { error: 'The chart type must be bar, line or pie.' };
  const labels = Array.isArray(d.labels) ? d.labels.map((l) => String(l)) : [];
  if (!labels.length || labels.length > MAX_LABELS) return { error: 'The chart needs between 1 and {n} labels.', values: { n: MAX_LABELS } };
  const series = (Array.isArray(d.series) ? d.series : []).slice(0, MAX_SERIES).map((s, i) => {
    const o = (s ?? {}) as Record<string, unknown>;
    return { name: typeof o.name === 'string' && o.name ? o.name : `Series ${i + 1}`, values: Array.isArray(o.values) ? o.values.map(Number) : [] };
  });
  if (!series.length) return { error: 'The chart has no series.' };
  if (series.some((s) => s.values.length !== labels.length || s.values.some((v) => !Number.isFinite(v)))) return { error: 'Each series needs one number per label.' };
  if (d.type === 'pie' && series[0].values.some((v) => v < 0)) return { error: 'A pie chart cannot have negative values.' };
  return { type: d.type, title: typeof d.title === 'string' ? d.title : '', labels, series: d.type === 'pie' ? series.slice(0, 1) : series };
}

