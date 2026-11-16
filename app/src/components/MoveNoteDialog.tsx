// Moving a project note to another project: choose the project, read what stays behind (ties to PDF pages and
// lines of code, links to this project's files), move. The note keeps its title, tags and star.

import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import { t } from '../i18n';
import { moveNoteRef } from '../side-menu';
import { IconX } from './Icons';
import { Modal } from './Modal';

interface Props {
  project: string; path: string; title: string;
  projects: { id: string; name: string }[];
  onClose: () => void;
  onMoved: (target: string, path: string) => void;
}

export function MoveNoteDialog({ project, path, title, projects, onClose, onMoved }: Props) {
  const others = projects.filter((p) => p.id !== project);
  const [target, setTarget] = useState('');
  const [plan, setPlan] = useState<{ pdf: number; code: number; links: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const chosen = others.find((p) => p.id === target);

  useEffect(() => {
    setPlan(null); setError('');
    if (!target) return;
    let live = true;
    api.moveNotePlan(project, path, target).then((p) => { if (live) setPlan(p); }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [project, path, target]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen || !plan) return;
    setBusy(true); setError('');
    try {
      const moved = await api.moveNote(project, path, chosen.id);
      moveNoteRef(project, path, chosen.id, moved);
      window.qa?.notesChanged();
      onMoved(chosen.id, moved);
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); setBusy(false); }
  };

  const behind = plan ? [
    plan.pdf === 1 ? t('its place in 1 PDF page') : plan.pdf > 1 ? t('its place in {n} PDF pages', { n: plan.pdf }) : '',
    plan.code === 1 ? t('its tie to 1 passage of code') : plan.code > 1 ? t('its ties to {n} passages of code', { n: plan.code }) : '',
  ].filter(Boolean) : [];

  return (
    <Modal as="form" size="compact" labelledBy="move-note-title" onClose={onClose} busy={busy} onSubmit={(e) => { void submit(e); }}>
      <header className="modal-head">
        <h2 id="move-note-title">{t('Move "{title}" to another project', { title })}</h2>
        <button type="button" className="icon-btn" onClick={onClose} disabled={busy} title={t('Close (Esc)')}><IconX size={18} /></button>
      </header>
      <div className="modal-body">
        <label className="field">
          <span>{t('Project')}</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} disabled={busy} autoFocus>
            <option value="">{t('Choose a project')}</option>
            {others.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        {chosen && plan && (
          <div className="merge-plan">
            <p>{t('The note goes with its title, tags and star, and leaves this project.')}</p>
            {behind.length > 0 && <p className="muted small">{t('Stays behind: {what}.', { what: behind.join(', ') })}</p>}
            {plan.links > 0 && <p className="muted small">{plan.links === 1
              ? t('1 link to a file of this project will no longer open.')
              : t('{n} links to files of this project will no longer open.', { n: plan.links })}</p>}
          </div>
        )}
        {error && <p className="error small">{error}</p>}
      </div>
      <footer className="modal-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>{t('Cancel')}</button>
        <button type="submit" className="btn" disabled={busy || !chosen || !plan}>{busy ? t('Moving…') : t('Move')}</button>
      </footer>
    </Modal>
  );
}
