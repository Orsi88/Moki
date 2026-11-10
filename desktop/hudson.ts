// Hudson, the organizer of what runs leave behind: the AI reads the list of a project's run files (with a short
// preview of each) and answers with a plan — take a file to the project context, rename it, delete it, or keep it —
// one reason per file. The AI touches nothing: Moki shows the plan, the person approves item by item, and the
// service applies it (organizeApply). Pure: the prompt, and reading and checking the AI's answer.

export type OrganizeAction = 'context' | 'rename' | 'delete' | 'keep';
export interface OrganizeCandidate { path: string; size: number; run: string; title: string; status: string; deliverable: boolean; preview: string }
export interface OrganizeStep { path: string; do: OrganizeAction; name?: string; why: string }

const ACTIONS: OrganizeAction[] = ['context', 'rename', 'delete', 'keep'];

// A file name the plan may give: one name, no folder, no hidden file, the extension of the file it renames.
export function safeName(name: string, original: string): string | null {
  const clean = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').replace(/\s+/g, ' ').slice(0, 100);
  if (!clean || clean.startsWith('.')) return null;
  const ext = /\.[^./]+$/.exec(original)?.[0] ?? '';
  return ext && !clean.toLowerCase().endsWith(ext.toLowerCase()) ? `${clean.replace(/\.[^.]*$/, '')}${ext}` : clean;
}

export function organizePrompt(files: OrganizeCandidate[], language: string): string {
  const list = files.map((f) => [
    `- path: ${f.path}`,
    `  run: ${f.title || f.run} (${f.status})${f.deliverable ? ' — listed as a deliverable of the run' : ''}`,
    `  size: ${f.size} bytes`,
    ...(f.preview ? [`  starts with: ${JSON.stringify(f.preview)}`] : []),
  ].join('\n')).join('\n');
  return [
    'You are Hudson, who keeps a project\'s files in order. These are the files left by the AI runs of a QA project.',
    'Decide, for each file, one action:',
    '- "context": confirmed knowledge of the system worth keeping as project context (definitions, business rules, approved documentation). Only Markdown or text files.',
    '- "delete": a file nobody needs: support notes, drafts, helper data, duplicates, copies in another format, files written along the way that nobody asked for.',
    '- "rename": a deliverable worth keeping whose name does not say what it is; give "name" (a short, clear file name, in ' + language + ', same extension).',
    '- "keep": a deliverable the person asked for, or anything you are not sure about. When in doubt, keep.',
    'Never delete a file listed as a deliverable of its run unless it is clearly a duplicate. Give a short reason for each file, in ' + language + '.',
    'Answer with JSON only, no other text: {"actions":[{"path":"...","do":"context|rename|delete|keep","name":"...","why":"..."}]}',
    '',
    'The files:',
    list,
    '',
  ].join('\n');
}

// The plan in the AI's answer, kept only where it names a listed file with a known action. A file the answer leaves
// out is kept; a rename without a usable name is kept; "context" only for Markdown and text.
export function readPlan(answer: string, files: OrganizeCandidate[]): OrganizeStep[] {
  const json = /\{[\s\S]*\}/.exec(answer.replace(/^```(?:json)?\s*|\s*```$/g, ''))?.[0];
  let raw: unknown = null;
  try { raw = json ? JSON.parse(json) : null; } catch { raw = null; }
  const actions = raw && typeof raw === 'object' && Array.isArray((raw as { actions?: unknown }).actions) ? (raw as { actions: unknown[] }).actions : [];
  const known = new Map(files.map((f) => [f.path, f]));
  const plan = new Map<string, OrganizeStep>();
  for (const item of actions) {
    if (!item || typeof item !== 'object') continue;
    const { path, do: action, name, why } = item as Record<string, unknown>;
    if (typeof path !== 'string' || !known.has(path) || plan.has(path) || !ACTIONS.includes(action as OrganizeAction)) continue;
    const reason = typeof why === 'string' ? why.trim().slice(0, 300) : '';
    let step: OrganizeStep = { path, do: action as OrganizeAction, why: reason };
    if (step.do === 'rename') {
      const next = typeof name === 'string' ? safeName(name, path.split('/').pop() ?? '') : null;
      step = next && next !== path.split('/').pop() ? { ...step, name: next } : { path, do: 'keep', why: reason };
    }
    if (step.do === 'context' && !/\.(md|txt)$/i.test(path)) step = { path, do: 'keep', why: reason };
    plan.set(path, step);
  }
  return files.map((f) => plan.get(f.path) ?? { path: f.path, do: 'keep', why: '' });
}
