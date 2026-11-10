// Local HTML runs only inside a sandboxed frame; the parent application keeps its strict script policy.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { isHtmlAnchor, type HtmlAnchor, type HtmlComment } from '../../../scripts/lib/html-comments';
import { t } from '../i18n';
import { IconChat, IconExternal, IconPlus, IconRefresh, IconTrash, IconX } from './Icons';

export function HtmlPreview({ url, text, title, project, toolbar, onExternal }: { url?: string; text: string; title: string; project?: string; toolbar?: HTMLElement | null; onExternal: () => void }) {
  const [fallback, setFallback] = useState('');
  const [revision, setRevision] = useState(0);
  const [width, setWidth] = useState('100%');
  const frame = useRef<HTMLIFrameElement>(null);
  const [comments, setComments] = useState<HtmlComment[]>([]), [anchor, setAnchor] = useState<HtmlAnchor | null>(null);
  const [draft, setDraft] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [commentsOn, setCommentsOn] = useState(false), [missing, setMissing] = useState<string[]>([]);
  const send = (active = '') => frame.current?.contentWindow?.postMessage({ type: 'moki:comments', comments: comments.map(({ id, anchor }) => ({ id, anchor })), active }, '*');
  const latestSend = useRef(send); latestSend.current = send;
  useEffect(() => {
    if (!project) return;
    let live = true;
    api.htmlComments(project, title).then((list) => { if (live) { setComments(list); if (list.length) setCommentsOn(true); } }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [project, title]);
  useEffect(() => { latestSend.current(); }, [comments]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || !event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'moki:selection' && isHtmlAnchor(event.data.anchor)) setAnchor(event.data.anchor);
      if (event.data.type === 'moki:preview-ready') latestSend.current();
      if (event.data.type === 'moki:comment-anchors' && Array.isArray(event.data.missing)) setMissing(event.data.missing.filter((id: unknown): id is string => typeof id === 'string').slice(0, 500));
    };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, []);
  const save = async (remove?: string) => {
    if (!project || busy || !remove && (!anchor || !draft.trim())) return;
    setBusy(true); setError('');
    try {
      const list = remove ? await api.removeHtmlComment(project, title, remove) : await api.addHtmlComment(project, title, anchor!, draft.trim());
      setComments(list); if (!remove) { setDraft(''); setAnchor(null); }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  useEffect(() => {
    if (url) return;
    const value = URL.createObjectURL(new Blob([text], { type: 'text/html' }));
    setFallback(value);
    return () => URL.revokeObjectURL(value);
  }, [url, text]);
  const controls = <div className={`html-preview-bar${toolbar ? ' in-doc-bar' : ''}`}>
      {!toolbar && <span className="muted small">{t('Local preview')}</span>}
      <select aria-label={t('Preview width')} value={width} onChange={(e) => setWidth(e.target.value)}>
        <option value="100%">{t('Fit to the panel')}</option><option value="768px">{t('Tablet')} · 768px</option><option value="390px">{t('Phone')} · 390px</option>
      </select>
      <span className="statusbar-spacer" />
      {project && url && <button type="button" className={`icon-btn${commentsOn ? ' on' : ''}`} title={t('Comments')} aria-label={t('Comments')} aria-pressed={commentsOn} onClick={() => setCommentsOn((value) => !value)}><IconChat size={16} /></button>}
      <button type="button" className="icon-btn" title={t('Reload preview')} aria-label={t('Reload preview')} onClick={() => setRevision((n) => n + 1)}><IconRefresh size={16} /></button>
      <button type="button" className="icon-btn" title={t('Open in browser')} aria-label={t('Open in browser')} onClick={onExternal}><IconExternal size={16} /></button>
    </div>;
  return <section className="html-preview" aria-label={t('HTML preview')}>
    {toolbar ? createPortal(controls, toolbar) : controls}
    <div className={`html-preview-content${commentsOn && project && url ? ' with-comments' : ''}`}>
      <div className="html-preview-stage">{(url || fallback) && <iframe ref={frame} key={`${url}:${revision}`} onLoad={() => { setAnchor(null); latestSend.current(); }} src={url || fallback} title={title} style={{ width }} sandbox={url ? 'allow-scripts allow-forms' : ''} referrerPolicy="no-referrer" />}</div>
      {commentsOn && project && url && <aside className="office-comments html-comments" aria-label={t('Comments')}>
        <h3><IconChat size={15} />{t('Comments')} <span className="muted">({comments.length})</span><span className="statusbar-spacer" /><button type="button" className="icon-btn" title={t('Close comments')} aria-label={t('Close comments')} onClick={() => setCommentsOn(false)}><IconX size={14} /></button></h3>
        {error && <p role="alert" className="warn-text">{t(error)}</p>}
        {comments.map((comment) => <article key={comment.id} onClick={(event) => { if (!(event.target as Element).closest('button')) send(comment.id); }}>
          <div className="office-comment-head"><strong>{comment.author}</strong></div>
          <button type="button" className="html-comment-quote" onClick={() => send(comment.id)}>{comment.anchor.quote}</button>
          {missing.includes(comment.id) && <p className="muted small">{t('This passage was not found. The page may have changed.')}</p>}
          <p>{comment.text}</p>
          <div className="comment-actions"><button type="button" className="icon-btn" title={t('Go to the commented location')} aria-label={t('Go to the commented location')} disabled={missing.includes(comment.id)} onClick={() => send(comment.id)}><IconExternal size={15} /></button><button type="button" className="icon-btn" disabled={busy} aria-label={t('Delete comment')} title={t('Delete comment')} onClick={() => { void save(comment.id); }}><IconTrash size={15} /></button></div>
        </article>)}
        {anchor ? <blockquote className="html-comment-selection">{anchor.quote}</blockquote> : <p className="muted small">{t('Select a passage in the preview to comment on it.')}</p>}
        <label className="field"><span className="label">{t('Add a comment')}</span><textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={10000} rows={3} placeholder={t('Write a comment…')} disabled={!anchor || busy} /></label>
        <div className="comment-actions"><button type="button" className="icon-btn office-add-comment" title={t('Add comment')} aria-label={t('Add comment')} disabled={!anchor || !draft.trim() || busy} onClick={() => { void save(); }}><IconPlus size={17} /></button></div>
      </aside>}
    </div>
  </section>;
}
