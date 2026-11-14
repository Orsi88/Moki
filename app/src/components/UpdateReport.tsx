// The update report of one routine check, opened from its notification or from the history: each item that changed
// in the monitored source, field by field, before and after, as read. "Start update activity" opens an AI in the
// project with the report, to update the files that rely on those items (it shows a plan and waits for approval).

import { useEffect, useState } from 'react';
import { api, type ProjectSummary, type RoutineReport, type TerminalRef, type ToolInfo } from '../api';
import { conversationLanguage, t } from '../i18n';
import { preferredTool } from '../prefs';
import { BackArrow } from './ListPage';
import { IconPlay } from './Icons';

interface Props {
  projectId: string;
  routineId: string;
  executionId: string;
  projects: ProjectSummary[];
  tools: ToolInfo[];
  onBack: () => void;
  onTerminal?: (terminal: TerminalRef, projectId: string) => void;
}

const CHANGE = { changed: () => t('Changed'), added: () => t('New'), removed: () => t('Removed') } as const;

export function UpdateReport({ projectId, routineId, executionId, projects, tools, onBack, onTerminal }: Props) {
  const [report, setReport] = useState<RoutineReport | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const tool = preferredTool(tools.filter((x) => x.available && x.kind === 'terminal'));
  const project = projects.find((p) => p.id === projectId);

  useEffect(() => {
    let live = true;
    setReport(null); setError('');
    api.routineReport(projectId, routineId, executionId).then((r) => { if (live) setReport(r); }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [projectId, routineId, executionId]);

  const start = async () => {
    if (!tool) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const file = await api.routineReportFile(projectId, routineId, executionId);
      const r = await api.launch({ project: projectId, activity: 'routine-update', tool: tool.id, files: [], note: `The update report is ${file}`, language: conversationLanguage() });
      if (r.terminal && onTerminal) onTerminal(r.terminal, projectId);
      else if (r.opened) setNotice(r.message ?? t('The AI is opening with the report.'));
      else setError(r.message ?? t('The request could not be prepared.'));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return <div className="update-report">
    <header className="library-head"><div className="title-row"><BackArrow label={t('Routines')} onBack={onBack} /><h1>{t('Update report')}</h1></div></header>
    {error && <p className="result warn" role="alert">{error}</p>}
    {notice && <p className="result" role="status">{notice}</p>}
    {!report && !error && <p className="muted" role="status">{t('Loading…')}</p>}
    {report && <>
      <section className="update-report-head">
        <div>
          <strong>{report.routineName}</strong>
          <span className="muted small">{[project?.name ?? projectId, new Date(report.createdAt).toLocaleString()].join(' · ')}</span>
          <span className="small">{report.items.length === 1 ? t('1 item changed in the source.') : t('{n} items changed in the source.', { n: report.items.length })}</span>
        </div>
        <div className="update-report-action">
          <button type="button" className="btn" disabled={busy || !tool} onClick={() => { void start(); }}><IconPlay size={14} />{busy ? t('Starting…') : t('Start update activity')}</button>
          <span className="muted small">{tool ? t('Opens {tool} with this report. It shows a plan and waits for your approval before changing files.', { tool: tool.label }) : t('Install an AI in Settings › My AIs to start the update.')}</span>
        </div>
      </section>
      <ol className="update-report-items">
        {report.items.map((item) => (
          <li key={`${item.sourceId}:${item.resourceId}`} className="update-report-item" data-change={item.change}>
            <header><span className={`update-report-badge ${item.change}`}>{CHANGE[item.change]()}</span><h2>{item.title}</h2></header>
            {item.bookkeeping && <p className="muted small">{t('Only its revision, dates or comment count changed: no field you read is different.')}</p>}
            {item.binary && <p className="muted small">{t('Not a text file: its content cannot be compared here. Open the file to see it.')}</p>}
            {item.fields.length > 0 && (
              <table className="update-report-fields">
                <thead><tr><th scope="col">{t('Field')}</th><th scope="col">{t('Before')}</th><th scope="col">{t('After')}</th></tr></thead>
                <tbody>
                  {item.fields.map((field) => (
                    <tr key={field.name}>
                      <th scope="row">{field.name}</th>
                      <td className="update-report-before"><div className="update-report-value">{field.before || <span className="muted">—</span>}</div></td>
                      <td className="update-report-after"><div className="update-report-value">{field.after || <span className="muted">—</span>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </li>
        ))}
      </ol>
    </>}
  </div>;
}
