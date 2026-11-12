// The Configurador in the app: the person says in their words what they want set up, their AI (Claude Code or Codex,
// without a terminal) answers with a plan of changes (desktop/configurator.ts), and the plan shows as a checklist in
// the same look as the quick assistants of the notes. Nothing changes until "Apply"; Moki then applies each checked
// step through the same calls the Settings screens use. In a terminal, the same agent is agents/framework/configurador.md.

import { useEffect, useRef, useState } from 'react';
import { api, type ConfigKind, type ConfigStep } from '../api';
import { t } from '../i18n';
import { defaultTool, recall } from '../prefs';
import { IconSparkle, IconX } from './Icons';

type State =
  | { status: 'idle' }
  | { status: 'running'; id: string }
  | { status: 'plan'; steps: ConfigStep[]; questions: string[]; answer: string; tool: string }
  | { status: 'applied'; results: { title: string; ok: boolean; message: string }[] }
  | { status: 'error'; error: string };

const KIND: Record<ConfigKind, string> = { routine: 'Routine', activity: 'Activity', agent: 'Agent', template: 'Template', mcp: 'MCP server', tag: 'Tag', project: 'Project' };
const toolName = (tool: string) => (tool === 'codex' ? 'Codex' : 'Claude Code');

// The button that opens the Configurador: the same yellow "✦ AI" pill as the quick assistants of the notes.
export function ConfiguratorButton({ open, onToggle, disabled }: { open: boolean; onToggle: () => void; disabled?: boolean }) {
  const name = t('Configure with AI');
  return (
    <button type="button" className={`ai-pill${open ? ' on' : ''}`} aria-pressed={open} aria-label={name} disabled={disabled}
      title={t('Say what you want set up and the Configurador prepares it for your approval')} onClick={onToggle}>
      <IconSparkle size={14} /> {t('AI')}
    </button>
  );
}

interface Props { project: string | null; projectName?: string; onApplied?: () => void; onMyAis?: () => void }

export function ConfiguratorPanel({ project, projectName, onApplied, onMyAis }: Props) {
  const [request, setRequest] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const live = useRef<State>(state);
  live.current = state;
  useEffect(() => () => { const s = live.current; if (s.status === 'running') void api.noteAssistCancel(s.id); }, []);

  const examples = project
    ? [t('A routine that checks the context folder every morning and tells me what changed'), t('An activity that reviews a user story with the requirements analyst'), t('Describe this project and give it the right tags')]
    : [t('A tag for each client and a visual template for client documents'), t('An agent that writes release notes from the delivered items'), t('Connect a read-only MCP server for every project')];

  const plan = () => {
    const text = request.trim();
    if (!text) return;
    const id = `config-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setState({ status: 'running', id });
    void api.configPlan({ id, project, request: text, prefer: defaultTool(), language: recall('qa-language') ?? 'English' }).then((answer) => {
      if (live.current.status !== 'running' || live.current.id !== id) return; // cancelled meanwhile
      if (answer.plan) {
        setChosen(new Set(answer.plan.steps.map((_, i) => i)));
        setState({ status: 'plan', ...answer.plan, tool: answer.tool ?? '' });
      } else setState({ status: 'error', error: answer.error ?? '' });
    });
  };
  const cancel = () => { if (state.status === 'running') void api.noteAssistCancel(state.id); setState({ status: 'idle' }); };
  const apply = async () => {
    if (state.status !== 'plan') return;
    setApplying(true);
    try {
      const results = await api.configApply(project, state.steps.filter((_, i) => chosen.has(i)));
      setState({ status: 'applied', results });
      if (results.some((r) => r.ok)) onApplied?.();
    } catch (e) {
      setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
    } finally { setApplying(false); }
  };
  const toggle = (i: number) => setChosen((now) => { const next = new Set(now); if (next.has(i)) next.delete(i); else next.add(i); return next; });

  return (
    <section className="note-assist configurator" aria-label={t('Configurador')} aria-busy={state.status === 'running'}>
      <div className="note-assist-head">
        <span className="note-assist-icon"><IconSparkle size={15} /></span>
        <strong>{t('Configurador')}</strong>
        <span className="muted small">· {project ? t('sets up {project} for you', { project: projectName ?? project }) : t('sets up your workspace for you')}</span>
        <span className="statusbar-spacer" />
        {(state.status === 'plan' || state.status === 'applied' || state.status === 'error') && <button type="button" className="icon-btn" onClick={() => setState({ status: 'idle' })} title={t('Close')} aria-label={t('Close')}><IconX size={14} /></button>}
      </div>

      {(state.status === 'idle' || state.status === 'running') && <>
        <textarea className="configurator-request" rows={3} maxLength={4000} value={request} disabled={state.status === 'running'} aria-label={t('What do you want to set up?')}
          placeholder={t('What do you want to set up? Say it in your words, for example: {example}', { example: examples[0] })}
          onChange={(e) => setRequest(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) plan(); }} />
        {state.status === 'idle' ? <div className="note-assist-actions">
          <span className="configurator-examples">{examples.map((ex) => <button key={ex} type="button" className="chip" onClick={() => setRequest(ex)}>{ex}</button>)}</span>
          <span className="statusbar-spacer" />
          <button type="button" className="btn btn-sm" disabled={!request.trim()} onClick={plan}>{t('Prepare the plan')}</button>
        </div> : <div className="note-assist-working" role="status">
          <span className="note-assist-spinner" aria-hidden="true" />
          <span>{t('The Configurador is preparing the plan…')}</span>
          <span className="statusbar-spacer" />
          <button type="button" className="btn btn-sm btn-ghost" onClick={cancel}>{t('Cancel')}</button>
        </div>}
      </>}

      {state.status === 'error' && <>
        <p role="alert">
          {state.error === 'no-tool'
            ? <>{t('The Configurador uses Claude Code or Codex, and neither was found on this computer.')} {onMyAis && <button type="button" className="link" onClick={onMyAis}>{t('Install in Settings › My AIs')}</button>}</>
            : <>{t('The Configurador did not answer.')} {state.error && state.error !== 'cancelled' && <span className="muted small note-assist-detail">{state.error}</span>}</>}
        </p>
        {state.error !== 'no-tool' && <div className="note-assist-actions"><span className="statusbar-spacer" /><button type="button" className="btn btn-sm" onClick={plan}>{t('Try again')}</button></div>}
      </>}

      {state.status === 'plan' && <>
        <div className="note-assist-body configurator-body">
          {state.answer && <p className="configurator-answer">{state.answer}</p>}
          {state.steps.length > 0 && <ul className="configurator-steps">
            {state.steps.map((step, i) => (
              <li key={i}>
                <label className="configurator-step">
                  <input type="checkbox" checked={chosen.has(i)} onChange={() => toggle(i)} />
                  <span className="chip configurator-kind">{t(KIND[step.kind])}</span>
                  <span className="configurator-step-text"><strong>{step.title}</strong>{step.why && <span className="muted small">{step.why}</span>}</span>
                </label>
                <details className="configurator-data"><summary className="muted small">{t('Details')}</summary><pre>{JSON.stringify(step.data, null, 2)}</pre></details>
              </li>
            ))}
          </ul>}
          {state.questions.length > 0 && <div className="configurator-questions"><strong>{t('Before more, the Configurador asks:')}</strong><ul>{state.questions.map((q) => <li key={q}>{q}</li>)}</ul></div>}
          {!state.steps.length && !state.questions.length && !state.answer && <p className="muted">{t('No change was proposed. Try saying it another way.')}</p>}
        </div>
        <div className="note-assist-actions">
          <span className="muted small">{state.tool ? `${toolName(state.tool)} · ` : ''}{t('Nothing changes until you apply. Each step goes through the same checks as the Settings screens.')}</span>
          <span className="statusbar-spacer" />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setState({ status: 'idle' })}>{state.steps.length ? t('Discard') : t('Ask again')}</button>
          {state.steps.length > 0 && <button type="button" className="btn btn-sm" disabled={!chosen.size || applying} onClick={() => { void apply(); }}>{applying ? t('Applying…') : t('Apply {n} of {total}', { n: chosen.size, total: state.steps.length })}</button>}
        </div>
      </>}

      {state.status === 'applied' && <>
        <ul className="configurator-results" role="status">
          {state.results.map((r, i) => <li key={i} className={r.ok ? 'ok' : 'failed'}><strong>{r.ok ? '✓' : '✕'} {r.title}</strong>{!r.ok && <span className="small"> — {r.message}</span>}</li>)}
        </ul>
        <div className="note-assist-actions"><span className="statusbar-spacer" /><button type="button" className="btn btn-sm" onClick={() => { setRequest(''); setState({ status: 'idle' }); }}>{t('Set up something else')}</button></div>
      </>}
    </section>
  );
}
