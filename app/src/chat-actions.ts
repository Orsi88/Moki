// Clickable answers in the chat: a ```choices block becomes one button per option (the person may still write
// freely), an ```approval block shows exactly what will be approved with Approve and Decline. A click sends the
// pick as the person's next message; the buttons lock at once (no double click) and, once a later message answers
// the block (also after reopening), show what was chosen. A block that is not valid stays as code.

import { t } from './i18n';
import { approvalReply, parseApproval, parseChoices } from './chat-action-spec';

export { parseApproval, parseChoices } from './chat-action-spec';

// `answer`: the person's message right after this answer, if any; `onReply`: sends a pick (null while not possible).
export function dressActions(root: HTMLElement, answer: string | undefined, onReply: ((text: string) => void) | null): void {
  const words = { approved: t('Approved'), declined: t('Declined') };
  for (const pre of root.querySelectorAll<HTMLElement>('pre[data-lang="choices"]:not([data-action]), pre[data-lang="approval"]:not([data-action])')) {
    const source = pre.querySelector('code')?.textContent ?? '';
    const box = document.createElement('div');
    if (pre.dataset.lang === 'choices') {
      const spec = parseChoices(source);
      if (!spec) { pre.dataset.action = 'invalid'; continue; }
      box.className = 'chat-choice';
      if (spec.question) { const q = document.createElement('p'); q.textContent = spec.question; box.append(q); }
      const row = document.createElement('div');
      row.className = 'chat-choice-options';
      for (const option of spec.options) row.append(button(option, option));
      box.append(row);
    } else {
      const spec = parseApproval(source);
      if (!spec) { pre.dataset.action = 'invalid'; continue; }
      box.className = 'chat-approval';
      const title = document.createElement('p');
      title.className = 'chat-approval-title';
      title.textContent = t('Waiting for your approval: {title}', { title: spec.title });
      const list = document.createElement('ul');
      for (const item of spec.items) { const li = document.createElement('li'); li.textContent = item; list.append(li); }
      const row = document.createElement('div');
      row.className = 'chat-choice-options';
      row.append(button(t('Approve'), approvalReply(true, spec.title, words), 'approve'), button(t('Decline'), approvalReply(false, spec.title, words), 'decline'));
      box.append(title, list, row);
    }
    pre.dataset.action = 'done';
    pre.replaceWith(box);
  }
  // The state of every block of this answer: answered (its pick marked), or open to a click.
  for (const btn of root.querySelectorAll<HTMLButtonElement>('.chat-choice button, .chat-approval button')) {
    const reply = btn.dataset.reply ?? '';
    const chosen = answer !== undefined && answer.trim() === reply;
    btn.classList.toggle('chosen', chosen);
    btn.setAttribute('aria-pressed', String(chosen));
    btn.disabled = answer !== undefined || !onReply || btn.dataset.sent === '1';
    btn.onclick = () => {
      if (btn.disabled || !onReply) return;
      // Lock every button of this block at once: a second click sends nothing.
      for (const other of btn.parentElement?.querySelectorAll('button') ?? []) { (other as HTMLButtonElement).disabled = true; (other as HTMLElement).dataset.sent = '1'; }
      btn.classList.add('chosen');
      onReply(reply);
    };
  }
}

function button(label: string, reply: string, tone = ''): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `chat-choice-button${tone ? ` ${tone}` : ''}`;
  btn.textContent = label;
  btn.dataset.reply = reply;
  return btn;
}
