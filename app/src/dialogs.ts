// In-app confirmations are queued, never blocking the renderer or running an action before a decision.

export interface DialogOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface DialogRequest {
  id: number;
  kind: 'confirm' | 'alert';
  message: string;
  options: DialogOptions;
}

const pending: { request: DialogRequest; resolve: (accepted: boolean) => void }[] = [];
const listeners = new Set<() => void>();
let nextId = 0;
const notify = () => listeners.forEach((listener) => listener());

export const currentDialog = (): DialogRequest | null => pending[0]?.request ?? null;
export const subscribeDialogs = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

function request(kind: DialogRequest['kind'], message: string, options: DialogOptions): Promise<boolean> {
  return new Promise((resolve) => {
    pending.push({ request: { id: ++nextId, kind, message, options }, resolve });
    notify();
  });
}

export function confirmDialog(message: string, options: DialogOptions = {}): Promise<boolean> {
  return request('confirm', message, options);
}

export async function alertDialog(message: string, options: Pick<DialogOptions, 'title' | 'confirmLabel'> = {}): Promise<void> {
  await request('alert', message, options);
}

export function resolveDialog(id: number, accepted: boolean): void {
  if (pending[0]?.request.id !== id) return; // an old click cannot accept the next queued request
  const item = pending.shift();
  notify();
  item?.resolve(accepted);
}
