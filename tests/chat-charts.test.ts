// Chart blocks of a chat answer: what makes a valid chart, and the reason given for an invalid one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseChart } from '../app/src/chat-chart-spec.ts';

test('chat charts: bar, line and pie specs are read; a pie keeps one series', () => {
  const bar = parseChart(JSON.stringify({ type: 'bar', title: 'Sales', labels: ['Jan', 'Feb'], series: [{ name: '2025', values: [3, 4] }, { name: '2026', values: [5, '6'] }] }));
  assert.deepEqual(bar, { type: 'bar', title: 'Sales', labels: ['Jan', 'Feb'], series: [{ name: '2025', values: [3, 4] }, { name: '2026', values: [5, 6] }] });
  const pie = parseChart(JSON.stringify({ type: 'pie', labels: ['A', 'B'], series: [{ values: [1, 3] }, { values: [9, 9] }] }));
  assert.ok(!('error' in pie) && pie.series.length === 1 && pie.series[0].name === 'Series 1');
  assert.ok(!('error' in parseChart(JSON.stringify({ type: 'line', labels: ['1'], series: [{ name: 'x', values: [-2] }] }))));
});

test('chat charts: invalid data says why, and never throws', () => {
  const why = (source: string) => { const r = parseChart(source); return 'error' in r ? r.error : ''; };
  assert.match(why('{not json'), /not valid JSON/);
  assert.match(why(JSON.stringify({ type: 'radar', labels: ['a'], series: [{ values: [1] }] })), /bar, line or pie/);
  assert.match(why(JSON.stringify({ type: 'bar', labels: [], series: [{ values: [] }] })), /labels/);
  assert.match(why(JSON.stringify({ type: 'bar', labels: ['a', 'b'], series: [{ values: [1] }] })), /one number per label/);
  assert.match(why(JSON.stringify({ type: 'bar', labels: ['a'], series: [{ values: ['x'] }] })), /one number per label/);
  assert.match(why(JSON.stringify({ type: 'pie', labels: ['a'], series: [{ values: [-1] }] })), /negative/);
  assert.match(why(JSON.stringify({ type: 'bar', labels: ['a'], series: [] })), /no series/);
});
