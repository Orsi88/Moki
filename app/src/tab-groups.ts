// The tabs of a project, in groups and split views. Every terminal opens its own group (its name and color, like a
// browser's tab groups); the deliverables of the runs it creates open in that group. Files opened by hand join the
// group of the focused view, or "General". The main area splits into up to 4 views; each view shows one group with
// its own tabs, so the same group can be in two views (a terminal on one side, the file being reviewed on the other)
// or each view can show another group. A tab is in one view at a time. Pure functions on a plain object (a Board):
// Workspace keeps the files and terminals, this keeps where they show. Saved per project (prefs), without contents.

export type TabKey = string; // 'file:<path>' | 'term:<id>' | 'graph'
export const fileKey = (path: string): TabKey => `file:${path}`;
export const termKey = (id: string): TabKey => `term:${id}`;
export const GRAPH: TabKey = 'graph';
export const GENERAL = 'general';

// Chrome-like group colors; the CSS gives each one a light and a dark shade.
export const GROUP_COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'] as const;
export type GroupColor = (typeof GROUP_COLORS)[number];
export const ARRANGEMENTS = ['1', '2', '2r', '3', '4'] as const; // one; side by side; stacked; one + two stacked; 2×2
export type Arrangement = (typeof ARRANGEMENTS)[number];
export const PANES: Record<Arrangement, number> = { 1: 1, 2: 2, '2r': 2, 3: 3, 4: 4 };

export interface Group { id: string; name: string; color: GroupColor; terminal?: string }
export interface Pane { group: string; active: TabKey | null }
export interface Placement { group: string; pane?: number; fresh?: boolean } // pane: the view it was put in; fresh: new, not seen yet
export interface Board {
  groups: Group[];
  tabs: Record<TabKey, Placement>;
  order: TabKey[]; // the order tabs were opened (the order they show in)
  panes: Pane[];
  arrangement: Arrangement;
  focus: number; // the view the next tab opens in
  split: { x: number; y: number }; // divider positions, in % of the area
}

const general = (): Group => ({ id: GENERAL, name: '', color: 'grey' });
export const emptyBoard = (): Board => ({ groups: [general()], tabs: {}, order: [], panes: [{ group: GENERAL, active: null }], arrangement: '1', focus: 0, split: { x: 50, y: 50 } });

export const groupOf = (b: Board, id: string): Group | undefined => b.groups.find((g) => g.id === id);
const nextColor = (b: Board): GroupColor => {
  const used = new Set(b.groups.filter((g) => g.id !== GENERAL).map((g) => g.color));
  return GROUP_COLORS.find((c) => c !== 'grey' && !used.has(c)) ?? GROUP_COLORS[(b.groups.length - 1) % (GROUP_COLORS.length - 1)];
};

// The views showing a group, in order; its tabs without a view of their own show in the first one.
const panesOf = (b: Board, group: string): number[] => b.panes.flatMap((p, i) => (p.group === group ? [i] : []));
export function tabsOfPane(b: Board, pane: number): TabKey[] {
  const p = b.panes[pane];
  if (!p) return [];
  const first = panesOf(b, p.group)[0];
  return b.order.filter((k) => {
    const at = b.tabs[k];
    if (!at || at.group !== p.group) return false;
    const home = at.pane !== undefined && b.panes[at.pane]?.group === p.group ? at.pane : first;
    return home === pane;
  });
}
export const tabsOfGroup = (b: Board, group: string): TabKey[] => b.order.filter((k) => b.tabs[k]?.group === group);
export const paneOfTab = (b: Board, key: TabKey): number | undefined => b.panes.findIndex((_, i) => tabsOfPane(b, i).includes(key)) >= 0
  ? b.panes.findIndex((_, i) => tabsOfPane(b, i).includes(key)) : undefined;
export const focusedKey = (b: Board): TabKey | null => b.panes[b.focus]?.active ?? null;

// A pane's active tab must be one of its tabs; otherwise its last one.
function settle(b: Board): Board {
  const panes = b.panes.map((p, i) => {
    const own = tabsOfPane(b, i);
    return own.includes(p.active ?? '') ? p : { ...p, active: own[own.length - 1] ?? null };
  });
  return { ...b, panes, focus: Math.min(b.focus, panes.length - 1) };
}
const seen = (b: Board, key: TabKey | null): Board => (key && b.tabs[key]?.fresh ? { ...b, tabs: { ...b.tabs, [key]: { ...b.tabs[key], fresh: false } } } : b);

// A new terminal: its own group, shown in the focused view with the terminal active.
export function addTerminal(b: Board, id: string, name: string): Board {
  const key = termKey(id);
  if (b.tabs[key]) return show(b, key);
  const groupId = `g-${id}`;
  const group: Group = groupOf(b, groupId) ?? { id: groupId, name, color: nextColor(b), terminal: id };
  const groups = groupOf(b, groupId) ? b.groups : [...b.groups, group];
  const panes = b.panes.map((p, i) => (i === b.focus ? { group: groupId, active: key } : p));
  return settle({ ...b, groups, panes, tabs: { ...b.tabs, [key]: { group: groupId, pane: b.focus } }, order: [...b.order, key] });
}

// Opens a tab, or shows it where it is. `group`: where a new tab goes (default: the focused view's group). `background`:
// it joins its group without taking the focused view (a deliverable an AI just wrote), marked new.
export function open(b: Board, key: TabKey, options: { group?: string; background?: boolean } = {}): Board {
  if (b.tabs[key]) return options.background ? b : show(b, key);
  const group = options.group && groupOf(b, options.group) ? options.group : b.panes[b.focus]?.group ?? GENERAL;
  const views = panesOf(b, group);
  const pane = views.includes(b.focus) ? b.focus : views[0];
  const next: Board = { ...b, tabs: { ...b.tabs, [key]: { group, ...(pane !== undefined ? { pane } : {}), ...(options.background ? { fresh: true } : {}) } }, order: [...b.order, key] };
  if (options.background) return settle(next);
  if (pane === undefined) return show(next, key);
  return settle({ ...next, panes: next.panes.map((p, i) => (i === pane ? { ...p, active: key } : p)), focus: pane });
}

// Brings a tab to the front: in the view that shows it, or in the focused view (which then shows its group).
export function show(b: Board, key: TabKey): Board {
  const at = b.tabs[key];
  if (!at) return b;
  const where = paneOfTab(b, key);
  if (where !== undefined) return seen(settle({ ...b, panes: b.panes.map((p, i) => (i === where ? { ...p, active: key } : p)), focus: where }), key);
  const panes = b.panes.map((p, i) => (i === b.focus ? { group: at.group, active: key } : p));
  return seen(settle({ ...b, panes, tabs: { ...b.tabs, [key]: { ...at, pane: b.focus } } }), key);
}

export const focus = (b: Board, pane: number): Board => (pane >= 0 && pane < b.panes.length ? seen({ ...b, focus: pane }, b.panes[pane].active) : b);

// A view shows another group: the tab it had open there, or its last tab.
export function showGroup(b: Board, group: string, pane = b.focus): Board {
  if (!groupOf(b, group) || !b.panes[pane]) return b;
  const panes = b.panes.map((p, i) => (i === pane ? { group, active: null } : p));
  return seen(settle({ ...b, panes, focus: pane }), settle({ ...b, panes }).panes[pane].active);
}

export function close(b: Board, key: TabKey): Board {
  if (!b.tabs[key]) return b;
  const { [key]: _gone, ...tabs } = b.tabs;
  const i = b.order.indexOf(key);
  const order = b.order.filter((k) => k !== key);
  // The view that had it active goes to the neighbour tab, as tabs do.
  const panes = b.panes.map((p, n) => {
    if (p.active !== key) return p;
    const own = tabsOfPane({ ...b, tabs, order }, n);
    const near = own.find((k) => b.order.indexOf(k) > i) ?? own[own.length - 1] ?? null;
    return { ...p, active: near };
  });
  return settle({ ...b, tabs, order, panes });
}

// A file renamed or moved: its tab keeps its place.
export function rename(b: Board, from: TabKey, to: TabKey): Board {
  if (!b.tabs[from] || from === to) return b;
  const { [from]: at, ...rest } = b.tabs;
  return { ...b, tabs: { ...rest, [to]: at }, order: b.order.map((k) => (k === from ? to : k)), panes: b.panes.map((p) => (p.active === from ? { ...p, active: to } : p)) };
}

// Into another view (dragged there): a file joins the group that view shows; a terminal takes its group with it.
export function moveToPane(b: Board, key: TabKey, pane: number): Board {
  const at = b.tabs[key];
  const target = b.panes[pane];
  if (!at || !target) return b;
  if (key.startsWith('term:') && target.group !== at.group) {
    const panes = b.panes.map((p, i) => (i === pane ? { group: at.group, active: key } : p));
    return settle({ ...b, panes, tabs: { ...b.tabs, [key]: { ...at, pane } }, focus: pane });
  }
  const tabs = { ...b.tabs, [key]: { ...at, group: target.group, pane } };
  return seen(settle({ ...b, tabs, panes: b.panes.map((p, i) => (i === pane ? { ...p, active: key } : p)), focus: pane }), key);
}

// Into another group by hand (the tab's menu). A new group gets a name and the next color.
export function moveToGroup(b: Board, key: TabKey, group: string): Board {
  const at = b.tabs[key];
  if (!at || !groupOf(b, group) || key.startsWith('term:')) return b;
  return settle({ ...b, tabs: { ...b.tabs, [key]: { group } } });
}
export function newGroup(b: Board, name: string): { board: Board; id: string } {
  const id = `g-${Date.now().toString(36)}-${b.groups.length}`;
  return { board: { ...b, groups: [...b.groups, { id, name: name.trim().slice(0, 40), color: nextColor(b) }] }, id };
}
export const renameGroup = (b: Board, id: string, name: string): Board => ({ ...b, groups: b.groups.map((g) => (g.id === id && id !== GENERAL ? { ...g, name: name.trim().slice(0, 40) || g.name } : g)) });
export const colorGroup = (b: Board, id: string, color: GroupColor): Board => (id === GENERAL || !GROUP_COLORS.includes(color) ? b
  : { ...b, groups: b.groups.map((g) => (g.id === id ? { ...g, color } : g)) });
// A group goes (its tabs were closed): the views that showed it show General.
export function dropGroup(b: Board, id: string): Board {
  if (id === GENERAL || tabsOfGroup(b, id).length) return b;
  return settle({ ...b, groups: b.groups.filter((g) => g.id !== id), panes: b.panes.map((p) => (p.group === id ? { group: GENERAL, active: null } : p)) });
}

// The layout: more views show the groups not on screen yet; fewer views keep the focused one.
export function arrange(b: Board, arrangement: Arrangement): Board {
  if (!ARRANGEMENTS.includes(arrangement)) return b;
  const n = PANES[arrangement];
  let panes = b.panes.slice(0, n);
  if (b.focus >= n) panes = [b.panes[b.focus], ...b.panes.filter((_, i) => i !== b.focus)].slice(0, n);
  const shown = new Set(panes.map((p) => p.group));
  const waiting = b.groups.filter((g) => !shown.has(g.id) && tabsOfGroup(b, g.id).length).map((g) => g.id);
  while (panes.length < n) panes.push({ group: waiting.shift() ?? panes[panes.length - 1]?.group ?? GENERAL, active: null });
  const keep = new Set(panes.map((_, i) => i));
  const tabs = Object.fromEntries(Object.entries(b.tabs).map(([k, at]) => [k, at.pane !== undefined && !keep.has(at.pane) ? { group: at.group, ...(at.fresh ? { fresh: true } : {}) } : at]));
  return settle({ ...b, arrangement, panes, tabs, focus: Math.min(b.focus, n - 1) });
}
export const setSplit = (b: Board, x: number, y: number): Board => ({ ...b, split: { x: Math.min(80, Math.max(20, x)), y: Math.min(80, Math.max(20, y)) } });

// What a group still has that is new (the dot on its chip).
export const freshIn = (b: Board, group: string): number => tabsOfGroup(b, group).filter((k) => b.tabs[k]?.fresh).length;

// Only tabs that still exist: the rest is dropped (a terminal closed elsewhere, a file deleted); empty terminal-less
// groups go too. Used after restoring a saved board.
export function prune(b: Board, alive: Set<TabKey>): Board {
  const tabs = Object.fromEntries(Object.entries(b.tabs).filter(([k]) => alive.has(k)));
  const order = b.order.filter((k) => alive.has(k));
  const groups = b.groups.filter((g) => g.id === GENERAL || order.some((k) => tabs[k]?.group === g.id));
  const ids = new Set(groups.map((g) => g.id));
  return settle({ ...b, tabs, order, groups, panes: b.panes.map((p) => (ids.has(p.group) ? p : { group: GENERAL, active: null })) });
}

// Saved boards are read back carefully (another version, a hand edit): anything odd starts over.
export function parseBoard(raw: string | null): Board {
  try {
    const v = JSON.parse(raw ?? '') as Board;
    if (!v || !Array.isArray(v.groups) || !Array.isArray(v.order) || !Array.isArray(v.panes) || typeof v.tabs !== 'object' || !ARRANGEMENTS.includes(v.arrangement)) return emptyBoard();
    const groups = v.groups.filter((g) => typeof g?.id === 'string' && typeof g.name === 'string' && GROUP_COLORS.includes(g.color));
    if (!groups.some((g) => g.id === GENERAL)) groups.unshift(general());
    const panes = v.panes.slice(0, PANES[v.arrangement]).map((p) => ({ group: groups.some((g) => g.id === p?.group) ? p.group : GENERAL, active: typeof p?.active === 'string' ? p.active : null }));
    while (panes.length < PANES[v.arrangement]) panes.push({ group: GENERAL, active: null });
    const tabs = Object.fromEntries(Object.entries(v.tabs).filter(([k, at]) => typeof k === 'string' && groups.some((g) => g.id === at?.group))
      .map(([k, at]) => [k, { group: at.group, ...(Number.isInteger(at.pane) && at.pane! < panes.length ? { pane: at.pane } : {}), ...(at.fresh ? { fresh: true } : {}) }]));
    const x = Number(v.split?.x), y = Number(v.split?.y);
    return settle({ groups, tabs, order: v.order.filter((k) => typeof k === 'string' && k in tabs), panes, arrangement: v.arrangement, focus: Number.isInteger(v.focus) ? v.focus : 0, split: { x: Number.isFinite(x) ? x : 50, y: Number.isFinite(y) ? y : 50 } });
  } catch { return emptyBoard(); }
}
