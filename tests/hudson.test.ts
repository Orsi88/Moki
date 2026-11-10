import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from '../scripts/lib/repo.mjs';
import { createProject } from '../scripts/lib/core.ts';
import { createService } from '../desktop/service.ts';
import { organizePrompt, readPlan, safeName, type OrganizeCandidate } from '../desktop/hudson.ts';

const file = (path: string, extra: Partial<OrganizeCandidate> = {}): OrganizeCandidate => ({ path, size: 10, run: 'r1', title: 'Revisão', status: 'completed', deliverable: false, preview: '', ...extra });

test('hudson: a new name keeps the extension and holds no folder', () => {
  assert.equal(safeName('Relatório final', 'x.md'), 'Relatório final.md');
  assert.equal(safeName('../../etc/passwd.md', 'x.md'), null); // a path is never a name: what is left starts with a dot
  assert.equal(safeName('pasta/sub: nome', 'x.md'), 'pastasub nome.md');
  assert.equal(safeName('.oculto', 'x.md'), null);
  assert.equal(safeName('Matriz.xlsx', 'a.xlsx'), 'Matriz.xlsx');
});

test('hudson: the request lists every file with its run and preview, and asks for JSON only', () => {
  const prompt = organizePrompt([file('runs/r1/outputs/apoio.md', { preview: 'notas soltas', deliverable: true })], 'Portuguese (pt-BR)');
  assert.match(prompt, /path: runs\/r1\/outputs\/apoio\.md/);
  assert.match(prompt, /listed as a deliverable/);
  assert.match(prompt, /"notas soltas"/);
  assert.match(prompt, /Answer with JSON only/);
  assert.match(prompt, /When in doubt, keep/);
});

test('hudson: only listed files with a known action are taken; what is unclear is kept', () => {
  const files = [file('runs/r1/outputs/a.md'), file('runs/r1/outputs/b.md'), file('runs/r1/outputs/c.pdf'), file('runs/r1/outputs/d.md'), file('runs/r1/outputs/e.md')];
  const answer = '```json\n' + JSON.stringify({ actions: [
    { path: 'runs/r1/outputs/a.md', do: 'delete', why: 'rascunho' },
    { path: 'runs/r1/outputs/b.md', do: 'rename', why: 'sem nome' }, // no name: kept
    { path: 'runs/r1/outputs/c.pdf', do: 'context', why: 'regra' }, // not Markdown: kept
    { path: 'runs/r1/outputs/d.md', do: 'rename', name: 'Definições', why: 'nome melhor' },
    { path: '../fora.md', do: 'delete', why: 'x' }, // not listed: ignored
    { path: 'runs/r1/outputs/a.md', do: 'keep', why: 'repetido' }, // the first answer for a file stands
  ] }) + '\n```';
  assert.deepEqual(readPlan(answer, files), [
    { path: 'runs/r1/outputs/a.md', do: 'delete', why: 'rascunho' },
    { path: 'runs/r1/outputs/b.md', do: 'keep', why: 'sem nome' },
    { path: 'runs/r1/outputs/c.pdf', do: 'keep', why: 'regra' },
    { path: 'runs/r1/outputs/d.md', do: 'rename', name: 'Definições.md', why: 'nome melhor' },
    { path: 'runs/r1/outputs/e.md', do: 'keep', why: '' }, // left out: kept
  ]);
  assert.ok(readPlan('não é JSON', files).every((s) => s.do === 'keep'));
});

const root = mkdtempSync(join(tmpdir(), 'moki-hudson-'));
after(() => rmSync(root, { recursive: true, force: true }));

test('hudson: the service offers the files runs left, not their state, inputs or journals, and applies only offered files', async () => {
  for (const dir of ['agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
  createProject('acme', 'Acme', root);
  const service = createService(root, { launch: () => ({ opened: true, message: '' }), openFolder: () => {}, openPath: () => {} });
  const run = join(root, 'workspace', 'projects', 'acme', 'runs', '20261109-1500-requirements-review-us-12');
  for (const sub of ['inputs', 'logs', 'outputs', 'work']) mkdirSync(join(run, sub), { recursive: true });
  writeFileSync(join(run, 'state.json'), JSON.stringify({ schemaVersion: '1', id: '20261109-1500-requirements-review-us-12', project: 'acme', skill: 'requirements-review', title: 'Revisão da US-12', status: 'completed', artifacts: ['workspace/projects/acme/runs/20261109-1500-requirements-review-us-12/outputs/relatorio.md'] }));
  writeFileSync(join(run, 'inputs', 'us-12.md'), 'história');
  writeFileSync(join(run, 'logs', 'publication.jsonl'), '{}');
  writeFileSync(join(run, 'outputs', 'relatorio.md'), '# Relatório');
  writeFileSync(join(run, 'outputs', 'definicoes.md'), '# Definições confirmadas\n\nFrete grátis acima de R$ 100.');
  writeFileSync(join(run, 'work', 'apoio.md'), 'notas soltas');

  const offered = service.organizeCandidates('acme');
  const rel = (p: string) => `runs/20261109-1500-requirements-review-us-12/${p}`;
  assert.deepEqual(offered.map((f) => f.path).sort(), [rel('outputs/definicoes.md'), rel('outputs/relatorio.md'), rel('work/apoio.md')]);
  assert.equal(offered.find((f) => f.path === rel('outputs/relatorio.md'))?.deliverable, true);
  assert.equal(offered[0].title, 'Revisão da US-12');

  const result = await service.organizeApply('acme', [
    { path: rel('outputs/definicoes.md'), do: 'context', why: 'Regras de frete confirmadas' },
    { path: rel('outputs/relatorio.md'), do: 'rename', name: 'Relatório da US-12' },
    { path: rel('work/apoio.md'), do: 'delete' },
    { path: rel('state.json'), do: 'delete' }, // never offered: refused
  ]);
  assert.deepEqual(result.failed, [rel('state.json')]);
  assert.equal(result.done.length, 3);
  const context = join(root, 'workspace', 'projects', 'acme', 'context');
  assert.match(readFileSync(join(context, 'definicoes.md'), 'utf8'), /Frete grátis/);
  assert.match(readFileSync(join(context, 'index.md'), 'utf8'), /\| \[definicoes\.md\]\(definicoes\.md\) \| Regras de frete confirmadas \| \d{4}-\d{2}-\d{2} \|\n$/);
  assert.ok(existsSync(join(run, 'outputs', 'Relatório da US-12.md')));
  assert.ok(!existsSync(join(run, 'work', 'apoio.md')));
  assert.ok(existsSync(join(run, 'state.json')) && existsSync(join(run, 'logs', 'publication.jsonl')));
});
