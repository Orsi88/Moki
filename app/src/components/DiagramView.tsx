// A diagram is reviewed as a vector image; comments and viewport use the existing review store.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { api } from '../api';
import type { DiagramAnchor, DiagramComment, DiagramSettings, DiagramViewState } from '../../../scripts/lib/diagram-types';
import { t } from '../i18n';
import { SWATCH, isCommentColor, type CommentColor, type MdComment } from '../md-comments';
import { clampDiagramZoom, diagramFocus, diagramLayout, diagramPoint, diagramRegion, diagramVisible, fitDiagram, zoomDiagramAt, type DiagramPoint, type DiagramSize } from '../diagram-viewport';
import { sanitizeDiagramSvg } from '../diagram-svg';
import { CommentColumn, CommentComposer, useCommentPlacement, type CommentActions } from './CommentColumn';
import { IconChat, IconCode, IconCollapse, IconCopy, IconDownload, IconExpand, IconFitScreen, IconFitWidth, IconHand, IconRefresh, IconSelect } from './Icons';
import '../diagram-view.css';

interface Props { project?: string; path: string; source: string; kind: string; onReload: () => void; onExternal: () => void }
interface Picture { svg: string; size: DiagramSize; sourceHash: string; source: string }
type Settings = DiagramSettings;
type Mode = DiagramViewState['mode'];
const EMPTY_SIZE = { width: 1, height: 1 };
let sequence = 0;
const diagramError = (message: string) => {
  const http = /^Diagram rendering failed \(HTTP (\d+)\)\.$/.exec(message);
  return http ? t('Diagram rendering failed (HTTP {status}).', { status: http[1] }) : t(message);
};

async function pngOf(picture: Picture): Promise<string> {
  const scale = Math.min(2, 8192 / picture.size.width, 8192 / picture.size.height, Math.sqrt(64000000 / (picture.size.width * picture.size.height)));
  const url = URL.createObjectURL(new Blob([picture.svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('This diagram could not be exported.')); image.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(picture.size.width * scale)); canvas.height = Math.max(1, Math.round(picture.size.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This diagram could not be exported.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

export function DiagramView({ project, path, source, kind, onReload, onExternal }: Props) {
  const root = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), viewport = useRef<HTMLDivElement>(null), pictureBox = useRef<HTMLDivElement>(null), rail = useRef<HTMLDivElement>(null);
  const [picture, setPicture] = useState<Picture | null>(null), [url, setUrl] = useState(''), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [comments, setComments] = useState<DiagramComment[]>([]), [commentsOn, setCommentsOn] = useState(false), [active, setActive] = useState('');
  const [busy, setBusy] = useState(false), [revision, setRevision] = useState(0), [showSource, setShowSource] = useState(false), [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1), [mode, setMode] = useState<Mode>('select'), [viewSize, setViewSize] = useState<DiagramSize>(EMPTY_SIZE);
  const [space, setSpace] = useState(false);
  const [color, setColor] = useState<CommentColor>('yellow'), [composer, setComposer] = useState<{ anchor: DiagramAnchor; x: number; y: number } | null>(null);
  const [region, setRegion] = useState<ReturnType<typeof diagramRegion> | null>(null), [configOpen, setConfigOpen] = useState(false), [settings, setSettings] = useState<Settings>({ provider: 'local', url: '', allowRemote: false });
  const [copied, setCopied] = useState(false), [metadataReady, setMetadataReady] = useState(false);
  const request = useRef(0), working = useRef(false), restored = useRef(false), pendingView = useRef<DiagramViewState | null>(null), lastView = useRef<DiagramViewState | null>(null), viewTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), commentsPref = useRef<boolean | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; anchor: DiagramPoint | null; hand: boolean } | null>(null);
  const current = useRef({ picture, zoom, mode, viewSize, showSource }); current.current = { picture, zoom, mode, viewSize, showSource };

  const load = useCallback(async () => {
    const id = ++request.current;
    clearTimeout(viewTimer.current);
    setLoading(true); setError(''); setComposer(null); setRegion(null); restored.current = false;
    if (lastView.current) pendingView.current = lastView.current;
    try {
      if (!project) throw new Error('Open this diagram from a project to preview it.');
      const result = await api.renderDiagram(project, path);
      if (id !== request.current) return;
      let svg = result.svg ?? '';
      if (result.provider === 'local') {
        const mermaid = (await import('mermaid')).default;
        if (id !== request.current) return;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', htmlLabels: false, theme: 'neutral' });
        if (typeof result.source !== 'string') throw new Error('Invalid diagram source.');
        svg = (await mermaid.render(`moki-diagram-${++sequence}`, result.source)).svg;
      }
      const clean = sanitizeDiagramSvg(svg);
      if (id === request.current) setPicture({ ...clean, sourceHash: result.sourceHash, source: result.source ?? source });
    } catch (failure) { if (id === request.current) { setPicture(null); setError((failure as Error).message); } }
    finally { if (id === request.current) setLoading(false); }
  }, [project, path, source]);

  useEffect(() => { void load(); return () => { request.current++; }; }, [load, revision]);
  useEffect(() => {
    if (!project) return;
    let live = true;
    setComments([]); setMetadataReady(false); pendingView.current = null; lastView.current = null;
    void Promise.allSettled([api.diagramComments(project, path), api.diagramView(project, path), api.diagramSettings(project)]).then(([list, view, config]) => {
      if (!live) return;
      const saved = view.status === 'fulfilled' ? view.value : null;
      if (list.status === 'fulfilled') {
        setComments(list.value);
        const open = typeof saved?.commentsOpen === 'boolean' ? saved.commentsOpen : list.value.length > 0;
        commentsPref.current = typeof saved?.commentsOpen === 'boolean' ? saved.commentsOpen : null;
        setCommentsOn(open);
      }
      if (saved) pendingView.current = saved;
      if (config.status === 'fulfilled') setSettings(config.value);
      const failed = [list, view, config].find((result) => result.status === 'rejected');
      if (failed?.status === 'rejected') setError((failed.reason as Error).message);
      // Metadata may arrive after the image; trigger the layout restoration in either order.
      restored.current = false; setMetadataReady(true);
    });
    return () => { live = false; };
  }, [project, path]);

  useEffect(() => {
    if (!picture) { setUrl(''); return; }
    const next = URL.createObjectURL(new Blob([picture.svg], { type: 'image/svg+xml' }));
    setUrl(next); return () => URL.revokeObjectURL(next);
  }, [picture]);
  useLayoutEffect(() => {
    const box = viewport.current;
    if (!box) return;
    const measure = () => setViewSize((old) => old.width === box.clientWidth && old.height === box.clientHeight ? old : { width: box.clientWidth, height: box.clientHeight });
    const observer = new ResizeObserver(measure); observer.observe(box); measure();
    return () => observer.disconnect();
  }, [showSource, picture]);
  useLayoutEffect(() => {
    if (!picture || !viewport.current || viewSize.width <= 1 || restored.current || !metadataReady || showSource) return;
    restored.current = true;
    const saved = pendingView.current;
    const savedHere = saved?.sourceHash === picture.sourceHash ? saved : null;
    const nextZoom = savedHere?.zoom ?? fitDiagram(picture.size, viewSize, 'screen');
    if (savedHere) setMode(savedHere.mode);
    if (savedHere && diagramVisible(picture.size, viewSize, savedHere)) {
      setZoom(savedHere.zoom);
      requestAnimationFrame(() => { viewport.current?.scrollTo(savedHere.scrollLeft, savedHere.scrollTop); });
    } else {
      setZoom(nextZoom);
      const focus = diagramFocus(picture.size, viewSize, nextZoom);
      requestAnimationFrame(() => { viewport.current?.scrollTo(focus.scrollLeft, focus.scrollTop); });
    }
  }, [picture, viewSize, metadataReady, showSource]);

  const keepView = useCallback(() => {
    const value = current.current, box = viewport.current;
    if (!project || !value.picture || !box || !restored.current || value.showSource) return;
    lastView.current = { sourceHash: value.picture.sourceHash, zoom: value.zoom, scrollLeft: box.scrollLeft, scrollTop: box.scrollTop, mode: value.mode, ...(commentsPref.current === null ? {} : { commentsOpen: commentsPref.current }) };
    clearTimeout(viewTimer.current);
    const epoch = request.current, snapshot = lastView.current;
    viewTimer.current = setTimeout(() => {
      if (snapshot && epoch === request.current) void api.saveDiagramView(project, path, snapshot).catch((failure: Error) => {
        if (epoch === request.current && current.current.picture?.sourceHash === snapshot.sourceHash) setError(failure.message);
      });
    }, 400);
  }, [project, path]);
  useEffect(() => { keepView(); }, [zoom, mode, keepView]);
  const showComments = (open: boolean) => {
    commentsPref.current = open;
    setCommentsOn(open);
    clearTimeout(viewTimer.current);
    const value = current.current, box = viewport.current, base = lastView.current;
    if (!project || !value.picture || !box) return;
    const next: DiagramViewState = { sourceHash: value.picture.sourceHash, zoom: value.zoom, scrollLeft: box.scrollLeft, scrollTop: box.scrollTop, mode: base?.mode ?? value.mode, commentsOpen: open };
    lastView.current = next;
    void api.saveDiagramView(project, path, next).catch(() => {});
  };
  useEffect(() => () => {
    clearTimeout(viewTimer.current);
    if (project && lastView.current) void api.saveDiagramView(project, path, lastView.current).catch(() => {});
  }, [project, path]);

  const magnify = useCallback((next: number, point?: DiagramPoint) => {
    const box = viewport.current, value = current.current;
    if (!box || !value.picture) return;
    const target = clampDiagramZoom(next), scroll = zoomDiagramAt(value.picture.size, value.viewSize, { zoom: value.zoom, scrollLeft: box.scrollLeft, scrollTop: box.scrollTop }, target, point ?? { x: box.clientWidth / 2, y: box.clientHeight / 2 });
    setZoom(target); setComposer(null);
    requestAnimationFrame(() => { box.scrollTo(scroll.scrollLeft, scroll.scrollTop); keepView(); });
  }, [keepView]);
  useEffect(() => {
    const box = viewport.current;
    if (!box) return;
    const wheel = (event: WheelEvent) => {
      if (event.shiftKey && !event.ctrlKey && !event.metaKey) { event.preventDefault(); box.scrollLeft += event.deltaY || event.deltaX; return; }
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = box.getBoundingClientRect();
      magnify(current.current.zoom * Math.exp(-event.deltaY * 0.002), { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    box.addEventListener('wheel', wheel, { passive: false });
    return () => box.removeEventListener('wheel', wheel);
  }, [magnify, showSource, picture]);
  useEffect(() => {
    const change = () => setFullscreen(document.fullscreenElement === root.current);
    document.addEventListener('fullscreenchange', change); return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  const fit = (type: 'screen' | 'width') => {
    if (!picture || !viewport.current) return;
    const next = fitDiagram(picture.size, viewSize, type), focus = diagramFocus(picture.size, viewSize, next);
    setZoom(next); setComposer(null);
    requestAnimationFrame(() => { viewport.current?.scrollTo(focus.scrollLeft, focus.scrollTop); keepView(); });
  };
  const toggleSource = () => {
    if (!showSource) keepView();
    else { pendingView.current = lastView.current; restored.current = false; }
    setShowSource((value) => !value); setComposer(null);
  };
  const full = async () => {
    try { if (document.fullscreenElement === root.current) await document.exitFullscreen(); else await root.current?.requestFullscreen(); }
    catch (failure) { setError((failure as Error).message); }
  };

  const save = async (job: () => Promise<DiagramComment[]>): Promise<boolean> => {
    if (!project || working.current) return false;
    working.current = true; setBusy(true); setError('');
    try { setComments(await job()); return true; }
    catch (failure) { setError((failure as Error).message); return false; }
    finally { working.current = false; setBusy(false); }
  };
  const actions: CommentActions = {
    edit: (id, text) => { if (project) void save(() => api.changeDiagramComment(project, path, { op: 'edit', id, text })); },
    reply: (id, text) => { if (project) void save(() => api.changeDiagramComment(project, path, { op: 'reply', id, text })); },
    color: (id, color) => { if (project) void save(() => api.changeDiagramComment(project, path, { op: 'color', id, color })); },
    remove: (id) => { if (project) void save(() => api.removeDiagramComment(project, path, id)); },
  };
  const cards = useMemo<MdComment[]>(() => comments.map((comment) => ({ id: comment.id, author: comment.author, at: comment.date, text: comment.text, replies: comment.replies ?? [],
    ...(isCommentColor(comment.color) ? { color: comment.color } : {}) })), [comments]);
  const markOf = useCallback((_body: HTMLElement, id: string) => {
    const comment = comments.find((c) => c.id === id), canvas = pictureBox.current, box = viewport.current;
    if (showSource || !comment || !picture || comment.anchor.sourceHash !== picture.sourceHash || !canvas || !box) return null;
    const rect = canvas.getBoundingClientRect(), clip = box.getBoundingClientRect(), anchor = comment.anchor;
    const x = rect.left + anchor.x * rect.width, y = rect.top + anchor.y * rect.height;
    const width = Math.max(4, anchor.width * rect.width), height = Math.max(4, anchor.height * rect.height);
    if (x + width < clip.left || x > clip.right || y + height < clip.top || y > clip.bottom) return null;
    return { getBoundingClientRect: () => DOMRect.fromRect({ x: Math.max(clip.left, x), y: Math.max(clip.top, y), width: Math.max(0, Math.min(clip.right, x + width) - Math.max(clip.left, x)), height: Math.max(0, Math.min(clip.bottom, y + height) - Math.max(clip.top, y)) }) };
  }, [comments, picture, zoom, viewSize, showSource]);
  const placed = useCommentPlacement(stage, viewport, rail, cards, markOf);
  const choose = (id: string) => {
    const comment = comments.find((c) => c.id === id), box = viewport.current;
    setActive(id); showComments(true);
    if (!comment || !picture || comment.anchor.sourceHash !== picture.sourceHash || !box) return;
    const layout = diagramLayout(picture.size, viewSize, zoom);
    box.scrollTo({ left: Math.max(0, layout.left + (comment.anchor.x + comment.anchor.width / 2) * picture.size.width * zoom - box.clientWidth / 2),
      top: Math.max(0, layout.top + (comment.anchor.y + comment.anchor.height / 2) * picture.size.height * zoom - box.clientHeight / 2), behavior: 'smooth' });
  };
  const pointAt = (event: { clientX: number; clientY: number }): DiagramPoint | null => {
    const box = viewport.current;
    if (!box || !picture) return null;
    const rect = box.getBoundingClientRect();
    return diagramPoint(picture.size, viewSize, { zoom, scrollLeft: box.scrollLeft, scrollTop: box.scrollTop }, { x: event.clientX - rect.left, y: event.clientY - rect.top });
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (!picture || showSource || composer || !(event.button === 0 || event.button === 1) || (event.target as HTMLElement).closest('button')) return;
    const hand = mode !== 'comment' || space || event.button === 1;
    if (!hand && mode !== 'comment') return;
    const anchor = pointAt(event);
    if (!hand && !anchor) return;
    const box = event.currentTarget;
    event.preventDefault(); box.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: box.scrollLeft, top: box.scrollTop, anchor, hand };
    if (anchor && !hand) setRegion(diagramRegion(anchor, anchor));
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const moving = drag.current;
    if (!moving || moving.id !== event.pointerId) return;
    if (moving.hand) event.currentTarget.scrollTo(moving.left - event.clientX + moving.x, moving.top - event.clientY + moving.y);
    else if (moving.anchor) { const point = pointAt(event); if (point) setRegion(diagramRegion(moving.anchor, point)); }
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const moving = drag.current; drag.current = null;
    if (!moving || moving.id !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!moving.hand && moving.anchor && picture && project && stage.current) {
      const end = pointAt(event), bounds = end ? diagramRegion(moving.anchor, end) : region ?? diagramRegion(moving.anchor, moving.anchor), rect = stage.current.getBoundingClientRect();
      setComposer({ anchor: { kind: 'diagram', ...bounds, sourceHash: picture.sourceHash }, x: Math.max(8, Math.min(event.clientX - rect.left, stage.current.clientWidth - 310)), y: Math.max(8, Math.min(event.clientY - rect.top + 12, stage.current.clientHeight - 250)) });
    }
    setRegion(null); keepView();
  };

  const exportImage = async (format: 'svg' | 'png' | 'copy') => {
    if (!project || !picture || working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      if (format === 'copy') { await api.copyDiagramImage(project, path, await pngOf(picture)); setCopied(true); setTimeout(() => setCopied(false), 1500); }
      else await api.exportDiagram(project, path, format, format === 'svg' ? picture.svg : await pngOf(picture));
    } catch (failure) { setError((failure as Error).message); }
    finally { working.current = false; setBusy(false); }
  };
  const configure = async () => {
    if (!project || busy) return;
    setBusy(true); setError('');
    try { setSettings(await api.saveDiagramSettings(project, settings)); setConfigOpen(false); setRevision((n) => n + 1); }
    catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  };
  const layout = diagramLayout(picture?.size ?? EMPTY_SIZE, viewSize, zoom);
  const regionStyle = (anchor: ReturnType<typeof diagramRegion>) => ({ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%`, width: `${anchor.width * 100}%`, height: `${anchor.height * 100}%` });

  return <div className="diagram-view" ref={root}>
    <div className="diagram-tools pdf-bar" role="toolbar" aria-label={t('Diagram tools')}>
      <div className="view-toggle" role="group" aria-label={t('Diagram interaction')}>
        <button type="button" className={mode === 'select' ? 'on' : ''} title={t('Select')} aria-label={t('Select')} aria-pressed={mode === 'select'} onClick={() => setMode('select')}><IconSelect size={16} /></button>
        <button type="button" className={mode === 'hand' ? 'on' : ''} title={t('Pan diagram')} aria-label={t('Pan diagram')} aria-pressed={mode === 'hand'} onClick={() => setMode('hand')}><IconHand size={16} /></button>
        <button type="button" className={mode === 'comment' ? 'on' : ''} disabled={!project || !picture} title={t('Comment on a diagram region')} aria-label={t('Comment on a diagram region')} aria-pressed={mode === 'comment'} onClick={() => setMode('comment')}><IconChat size={16} /></button>
      </div>
      <div className="pdf-zoom">
        <button type="button" className="icon-btn" title={t('Zoom out')} aria-label={t('Zoom out')} disabled={!picture || zoom <= 0.25} onClick={() => magnify(zoom - 0.25)}>−</button>
        <button type="button" className="icon-btn diagram-zoom-value" title={t('Reset zoom')} aria-label={t('Reset zoom')} disabled={!picture} onClick={() => magnify(1)}>{Math.round(zoom * 100)}%</button>
        <button type="button" className="icon-btn" title={t('Zoom in')} aria-label={t('Zoom in')} disabled={!picture || zoom >= 5} onClick={() => magnify(zoom + 0.25)}>+</button>
      </div>
      <button type="button" className="icon-btn" title={t('Fit diagram to screen')} aria-label={t('Fit diagram to screen')} disabled={!picture} onClick={() => fit('screen')}><IconFitScreen size={16} /></button>
      <button type="button" className="icon-btn" title={t('Fit diagram to width')} aria-label={t('Fit diagram to width')} disabled={!picture} onClick={() => fit('width')}><IconFitWidth size={16} /></button>
      <button type="button" className="icon-btn" title={fullscreen ? t('Exit fullscreen') : t('Fullscreen')} aria-label={fullscreen ? t('Exit fullscreen') : t('Fullscreen')} onClick={() => { void full(); }}>{fullscreen ? <IconCollapse size={16} /> : <IconExpand size={16} />}</button>
      <span className="diagram-tool-spacer" />
      <button type="button" className={`icon-btn${showSource ? ' on' : ''}`} title={t('Diagram source')} aria-label={t('Diagram source')} aria-pressed={showSource} onClick={toggleSource}><IconCode size={16} /></button>
      <button type="button" className={`btn btn-ghost btn-sm pdf-rail-toggle${commentsOn ? ' on' : ''}`} title={t('Comments')} aria-label={`${t('Comments')} (${comments.length})`} aria-pressed={commentsOn} onClick={() => showComments(!commentsOn)}><IconChat size={14} />{comments.length > 0 && <span className="pdf-rail-count">{comments.length}</span>}</button>
      <button type="button" className="icon-btn" title={copied ? t('Copied') : t('Copy diagram image')} aria-label={copied ? t('Copied') : t('Copy diagram image')} disabled={!picture || busy} onClick={() => { void exportImage('copy'); }}><IconCopy size={16} /></button>
      <details className="diagram-export"><summary className="icon-btn" title={t('Export diagram')} aria-label={t('Export diagram')}><IconDownload size={16} /></summary><div>
        <button type="button" className="link-btn" disabled={!picture || busy} onClick={() => { void exportImage('svg'); }}>{t('Export SVG')}</button>
        <button type="button" className="link-btn" disabled={!picture || busy} onClick={() => { void exportImage('png'); }}>{t('Export PNG')}</button>
      </div></details>
      <button type="button" className="icon-btn" title={t('Reload this file')} aria-label={t('Reload this file')} disabled={loading} onClick={() => { onReload(); setRevision((n) => n + 1); }}><IconRefresh size={16} /></button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfigOpen((open) => !open)} aria-expanded={configOpen}>{t('Diagram renderer')}</button>
    </div>
    {configOpen && <div className="diagram-settings">
      <label>{t('Diagram renderer')}<select value={settings.provider} onChange={(event) => setSettings({ ...settings, provider: event.target.value as Settings['provider'] })}><option value="local">{t('Local Mermaid (offline)')}</option><option value="kroki">Kroki</option></select></label>
      {settings.provider === 'kroki' && <><label>{t('Kroki server URL')}<input type="url" value={settings.url} placeholder="http://localhost:8000" onChange={(event) => setSettings({ ...settings, url: event.target.value, allowRemote: false })} /></label>
        <label className="diagram-consent"><input type="checkbox" checked={settings.allowRemote} onChange={(event) => setSettings({ ...settings, allowRemote: event.target.checked })} />{t('Allow sending diagram source to this remote server')}</label>
        <p className="muted small">{t('A local Kroki server keeps diagrams on this computer. Remote servers receive the diagram source only after this setting is saved.')}</p></>}
      <div className="pdf-actions"><button type="button" className="btn btn-sm" disabled={busy} onClick={() => { void configure(); }}>{t('Save')}</button><button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfigOpen(false)}>{t('Cancel')}</button></div>
    </div>}
    {error && <div className="diagram-notice" role="alert"><span>{diagramError(error)}</span><button type="button" className="link-btn" onClick={() => setConfigOpen(true)}>{t('Configure renderer')}</button><button type="button" className="link-btn" onClick={onExternal}>{t('Open with the default program')}</button></div>}
    {loading && <p role="status" className="diagram-notice">{t('Drawing diagram…')}</p>}
    {mode === 'comment' && picture && !showSource && <p className="diagram-hint muted small">{t('Click a point or drag a region to comment. Ctrl+wheel zooms around the pointer.')}</p>}
    <div ref={stage} className={`diagram-commented${commentsOn ? ' with-rail' : ''}`}>
      <div className={`diagram-viewport ${space ? 'hand' : mode}`} ref={viewport} tabIndex={0} aria-label={t('Diagram canvas')} onScroll={keepView}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; setRegion(null); }}
        onBlur={() => setSpace(false)} onKeyUp={(event) => { if (event.key === ' ') setSpace(false); }}
        onKeyDown={(event) => { if (event.key === 'Escape') { setComposer(null); setRegion(null); } else if (!showSource && !event.ctrlKey && !event.metaKey) {
          if (event.key === ' ') { event.preventDefault(); setSpace(true); }
          else if (event.key === '+' || event.key === '=') { event.preventDefault(); magnify(zoom + 0.25); }
          else if (event.key === '-') { event.preventDefault(); magnify(zoom - 0.25); }
          else if (event.key === '0') { event.preventDefault(); magnify(1); }
          else if (event.key.toLowerCase() === 'h') setMode('hand');
          else if (event.key.toLowerCase() === 'v') setMode('select');
          else if (event.key.toLowerCase() === 'c' && project) setMode('comment');
        } }}>
        {showSource ? <pre className="plain code-view diagram-source" aria-label={t('Diagram source')}><code>{picture?.source ?? source}</code></pre> : <div className="diagram-scroll-area" style={{ width: layout.width, height: layout.height }}>
          {picture && url && <div ref={pictureBox} className="diagram-image" style={{ left: layout.left, top: layout.top, width: picture.size.width * zoom, height: picture.size.height * zoom }}>
            <img src={url} alt={t('{kind} diagram', { kind })} draggable={false} />
            {comments.filter((comment) => comment.anchor.sourceHash === picture.sourceHash).map((comment) => <button key={comment.id} type="button" className={`diagram-mark${active === comment.id ? ' on' : ''}${comment.anchor.width === 0 && comment.anchor.height === 0 ? ' point' : ''}`}
              style={{ ...regionStyle(comment.anchor), borderColor: isCommentColor(comment.color) ? SWATCH[comment.color] : undefined }} title={comment.text} aria-label={t('Open the comment: {text}', { text: comment.text })} onClick={() => choose(comment.id)} />)}
            {region && <span className="diagram-region" style={regionStyle(region)} />}
          </div>}
        </div>}
      </div>
      <CommentColumn comments={cards} placed={placed} rail={rail} shown={commentsOn} hidden={false} active={active} onActive={setActive} saving={busy} actions={actions} onJump={choose}
        describe={(id) => { const comment = comments.find((item) => item.id === id); return <>{picture && comment?.anchor.sourceHash !== picture.sourceHash && <p className="diagram-missing muted small">{t('The diagram source changed. This region could not be located.')}</p>}</>; }} />
      {composer && <CommentComposer x={composer.x} y={composer.y} saving={busy} color={color} onColor={setColor} onCancel={() => setComposer(null)} onAdd={(text) => {
        if (project) void save(() => api.addDiagramComment(project, path, composer.anchor, text, color)).then((ok) => { if (ok) { setComposer(null); showComments(true); } });
      }} />}
    </div>
  </div>;
}
