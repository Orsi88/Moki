// Local HTML runs only inside a sandboxed frame; document comments stay in the parent application.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { isHtmlAnchor, type HtmlAnchor, type HtmlComment } from '../../../scripts/lib/html-comments';
import { isCommentColor, type CommentColor, type MdComment } from '../md-comments';
import { t } from '../i18n';
import { IconChat, IconExternal, IconRefresh } from './Icons';
import { CommentColumn, CommentComposer, SelectionBubble, useCommentPlacement, type Bubble, type CommentActions } from './CommentColumn';

interface FrameRect { left: number; top: number; width: number; height: number }
interface FrameAnchor { id: string; rect: FrameRect; visible: boolean }
const isRect = (value: unknown): value is FrameRect => {
  if (!value || typeof value !== 'object') return false;
  const rect = value as Record<string, unknown>;
  return ['left', 'top', 'width', 'height'].every((key) => typeof rect[key] === 'number' && Number.isFinite(rect[key]) && Math.abs(rect[key]) <= 10000000)
    && Number(rect.width) >= 0 && Number(rect.height) >= 0;
};

export function HtmlPreview({ url, text, title, project, toolbar, onExternal }: { url?: string; text: string; title: string; project?: string; toolbar?: HTMLElement | null; onExternal: () => void }) {
  const [fallback, setFallback] = useState(''), [revision, setRevision] = useState(0), [width, setWidth] = useState('100%');
  const frame = useRef<HTMLIFrameElement>(null), stage = useRef<HTMLDivElement>(null), body = useRef<HTMLDivElement>(null), rail = useRef<HTMLDivElement>(null);
  const [comments, setComments] = useState<HtmlComment[]>([]), [active, setActive] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [commentsOn, setCommentsOn] = useState(false), [missing, setMissing] = useState<string[]>([]);
  const [anchors, setAnchors] = useState<FrameAnchor[]>([]), [color, setColor] = useState<CommentColor>('yellow');
  const [bubble, setBubble] = useState<(Bubble & { anchor: HtmlAnchor }) | null>(null), [composer, setComposer] = useState<typeof bubble>(null);
  const activeRef = useRef(''), working = useRef(false);
  const send = (id = activeRef.current, focus = false) => {
    activeRef.current = id;
    frame.current?.contentWindow?.postMessage({ type: 'moki:comments', comments: comments.map(({ id, anchor, color }) => ({ id, anchor, color })), active: id, focus }, '*');
  };
  const latestSend = useRef(send); latestSend.current = send;
  const choose = (id: string) => { setCommentsOn(true); setActive(id); send(id, true); };
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
      const data = event.data;
      if (data.type === 'moki:selection') {
        if (!isHtmlAnchor(data.anchor) || !isRect(data.rect) || !stage.current || !frame.current) { setBubble(null); return; }
        const origin = stage.current.getBoundingClientRect(), rect = frame.current.getBoundingClientRect();
        const left = rect.left + data.rect.left - origin.left, top = rect.top + data.rect.top - origin.top;
        setBubble({ x: Math.max(8, Math.min(left, stage.current.clientWidth - 300)), y: top, below: top + data.rect.height, why: '', anchor: data.anchor });
      }
      if (data.type === 'moki:preview-ready') latestSend.current();
      if (data.type === 'moki:comment-anchors' && Array.isArray(data.missing) && Array.isArray(data.anchors)) {
        const missing = data.missing.filter((id: unknown): id is string => typeof id === 'string').slice(0, 500);
        const anchors = data.anchors.filter((value: unknown): value is FrameAnchor => Boolean(value && typeof value === 'object'
          && typeof (value as FrameAnchor).id === 'string' && typeof (value as FrameAnchor).visible === 'boolean' && isRect((value as FrameAnchor).rect))).slice(0, 500);
        setMissing((old) => JSON.stringify(old) === JSON.stringify(missing) ? old : missing);
        setAnchors((old) => JSON.stringify(old) === JSON.stringify(anchors) ? old : anchors);
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  useEffect(() => {
    if (!bubble && !composer) return;
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setBubble(null); setComposer(null); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [bubble, composer]);
  const visible = useMemo(() => new Set([...anchors.filter((a) => a.visible).map((a) => a.id), ...missing]), [anchors, missing]);
  const cards = useMemo<MdComment[]>(() => comments.filter((c) => visible.has(c.id)).map((c) => ({
    id: c.id, author: c.author, at: c.date, text: c.text, replies: c.replies ?? [], ...(isCommentColor(c.color) ? { color: c.color } : {}),
  })), [comments, visible]);
  const markOf = useCallback((_body: HTMLElement, id: string) => {
    const anchor = anchors.find((a) => a.id === id), box = frame.current;
    if (!anchor || !box) return null;
    return { getBoundingClientRect: () => { const rect = box.getBoundingClientRect(); return DOMRect.fromRect({ x: rect.left + anchor.rect.left, y: rect.top + anchor.rect.top, width: anchor.rect.width, height: anchor.rect.height }); } };
  }, [anchors]);
  const placed = useCommentPlacement(stage, body, rail, cards, markOf);
  const save = async (job: () => Promise<HtmlComment[]>): Promise<boolean> => {
    if (!project || working.current) return false;
    working.current = true; setBusy(true); setError('');
    try { setComments(await job()); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { working.current = false; setBusy(false); }
  };
  const actions: CommentActions = {
    reply: (id, text) => { if (project) void save(() => api.changeHtmlComment(project, title, { op: 'reply', id, text })); },
    edit: (id, text) => { if (project) void save(() => api.changeHtmlComment(project, title, { op: 'edit', id, text })); },
    color: (id, color) => { if (project) void save(() => api.changeHtmlComment(project, title, { op: 'color', id, color })); },
    remove: (id) => { if (project) void save(() => api.removeHtmlComment(project, title, id)).then((ok) => { if (ok && id === activeRef.current) { activeRef.current = ''; setActive(''); } }); },
  };
  const add = async (text: string) => {
    if (!project || !composer) return;
    if (await save(() => api.addHtmlComment(project, title, composer.anchor, text, color))) {
      frame.current?.contentWindow?.postMessage({ type: 'moki:clear-selection' }, '*');
      setComposer(null); setCommentsOn(true);
    }
  };
  useEffect(() => {
    if (url) return;
    const value = URL.createObjectURL(new Blob([text], { type: 'text/html' }));
    setFallback(value);
    return () => URL.revokeObjectURL(value);
  }, [url, text]);
  const enabled = Boolean(project && url);
  const controls = <div className={'html-preview-bar' + (toolbar ? ' in-doc-bar' : '')}>
    {!toolbar && <span className="muted small">{t('Local preview')}</span>}
    <select aria-label={t('Preview width')} value={width} onChange={(e) => { setWidth(e.target.value); setBubble(null); setComposer(null); }}>
      <option value="100%">{t('Fit to the panel')}</option><option value="768px">{t('Tablet')} · 768px</option><option value="390px">{t('Phone')} · 390px</option>
    </select>
    <span className="statusbar-spacer" />
    {enabled && <button type="button" className={'btn btn-ghost btn-sm pdf-rail-toggle' + (commentsOn ? ' on' : '')} title={t('Comments')} aria-label={t('Comments') + ' (' + comments.length + ')'} aria-pressed={commentsOn} onClick={() => setCommentsOn((value) => !value)}><IconChat size={16} />{comments.length > 0 && <span className="pdf-rail-count">{comments.length}</span>}</button>}
    <button type="button" className="icon-btn" title={t('Reload preview')} aria-label={t('Reload preview')} onClick={() => setRevision((n) => n + 1)}><IconRefresh size={16} /></button>
    <button type="button" className="icon-btn" title={t('Open in browser')} aria-label={t('Open in browser')} onClick={onExternal}><IconExternal size={16} /></button>
  </div>;
  return <section className="html-preview" aria-label={t('HTML preview')}>
    {toolbar ? createPortal(controls, toolbar) : controls}
    {error && <p role="alert" className="warn-text office-sheet-note">{t(error)}</p>}
    <div ref={stage} className={'html-preview-content office-commented' + (commentsOn && enabled ? ' with-rail' : '')}>
      <div ref={body} className="html-preview-stage">{(url || fallback) && <iframe ref={frame} key={url + ':' + revision} onLoad={() => { setBubble(null); setComposer(null); setAnchors([]); latestSend.current(); }} src={url || fallback} title={title} style={{ width }} sandbox={url ? 'allow-scripts allow-forms' : ''} referrerPolicy="no-referrer" />}</div>
      {enabled && <CommentColumn comments={cards} placed={placed} rail={rail} shown={commentsOn} hidden={!commentsOn} onShow={() => setCommentsOn(true)}
        active={active} onActive={(id) => { setActive(id); send(id); }} saving={busy} actions={actions} onJump={choose}
        empty={comments.length > 0 ? <p className="muted small">{t('Select a passage in the preview to comment on it.')}</p> : undefined}
        describe={(id) => <><button type="button" className="office-comment-where" disabled={missing.includes(id)} onClick={() => choose(id)}>{comments.find((c) => c.id === id)?.anchor.quote}</button>
          {missing.includes(id) && <p className="muted small">{t('This passage was not found. The page may have changed.')}</p>}</>} />}
      {enabled && bubble && <SelectionBubble bubble={bubble} onComment={() => { setComposer(bubble); setBubble(null); }} />}
      {enabled && composer && <CommentComposer x={composer.x} y={Math.max(8, Math.min(composer.below + 8, (stage.current?.clientHeight ?? 400) - 220))} saving={busy} color={color} onColor={setColor} onAdd={(text) => { void add(text); }} onCancel={() => setComposer(null)} />}
    </div>
  </section>;
}
