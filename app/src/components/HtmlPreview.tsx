// Local HTML runs only inside a sandboxed frame; document comments stay in the parent application.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { isHtmlAnchor, isHtmlAreaAnchor, type HtmlAnchor, type HtmlComment } from '../../../scripts/lib/html-comments';
import { isCommentColor, type CommentColor, type MdComment } from '../md-comments';
import { t } from '../i18n';
import { IconChat, IconExternal, IconFitScreen, IconRefresh } from './Icons';
import { CommentColumn, CommentComposer, SelectionBubble, useCommentPlacement, type Bubble, type CommentActions } from './CommentColumn';
import { MarkerContextMenu, MarkerMenu } from './Markers';
import type { Marker } from '../api';
import { markerColor, markerLabel, splitMarker, useMarkers } from '../markers';

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
  const markers = useMarkers();
  const [markerMenu, setMarkerMenu] = useState<string | null>(null);
  // The markers menu: on a right-click over selected text, or when an area has been dragged (then with "Comment…").
  const [marking, setMarking] = useState<{ anchor: HtmlAnchor; left: number; top: number; place: Bubble } | null>(null);
  // "Mark an area": the page takes a dragged rectangle (the frame draws it and sends it back) instead of a selection.
  const [areaMode, setAreaMode] = useState(false);
  const areaRef = useRef(false);
  const setArea = (on: boolean) => { areaRef.current = on; setAreaMode(on); frame.current?.contentWindow?.postMessage({ type: 'moki:area-mode', on }, '*'); };
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
      if (data.type === 'moki:area') {
        if (!isHtmlAreaAnchor(data.anchor) || !isRect(data.rect) || !stage.current || !frame.current) return;
        const origin = stage.current.getBoundingClientRect(), rect = frame.current.getBoundingClientRect();
        const left = rect.left + data.rect.left - origin.left, top = rect.top + data.rect.top - origin.top;
        areaRef.current = false; setAreaMode(false); frame.current.contentWindow?.postMessage({ type: 'moki:area-mode', on: false }, '*');
        setBubble(null);
        const place = { x: Math.max(8, Math.min(left, stage.current.clientWidth - 300)), y: top, below: top + data.rect.height, why: '' };
        setMarking({ anchor: data.anchor, left: rect.left + data.rect.left + data.rect.width, top: rect.top + data.rect.top + data.rect.height, place });
      }
      if (data.type === 'moki:context') {
        if (!isHtmlAnchor(data.anchor) || !data.point || typeof data.point.x !== 'number' || typeof data.point.y !== 'number' || !frame.current || !stage.current) return;
        const rect = frame.current.getBoundingClientRect(), origin = stage.current.getBoundingClientRect();
        setBubble(null);
        setMarking({ anchor: data.anchor, left: rect.left + data.point.x, top: rect.top + data.point.y, place: { x: rect.left + data.point.x - origin.left, y: rect.top + data.point.y - origin.top, below: rect.top + data.point.y - origin.top + 16, why: '' } });
      }
      if (data.type === 'moki:preview-ready') { latestSend.current(); frame.current?.contentWindow?.postMessage({ type: 'moki:area-mode', on: areaRef.current }, '*'); }
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
  // The page runs in its frame: each marked passage's icon goes in the left margin from where the frame says it is.
  const margins = comments.flatMap((c) => {
    const marker = splitMarker(c.text, markers).marker, anchor = anchors.find((a) => a.id === c.id && a.visible);
    const box = frame.current?.getBoundingClientRect(), origin = stage.current?.getBoundingClientRect();
    if (!marker || !anchor || !box || !origin) return [];
    const scrollTop = stage.current?.scrollTop ?? 0, scrollLeft = stage.current?.scrollLeft ?? 0;
    return [{ id: c.id, text: c.text, icon: marker.icon, name: marker.name, color: markerColor(markers.find((m) => m.icon === marker.icon) ?? marker),
      left: Math.max(2, box.left - origin.left + scrollLeft + anchor.rect.left - 30), top: box.top - origin.top + scrollTop + anchor.rect.top + anchor.rect.height / 2 - 11 }];
  });
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
    {enabled && <button type="button" className={'btn btn-ghost btn-sm pdf-area-toggle' + (areaMode ? ' on' : '')} aria-pressed={areaMode} title={t('Drag a rectangle on the page to mark or comment on that area')}
      onClick={() => { setArea(!areaMode); setComposer(null); setBubble(null); }}><IconFitScreen size={14} /> {t('Mark an area')}</button>}
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
        describe={(id) => <><button type="button" className="office-comment-where" disabled={missing.includes(id)} onClick={() => choose(id)}>{(() => { const anchor = comments.find((c) => c.id === id)?.anchor; return anchor && 'quote' in anchor ? anchor.quote : t('Area of the page'); })()}</button>
          {missing.includes(id) && <p className="muted small">{t('This passage was not found. The page may have changed.')}</p>}</>} />}
      {enabled && margins.map((m) => <button key={`margin-${m.id}`} type="button" className={`marker-margin${markerMenu === m.id ? ' on' : ''}`} data-marker-color={m.color} style={{ left: m.left, top: m.top }}
        title={m.name} aria-label={t('Marker {name}', { name: m.name })} aria-expanded={markerMenu === m.id} disabled={busy}
        onMouseEnter={() => { setActive(m.id); send(m.id); }} onClick={() => setMarkerMenu(markerMenu === m.id ? null : m.id)}>{m.icon}</button>)}
      {enabled && markerMenu && (() => {
        const m = margins.find((x) => x.id === markerMenu);
        if (!m) return null;
        return <MarkerMenu markers={markers} text={m.text} left={m.left + 28} top={m.top - 4} disabled={busy}
          onText={(next) => { actions.edit(m.id, next); setCommentsOn(true); }} onRemove={() => actions.remove(m.id)} onClose={() => setMarkerMenu(null)} />;
      })()}
      {enabled && marking && <MarkerContextMenu markers={markers} left={marking.left} top={marking.top} onClose={() => setMarking(null)}
        onComment={'kind' in marking.anchor ? () => setComposer({ ...marking.place, anchor: marking.anchor }) : undefined}
        onPick={(m: Marker) => { if (project) void save(() => api.addHtmlComment(project, title, marking.anchor, markerLabel(m), markerColor(m))).then((ok) => { if (ok) frame.current?.contentWindow?.postMessage({ type: 'moki:clear-selection' }, '*'); }); }} />}
      {enabled && bubble && <SelectionBubble bubble={bubble} onComment={() => { setComposer(bubble); setBubble(null); }} />}
      {enabled && composer && <CommentComposer x={composer.x} y={Math.max(8, Math.min(composer.below + 8, (stage.current?.clientHeight ?? 400) - 220))} saving={busy} color={color} onColor={setColor} onAdd={(text) => { void add(text); }} onCancel={() => setComposer(null)} />}
    </div>
  </section>;
}
