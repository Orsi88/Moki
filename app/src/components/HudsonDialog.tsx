// Hudson organizes what the runs left behind: the AI proposes, file by file, to take it to the project context,
// rename it, delete it or keep it, with a reason (desktop/hudson.ts). Nothing changes until the person applies the
// steps they keep checked; Moki does the moves, and a deletion goes to the trash.

import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type OrganizeAction, type OrganizeCandidate, type OrganizeStep } from '../api';
import { t } from '../i18n';
import { defaultTool, recall } from '../prefs';
import { IconX } from './Icons';
import { Modal } from './Modal';

interface Props { project: string; onClose: () => void; onDone: () => void; onMyAis?: () => void }

const ORDER: OrganizeAction[] = ['context', 'rename', 'delete', 'keep'];
const heading = (action: OrganizeAction) => ({ context: t('Take to the project context'), rename: t('Rename'), delete: t('Delete (to the trash)'), keep: t('Keep as it is') })[action];

export function HudsonDialog({ project, onClose, onDone, onMyAis }: Props) {
  const [state, setState] = useState<'working' | 'ready' | 'error' | 'applying' | 'done'>('working');
  const [error, setError] = useState('');
  const [files, setFiles] = useState<OrganizeCandidate[]>([]);
  const [plan, setPlan] = useState<OrganizeStep[]>([]);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ done: string[]; failed: string[] } | null>(null);
  const id = useRef(`hudson-${Date.now().toString(36)}`);

  useEffect(() => {
    let live = true;
    void api.hudsonPlan({ id: id.current, project, prefer: defaultTool(), language: recall('qa-language') ?? 'English' }).then((answer) => {
      if (!live) return;
      if (answer.error) { setError(answer.error); setState('error'); return; }
      const steps = answer.plan ?? [];
      setFiles(answer.files ?? []);
      setPlan(steps);
      setChosen(new Set(steps.filter((s) => s.do !== 'keep').map((s) => s.path)));
      setState('ready');
    });
    return () => { live = false; void api.noteAssistCancel(id.current); };
  }, [project]);

  const byPath = useMemo(() => new Map(files.map((f) => [f.path, f])), [files]);
  const groups = ORDER.map((action) => ({ action, steps: plan.filter((s) => s.do === action) })).filter((g) => g.steps.length);
  const hasChanges = plan.some((step) => step.do !== 'keep');
  const picked = plan.filter((s) => s.do !== 'keep' && chosen.has(s.path));
  const toggle = (path: string) => setChosen((now) => { const next = new Set(now); if (next.has(path)) next.delete(path); else next.add(path); return next; });

  const apply = async () => {
    setState('applying');
    try { setResult(await api.organizeApply(project, picked)); setState('done'); onDone(); }
    catch (e) { setError((e as Error).message); setState('error'); }
  };

  const name = (path: string) => path.split('/').pop() ?? path;
  return (
    <Modal size="medium" labelledBy="hudson-title" onClose={onClose} busy={state === 'applying'} className="hudson">
      <header className="modal-head">
        <h2 id="hudson-title">{t('Organize with Hudson')}</h2>
        <button type="button" className="icon-btn" onClick={onClose} disabled={state === 'applying'} title={t('Close (Esc)')}><IconX size={18} /></button>
      </header>
      <div className="modal-body">
        {state === 'working' && (
          <p className="hudson-working" role="status"><span className="note-assist-spinner" aria-hidden="true" /> {t('Hudson is looking at the files the runs left…')}</p>
        )}
        {state === 'error' && (
          <p role="alert">{error === 'no-tool'
            ? <>{t('Hudson uses Claude Code or Codex, and neither was found on this computer.')} {onMyAis && <button type="button" className="link" onClick={onMyAis}>{t('Install in Settings › My AIs')}</button>}</>
            : <>{t('Hudson could not finish.')} <span className="muted small">{error}</span></>}</p>
        )}
        {state === 'ready' && !plan.length && <p>{t('There is nothing to organize: the runs left no files.')}</p>}
        {(state === 'ready' || state === 'applying') && plan.length > 0 && (
          <>
            {hasChanges ? <p className="muted small">{t('Nothing changes until you apply. Uncheck what you do not want; a deleted file goes to the trash.')}</p> : <><h3 role="status">{t('No changes needed')}</h3><p className="muted small">{t('Hudson reviewed {n} files and recommends keeping them as they are.', { n: String(plan.length) })}</p></>}
            {groups.map(({ action, steps }) => (
              <section key={action} className={`hudson-group hudson-${action}`}>
                <h3>{heading(action)} <span className="muted">({steps.length})</span></h3>
                <ul>
                  {steps.map((step) => {
                    const file = byPath.get(step.path);
                    return (
                      <li key={step.path}>
                        <label className="hudson-item">
                          {action !== 'keep' && <input type="checkbox" checked={chosen.has(step.path)} onChange={() => toggle(step.path)} disabled={state === 'applying'} />}
                          <span className="hudson-text">
                            <span className="hudson-name" title={step.path}>{name(step.path)}{step.name && <> <span aria-hidden="true">→</span> <strong>{step.name}</strong></>}</span>
                            <span className="muted small">{file?.title || file?.run}{step.why ? ` · ${step.why}` : ''}</span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </>
        )}
        {state === 'done' && result && (
          <p role="status">{t('{n} files organized.', { n: String(result.done.length) })}{result.failed.length ? ` ${t('{n} could not be changed (moved or open elsewhere).', { n: String(result.failed.length) })}` : ''}</p>
        )}
      </div>
      {!(state === 'ready' && !hasChanges) && <footer className="modal-foot">
        {state === 'done' || state === 'error' || (state === 'ready' && !plan.length)
          ? <button type="button" className="btn" onClick={onClose}>{t('Close')}</button>
          : <>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={state === 'applying'}>{t('Cancel')}</button>
            <button type="button" className="btn" onClick={() => { void apply(); }} disabled={state !== 'ready' || !picked.length}>
              {state === 'applying' ? t('Applying…') : t('Apply ({n})', { n: String(picked.length) })}
            </button>
          </>}
      </footer>}
    </Modal>
  );
}
