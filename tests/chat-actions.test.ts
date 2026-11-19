// Choices and approval blocks of a chat answer: what makes them valid, and the reply an approval sends.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approvalReply, parseApproval, parseChoices } from '../app/src/chat-action-spec.ts';

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
