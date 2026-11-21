// Clickable answers in the chat: a ```choices block becomes one button per option (the person may still write
// freely), or, with several questions, one group of options per question and a single button that sends them all; an
// ```approval block shows exactly what will be approved with Approve and Decline. A click sends the pick as the
// person's next message; the controls lock at once (no double click) and, once a later message answers the block
// (also after reopening), show what was chosen. A block that is not valid stays as code.

import { t } from './i18n';
import { approvalReply, groupReply, parseApproval, parseChoiceGroup, parseChoices, readGroupReply, type ChoiceGroup } from './chat-action-spec';

export { parseApproval, parseChoiceGroup, parseChoices } from './chat-action-spec';

const groups = new WeakMap<HTMLElement, ChoiceGroup>(); // a drawn group and the block it came from
let drawn = 0; // a name for each group's radio sets, unique in the window

// `answer`: the person's message right after this answer, if any; `onReply`: sends a pick (null while not possible).
export function dressActions(root: HTMLElement, answer: string | undefined, onReply: ((text: string) => void) | null): void {
  const words = { approved: t('Approved'), declined: t('Declined') };
  for (const pre of root.querySelectorAll<HTMLElement>('pre[data-lang="choices"]:not([data-action]), pre[data-lang="approval"]:not([data-action])')) {
    const source = pre.querySelector('code')?.textContent ?? '';
    let box: HTMLElement;
    if (pre.dataset.lang === 'choices') {
      const several = parseChoiceGroup(source);
      const spec = several ? null : parseChoices(source);
      if (several) box = group(several);
      else if (!spec) { pre.dataset.action = 'invalid'; continue; }
      else {
        box = document.createElement('div');
        box.className = 'chat-choice';
        if (spec.question) box.append(paragraph(spec.question));
        const row = document.createElement('div');
        row.className = 'chat-choice-options';
        for (const option of spec.options) row.append(button(option, option));
        box.append(row);
      }
    } else {
      const spec = parseApproval(source);
      if (!spec) { pre.dataset.action = 'invalid'; continue; }
      box = document.createElement('div');
      box.className = 'chat-approval';
      const list = document.createElement('ul');
      for (const item of spec.items) { const li = document.createElement('li'); li.textContent = item; list.append(li); }
      const row = document.createElement('div');
      row.className = 'chat-choice-options';
      row.append(button(t('Approve'), approvalReply(true, spec.title, words), 'approve'), button(t('Decline'), approvalReply(false, spec.title, words), 'decline'));
      box.append(paragraph(t('Waiting for your approval: {title}', { title: spec.title }), 'chat-approval-title'), list, row);
    }
    pre.dataset.action = 'done';
    pre.replaceWith(box);
  }
  // The state of every block of this answer: answered (its pick marked), or open to a click.
  for (const btn of root.querySelectorAll<HTMLButtonElement>('button.chat-choice-button')) {
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
  for (const box of root.querySelectorAll<HTMLElement>('.chat-choice-group')) {
    const spec = groups.get(box);
    if (spec) groupState(box, spec, answer, onReply);
  }
}

// A group: each question with its options as radio buttons, then one button that sends every answer together.
function group(spec: ChoiceGroup): HTMLElement {
  const box = document.createElement('div');
  box.className = 'chat-choice chat-choice-group';
  if (spec.title) box.append(paragraph(spec.title, 'chat-choice-title'));
  const name = `chat-choice-${++drawn}`;
  spec.questions.forEach((q, i) => {
    const set = document.createElement('fieldset');
    set.className = 'chat-choice-question';
    const legend = document.createElement('legend');
    legend.textContent = `${i + 1}. ${q.question}`;
    set.append(legend);
    for (const option of q.options) {
      const label = document.createElement('label');
      label.className = 'chat-choice-radio';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `${name}-${i}`;
      input.value = option;
      const span = document.createElement('span');
      span.textContent = option;
      label.append(input, span);
      set.append(label);
    }
    box.append(set);
  });
  const submit = document.createElement('button');
  submit.type = 'button';
  submit.className = 'chat-choice-submit';
  submit.textContent = spec.submit || t('Send answers');
  box.append(submit);
  groups.set(box, spec);
  return box;
}

function groupState(box: HTMLElement, spec: ChoiceGroup, answer: string | undefined, onReply: ((text: string) => void) | null): void {
  const sets = [...box.querySelectorAll<HTMLFieldSetElement>('fieldset')];
  const submit = box.querySelector<HTMLButtonElement>('.chat-choice-submit');
  if (!submit) return;
  const picked = () => sets.map((set) => set.querySelector<HTMLInputElement>('input:checked')?.value ?? '');
  if (answer !== undefined) {
    // Answered: the picks the next message holds (none when the person answered in their own words).
    const picks = readGroupReply(spec, answer);
    sets.forEach((set, i) => { for (const input of set.querySelectorAll('input')) input.checked = input.value === picks[i]; });
  }
  const locked = answer !== undefined || !onReply || box.dataset.sent === '1';
  sets.forEach((set) => { set.disabled = locked; });
  const update = () => {
    const ready = picked().every(Boolean);
    submit.disabled = locked || !ready;
    submit.title = locked || ready ? '' : t('Answer every question first.');
  };
  update();
  box.onchange = update;
  submit.onclick = () => {
    const picks = picked();
    if (submit.disabled || !onReply || !picks.every(Boolean)) return;
    box.dataset.sent = '1';
    sets.forEach((set) => { set.disabled = true; });
    submit.disabled = true;
    onReply(groupReply(spec, picks));
  };
}

function paragraph(text: string, className = ''): HTMLParagraphElement {
  const p = document.createElement('p');
  if (className) p.className = className;
  p.textContent = text;
  return p;
}

function button(label: string, reply: string, tone = ''): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `chat-choice-button${tone ? ` ${tone}` : ''}`;
  btn.textContent = label;
  btn.dataset.reply = reply;
  return btn;
}
