// What a run is called in the app: its activity (state.json activity) and its scenario (desktop/run-origin.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOrigin } from '../desktop/run-origin.ts';

const labels = new Map([['investigation', 'Investigation'], ['review', 'Review user stories']]);

test('a run from an activity is named by it and by the words of its slug', () => {
  assert.deepEqual(runOrigin({ id: '20261108-1030-failure-analysis-login-error', skill: 'failure-analysis', activity: 'investigation' }, labels),
    { activity: { id: 'investigation', label: 'Investigation' }, scenario: 'login error' });
  assert.deepEqual(runOrigin({ id: '20261108-1030-requirements-to-tests-us-12', workflow: 'requirements-to-tests', activity: 'review' }, labels),
    { activity: { id: 'review', label: 'Review user stories' }, scenario: 'us 12' });
});

test('a request made straight to the AI has no activity; the app\'s tracking slug names no scenario', () => {
  assert.deepEqual(runOrigin({ id: '20261108-1030-failure-analysis-checkout-timeout', skill: 'failure-analysis' }, labels), { activity: null, scenario: 'checkout timeout' });
  assert.deepEqual(runOrigin({ id: `20261108-1030-test-design-moki-${'a'.repeat(32)}`, skill: 'test-design', activity: 'review' }, labels),
    { activity: { id: 'review', label: 'Review user stories' }, scenario: '' });
});

test('an activity that is gone still names its runs (its id); odd ids are left as they are', () => {
  assert.deepEqual(runOrigin({ id: '20261108-1030-test-design-cart', skill: 'test-design', activity: 'old-one' }, labels), { activity: { id: 'old-one', label: 'old-one' }, scenario: 'cart' });
  assert.deepEqual(runOrigin({ id: 'handmade', activity: 7 }, labels), { activity: null, scenario: 'handmade' });
});
