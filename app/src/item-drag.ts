// Dragging a skill or an agent of the project panel onto an AI terminal. Pure, so it is tested without the screen.
// The payload names only the item ({ project, kind, name }); the main process still checks that name against the
// project's list and takes the path from there, so nothing dragged can carry a path or free text to the terminal.

export const ITEM_DRAG = 'application/x-moki-item';

export interface DraggedItem { project: string; kind: 'skill' | 'agent'; name: string }

// A drag's data can only be read at the drop, not while it is over a target; so the item being dragged is kept here
// from dragstart to dragend (one window, one drag at a time), to decide whether a terminal accepts it.
export const dragging: { current: DraggedItem | null } = { current: null };

export const itemPayload = (item: DraggedItem): string => JSON.stringify(item);

export function parseItem(raw: string): DraggedItem | null {
  try {
    const v: unknown = JSON.parse(raw);
    if (!v || typeof v !== 'object') return null;
    const { project, kind, name } = v as Record<string, unknown>;
    if (typeof project !== 'string' || !project || typeof name !== 'string' || !name || (kind !== 'skill' && kind !== 'agent')) return null;
    return { project, kind, name };
  } catch { return null; }
}

// While dragging over a terminal of `project`: only our own type, and only an item of that same project.
export const acceptsItem = (types: readonly string[], project: string, current: DraggedItem | null = dragging.current): boolean =>
  types.includes(ITEM_DRAG) && current?.project === project;

// At the drop: the target to send ({ kind, name }) or null when the data is not one of ours or is from another project.
export function droppedItem(raw: string, project: string): { kind: 'skill' | 'agent'; name: string } | null {
  const item = parseItem(raw);
  return item && item.project === project ? { kind: item.kind, name: item.name } : null;
}
