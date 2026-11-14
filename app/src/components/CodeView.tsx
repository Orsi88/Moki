// A source file, read-only, with the colors of an IDE (highlight.js, loaded the first time a code file opens) and
// line numbers. A click on a number selects that line; "Open in the IDE" opens VS Code or Cursor on the project's
// folder at the selected line, where the code is changed. Very large files show without colors, so they stay fast.

import { useMemo, useState } from 'react';
import { api } from '../api';
import { t } from '../i18n';
import { loadOnce } from '../lazy-module';
import { useLoaded } from './useLoaded';
import { IconCode } from './Icons';

const highlighter = loadOnce(() => import('highlight.js').then((m) => m.default));
const COLOR_LIMIT = 400 * 1024; // characters: past this the file shows as plain text

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Props { project?: string; path: string; text: string; language: string }

export function CodeView({ project, path, text, language }: Props) {
  const { mod: hljs } = useLoaded(highlighter);
  const [line, setLine] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lines = useMemo(() => text.split(/\r?\n/).length, [text]);
  const html = useMemo(() => {
    if (!hljs || text.length > COLOR_LIMIT || !hljs.getLanguage(language)) return escape(text);
    try { return hljs.highlight(text, { language, ignoreIllegals: true }).value; } catch { return escape(text); }
  }, [hljs, text, language]);
  const open = async () => {
    if (!project) return;
    setError(''); setNotice('');
    try { const ide = await api.openFileInIde(project, path, line ?? 1); setNotice(t('Opening in {ide}…', { ide })); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  return (
    <div className="code-file" data-language={language}>
      <div className="code-file-bar">
        <span className="muted small">{language}{line ? ` · ${t('line {n}', { n: line })}` : ''}</span>
        {text.length > COLOR_LIMIT && <span className="muted small">{t('Large file: shown without colors.')}</span>}
        {project && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void open(); }} title={t('Open this file in VS Code or Cursor, at the selected line')}>
          <IconCode size={14} /> {t('Open in the IDE')}
        </button>}
      </div>
      {error && <p className="result warn" role="alert">{error}</p>}
      {notice && <p className="result" role="status">{notice}</p>}
      <div className="code-file-body">
        <div className="code-gutter" aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => <button key={i} type="button" tabIndex={-1} className={line === i + 1 ? 'on' : ''} onClick={() => setLine(line === i + 1 ? null : i + 1)}>{i + 1}</button>)}
        </div>
        <pre className="code-text">
          {line && <span className="code-line-mark" style={{ top: `calc(${line - 1} * var(--code-line))` }} />}
          <code className={`hljs language-${language}`} dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
    </div>
  );
}
