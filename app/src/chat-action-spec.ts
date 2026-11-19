// What makes a ```choices or ```approval block of a chat answer (chat-actions.ts shows it). No app imports, so tests
// read it directly.
//   choices:  {"question": "...", "options": ["...", "..."]}         a closed question: one button per option
//   approval: {"title": "...", "items": ["exactly what will change"]}  a step that waits for the person's approval

export interface Choices { question: string; options: string[] }
export interface Approval { title: string; items: string[] }

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const read = (source: string): Record<string, unknown> | null => {
  try { const v: unknown = JSON.parse(source); return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null; } catch { return null; }
};

export function parseChoices(source: string): Choices | null {
  const d = read(source);
  const options = Array.isArray(d?.options) ? [...new Set(d.options.map((o) => text(o, 200)).filter(Boolean))].slice(0, 8) : [];
  return d && options.length >= 2 ? { question: text(d.question, 500), options } : null;
}

export function parseApproval(source: string): Approval | null {
  const d = read(source);
  const items = Array.isArray(d?.items) ? d.items.map((i) => text(i, 500)).filter(Boolean).slice(0, 20) : [];
  const title = text(d?.title, 300);
  return d && title && items.length ? { title, items } : null;
}

// The message a pick sends, and how a later message is recognized as that pick (also after the conversation is
// reopened): the option itself for a question, "Approved: <title>" / "Declined: <title>" for an approval.
export const approvalReply = (approved: boolean, title: string, words: { approved: string; declined: string }) =>
  `${approved ? words.approved : words.declined}: ${title}`;
