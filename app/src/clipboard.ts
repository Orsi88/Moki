// Copying text. The Moki window refuses every browser permission, the clipboard's included, so navigator.clipboard
// fails there without a word: the desktop app copies through its main process (service.copyText). Where that call
// does not exist (the IDE panel's webview, a browser), the browser's clipboard is used.

import { api } from './api';

export async function copyText(text: string): Promise<void> {
  if (window.qa) {
    try { if (await api.copyText(text)) return; } catch { /* not the desktop app: the browser's clipboard */ }
  }
  await navigator.clipboard.writeText(text);
}
