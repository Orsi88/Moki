// Marking the items of an upload by group (a kind, or the folder an agent came from). Pure, so it is tested
// without the screen. A blocked item is never marked; clearing a group keeps the marks made outside it.

export interface Markable { kind: string; name: string; blocked?: unknown }

export const uploadKey = (i: Markable): string => `${i.kind}:${i.name}`;

const selectable = (group: Markable[]): string[] => group.filter((i) => !i.blocked).map(uploadKey);

export const allMarked = (marked: string[], group: Markable[]): boolean => {
  const keys = selectable(group);
  return keys.length > 0 && keys.every((k) => marked.includes(k));
};

export const toggleMarked = (marked: string[], group: Markable[]): string[] => {
  const keys = selectable(group);
  return allMarked(marked, group) ? marked.filter((k) => !keys.includes(k)) : [...marked, ...keys.filter((k) => !marked.includes(k))];
};
