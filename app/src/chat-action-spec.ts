// What makes a ```choices or ```approval block of a chat answer (chat-actions.ts shows it). No app imports, so tests
// read it directly.
//   choices:  {"question": "...", "options": ["...", "..."]}         a closed question: one button per option
//             {"title": "...", "questions": [{"question", "options"}, ...], "submit": "..."}
//                                                                    several decisions, answered together
//   approval: {"title": "...", "items": ["exactly what will change"]}  a step that waits for the person's approval

export interface Choices { question: string; options: string[] }
export interface ChoiceGroup { title: string; questions: Choices[]; submit: string }
export interface Approval { title: string; items: string[] }

const MAX_QUESTIONS = 10;
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
// On one line: a group's answer is read back line by line.
const line = (v: unknown, max: number) => text(v, max).replace(/\s+/g, ' ');
const read = (source: string): Record<string, unknown> | null => {
  try { const v: unknown = JSON.parse(source); return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null; } catch { return null; }
};
const question = (d: Record<string, unknown> | null, clean = text): Choices | null => {
  const options = Array.isArray(d?.options) ? [...new Set(d.options.map((o) => clean(o, 200)).filter(Boolean))].slice(0, 8) : [];
  return d && options.length >= 2 ? { question: clean(d.question, 500), options } : null;
};

export const parseChoices = (source: string): Choices | null => question(read(source));

// A block with "questions" is a group; each of its questions needs its text.
export function parseChoiceGroup(source: string): ChoiceGroup | null {
  const d = read(source);
  if (!Array.isArray(d?.questions)) return null;
  const questions = d.questions.map((q) => question(q && typeof q === 'object' && !Array.isArray(q) ? q as Record<string, unknown> : null, line))
    .filter((q): q is Choices => Boolean(q?.question)).slice(0, MAX_QUESTIONS);
  return questions.length ? { title: line(d.title, 300), questions, submit: line(d.submit, 80) } : null;
}

export function parseApproval(source: string): Approval | null {
  const d = read(source);
  const items = Array.isArray(d?.items) ? d.items.map((i) => text(i, 500)).filter(Boolean).slice(0, 20) : [];
  const title = text(d?.title, 300);
  return d && title && items.length ? { title, items } : null;
}

// The message a pick sends, and how a later message is recognized as that pick (also after the conversation is
// reopened): the option itself for a question, "Approved: <title>" / "Declined: <title>" for an approval, and one
// numbered line per question for a group.
export const approvalReply = (approved: boolean, title: string, words: { approved: string; declined: string }) =>
  `${approved ? words.approved : words.declined}: ${title}`;

const answerLine = (q: Choices, i: number) => `${i + 1}. ${q.question} → `;
export const groupReply = (g: ChoiceGroup, picks: string[]) =>
  [...(g.title ? [`${g.title}:`] : []), ...g.questions.map((q, i) => `${answerLine(q, i)}${picks[i]}`)].join('\n');
export function readGroupReply(g: ChoiceGroup, answer: string): (string | null)[] {
  const lines = answer.split('\n').map((l) => l.trim());
  return g.questions.map((q, i) => {
    const pick = lines.find((l) => l.startsWith(answerLine(q, i)))?.slice(answerLine(q, i).length);
    return pick && q.options.includes(pick) ? pick : null;
  });
}
