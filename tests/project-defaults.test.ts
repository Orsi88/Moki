// A project's defaults (project.json defaults): read from the file, and what an AI opened in the project without
// a choice is asked (scripts/lib/core.ts, buildStartPrompt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStartPrompt, parseDefaults } from '../scripts/lib/core.ts';
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
