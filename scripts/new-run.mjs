// Creates a run folder inside a project, with an initial state.json, and logs
// it in the project's activity-log.md (see core/persistence-protocol.md).
// Usage: npm run new-run -- --project <project-id> (--skill <name> | --workflow <id>) --slug <short-slug> [--title "<what was asked>"] [--activity <id>]
// --title: what was asked, in a few words; the app shows it as the run's name.
// The run starts with state.json only: outputs/, evidence/ and work/ are created when the first file goes there.
// --activity: the Moki activity the request came from (recorded in state.json, shown by the app under that activity).

import { mkdirSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, SLUG, listSkillDirs, parseArgs, nowStamp, workspaceDir } from './lib/repo.mjs';
import { listActivities } from './lib/activities.ts';

const args = parseArgs(process.argv.slice(2));
const fail = (msg) => { console.error(msg); process.exit(1); };
const kind = args.skill ? 'skill' : args.workflow ? 'workflow' : null;
if (!kind || !args.project || !args.slug) {
  fail('Usage: npm run new-run -- --project <project-id> (--skill <name> | --workflow <id>) --slug <short-slug> [--title "<what was asked>"] [--activity <id>]');
}
const name = args[kind];
if (kind === 'skill' && !listSkillDirs().includes(name)) fail(`Unknown skill "${name}". Available: ${listSkillDirs().join(', ')}`);
if (kind === 'workflow' && !existsSync(join(ROOT, 'skills', 'qa-orchestrator', 'references', 'workflows', `${name}.md`))) {
  fail(`Unknown workflow "${name}".`);
}
for (const [label, value] of [['project', args.project], ['slug', args.slug]]) {
  if (!SLUG.test(value)) fail(`--${label} must be lowercase letters, digits and hyphens`);
}
const projectDir = join(workspaceDir(), 'projects', args.project); // QA_WORKSPACE selects another workspace
if (!existsSync(join(projectDir, 'project.json'))) {
  fail(`Project "${args.project}" does not exist. Create it first: npm run new-project -- ${args.project}`);
}
if (args.activity !== undefined && !listActivities(ROOT, args.project).some((a) => a.id === args.activity)) {
  fail(`Unknown activity "${args.activity}" for project "${args.project}".`);
}

const id = `${nowStamp()}-${name}-${args.slug}`;
const runDir = join(projectDir, 'runs', id);
if (existsSync(runDir)) fail(`Run ${id} already exists.`);
const title = typeof args.title === 'string' ? args.title.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
mkdirSync(runDir, { recursive: true });

const now = new Date().toISOString();
const state = {
  schemaVersion: '1',
  id,
  project: args.project,
  [kind]: name,
  ...(title ? { title } : {}),
  ...(args.activity ? { activity: args.activity } : {}),
  // The Moki terminal the AI runs in (QA_TERMINAL), so the app opens this run's deliverables in that terminal's group.
  ...(/^t[\w-]{1,40}$/.test(process.env.QA_TERMINAL ?? '') ? { terminal: process.env.QA_TERMINAL } : {}),
  createdAt: now,
  updatedAt: now,
  status: 'in-progress',
  currentStep: '',
  completedSteps: [],
  pending: [],
  approvals: [],
  inputs: [],
  results: [],
  artifacts: [],
};
writeFileSync(join(runDir, 'state.json'), `${JSON.stringify(state, null, 2)}\n`);
appendFileSync(join(projectDir, 'activity-log.md'), `| ${now.slice(0, 10)} | ${kind}: ${name} | ${id} | in-progress |\n`);
console.log(`Created workspace/projects/${args.project}/runs/${id}/`);
