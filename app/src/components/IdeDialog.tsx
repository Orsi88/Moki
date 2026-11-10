// The project shortcuts to Moki's IDE companion share the installer used by Settings > My AIs.
import { useEffect, useState } from 'react';
import { api, type AiToolStatus, type ToolInfo } from '../api';
import { t } from '../i18n';
import { IconMoki, IconExternal, IconProgress, IconX } from './Icons';
import { Modal } from './Modal';

interface Props { project: string; tools: ToolInfo[]; onClose: () => void; onMyAis: () => void }

export function IdeDialog({ project, tools, onClose, onMyAis }: Props) {
  const [status, setStatus] = useState<AiToolStatus[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  useEffect(() => {
    let live = true;
    api.aiTools().then((value) => { if (live) setStatus(value); }).catch((e: Error) => { if (live) { setError(e.message); setStatus([]); } });
    return () => { live = false; };
  }, []);
  const editors = tools.filter((tool) => tool.kind === 'editor' && tool.mokiExtension);
  const open = async (tool: ToolInfo) => {
    setBusy(tool.id); setError(''); setInfo('');
    try {
      const result = await api.openMokiInEditor(tool.id, project);
      setInfo(t('Moki is ready in {tool}. The editor opened on {folder}.', { tool: tool.label, folder: result.folder }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(''); }
  };
  return (
    <Modal size="medium" labelledBy="ide-companion-title" onClose={onClose} busy={Boolean(busy)}>
      <header className="modal-head">
        <IconMoki size={20} /><h2 id="ide-companion-title">{t('Moki in your IDE')}</h2>
        <button type="button" className="icon-btn" disabled={Boolean(busy)} onClick={onClose} aria-label={t('Close')}><IconX size={18} /></button>
      </header>
      <div className="modal-body ide-shortcut">
        <p className="muted small">{t('Choose an editor. Moki installs or updates its companion extension when needed, then opens this project.')}</p>
        {error && <p role="alert" className="warn-text">{error}</p>}
        {info && <p role="status">{info}</p>}
        {editors.map((tool) => {
          const found = status?.find((entry) => entry.id === tool.id);
          const available = found?.available ?? tool.available;
          return <section key={tool.id} className="ide-shortcut-row">
            <div><strong>{tool.label}</strong><p className="muted small">{status === null ? t('Checking…') : !available ? t('Not installed') : found?.extension ? t('Moki extension {version}', { version: found.extension }) : t('Moki extension not installed')}</p></div>
            <button type="button" className="btn btn-sm" aria-label={t('Open Moki in {tool}', { tool: tool.label })} disabled={!available || status === null || Boolean(busy)} onClick={() => { void open(tool); }}>
              {busy === tool.id ? <IconProgress size={15} /> : <IconExternal size={15} />}{t('Open')}
            </button>
          </section>;
        })}
      </div>
      <footer className="modal-foot"><button type="button" className="btn btn-ghost" disabled={Boolean(busy)} onClick={onMyAis}>{t('My AIs')}</button></footer>
    </Modal>
  );
}
