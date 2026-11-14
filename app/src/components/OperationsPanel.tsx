// Operations card of a project, in the right panel below the Activities card, taking the room left: the multi-agent
// operations run in this project, under way or finished. An operation is chosen on the assistant card, from every
// operation on this computer, not from a list kept on this card. Activities (single requests) are in ActivitiesCard.

import { useEffect, useRef, useState } from 'react';
import { api, statusLabel, type OperationRun } from '../api';
import { t } from '../i18n';
import { IconCheck, IconProgress } from './Icons';
import { ListTabs } from './ListPage';

interface Props {
  project: string;
  tick: number; // bumped when files change, so statuses follow
  active: string | null; // the run shown in the main area
  onRun: (run: string) => void;
}

const ENDED = ['completed', 'cancelled'];
type Phase = 'open' | 'ended';
const pill = (status: string) => (status === 'completed' ? 'pill-completed' : status === 'paused' || status === 'cancelled' ? '' : status === 'in-progress' ? 'pill-in-progress' : 'pill-awaiting-approval');

export function OperationsPanel({ project, tick, active, onRun }: Props) {
  const [runs, setRuns] = useState<OperationRun[]>([]);
  const [operationRunsError, setOperationRunsError] = useState('');
  const [chosen, setChosen] = useState<Phase | null>(null); // null: the tab follows the runs

  useEffect(() => {
    let live = true;
    api.operationRuns(project).then((items) => { if (live) { setRuns(items); setOperationRunsError(''); } }).catch((e: Error) => { if (live) setOperationRunsError(e.message); });
    return () => { live = false; };
  }, [project, tick]);

  const open = runs.filter((r) => !ENDED.includes(r.status));
  const ended = runs.filter((r) => ENDED.includes(r.status));

  // A run that started since the last look takes the panel back to the runs under way.
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(open.map((r) => r.id));
    if (seen.current && [...ids].some((id) => !seen.current?.has(id))) setChosen(null);
    seen.current = ids;
  }, [runs]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setChosen(null); seen.current = null; }, [project]);
  const tab: Phase = chosen ?? 'open';
  const current = (r: OperationRun) => r.steps.find((s) => s.id === r.visits?.find((v) => v.slot === r.currentStep)?.step);

  const runRow = (r: OperationRun) => (
    <li key={r.id}>
      <button type="button" className={`ops-side-row${active === r.id ? ' active' : ''}`} data-status={r.status} onClick={() => onRun(r.id)} title={r.id}>
        <span className="ops-side-name">{r.operation.name}</span>
        <span className="ops-side-meta">
          <span className={`pill ${pill(r.status)}`}>{statusLabel(r.status)}</span>
          {!ENDED.includes(r.status) && current(r) && <span className="muted small">{current(r)?.name}</span>}
        </span>
      </button>
    </li>
  );

  return (
    <section className="ops-side" aria-label={t('Operations')}>
      <h3 className="pp-card-title">{t('Operations')}</h3>
      {operationRunsError && <p className="error small ops-side-empty" role="alert">{t('Could not load executions: {error}', { error: operationRunsError })}</p>}
      <div className="ops-phases">
        <ListTabs<Phase> label={t('Operations')} value={tab} onChange={setChosen} tabs={[
          { id: 'open', label: t('Under way'), icon: <IconProgress size={14} />, count: operationRunsError ? undefined : open.length },
          { id: 'ended', label: t('Finished'), icon: <IconCheck size={14} />, count: operationRunsError ? undefined : ended.length },
        ]} />
      </div>
      <div className="ops-side-body">
      {!operationRunsError && <>
        {tab === 'open' && (open.length ? <ul>{open.map(runRow)}</ul> : <p className="muted small ops-side-empty">{t('Nothing under way.')}</p>)}
        {tab === 'ended' && (ended.length ? <ul className="ops-side-ended">{ended.map(runRow)}</ul> : <p className="muted small ops-side-empty">{t('Nothing finished yet.')}</p>)}
      </>}
      </div>
    </section>
  );
}
