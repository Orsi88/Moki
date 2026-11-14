// The project's activities in one card of the right panel: first the activities pinned to this project (one click
// calls the AI with it), then what is under way, the runs that need the person first. Finished and cancelled runs are
// not listed (the run view and the Deliveries folder keep them), and neither is a run whose state cannot be read. A
// request just sent shows until its run appears, for a short while only: "Just open the project" never makes one.

import { useEffect, useState } from 'react';
import { api, describeRun, statusLabel, type ActivityInfo, type ActivityRun, type LaunchPreset, type ProjectSummary } from '../api';
import { activityFace } from '../catalog-copy';
import { t } from '../i18n';
import { launchForRun, type ActivityLaunch } from '../activity-launches';
import { IconPin, IconPlay, IconX } from './Icons';

interface Props {
  project: ProjectSummary;
  tick: number; // bumped when files change, so statuses follow
  active: string | null; // the run shown in the main area
  launches: ActivityLaunch[];
  onLaunch: (preset: LaunchPreset) => void;
  onPin: (activity: string, on: boolean) => void;
  onRun: (run: string) => void;
  onResume: (run: string) => void;
  onDismissLaunch: (id: string) => void;
}

const ENDED = ['completed', 'cancelled', 'unreadable'];
const NEEDS_YOU = ['awaiting-approval', 'awaiting-input', 'blocked'];
export const LAUNCH_SHOWN_MS = 15 * 60_000; // a request whose run never appeared stops showing after this
const pill = (status: string) => (status === 'paused' ? '' : status === 'in-progress' ? 'pill-in-progress' : 'pill-awaiting-approval');

export function ActivitiesCard({ project, tick, active, launches, onLaunch, onPin, onRun, onResume, onDismissLaunch }: Props) {
  const [catalog, setCatalog] = useState<ActivityInfo[]>([]);
  const [runs, setRuns] = useState<ActivityRun[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    api.activities(project.id).then((r) => { if (live) setCatalog(r.activities); }).catch(() => { if (live) setCatalog([]); });
    return () => { live = false; };
  }, [project.id]);
  useEffect(() => {
    let live = true;
    api.activityRuns(project.id).then((items) => { if (live) { setRuns(items); setError(''); } }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [project.id, tick]);

  const pinned = project.pinnedActivities.flatMap((id) => catalog.filter((a) => a.id === id && a.available));
  const underWay = runs.filter((r) => !ENDED.includes(r.status))
    .sort((a, b) => Number(NEEDS_YOU.includes(b.status)) - Number(NEEDS_YOU.includes(a.status)));
  const now = Date.now();
  const waiting = launches.filter((l) => !runs.some((r) => launchForRun(r.id, [l])) && l.phase !== 'failed' && now - Date.parse(l.at) < LAUNCH_SHOWN_MS);
  const titleOf = (run: ActivityRun) => {
    const label = run.activity ? t(run.activity.label) : launches.find((l) => launchForRun(run.id, [l]))?.label ?? '';
    return label ? (run.scenario ? `${label} · ${run.scenario}` : label) : run.scenario || describeRun(run.id).title;
  };

  return (
    <section className="pp-card pp-activities" aria-label={t('Activities')}>
      <h3 className="pp-card-title">{t('Activities')}</h3>
      {pinned.length > 0 && (
        <ul className="pp-pinned" aria-label={t('Pinned to this project')}>
          {pinned.map((a) => {
            const face = activityFace(a.id, a.label, a.hint);
            return (
              <li key={a.id}>
                <button type="button" className="pp-pinned-call" onClick={() => onLaunch({ activity: a.id })} title={face.hint}>
                  <IconPlay size={13} /><span>{face.label}</span>
                </button>
                <button type="button" className="icon-btn pin-btn on" aria-pressed="true" onClick={() => onPin(a.id, false)}
                  title={t('Unpin from this project')} aria-label={t('Unpin {name} from this project', { name: face.label })}><IconPin size={14} /></button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="error small" role="alert">{t('Could not load executions: {error}', { error })}</p>}
      {(underWay.length > 0 || waiting.length > 0) && (
        <ul className="pp-underway" aria-label={t('Under way')}>
          {waiting.map((item) => (
            <li key={item.id} className="activity-launch-row" data-phase={item.phase}>
              <div className="ops-side-row" data-status="start"><span className="ops-side-name">{item.label}</span><span className="muted small">{t('Starting…')}</span></div>
              <button type="button" className="icon-btn" title={t('Remove request from this list')} aria-label={t('Remove request from this list')} onClick={() => onDismissLaunch(item.id)}><IconX size={14} /></button>
            </li>
          ))}
          {underWay.map((run) => (
            <li key={run.id} className="activity-launch-row">
              <button type="button" className={`ops-side-row${active === run.id ? ' active' : ''}`} data-status={run.status} onClick={() => onRun(run.id)} title={run.id}>
                <span className="ops-side-name">{titleOf(run)}</span>
                <span className="ops-side-meta">
                  <span className={`pill ${pill(run.status)}`}>{statusLabel(run.status)}</span>
                  {!run.scenario && <span className="muted small">{describeRun(run.id).date}</span>}
                </span>
              </button>
              {run.status !== 'blocked' && <button type="button" className="icon-btn" onClick={() => onResume(run.id)} title={t('Continue in your AI tool')} aria-label={t('Continue in your AI tool')}><IconPlay size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
      {!pinned.length && !underWay.length && !waiting.length && !error && (
        <p className="muted small pp-activities-empty">{t('Nothing under way. Pin the activities you use in this project from Call… to have them here.')}</p>
      )}
    </section>
  );
}
