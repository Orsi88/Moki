// Live project conversations: the process survives a hidden tab; only this project's transcript is persisted.
// `onChange`: called after each change of a live conversation (text arriving, a tool call, the end of an answer), so
// the window reads it then instead of polling.
import { chatTitle, newChat, readChat, saveChat, type ChatRecord, type ChatToolCall } from './chat-store.ts';
import type { ChatEvent, ChatSession, ChatTool } from './chat.ts';

export interface ChatState { record: ChatRecord; busy: boolean; error?: string }
type Factory = (record: ChatRecord, onEvent: (event: ChatEvent) => void) => ChatSession;
interface Live { record: ChatRecord; session: ChatSession; error?: string }

export function createConversations(onChange: (dir: string, id: string) => void = () => {}) {
  const live = new Map<string, Live>();
  const key = (dir: string, id: string) => `${dir}\0${id}`;
  const snapshot = (entry: Live): ChatState => ({ record: entry.record, busy: entry.session.busy(), ...(entry.error ? { error: entry.error } : {}) });
  const persist = (dir: string, entry: Live) => {
    entry.record.updated = new Date().toISOString();
    try { saveChat(dir, entry.record); delete entry.error; }
    catch (e) { entry.error = e instanceof Error ? e.message : String(e); }
  };
  return {
    state(dir: string, id: string): ChatState {
      const entry = live.get(key(dir, id));
      if (entry) return snapshot(entry);
      // An answer cut by the app closing was saved empty: it shows as stopped.
      const record = readChat(dir, id);
      const last = record.messages.at(-1);
      if (last?.role === 'assistant' && !last.text && !last.error) last.error = 'stopped';
      return { record, busy: false };
    },
    send(dir: string, id: string | undefined, tool: ChatTool, text: string, create: Factory): ChatState {
      if (typeof text !== 'string' || !text.trim()) throw new Error('Write a message first.');
      if (text.length > 1_000_000) throw new Error('This message is too long.');
      let entry = id ? live.get(key(dir, id)) : undefined;
      if (!entry) {
        const record = id ? readChat(dir, id) : newChat(tool);
        if (record.tool !== tool) throw new Error('Start a new conversation to change the AI.');
        if (!id) saveChat(dir, record);
        const calls = new Map<string, ChatToolCall>();
        const session = create(record, (event) => {
          const current = live.get(key(dir, record.id));
          if (!current) return;
          const answer = record.messages.at(-1);
          if (event.kind === 'session') record.sessionId = event.id;
          else if (answer?.role === 'assistant') {
            if (event.kind === 'text') answer.text += event.whole && answer.text.trim() ? `\n\n${event.delta}` : event.delta;
            if (event.kind === 'tool' && !calls.has(event.id)) {
              const call: ChatToolCall = { name: event.name, summary: event.summary };
              calls.set(event.id, call);
              (answer.tools ??= []).push(call);
            }
            if (event.kind === 'tool-done') { const call = calls.get(event.id); if (call) call.ok = event.ok; }
            if (event.kind === 'turn-end') {
              if (!event.ok) answer.error = event.error || 'The AI tool stopped.';
              calls.clear();
              persist(dir, current);
            }
          }
          onChange(dir, record.id);
        });
        entry = { record, session };
        live.set(key(dir, record.id), entry);
      }
      if (entry.record.tool !== tool) throw new Error('Start a new conversation to change the AI.');
      if (entry.session.busy()) throw new Error('Wait for the answer, or stop it first.');
      const at = new Date().toISOString();
      entry.record.messages.push({ role: 'user', text, at }, { role: 'assistant', text: '', at });
      entry.record.title ||= chatTitle(text);
      try { entry.session.send(text); }
      catch (e) { entry.record.messages.splice(-2); throw e; }
      persist(dir, entry); // the question is kept even if the app closes before the answer ends
      return snapshot(entry);
    },
    stop(dir: string, id: string) { live.get(key(dir, id))?.session.stop(); },
    close(dir?: string, id?: string) {
      for (const [k, entry] of live) {
        if (dir && !k.startsWith(`${dir}\0`) || id && entry.record.id !== id) continue;
        if (entry.session.busy()) {
          const answer = entry.record.messages.at(-1);
          if (answer?.role === 'assistant') answer.error = 'stopped';
          persist(k.slice(0, k.indexOf('\0')), entry);
        }
        entry.session.close();
        live.delete(k);
      }
    },
    busy(dir: string) { return [...live].some(([k, entry]) => k.startsWith(`${dir}\0`) && entry.session.busy()); },
  };
}
