// Merging a project into another: choose the project that receives the files, read what changes (names taken,
// context to consolidate, what stays behind), type its name, merge. The source is suspended afterwards.

import { useEffect, useState, type FormEvent } from 'react';
import { api, type MergePlan, type ProjectSummary } from '../api';
import { t } from '../i18n';
import { mergeProjectInto } from '../side-menu';
import { IconX } from './Icons';
import { Modal } from './Modal';

interface Props { project: ProjectSummary; projects: ProjectSummary[]; onClose: () => void; onMerged: (target: string) => void }

export function MergeProjectDialog({ project, projects, onClose, onMerged }: Props) {
  const others = projects.filter((p) => p.id !== project.id);
  const [target, setTarget] = useState('');
  const [plan, setPlan] = useState<MergePlan | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chosen = others.find((p) => p.id === target);

  useEffect(() => {
    setPlan(null); setTyped(''); setError('');
    if (!target) return;
    let live = true;
    api.mergePlan(project.id, target).then((p) => { if (live) setPlan(p); }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [project.id, target]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen || !plan || typed.trim() !== chosen.name) return;
    setBusy(true); setError('');
    try {
      const done = await api.mergeProject(project.id, chosen.id, typed);
      mergeProjectInto(project.id, chosen.id, [...done.renamed, ...done.context]);
      onMerged(chosen.id);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false); }
  };

  const moves = (list: { from: string; to: string }[]) => (
    <ul className="merge-moves">{list.map((m) => <li key={m.from}><code>{m.from}</code> → <code>{m.to}</code></li>)}</ul>
  );

  return (
    <Modal as="form" size="medium" labelledBy="merge-title" onClose={onClose} busy={busy} onSubmit={(e) => { void submit(e); }}>
      <header className="modal-head">
        <h2 id="merge-title">{t('Merge {name} into another project', { name: project.name })}</h2>
        <button type="button" className="icon-btn" onClick={onClose} disabled={busy} title={t('Close (Esc)')}><IconX size={18} /></button>
      </header>
      <div className="modal-body">
        <p>{t('Everything in {name} is copied into the project you choose: notes with their titles, files, activities, comments and tags. Nothing there is overwritten.', { name: project.name })}</p>
        <label className="field">
          <span>{t('Project that receives the files')}</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy}>
            <option value="">{t('Choose a project')}</option>
            {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {chosen && !plan && !error && <p className="muted small">{t('Checking what changes…')}</p>}
        {chosen && plan && (
          <div className="merge-plan">
            <p>{plan.runs === 0
              ? (plan.files === 1 ? t('1 file is copied.') : t('{n} files are copied.', { n: plan.files }))
              : t('{files} and {runs} are copied.', {
                files: plan.files === 1 ? t('1 file') : t('{n} files', { n: plan.files }),
                runs: plan.runs === 1 ? t('1 activity') : t('{n} activities', { n: plan.runs }),
              })}</p>
            {plan.renamed.length > 0 && (
              <details>
                <summary>{plan.renamed.length === 1
                  ? t('1 takes another name, because {name} already uses it', { name: chosen.name })
                  : t('{n} take another name, because {name} already uses theirs', { n: plan.renamed.length, name: chosen.name })}</summary>
                {moves(plan.renamed)}
              </details>
            )}
            {plan.context.length > 0 && (
              <details open>
                <summary>{plan.context.length === 1
                  ? t('1 context file stays beside the one of {name}, to consolidate later (listed in proposed-updates.md)', { name: chosen.name })
                  : t('{n} context files stay beside the ones of {name}, to consolidate later (listed in proposed-updates.md)', { n: plan.context.length, name: chosen.name })}</summary>
                {moves(plan.context)}
              </details>
            )}
            {plan.identical > 0 && <p className="muted small">{plan.identical === 1 ? t('1 file is already there as it is and is not copied.') : t('{n} files are already there as they are and are not copied.', { n: plan.identical })}</p>}
            {plan.dropped > 0 && <p className="muted small">{plan.dropped === 1
              ? t('1 comment on a file of the linked folder stays behind: {name} does not use the same folder.', { name: chosen.name })
              : t('{n} comments on files of the linked folder stay behind: {name} does not use the same folder.', { n: plan.dropped, name: chosen.name })}</p>}
            <p className="muted small">{t('Then {name} is suspended: it keeps its own copy, and you can resume it under Suspended.', { name: project.name })}</p>
            <label className="field">
              <span>{t('Type {word} to confirm', { word: chosen.name })}</span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={chosen.name} autoComplete="off" spellCheck={false} disabled={busy} />
            </label>
          </div>
        )}
        {error && <p className="error small">{error}</p>}
      </div>
      <footer className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('Cancel')}</button>
        <button type="submit" className="btn" disabled={busy || !chosen || !plan || typed.trim() !== chosen.name}>{busy ? t('Merging…') : t('Merge')}</button>
      </footer>
    </Modal>
  );
}
