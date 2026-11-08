// Tabs in groups and split views (app/src/tab-groups.ts): every terminal opens a group, its deliverables join it,
// each view shows one group with its own tabs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GENERAL, addTerminal, arrange, close, colorGroup, dropGroup, emptyBoard, fileKey, focus, focusedKey, freshIn, groupOf,
  moveToGroup, moveToPane, newGroup, open, parseBoard, prune, rename, renameGroup, show, showGroup, tabsOfGroup, tabsOfPane, termKey,
} from '../app/src/tab-groups.ts';

test('each terminal opens its own group, with its own color; a file opened by hand joins the focused view\'s group', () => {
  let b = addTerminal(emptyBoard(), 't1-1', 'Claude Code · Triagem');
  b = addTerminal(b, 't1-2', 'Codex · Revisão');
  assert.deepEqual(b.groups.map((g) => g.name), ['', 'Claude Code · Triagem', 'Codex · Revisão']);
  assert.notEqual(groupOf(b, 'g-t1-1')?.color, groupOf(b, 'g-t1-2')?.color);
  assert.equal(focusedKey(b), termKey('t1-2'), 'the new terminal is in front');
  b = open(b, fileKey('context/rules.md'));
  assert.equal(b.tabs[fileKey('context/rules.md')].group, 'g-t1-2');
  assert.deepEqual(tabsOfPane(b, 0), [termKey('t1-2'), fileKey('context/rules.md')], 'one view shows one group: only its tabs');
  // Nothing open yet: General.
  assert.equal(open(emptyBoard(), fileKey('a.md')).tabs[fileKey('a.md')].group, GENERAL);
});

test('a deliverable opens in its terminal\'s group without taking the screen, marked new until seen', () => {
  let b = addTerminal(emptyBoard(), 't1-1', 'Triagem');
  b = addTerminal(b, 't1-2', 'Revisão'); // the view now shows Revisão
  b = open(b, fileKey('runs/r1/outputs/erros.xlsx'), { group: 'g-t1-1', background: true });
  assert.equal(focusedKey(b), termKey('t1-2'), 'what you look at stays');
  assert.equal(freshIn(b, 'g-t1-1'), 1);
  b = showGroup(b, 'g-t1-1');
  assert.deepEqual(tabsOfPane(b, 0), [termKey('t1-1'), fileKey('runs/r1/outputs/erros.xlsx')]);
  b = show(b, fileKey('runs/r1/outputs/erros.xlsx'));
  assert.equal(freshIn(b, 'g-t1-1'), 0, 'seen');
});

test('split: the same group in two views (terminal | file), or another group in each', () => {
  let b = addTerminal(emptyBoard(), 't1-1', 'Triagem');
  b = open(b, fileKey('erros.md'));
  b = addTerminal(b, 't1-2', 'Revisão');
  b = showGroup(b, 'g-t1-1');
  b = arrange(b, '2');
  assert.equal(b.panes.length, 2);
  assert.equal(b.panes[1].group, 'g-t1-2', 'a new view shows a group not on screen yet');
  // Case 2: different groups side by side.
  assert.deepEqual(tabsOfPane(b, 0), [termKey('t1-1'), fileKey('erros.md')]);
  assert.deepEqual(tabsOfPane(b, 1), [termKey('t1-2')]);
  // Case 1: the right view shows Triagem too, and the file moves there: terminal left, file right.
  b = showGroup(b, 'g-t1-1', 1);
  b = moveToPane(b, fileKey('erros.md'), 1);
  assert.deepEqual(tabsOfPane(b, 0), [termKey('t1-1')]);
  assert.deepEqual(tabsOfPane(b, 1), [fileKey('erros.md')]);
  assert.equal(b.focus, 1);
  b = focus(b, 0);
  assert.equal(focusedKey(b), termKey('t1-1'));
  // Back to one view: the tabs return to their group's view.
  b = arrange(b, '1');
  assert.deepEqual(tabsOfPane(b, 0), [termKey('t1-1'), fileKey('erros.md')]);
});

test('dragging a terminal into a view of another group takes its group along; a file joins the view\'s group', () => {
  let b = addTerminal(emptyBoard(), 't1-1', 'A');
  b = addTerminal(b, 't1-2', 'B');
  b = arrange(b, '2'); // view 0: B, view 1: A
  assert.equal(b.panes[1].group, 'g-t1-1');
  b = moveToPane(b, termKey('t1-2'), 1);
  assert.equal(b.panes[1].group, 'g-t1-2');
  assert.equal(b.tabs[termKey('t1-2')].group, 'g-t1-2');
  b = open(b, fileKey('x.md')); // focused view 1: group B
  b = moveToPane(b, fileKey('x.md'), 0);
  assert.equal(b.tabs[fileKey('x.md')].group, b.panes[0].group);
});

test('groups: rename, color, move a file by hand, new group; closing tabs and dropping an empty group', () => {
  let b = addTerminal(emptyBoard(), 't1-1', 'A');
  b = renameGroup(b, 'g-t1-1', '  Aprovação  ');
  b = colorGroup(b, 'g-t1-1', 'pink');
  assert.deepEqual([groupOf(b, 'g-t1-1')?.name, groupOf(b, 'g-t1-1')?.color], ['Aprovação', 'pink']);
  assert.equal(colorGroup(b, 'g-t1-1', 'gold' as never), b, 'unknown colors are refused');
  b = open(b, fileKey('a.md'));
  const made = newGroup(b, 'Licença');
  b = moveToGroup(made.board, fileKey('a.md'), made.id);
  assert.deepEqual(tabsOfGroup(b, made.id), [fileKey('a.md')]);
  assert.equal(moveToGroup(b, termKey('t1-1'), made.id), b, 'a terminal stays in its own group');
  assert.equal(dropGroup(b, made.id), b, 'a group with tabs stays');
  b = close(b, fileKey('a.md'));
  b = dropGroup(b, made.id);
  assert.equal(groupOf(b, made.id), undefined);
  b = close(b, termKey('t1-1'));
  assert.equal(b.panes[0].active, null);
});

test('closing the active tab shows its neighbour; a renamed file keeps its place', () => {
  let b = open(emptyBoard(), fileKey('a.md'));
  b = open(b, fileKey('b.md'));
  b = open(b, fileKey('c.md'));
  b = show(b, fileKey('b.md'));
  b = close(b, fileKey('b.md'));
  assert.equal(focusedKey(b), fileKey('c.md'));
  b = rename(b, fileKey('c.md'), fileKey('d.md'));
  assert.deepEqual(b.order, [fileKey('a.md'), fileKey('d.md')]);
  assert.equal(focusedKey(b), fileKey('d.md'));
});

test('a saved board comes back checked, and loses what no longer exists', () => {
  let b = addTerminal(emptyBoard(), 't1-1', 'A');
  b = open(b, fileKey('a.md'));
  b = arrange(b, '2');
  const back = parseBoard(JSON.stringify(b));
  assert.deepEqual(back.order, b.order);
  assert.equal(back.arrangement, '2');
  const pruned = prune(back, new Set([fileKey('a.md')]));
  assert.equal(groupOf(pruned, 'g-t1-1')?.id, 'g-t1-1', 'the group stays while it has a tab');
  assert.deepEqual(prune(back, new Set()).groups.map((g) => g.id), [GENERAL]);
  for (const raw of [null, 'nope', '{}', JSON.stringify({ ...b, arrangement: '9' })]) assert.deepEqual(parseBoard(raw), emptyBoard());
});
