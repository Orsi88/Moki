// The Configurador from a terminal (agents/setup/configurador.md): the same plan the app's panel shows, applied by
// the same service calls the Settings screens use, with the same checks. The AI writes the plan; the person approves
// it in the chat; this applies it.
//
//   npm run configure -- snapshot [--project <id>]          what exists now (names and ids to reuse), as JSON
//   npm run configure -- check <plan.json> [--project <id>]  the steps Moki would apply, after its own reading
//   npm run configure -- apply <plan.json> [--project <id>]  applies them; one line per step, ✓ or ✕ with the reason
//
// A plan is {"steps":[{"kind","title","why","data"}]} (desktop/configurator.ts lists the kinds and their data).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/repo.mjs';
import { isProject } from './lib/core.ts';
import { createService } from '../desktop/service.ts';
import { readConfigPlan } from '../desktop/configurator.ts';

const args = process.argv.slice(2);
const flag = (name: string) => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] ?? '' : ''; };
const command = args[0] ?? '';
const project = flag('--project');
const fail = (message: string): never => { console.error(message); process.exit(1); };

if (!['snapshot', 'check', 'apply'].includes(command)) fail('Usage: npm run configure -- snapshot|check <plan.json>|apply <plan.json> [--project <id>]');
if (project && !isProject(project, ROOT)) fail(`There is no project "${project}".`);

// Nothing here opens windows or terminals: the calls a plan makes never need them.
const nothing = () => { throw new Error('Not available from a terminal.'); };
const service = createService(ROOT, { launch: nothing, openFolder: nothing, openPath: nothing });

if (command === 'snapshot') {
  console.log(JSON.stringify(service.configSnapshot(project), null, 2));
} else {
  const file = args[1] && !args[1].startsWith('--') ? resolve(args[1]) : fail('Give the plan file.');
  let text = '';
  try { text = readFileSync(file, 'utf8'); } catch { fail(`Cannot read ${file}.`); }
  const plan = readConfigPlan(text, Boolean(project));
  if (!plan.steps.length) fail('The plan has no step Moki can apply (routine and project steps need --project).');
  if (command === 'check') {
    for (const step of plan.steps) console.log(`- [${step.kind}] ${step.title}${step.why ? ` — ${step.why}` : ''}`);
  } else {
    const results = await service.configApply(project, plan.steps);
    for (const r of results) console.log(`${r.ok ? '✓' : '✕'} ${r.title}${r.ok ? '' : ` — ${r.message}`}`);
    if (results.some((r) => !r.ok)) process.exitCode = 1;
  }
}
