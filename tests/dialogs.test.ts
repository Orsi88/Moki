// A confirmation never authorizes an action before a decision; queued requests cannot accept one another.
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { alertDialog, confirmDialog, currentDialog, resolveDialog, subscribeDialogs } from '../app/src/dialogs.ts';

afterEach(() => {
  let item = currentDialog();
  while (item) { resolveDialog(item.id, false); item = currentDialog(); }
});

test('confirmations wait for an explicit decision and cancellation does not run the action', async () => {
  let actions = 0;
  const decision = confirmDialog('Delete this comment?', { danger: true });
  const operation = decision.then((accepted) => { if (accepted) actions++; });
  await Promise.resolve();
  assert.equal(actions, 0);
  const item = currentDialog();
  assert.ok(item);
  assert.equal(item.kind, 'confirm');
  assert.equal(item.options.danger, true);
  resolveDialog(item.id, false);
  await operation;
  assert.equal(actions, 0);
  assert.equal(currentDialog(), null);
});

test('accepting one confirmation resolves it once, without accepting the next queued request', async () => {
  const first = confirmDialog('First');
  const second = confirmDialog('Second');
  const one = currentDialog();
  assert.ok(one);
  resolveDialog(one.id, true);
  assert.equal(await first, true);
  const two = currentDialog();
  assert.ok(two);
  assert.equal(two.message, 'Second');
  assert.notEqual(two.id, one.id);
  resolveDialog(one.id, true); // a double click from the old frame
  assert.equal(currentDialog()?.id, two.id);
  resolveDialog(two.id, false);
  assert.equal(await second, false);
});

test('a notice is queued like a confirmation, and its message stays plain text', async () => {
  const notice = alertDialog('<script>not markup</script>\nDetails', { title: 'Result' });
  const item = currentDialog();
  assert.ok(item);
  assert.equal(item.kind, 'alert');
  assert.equal(item.message, '<script>not markup</script>\nDetails');
  assert.equal(item.options.title, 'Result');
  resolveDialog(item.id, false);
  assert.equal(await notice, undefined);
});

test('subscribers see queue changes and stop receiving them after unsubscribe', async () => {
  let changes = 0;
  const unsubscribe = subscribeDialogs(() => { changes++; });
  const decision = confirmDialog('Continue?');
  const item = currentDialog();
  assert.ok(item);
  assert.equal(changes, 1);
  unsubscribe();
  resolveDialog(item.id, true);
  await decision;
  assert.equal(changes, 1);
});
