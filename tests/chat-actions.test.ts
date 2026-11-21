// Choices and approval blocks of a chat answer: what makes them valid, and the reply an approval sends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvalReply, groupReply, parseApproval, parseChoiceGroup, parseChoices, readGroupReply, type ChoiceGroup } from '../app/src/chat-action-spec.ts';

test('chat actions: a closed question needs at least two distinct options; text is trimmed and bounded', () => {
  assert.deepEqual(parseChoices('{"question":" Which env? ","options":["Staging","Production","Staging"," "]}'), { question: 'Which env?', options: ['Staging', 'Production'] });
  assert.equal(parseChoices('{"question":"Only one","options":["Yes"]}'), null);
  assert.equal(parseChoices('not json'), null);
  assert.equal(parseChoices('["a","b"]'), null);
  assert.equal(parseChoices(JSON.stringify({ options: Array.from({ length: 20 }, (_, i) => `o${i}`) }))?.options.length, 8);
});

test('chat actions: an approval says what it covers; its reply names the decision and the title', () => {
  assert.deepEqual(parseApproval('{"title":"Update context/rules.md","items":["Add rule R-12","Remove R-3"]}'), { title: 'Update context/rules.md', items: ['Add rule R-12', 'Remove R-3'] });
  assert.equal(parseApproval('{"title":"Nothing listed","items":[]}'), null);
  assert.equal(parseApproval('{"items":["x"]}'), null);
  const words = { approved: 'Approved', declined: 'Declined' };
  assert.equal(approvalReply(true, 'Update rules', words), 'Approved: Update rules');
  assert.equal(approvalReply(false, 'Update rules', words), 'Declined: Update rules');
});

test('chat actions: a group asks several questions; its reply has one line per question and is read back', () => {
  const group = parseChoiceGroup(JSON.stringify({ title: 'Scope\ndecisions', submit: 'Record and go on', questions: [
    { question: 'How do pipelines run?', options: ['Manually', 'Manually and on a schedule'] },
    { question: 'Only one option', options: ['x'] }, // not a question: dropped
    { options: ['a', 'b'] }, // a group question needs its text
    { question: 'Reports\nshown how?', options: ['Original HTML', 'Native dashboards', 'Both'] },
  ] })) as ChoiceGroup;
  assert.deepEqual(group, { title: 'Scope decisions', submit: 'Record and go on', questions: [
    { question: 'How do pipelines run?', options: ['Manually', 'Manually and on a schedule'] },
    { question: 'Reports shown how?', options: ['Original HTML', 'Native dashboards', 'Both'] },
  ] });
  const reply = groupReply(group, ['Manually and on a schedule', 'Both']);
  assert.equal(reply, 'Scope decisions:\n1. How do pipelines run? → Manually and on a schedule\n2. Reports shown how? → Both');
  assert.deepEqual(readGroupReply(group, reply), ['Manually and on a schedule', 'Both']);
  // Own words, or an option the block does not have, mark nothing.
  assert.deepEqual(readGroupReply(group, 'Let us talk first'), [null, null]);
  assert.deepEqual(readGroupReply(group, '1. How do pipelines run? → Hourly'), [null, null]);
  assert.equal(groupReply({ ...group, title: '' }, ['Manually', 'Both']).split('\n')[0], '1. How do pipelines run? → Manually');
  assert.equal(parseChoiceGroup('{"questions":[{"options":["a","b"]}]}'), null);
  assert.equal(parseChoiceGroup('{"question":"q","options":["a","b"]}'), null); // a single question is not a group
  assert.equal((parseChoiceGroup(JSON.stringify({ questions: Array.from({ length: 14 }, (_, i) => ({ question: `q${i}`, options: ['a', 'b'] })) })) as ChoiceGroup).questions.length, 10);
});
