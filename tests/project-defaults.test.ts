// A project's defaults (project.json defaults): read from the file, and what an AI opened in the project without
// a choice is asked (scripts/lib/core.ts, buildStartPrompt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvokePrompt, buildPrompt, buildStartPrompt, parseDefaults, type StartItem } from '../scripts/lib/core.ts';
import { ROOT } from '../scripts/lib/repo.mjs';

test('defaults are read as a list of kinds and ids; anything else, and repeats, are left out', () => {
  assert.deepEqual(parseDefaults([{ kind: 'agent', id: 'failure-analyst' }, { kind: 'skill', id: 'failure-analysis' }, { kind: 'agent', id: 'failure-analyst' },
    { kind: 'robot', id: 'x' }, { kind: 'skill', id: '../etc' }, 'skill', null]), [{ kind: 'agent', id: 'failure-analyst' }, { kind: 'skill', id: 'failure-analysis' }]);
  assert.deepEqual(parseDefaults('agent'), []);
});

test('nothing set asks nothing; operations are not part of the start', () => {
  assert.equal(buildStartPrompt({ project: 'acme', defaults: [], root: ROOT }), '');
  assert.equal(buildStartPrompt({ project: 'acme', defaults: [{ kind: 'operation', id: 'revisao' }], root: ROOT }), '');
});

test('one agent: the AI takes its role, says what is set up and what it needs, and waits', () => {
  const prompt = buildStartPrompt({ project: 'logs', defaults: [{ kind: 'agent', id: 'failure-analyst' }], language: 'Portuguese (pt-BR)', root: ROOT });
  assert.match(prompt, /^Follow AGENTS\.md\. Project: logs\./);
  assert.match(prompt, /Act as the failure-analyst agent: read agents\/quality\/failure-analyst\.md and follow it\./);
  assert.match(prompt, /say in one or two lines what is set up here and what you need from me to start .* and wait for it: do not start any work before that\./);
  assert.match(prompt, /Talk to me in Portuguese \(pt-BR\)\.$/);
});

test('several agents, skills, activities and the instructions all reach the start', () => {
  const prompt = buildStartPrompt({
    project: 'logs', root: ROOT, instructions: 'Os logs vêm do serviço X, em horário de Brasília',
    defaults: [{ kind: 'agent', id: 'failure-analyst' }, { kind: 'agent', id: 'qa-lead' }, { kind: 'skill', id: 'failure-analysis' },
      { kind: 'skill', id: 'meu-skill-global' }, { kind: 'activity', id: 'review' }, { kind: 'activity', id: 'failure' }],
    globalSkills: [{ name: 'meu-skill-global', path: '/home/eu/.claude/skills/meu-skill-global/SKILL.md' }],
  });
  assert.match(prompt, /This project's agents: failure-analyst \(agents\/quality\/failure-analyst\.md\), qa-lead \(agents\/quality\/qa-lead\.md\)\. For each request act as the one that fits, or ask me which\./);
  assert.match(prompt, /Use these skills whenever they fit, following each one's procedure and approval gates: failure-analysis \(skills\/failure-analysis\/SKILL\.md\), meu-skill-global \(\/home\/eu\/\.claude\/skills\/meu-skill-global\/SKILL\.md\)\./);
  assert.match(prompt, /This project's activities, to follow when I ask for one: "Review user stories" \(it needs files: ask me for them\): /);
  assert.match(prompt, /"Failure pre-analysis": /);
  assert.match(prompt, /Instructions for this project: Os logs vêm do serviço X, em horário de Brasília\./);
  assert.doesNotMatch(prompt, /Act as the failure-analyst agent/); // several roles: the AI picks or asks
});

test('the instructions alone start the AI too; a default that is gone is left out', () => {
  const prompt = buildStartPrompt({ project: 'logs', root: ROOT, instructions: 'Responda em tópicos.', defaults: [{ kind: 'agent', id: 'nao-existe' }, { kind: 'activity', id: 'nao-existe' }] });
  assert.match(prompt, /Instructions for this project: Responda em tópicos\./);
  assert.doesNotMatch(prompt, /nao-existe/);
});

const item = (kind: 'skill' | 'agent', name: string, extra: Partial<StartItem> = {}): StartItem => ({ kind, name, path: kind === 'skill' ? `workspace/projects/logs/skills/${name}/SKILL.md` : `workspace/projects/logs/agents/${name}.md`, description: `About ${name}.`, ...extra });

test('the project\'s skills and agents start the AI by themselves: where each is and what it is for, none twice, none that are gone', () => {
  const items = [item('skill', 'billing'), item('skill', 'failure-analysis'), item('skill', 'old', { missing: true }), item('agent', 'helper')];
  const prompt = buildStartPrompt({ project: 'logs', root: ROOT, items, defaults: [{ kind: 'skill', id: 'failure-analysis' }] });
  assert.match(prompt, /Skills of this project: read the SKILL\.md before acting when the task fits one, and follow its procedure and approval gates: billing \(workspace\/projects\/logs\/skills\/billing\/SKILL\.md\): About billing\.\./);
  assert.match(prompt, /Agents of this project: when I ask for one, or the task fits it, read its file and follow it, using only the skills it lists: helper \(workspace\/projects\/logs\/agents\/helper\.md\): About helper\.\./);
  assert.doesNotMatch(prompt, /skills\/old\/|About old/, 'a missing one is not offered');
  assert.equal(prompt.match(/failure-analysis/g)?.length, 2, 'a default is named in its own sentence only (its name and its path)');
  assert.match(prompt, /Talk to me in English\.$/);
  // Without anything else set, they are enough to start; without them (or only missing ones) nothing starts.
  assert.match(buildStartPrompt({ project: 'logs', root: ROOT, defaults: [], items: [item('agent', 'helper')] }), /^Follow AGENTS\.md\. Project: logs\. Look in context\/ first:.*Agents of this project/);
  assert.equal(buildStartPrompt({ project: 'logs', root: ROOT, defaults: [], items: [item('skill', 'old', { missing: true })] }), '');
});

test('the start prompt stays short: long descriptions are cut, and past 40 items only the names are listed', () => {
  const long = buildStartPrompt({ project: 'logs', root: ROOT, defaults: [], items: [item('skill', 'wordy', { description: 'x'.repeat(400) })] });
  assert.ok(!long.includes('x'.repeat(141)) && long.includes(`${'x'.repeat(139)}…`));
  const many = Array.from({ length: 45 }, (_, i) => item('skill', `s${String(i).padStart(2, '0')}`));
  const prompt = buildStartPrompt({ project: 'logs', root: ROOT, defaults: [], items: many });
  assert.match(prompt, /: s00; s01;/);
  assert.match(prompt, /s39\. Others of this project are in workspace\/projects\/logs\/skills: read the folder when the task needs one\./);
  assert.doesNotMatch(prompt, /s40|About s0/, 'past the limit: no descriptions and no more names');
});

test('a skill, an agent or files: one request to type into an AI, with no shared context and no run', () => {
  const head = 'Follow AGENTS.md. Project: logs. Look in context/ first: it prevails when it disagrees with another folder. Then prefer inbox/, notes/, runs/ and temporary/. Other folders of this project, and a file the person points to, stay available.';
  assert.equal(buildInvokePrompt({ project: 'logs', target: { kind: 'skill', name: 'billing', path: 'workspace/projects/logs/skills/billing/SKILL.md' } }),
    `${head} Use the billing skill: read workspace/projects/logs/skills/billing/SKILL.md and follow its procedure and approval gates. Talk to me in English.`);
  assert.equal(buildInvokePrompt({ project: 'logs', language: 'Portuguese (pt-BR)', target: { kind: 'agent', name: 'helper', path: 'agents/quality/helper.md' } }),
    `${head} Act as the helper agent: read agents/quality/helper.md and follow it. Talk to me in Portuguese (pt-BR).`);
  assert.equal(buildInvokePrompt({ project: 'logs', target: { kind: 'file', paths: ['workspace/projects/logs/context/a.md'] } }),
    `${head} Read workspace/projects/logs/context/a.md and use it as context for what I ask next. Talk to me in English.`);
  assert.match(buildInvokePrompt({ project: 'logs', target: { kind: 'file', paths: ['a.md', 'b.md'] } }), /Read a\.md, b\.md and use them as context for what I ask next\./);
  assert.throws(() => buildInvokePrompt({ project: 'logs', target: { kind: 'file', paths: [] } }), /at least one file/);
  assert.match(buildInvokePrompt({ project: 'logs', workspace: '/data/ws', repository: '/code/app', target: { kind: 'file', paths: ['x.md'] } }), /Workspace folder: \/data\/ws\..*Linked folder \(the system's repository\): \/code\/app\./);
  assert.doesNotMatch(buildInvokePrompt({ project: 'logs', target: { kind: 'skill', name: 'billing', path: 'p/SKILL.md' } }), /--activity|new-run|shared/i);
});

test('the "skill" activity reads the skill where it is: Moki\'s folder by default, the given path for a project\'s or a global skill', () => {
  const base = { project: 'logs', activity: 'skill', skill: 'failure-analysis', root: ROOT };
  assert.match(buildPrompt(base), /Use the failure-analysis skill: read skills\/failure-analysis\/SKILL\.md and follow/);
  assert.match(buildPrompt({ ...base, skill: 'billing', skillPath: ' workspace/projects/logs/skills/billing/SKILL.md ' }), /Use the billing skill: read workspace\/projects\/logs\/skills\/billing\/SKILL\.md and follow/);
});
