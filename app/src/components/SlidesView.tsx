// A presentation (.pptx) shown as slides: thumbnails, the current slide, its speaker notes (edited in place), the
// comments beside the slide (an area marked on it, or the whole slide), and Present (full screen).
// The slides are read from the file's moki-file:// URL and drawn here by pptxtojson; the text of the file goes through
// sanitizeSlideHtml (app/src/slide-html.ts) before it is drawn. Notes and comments are read and written by the service
// in the file itself (scripts/lib/office-slides.ts), in PowerPoint's own format.
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from 'react';
import type { Chart, CommonChart, Element as SlideElement, Slide, Table } from 'pptxtojson';
import { api, type DeckNotes, type Marker, type SlideChange } from '../api';
import type { SlideComment } from '../../../scripts/lib/office-types';
import { createDebouncer, onFlushEdits } from '../debounce';
import { t } from '../i18n';
import { isCommentColor, SWATCH, type CommentColor, type MdComment } from '../md-comments';
import { markerColor, markerLabel, markerOnly, splitMarker, useMarkers } from '../markers';
import { recall, remember } from '../prefs';
import { borderCss, byOrder, cropBox, fillCss, notesText, safeColor, safeImage, shadowCss, transformCss, vAlignCss } from '../slides';
import { sanitizeSlideHtml } from '../slide-html';
import { CommentColumn, CommentComposer, useCommentPlacement, type CommentActions } from './CommentColumn';
import { IconChat, IconChevron, IconExternal, IconFitScreen, IconNotes, IconPresent } from './Icons';
import { MarkerContextMenu, MarkerMenu } from './Markers';
import { Notice } from './Notice';

interface Deck { slides: Slide[]; width: number; height: number }
const PT = 4 / 3; // CSS pixels per point

// Every text of the deck cleaned once, right after reading (the drawing below only places what is already safe).
function prepare(slides: Slide[]): Slide[] {
  const clean = (el: SlideElement): SlideElement => {
    if (el.type === 'text' || el.type === 'shape') return { ...el, content: sanitizeSlideHtml(el.content, true) };
    if (el.type === 'table') return { ...el, data: el.data.map((row) => row.map((cell) => ({ ...cell, text: sanitizeSlideHtml(cell.text) }))) };
    if (el.type === 'group') return { ...el, elements: el.elements.map(clean) as typeof el.elements };
    if (el.type === 'diagram') return { ...el, elements: el.elements.map((e) => clean(e) as typeof e) };
    return el;
  };
  return slides.map((s) => ({ ...s, elements: s.elements.map(clean), layoutElements: (s.layoutElements ?? []).map(clean), note: notesText(s.note ?? '') }));
}

const box = (el: { left: number; top: number; width: number; height: number }, extra: CSSProperties = {}): CSSProperties =>
  ({ left: `${el.left}pt`, top: `${el.top}pt`, width: `${el.width}pt`, height: `${el.height}pt`, ...extra });

function TextBody({ el }: { el: { content: string; vAlign: string; textInset?: { l: number; t: number; r: number; b: number }; autoFit?: { fontScale?: number }; isVertical?: boolean; wrap?: boolean } }) {
  if (!el.content) return null;
  const inset = el.textInset ?? { l: 7.2, t: 3.6, r: 7.2, b: 3.6 };
  const scale = el.autoFit?.fontScale && el.autoFit.fontScale < 100 ? el.autoFit.fontScale / 100 : el.autoFit?.fontScale && el.autoFit.fontScale < 1 ? el.autoFit.fontScale : 1;
  return (
    <div className="slide-text" style={{ justifyContent: vAlignCss(el.vAlign), padding: `${inset.t}pt ${inset.r}pt ${inset.b}pt ${inset.l}pt`, writingMode: el.isVertical ? 'vertical-rl' : undefined, whiteSpace: el.wrap === false ? 'nowrap' : undefined }}>
      <div style={scale !== 1 ? { zoom: scale } : undefined} dangerouslySetInnerHTML={{ __html: el.content }} />
    </div>
  );
}

function TableEl({ el }: { el: Table }) {
  const cellBorder = (b?: { borderColor: string; borderWidth: number; borderType: string }) => (b ? borderCss(b.borderWidth, b.borderType, b.borderColor) : '');
  return (
    <div className="slide-el" style={box(el)}>
      <table className="slide-table" style={{ width: `${el.width}pt` }}>
        <colgroup>{el.colWidths.map((w, i) => <col key={i} style={{ width: `${w}pt` }} />)}</colgroup>
        <tbody>
          {el.data.map((row, r) => (
            <tr key={r} style={{ height: el.rowHeights[r] ? `${el.rowHeights[r]}pt` : undefined }}>
              {row.map((cell, c) => (cell.hMerge || cell.vMerge ? null : (
                <td key={c} rowSpan={cell.rowSpan} colSpan={cell.colSpan} style={{
                  background: safeColor(cell.fillColor) || undefined, color: safeColor(cell.fontColor) || undefined, fontWeight: cell.fontBold ? 700 : undefined,
                  verticalAlign: cell.vAlign === 'mid' ? 'middle' : cell.vAlign === 'down' ? 'bottom' : 'top',
                  borderTop: cellBorder(cell.borders?.top) || undefined, borderBottom: cellBorder(cell.borders?.bottom) || undefined,
                  borderLeft: cellBorder(cell.borders?.left) || undefined, borderRight: cellBorder(cell.borders?.right) || undefined,
                }} dangerouslySetInnerHTML={{ __html: cell.text }} />
              )))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PALETTE = ['#156082', '#e97132', '#196b24', '#0f9ed5', '#a02b93', '#4ea72e'];
// The common charts drawn from their data (bars, columns, lines, areas, pies, doughnuts); any other kind shows its name.
function ChartEl({ el }: { el: Chart }) {
  const W = el.width, H = el.height;
  const color = (i: number) => safeColor(el.colors?.[i]) || PALETTE[i % PALETTE.length];
  let body: ReactNode = null;
  if (el.chartType !== 'scatterChart' && el.chartType !== 'bubbleChart') {
    const series = (el as CommonChart).data ?? [];
    const labels = series[0]?.values.map((v) => v.x) ?? [];
    const kind = el.chartType.replace('3D', '');
    if ((kind === 'pieChart' || kind === 'doughnutChart') && series[0]) {
      const values = series[0].values.map((v) => Math.max(0, Number(v.y) || 0)), total = values.reduce((a, b) => a + b, 0) || 1;
      const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.4, hole = kind === 'doughnutChart' ? r * 0.5 : 0;
      let angle = -Math.PI / 2;
      body = values.map((v, i) => {
        const a = (v / total) * Math.PI * 2, end = angle + a, large = a > Math.PI ? 1 : 0;
        const p = (rad: number, rr: number) => `${cx + rr * Math.cos(rad)},${cy + rr * Math.sin(rad)}`;
        const d = a >= Math.PI * 2 - 1e-6
          ? `M${p(0, r)}A${r},${r} 0 1 1 ${p(Math.PI, r)}A${r},${r} 0 1 1 ${p(0, r)}Z`
          : `M${p(angle, r)}A${r},${r} 0 ${large} 1 ${p(end, r)}L${hole ? p(end, hole) : `${cx},${cy}`}${hole ? `A${hole},${hole} 0 ${large} 0 ${p(angle, hole)}` : ''}Z`;
        angle = end;
        return <path key={i} d={d} fill={color(i)} stroke="#fff" strokeWidth={1} />;
      });
    } else if (series.length) {
      const pad = { l: 28, r: 8, t: 10, b: 22 }, w = W - pad.l - pad.r, h = H - pad.t - pad.b;
      const all = series.flatMap((s) => s.values.map((v) => Number(v.y) || 0));
      const max = Math.max(0, ...all), min = Math.min(0, ...all), span = max - min || 1;
      const y = (v: number) => pad.t + h - ((v - min) / span) * h;
      const n = Math.max(1, labels.length);
      const horizontal = (el as { barDir?: string }).barDir === 'bar' && kind === 'barChart';
      const parts: ReactNode[] = [<line key="axis" x1={pad.l} y1={y(0)} x2={pad.l + w} y2={y(0)} stroke="#999" strokeWidth={0.6} />];
      if (kind === 'barChart' && !horizontal) {
        const group = w / n, bar = (group * 0.7) / series.length;
        series.forEach((s, si) => s.values.forEach((v, i) => {
          const val = Number(v.y) || 0, top = Math.min(y(val), y(0));
          parts.push(<rect key={`${si}-${i}`} x={pad.l + i * group + group * 0.15 + si * bar} y={top} width={bar} height={Math.abs(y(val) - y(0))} fill={color(si)} />);
        }));
      } else if (kind === 'barChart') {
        const x = (v: number) => pad.l + ((v - min) / span) * w, group = h / n, bar = (group * 0.7) / series.length;
        series.forEach((s, si) => s.values.forEach((v, i) => {
          const val = Number(v.y) || 0;
          parts.push(<rect key={`${si}-${i}`} x={Math.min(x(val), x(0))} y={pad.t + i * group + group * 0.15 + si * bar} width={Math.abs(x(val) - x(0))} height={bar} fill={color(si)} />);
        }));
      } else {
        const step = n > 1 ? w / (n - 1) : 0;
        series.forEach((s, si) => {
          const pts = s.values.map((v, i) => `${pad.l + i * step},${y(Number(v.y) || 0)}`);
          if (kind === 'areaChart') parts.push(<polygon key={`a${si}`} points={`${pad.l},${y(0)} ${pts.join(' ')} ${pad.l + (n - 1) * step},${y(0)}`} fill={color(si)} opacity={0.7} />);
          else parts.push(<polyline key={`l${si}`} points={pts.join(' ')} fill="none" stroke={color(si)} strokeWidth={2} />);
        });
      }
      if (!horizontal) labels.forEach((label, i) => parts.push(
        <text key={`x${i}`} x={pad.l + (kind === 'barChart' ? (i + 0.5) * (w / n) : n > 1 ? i * (w / (n - 1)) : 0)} y={H - 6} fontSize={9} textAnchor="middle" fill="#555">{String(label).slice(0, 14)}</text>,
      ));
      body = parts;
    }
  }
  return (
    <div className="slide-el" style={box(el)}>
      {body ? <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={t('Chart')}>{body}</svg>
        : <div className="slide-placeholder">{t('Chart')}</div>}
    </div>
  );
}

function El({ el }: { el: SlideElement }): ReactNode {
  switch (el.type) {
    case 'text':
      return (
        <div className="slide-el" style={box(el, { background: fillCss(el.fill) || undefined, border: borderCss(el.borderWidth, el.borderType, el.borderColor) || undefined, transform: transformCss(el.rotate, el.isFlipH, el.isFlipV) || undefined })}>
          <TextBody el={el} />
        </div>
      );
    case 'shape': {
      const fill = fillCss(el.fill), stroke = safeColor(el.borderColor);
      const gradient = el.fill?.type === 'gradient' || el.fill?.type === 'image';
      return (
        <div className="slide-el" style={box(el, { transform: transformCss(el.rotate, el.isFlipH, el.isFlipV) || undefined, filter: shadowCss(el.shadow) || undefined })}>
          {el.path && el.pathViewBox ? (
            <svg className="slide-shape" width="100%" height="100%" viewBox={`${el.pathViewBox.x} ${el.pathViewBox.y} ${el.pathViewBox.width} ${el.pathViewBox.height}`} preserveAspectRatio="none" overflow="visible">
              {gradient && <clipPath id={`clip-${el.id}-${el.order}`}><path d={el.path} /></clipPath>}
              {gradient && <foreignObject x={el.pathViewBox.x} y={el.pathViewBox.y} width={el.pathViewBox.width} height={el.pathViewBox.height} clipPath={`url(#clip-${el.id}-${el.order})`}><div style={{ width: '100%', height: '100%', background: fill }} /></foreignObject>}
              <path d={el.path} fill={gradient || el.strokeOnly ? 'none' : (fill || 'none')} stroke={el.borderWidth > 0 && stroke ? stroke : 'none'}
                strokeWidth={el.borderWidth} strokeDasharray={el.borderStrokeDasharray && el.borderStrokeDasharray !== '0' ? el.borderStrokeDasharray : undefined} vectorEffect="non-scaling-stroke" />
            </svg>
          ) : <div className="slide-fill" style={{ background: fill || undefined, border: borderCss(el.borderWidth, el.borderType, el.borderColor) || undefined }} />}
          <TextBody el={el} />
        </div>
      );
    }
    case 'image': {
      const src = safeImage(el.base64);
      return (
        <div className="slide-el slide-image" style={box(el, { transform: transformCss(el.rotate, el.isFlipH, el.isFlipV) || undefined, borderRadius: el.geom === 'ellipse' ? '50%' : el.geom === 'roundRect' ? '8%' : undefined, border: borderCss(el.borderWidth, el.borderType, el.borderColor) || undefined })}>
          {src && <img src={src} alt="" draggable={false} style={{ position: 'absolute', ...cropBox(el.rect) }} />}
        </div>
      );
    }
    case 'table': return <TableEl el={el} />;
    case 'chart': return <ChartEl el={el} />;
    case 'math': {
      const src = safeImage(el.picBase64);
      return <div className="slide-el" style={box(el)}>{src ? <img src={src} alt={el.latex} style={{ width: '100%', height: '100%' }} /> : <div className="slide-placeholder">{el.text || el.latex}</div>}</div>;
    }
    case 'video':
    case 'audio':
      return <div className="slide-el" style={box(el)}><div className="slide-placeholder">{t(el.type === 'video' ? 'Video: open the file to play it' : 'Audio: open the file to play it')}</div></div>;
    case 'group':
    case 'diagram':
      return (
        <div className="slide-el" style={box(el, el.type === 'group' ? { transform: transformCss(el.rotate, el.isFlipH, el.isFlipV) || undefined } : {})}>
          {byOrder(el.elements as SlideElement[]).map((child, i) => <El key={`${child.id ?? ''}-${i}`} el={child} />)}
        </div>
      );
    default: return null;
  }
}

// One slide drawn at its size in points, scaled to `width` CSS pixels.
const SlideCanvas = memo(function SlideCanvas({ slide, deck, width }: { slide: Slide; deck: Deck; width: number }) {
  const scale = width / (deck.width * PT);
  return (
    <div className="slide-canvas" style={{ width, height: deck.height * PT * scale }}>
      <div className="slide-page" style={{ width: `${deck.width}pt`, height: `${deck.height}pt`, transform: `scale(${scale})`, background: fillCss(slide.fill) || '#fff' }}>
        {byOrder(slide.layoutElements ?? []).map((el, i) => <El key={`l${i}`} el={el} />)}
        {byOrder(slide.elements).map((el, i) => <El key={`e${i}`} el={el} />)}
      </div>
    </div>
  );
});

// The largest width at which the deck's slides fit `w` x `h`.
const fitWidth = (deck: Deck, w: number, h: number) => Math.max(40, Math.min(w, h * (deck.width / deck.height)));

type Info = DeckNotes & { version: string };
type Area = SlideComment['area'] & {};
const WHOLE = (a: Area | undefined) => !a || (a.x <= 0.001 && a.y <= 0.001 && a.w >= 0.999 && a.h >= 0.999);
const changeKey = (change: SlideChange) => (change.op === 'notes' ? `notes:${change.slide}` : `${change.op}:${Date.now()}:${Math.random()}`);

// Notes and comment changes, saved one after the other against the version the last save returned (the service
// refuses a change made against another version). A notes edit waits for a pause in the typing; the rest goes at once.
function useSlideEdits(project: string | undefined, path: string, info: Info | null, onSaved: (next: Info) => void) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef(new Map<string, SlideChange>()), working = useRef(false), version = useRef('');
  if (info && !working.current) version.current = info.version;
  const saved = useRef(onSaved); saved.current = onSaved;
  const drain = useRef<() => void>(() => {});
  drain.current = () => {
    if (!project || working.current || !pending.current.size) return;
    working.current = true; setBusy(true);
    void (async () => {
      while (pending.current.size) {
        const [key, change] = pending.current.entries().next().value as [string, SlideChange];
        pending.current.delete(key);
        try {
          const next = await api.editSlides(project, path, version.current, change);
          version.current = next.version; saved.current(next); setError('');
        } catch (e) {
          if (!pending.current.has(key)) pending.current.set(key, change);
          setError((e as Error).message); break;
        }
      }
    })().finally(() => { working.current = false; setBusy(false); });
  };
  const debounce = useMemo(() => createDebouncer(() => drain.current(), 700), []);
  useEffect(() => {
    const off = onFlushEdits(() => { debounce.flush(); drain.current(); });
    return () => { off(); debounce.flush(); drain.current(); };
  }, [debounce]);
  const edit = (change: SlideChange) => {
    pending.current.set(changeKey(change), change);
    if (change.op === 'notes') debounce.call(); else { debounce.flush(); drain.current(); }
  };
  const flush = () => { debounce.flush(); drain.current(); };
  const draft = (slide: number) => { const c = pending.current.get(`notes:${slide}`); return c?.op === 'notes' ? c.text : undefined; };
  return { busy, error, edit, flush, draft };
}

export function SlidesView({ url, title, project, onOpenExternal }: { url: string; title: string; project?: string; onOpenExternal: () => void }) {
  const [deck, setDeck] = useState<Deck | null>(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [notesOn, setNotesOn] = useState(() => recall('qa-slide-notes') !== 'closed');
  const [commentsOn, setCommentsOn] = useState(() => recall('qa-slide-comments') !== 'closed');
  const [presenting, setPresenting] = useState(false);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [screen, setScreen] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [info, setInfo] = useState<Info | null>(null);
  const [noteText, setNoteText] = useState<Record<number, string>>({});
  const [active, setActive] = useState('');
  const [areaMode, setAreaMode] = useState(false);
  const [drawing, setDrawing] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [marking, setMarking] = useState<{ area: Area; left: number; top: number } | null>(null);
  const [composer, setComposer] = useState<{ area: Area; x: number; y: number } | null>(null);
  const [markerMenu, setMarkerMenu] = useState<string | null>(null);
  const [color, setColor] = useState<CommentColor>('yellow');
  const stage = useRef<HTMLDivElement>(null);
  const work = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const commentRail = useRef<HTMLDivElement>(null);
  const show = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const deckRef = useRef<Deck | null>(null); deckRef.current = deck;
  const own = useRef(''); // the version this view saved last: a reread caused by that save draws nothing again
  const markers = useMarkers();
  const edits = useSlideEdits(project, title, info, (next) => { own.current = next.version; setInfo(next); });

  useEffect(() => {
    let live = true;
    if (!deckRef.current) { setError(''); setIndex(0); }
    (async () => {
      const notes = project ? await api.slideNotes(project, title).catch(() => null) : null;
      if (!live) return;
      if (notes) setInfo(notes);
      if (deckRef.current && notes && notes.version === own.current) return;
      const response = await fetch(url);
      if (!response.ok) throw new Error(t('Could not read this presentation.'));
      const data = await response.arrayBuffer();
      const { parse } = await import('pptxtojson');
      const result = await parse(data, { imageMode: 'base64', videoMode: 'none', audioMode: 'none', singleLineSpacingFactor: 1.2 });
      if (!live) return;
      if (!result.slides.length) throw new Error(t('This presentation has no slides.'));
      setDeck({ slides: prepare(result.slides), width: result.size.width || 960, height: result.size.height || 540 });
      setIndex((i) => Math.min(i, result.slides.length - 1));
    })().catch(() => { if (live && !deckRef.current) setError(t('Could not read this presentation.')); });
    return () => { live = false; };
  }, [url, project, title]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const measure = () => setStageSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [deck, notesOn]);

  useEffect(() => {
    const change = () => {
      const on = document.fullscreenElement === show.current && Boolean(show.current);
      setPresenting(on);
      if (on) { setScreen({ w: window.innerWidth, h: window.innerHeight }); show.current?.focus(); }
      else root.current?.focus();
    };
    const resize = () => setScreen({ w: window.innerWidth, h: window.innerHeight });
    document.addEventListener('fullscreenchange', change);
    window.addEventListener('resize', resize);
    return () => { document.removeEventListener('fullscreenchange', change); window.removeEventListener('resize', resize); };
  }, []);

  const count = deck?.slides.length ?? 0;
  const go = useCallback((to: number) => { setIndex(Math.max(0, Math.min(count - 1, to))); setComposer(null); setMarking(null); setDrawing(null); setMarkerMenu(null); }, [count]);
  useEffect(() => { rail.current?.querySelector<HTMLElement>(`[data-slide="${index}"]`)?.scrollIntoView({ block: 'nearest' }); }, [index]);

  const present = () => { edits.flush(); void show.current?.requestFullscreen().catch(() => {}); };
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.target as HTMLElement).closest('textarea, input, [contenteditable="true"], [role="menu"], [role="dialog"]')) return; // typing notes or a comment
    const next = ['ArrowRight', 'ArrowDown', 'PageDown', ...(presenting ? [' ', 'Enter'] : [])], back = ['ArrowLeft', 'ArrowUp', 'PageUp', ...(presenting ? ['Backspace'] : [])];
    if (next.includes(e.key)) { e.preventDefault(); go(index + 1); }
    else if (back.includes(e.key)) { e.preventDefault(); go(index - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(count - 1); }
    else if (e.key === 'F5' && !presenting) { e.preventDefault(); present(); }
  };
  // A link inside a slide opens in the browser (only http(s) and mailto are kept by the sanitizer).
  const link = (e: MouseEvent<HTMLDivElement>) => {
    const href = (e.target as HTMLElement).closest<HTMLElement>('[data-href]')?.dataset.href;
    if (href) { e.preventDefault(); e.stopPropagation(); void api.openLink(href); return true; }
    return false;
  };
  const toggleNotes = () => { setNotesOn((on) => { remember('qa-slide-notes', on ? 'closed' : 'open'); return !on; }); };
  const showComments = (on: boolean) => { setCommentsOn(on); remember('qa-slide-comments', on ? 'open' : 'closed'); };

  const current = deck?.slides[index];
  const notes = info?.slides[index];
  const editable = Boolean(project && info && !info.readOnly);
  const comments = useMemo(() => notes?.comments ?? [], [notes]);
  const total = info?.slides.reduce((n, s) => n + s.comments.length, 0) ?? 0;
  const cards = useMemo<MdComment[]>(() => comments.map((c) => ({
    id: c.id, author: c.author, at: c.date, text: c.text, replies: c.replies ?? [], ...(isCommentColor(c.color) ? { color: c.color } : {}),
  })), [comments]);
  // Where a comment points on the slide: its area (a point for a comment made in PowerPoint); the whole slide has none.
  const markOf = useCallback((body: HTMLElement, id: string) => {
    const c = comments.find((x) => x.id === id);
    const spot = c?.area && !WHOLE(c.area) ? c.area : c?.pin && !c.area ? { ...c.pin, w: 0, h: 0 } : null;
    if (!spot) return null;
    return { getBoundingClientRect: () => { const r = body.getBoundingClientRect(); return DOMRect.fromRect({ x: r.left + spot.x * r.width, y: r.top + spot.y * r.height, width: spot.w * r.width, height: spot.h * r.height }); } };
  }, [comments]);
  const ready = Boolean(project && info);
  const commentsShown = ready && commentsOn;
  const placed = useCommentPlacement(work, canvas, commentRail, cards, markOf);
  // The comments take the place of the project panel on the right (Workspace listens), as for a PDF.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('moki:doc-side', { detail: commentsShown }));
    return () => { window.dispatchEvent(new CustomEvent('moki:doc-side', { detail: false })); };
  }, [commentsShown]);
  useEffect(() => {
    const close = () => { setCommentsOn(false); remember('qa-slide-comments', 'closed'); };
    window.addEventListener('moki:doc-side-close', close);
    return () => window.removeEventListener('moki:doc-side-close', close);
  }, []);
  const stageWidth = useMemo(() => (deck && stageSize.w ? fitWidth(deck, stageSize.w - 48, stageSize.h - 48) : 0), [deck, stageSize]);

  const readOnlyIds = new Set(comments.filter((c) => c.readOnly).map((c) => c.id));
  const send = (id: string, change: SlideChange) => { if (!readOnlyIds.has(id)) edits.edit(change); };
  const actions: CommentActions = {
    reply: (id, text) => send(id, { op: 'reply', slide: index, id, text, author: '' }),
    edit: (id, text) => send(id, { op: 'edit-comment', slide: index, id, text }),
    color: (id, value) => send(id, { op: 'color', slide: index, id, color: value }),
    remove: (id) => { send(id, { op: 'delete-comment', slide: index, id }); if (id === active) setActive(''); },
  };
  const add = (area: Area, text: string, value: string) => { edits.edit({ op: 'comment', slide: index, text, author: '', color: value, area }); showComments(true); };

  // Mark an area: a rectangle dragged over the slide, in fractions of it; then the markers menu (with Comment…).
  const point = (e: { clientX: number; clientY: number }) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const startDraw = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !canvas.current) return;
    e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = point(e); setDrawing({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); setComposer(null); setMarking(null);
  };
  const moveDraw = (e: PointerEvent<HTMLDivElement>) => { if (drawing && canvas.current) { const p = point(e); setDrawing({ ...drawing, x1: p.x, y1: p.y }); } };
  const endDraw = (e: PointerEvent<HTMLDivElement>) => {
    if (!drawing || !canvas.current) return;
    const r = canvas.current.getBoundingClientRect();
    const area = { x: Math.min(drawing.x0, drawing.x1), y: Math.min(drawing.y0, drawing.y1), w: Math.abs(drawing.x1 - drawing.x0), h: Math.abs(drawing.y1 - drawing.y0) };
    setDrawing(null);
    if (area.w * r.width < 8 || area.h * r.height < 8) return; // a click, not an area
    setAreaMode(false);
    setMarking({ area, left: e.clientX, top: e.clientY });
  };
  // Right-click on the slide: comment on (or mark) the whole slide.
  const contextMenu = (e: MouseEvent<HTMLDivElement>) => {
    if (!editable || presenting) return;
    e.preventDefault();
    setMarking({ area: { x: 0, y: 0, w: 1, h: 1 }, left: e.clientX, top: e.clientY });
  };
  const openComposer = (area: Area) => {
    const box = work.current?.getBoundingClientRect(), slide = canvas.current?.getBoundingClientRect();
    if (!box || !slide) return;
    const whole = WHOLE(area);
    const x = whole ? slide.left - box.left + 16 : slide.left - box.left + (area.x + area.w) * slide.width + 8;
    const y = whole ? slide.top - box.top + 16 : slide.top - box.top + area.y * slide.height;
    setComposer({ area, x: Math.max(8, Math.min(x, box.width - 296)), y: Math.max(8, Math.min(y, box.height - 230)) });
  };
  useEffect(() => {
    if (!composer && !areaMode) return;
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { setComposer(null); setAreaMode(false); setDrawing(null); } };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [composer, areaMode]);

  // Without the service's reading (no project), the notes read with the slides are shown, not edited.
  const noteValue = noteText[index] ?? edits.draft(index) ?? notes?.notes ?? current?.note ?? '';
  const writeNote = (text: string) => { setNoteText((all) => ({ ...all, [index]: text })); edits.edit({ op: 'notes', slide: index, text }); };

  if (error) {
    return (
      <div className="slides-view slides-message">
        <Notice tone="warn" title={error} actions={<button type="button" className="btn btn-sm" onClick={onOpenExternal}><IconExternal size={14} />{t('Open with the default program')}</button>}>
          {t('Moki reads .pptx files itself; a file it cannot read still opens in PowerPoint or another presentation program.')}
        </Notice>
      </div>
    );
  }
  if (!deck || !current) return <div className="slides-view slides-message muted" role="status">{t('Opening the presentation…')}</div>;

  const shownNote = notesOn && (editable || Boolean(noteValue));
  const drawn = drawing && { x: Math.min(drawing.x0, drawing.x1), y: Math.min(drawing.y0, drawing.y1), w: Math.abs(drawing.x1 - drawing.x0), h: Math.abs(drawing.y1 - drawing.y0) };
  const menuOf = markerMenu ? comments.find((c) => c.id === markerMenu) : undefined;
  return (
    <div className="slides-view" ref={root} tabIndex={0} onKeyDown={keys} aria-label={title}>
      <div className="slides-rail" ref={rail} aria-label={t('Slides')}>
        {deck.slides.map((slide, i) => {
          const n = info?.slides[i]?.comments.length ?? 0;
          return (
            <button key={i} type="button" data-slide={i} className={`slides-thumb${i === index ? ' on' : ''}`} aria-current={i === index ? 'true' : undefined}
              aria-label={t('Slide {n}', { n: i + 1 })} title={n ? `${t('Comments')}: ${n}` : undefined} onClick={() => go(i)}>
              <span className="slides-thumb-n">{i + 1}{n > 0 && <span className="slides-thumb-comments" aria-hidden="true"><IconChat size={11} /></span>}</span>
              <SlideCanvas slide={slide} deck={deck} width={148} />
            </button>
          );
        })}
      </div>
      <div className="slides-main">
        <div ref={work} className={`slides-work${commentsShown ? ' with-rail' : ''}`}>
          <div className="slides-stage" ref={stage} onClick={link}>
            {stageWidth > 0 && (
              <div className="slides-current" ref={canvas} onContextMenu={contextMenu}>
                <SlideCanvas slide={current} deck={deck} width={stageWidth} />
                {ready && comments.map((c) => {
                  const { marker, body } = splitMarker(c.text, markers);
                  const tone = isCommentColor(c.color) ? SWATCH[c.color] : SWATCH.yellow;
                  const open = () => { if (marker && markerOnly(c.text, markers)) setMarkerMenu(markerMenu === c.id ? null : c.id); else { showComments(true); setActive(c.id); } };
                  const style = (extra: CSSProperties) => ({ ...extra, ['--mark' as string]: tone }) as CSSProperties;
                  if (c.area && !WHOLE(c.area)) return (
                    <button key={c.id} type="button" className={`slide-mark${active === c.id ? ' on' : ''}`} data-comment={c.id}
                      style={style({ left: `${c.area.x * 100}%`, top: `${c.area.y * 100}%`, width: `${c.area.w * 100}%`, height: `${c.area.h * 100}%` })}
                      title={body || marker?.name || ''} aria-label={t('Open the comment: {text}', { text: body || marker?.name || '' })}
                      onMouseEnter={() => setActive(c.id)} onMouseLeave={() => setActive('')} onClick={(e) => { e.stopPropagation(); open(); }}>
                      {marker && <span className="slide-mark-icon" aria-hidden="true">{marker.icon}</span>}
                    </button>
                  );
                  if (c.pin && !c.area) return (
                    <button key={c.id} type="button" className={`slide-pin${active === c.id ? ' on' : ''}`} data-comment={c.id} style={style({ left: `${c.pin.x * 100}%`, top: `${c.pin.y * 100}%` })}
                      title={c.text} aria-label={t('Open the comment: {text}', { text: c.text })}
                      onMouseEnter={() => setActive(c.id)} onMouseLeave={() => setActive('')} onClick={(e) => { e.stopPropagation(); open(); }}><IconChat size={12} /></button>
                  );
                  return null;
                })}
                {areaMode && (
                  <div className="slides-draw" onPointerDown={startDraw} onPointerMove={moveDraw} onPointerUp={endDraw} onPointerCancel={() => setDrawing(null)} aria-hidden="true">
                    {drawn && <div className="slides-draw-box" style={{ left: `${drawn.x * 100}%`, top: `${drawn.y * 100}%`, width: `${drawn.w * 100}%`, height: `${drawn.h * 100}%` }} />}
                  </div>
                )}
              </div>
            )}
          </div>
          {ready && (
            <CommentColumn comments={cards} placed={placed} rail={commentRail} shown={commentsShown} hidden={!commentsShown} onShow={() => showComments(true)}
              active={active} onActive={setActive} saving={edits.busy} actions={actions} readOnly={!editable}
              describe={(id) => {
                const c = comments.find((x) => x.id === id);
                if (c?.readOnly) return <p className="muted small">{t('Made in a newer PowerPoint: reply or change it there.')}</p>;
                return c && WHOLE(c.area) && !(c.pin && !c.area) ? <span className="office-comment-where">{t('The whole slide')}</span> : null;
              }}
              empty={<p className="muted small pdf-rail-empty">{editable ? t('Mark an area of the slide to comment on it, or right-click the slide to comment on all of it.') : t('No comments yet.')}</p>} />
          )}
          {menuOf?.area && canvas.current && work.current && (() => {
            const box = work.current.getBoundingClientRect(), slide = canvas.current.getBoundingClientRect(), a = menuOf.area;
            return <MarkerMenu markers={markers} text={menuOf.text} left={slide.left - box.left + a.x * slide.width} top={slide.top - box.top + (a.y + a.h) * slide.height + 4} disabled={edits.busy || !editable}
              onText={(next) => { actions.edit(menuOf.id, next); if (!markerOnly(next, markers)) showComments(true); }} onRemove={() => actions.remove(menuOf.id)} onClose={() => setMarkerMenu(null)} />;
          })()}
          {marking && <MarkerContextMenu markers={markers} left={marking.left} top={marking.top} onClose={() => setMarking(null)}
            onComment={() => openComposer(marking.area)}
            onPick={(m: Marker) => add(marking.area, markerLabel(m), markerColor(m))} />}
          {composer && <CommentComposer x={composer.x} y={composer.y} saving={edits.busy} color={color} onColor={setColor}
            onAdd={(text) => { add(composer.area, text, color); setComposer(null); }} onCancel={() => setComposer(null)} />}
        </div>
        {shownNote && (
          <div className="slides-notes">
            {editable
              ? <textarea className="slides-notes-input" value={noteValue} maxLength={20000} placeholder={t('Click to add speaker notes')} aria-label={t('Speaker notes')}
                  onChange={(e) => writeNote(e.target.value)} onBlur={edits.flush} />
              : <div className="slides-notes-text" aria-label={t('Speaker notes')}>{noteValue}</div>}
            {editable && notes?.formatted && noteText[index] === undefined && <p className="slides-notes-hint muted small">{t('Bold and lists in these notes are removed when you edit them here.')}</p>}
          </div>
        )}
        {edits.error && <p role="alert" className="warn-text slides-error">{t(edits.error)}</p>}
        <div className="slides-bar">
          <button type="button" className="icon-btn" onClick={() => go(index - 1)} disabled={index === 0} title={t('Previous slide')} aria-label={t('Previous slide')}><span className="slides-prev"><IconChevron size={16} /></span></button>
          <span className="slides-count" role="status">{t('Slide {n} of {total}', { n: index + 1, total: count })}</span>
          <button type="button" className="icon-btn" onClick={() => go(index + 1)} disabled={index === count - 1} title={t('Next slide')} aria-label={t('Next slide')}><span className="slides-next"><IconChevron size={16} /></span></button>
          <span className="slides-bar-gap" />
          {editable && <button type="button" className={`icon-btn${areaMode ? ' on' : ''}`} aria-pressed={areaMode} title={t('Drag a rectangle on the slide to mark or comment on that area')} aria-label={t('Mark an area')}
            onClick={() => { setAreaMode(!areaMode); setComposer(null); setMarking(null); }}><IconFitScreen size={16} /></button>}
          {ready && <button type="button" className={`btn btn-ghost btn-sm pdf-rail-toggle slides-comments-toggle${commentsOn ? ' on' : ''}`} aria-pressed={commentsOn}
            title={commentsOn ? t('Hide the comments: the slide gets the room') : t('Show the comments beside the slide')} aria-label={`${t('Comments')} (${total})`}
            onClick={() => showComments(!commentsOn)}><IconChat size={16} />{total > 0 && <span className="pdf-rail-count">{total}</span>}</button>}
          {ready && <span className="slides-bar-sep" aria-hidden="true" />}
          <button type="button" className={`icon-btn${notesOn ? ' on' : ''}`} aria-pressed={notesOn} onClick={toggleNotes} title={notesOn ? t('Hide the speaker notes') : t('Show the speaker notes')} aria-label={t('Speaker notes')}><IconNotes size={16} /></button>
          <button type="button" className="icon-btn" onClick={present} title={t('Present (F5)')} aria-label={t('Present')}><IconPresent size={16} /></button>
        </div>
      </div>
      <div ref={show} className="slides-show" onClick={(e) => { if (!link(e)) go(index + (e.clientX < screen.w / 4 ? -1 : 1)); }} tabIndex={-1}>
        {presenting && <SlideCanvas slide={current} deck={deck} width={fitWidth(deck, screen.w, screen.h)} />}
      </div>
    </div>
  );
}
