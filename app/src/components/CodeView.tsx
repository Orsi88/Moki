// A source file, read-only, with the colors of an IDE (highlight.js, loaded the first time a code file opens) and
// line numbers. Lines are selected on the numbers (Shift extends to a block); a selection can be commented on or
// marked, and "Open in the IDE" opens VS Code or Cursor at it. Comments and markers are kept apart from the file (the
// project's comment store, anchored to their lines and the text of the first one), so the code never changes; a
// marked block is an area in its marker's color with the icon in its corner. Very large files show without colors.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type CodeComment, type CodeNote } from '../api';
import { t } from '../i18n';
import { loadOnce } from '../lazy-module';
import { useLoaded } from './useLoaded';
import { IconChat, IconCode, IconNotePlus, IconX } from './Icons';
import { isCommentColor, SWATCH, type CommentColor, type MdComment } from '../md-comments';
import { codeAnchorLine, codeSelectionNote } from '../../../scripts/lib/code-comment-types.ts';
import { markerColor, splitMarker, useMarkers } from '../markers';
import { CommentColumn, CommentComposer, SelectionBubble, useCommentPlacement, type Bubble, type CommentActions } from './CommentColumn';
import { MarkerMenu } from './Markers';

const highlighter = loadOnce(() => import('highlight.js').then((m) => m.default));
const COLOR_LIMIT = 400 * 1024; // characters: past this the file shows as plain text

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

interface Props { project?: string; path: string; text: string; language: string }
interface Range { start: number; end: number }

export function CodeView({ project, path, text, language }: Props) {
  const { mod: hljs } = useLoaded(highlighter);
  const [sel, setSel] = useState<Range | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [comments, setComments] = useState<CodeComment[]>([]);
  const [notes, setNotes] = useState<CodeNote[]>([]); // project notes tied to lines ("Create a note from here")
  const [noteTitles, setNoteTitles] = useState<Record<string, string>>({});
  const [commentsOn, setCommentsOn] = useState(false);
  const [active, setActive] = useState('');
  const [busy, setBusy] = useState(false);
  const [color, setColor] = useState<CommentColor>('yellow');
  const [composer, setComposer] = useState<(Range & { x: number; y: number }) | null>(null);
  const [markerMenu, setMarkerMenu] = useState<string | null>(null); // the menu of a marked block's icon
  const stage = useRef<HTMLDivElement>(null), body = useRef<HTMLPreElement>(null), rail = useRef<HTMLDivElement>(null), gutter = useRef<HTMLDivElement>(null);
  const markers = useMarkers();
  const lines = useMemo(() => text.split(/\r?\n/), [text]);
  const html = useMemo(() => {
    if (!hljs || text.length > COLOR_LIMIT || !hljs.getLanguage(language)) return escape(text);
    try { return hljs.highlight(text, { language, ignoreIllegals: true }).value; } catch { return escape(text); }
  }, [hljs, text, language]);

  useEffect(() => {
    if (!project) return;
    let live = true;
    api.codeComments(project, path).then((list) => { if (live) { setComments(list); if (list.length) setCommentsOn(true); } }).catch((e: Error) => { if (live) setError(e.message); });
    api.codeNotes(project, path).then((list) => { if (live) setNotes(list); }).catch(() => { /* none */ });
    return () => { live = false; };
  }, [project, path]);

  // Where each comment's lines are now (the file may have changed since it was written).
  const located = useMemo(() => new Map(comments.map((c) => [c.id, codeAnchorLine(c.anchor, lines)])), [comments, lines]);
  const cards = useMemo<MdComment[]>(() => [...comments].sort((a, b) => (located.get(a.id)?.line ?? 0) - (located.get(b.id)?.line ?? 0)).map((c) => ({
    id: c.id, author: c.author, at: c.date, text: c.text, replies: c.replies ?? [], ...(isCommentColor(c.color) ? { color: c.color } : {}), ...(c.resolved ? { resolved: true } : {}),
  })), [comments, located]);
  const markOf = useCallback((root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`.code-area[data-id="${CSS.escape(id)}"]`), []);
  const placed = useCommentPlacement(stage, body, rail, cards, markOf);

  const save = async (job: () => Promise<CodeComment[]>): Promise<boolean> => {
    if (!project || busy) return false;
    setBusy(true); setError('');
    try { setComments(await job()); return true; } catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; } finally { setBusy(false); }
  };
  const actions: CommentActions = {
    reply: (id, value) => { if (project) void save(() => api.changeCodeComment(project, path, { op: 'reply', id, text: value })); },
    edit: (id, value) => { if (project) void save(() => api.changeCodeComment(project, path, { op: 'edit', id, text: value })); },
    color: (id, value) => { if (project) void save(() => api.changeCodeComment(project, path, { op: 'color', id, color: value })); },
    resolve: (id, resolved) => { if (project) void save(() => api.changeCodeComment(project, path, { op: 'resolve', id, resolved })); },
    remove: (id) => { if (project) void save(() => api.removeCodeComment(project, path, id)); },
  };
  const add = async (value: string) => {
    if (!project || !composer) return;
    const anchor = { kind: 'code' as const, line: composer.start, endLine: composer.end, first: (lines[composer.start - 1] ?? '').slice(0, 500) };
    if (await save(() => api.addCodeComment(project, path, anchor, value, color))) { setComposer(null); setSel(null); setCommentsOn(true); }
  };

  // A click on a number selects that line; Shift+click extends the selection to a block.
  const pick = (n: number, extend: boolean) => {
    setComposer(null);
    if (extend && sel) setSel({ start: Math.min(sel.start, n), end: Math.max(sel.end, n) });
    else setSel(sel && sel.start === n && sel.end === n ? null : { start: n, end: n });
  };
  const lineTop = (n: number) => {
    const button = gutter.current?.children[n - 1] as HTMLElement | undefined;
    const origin = stage.current?.getBoundingClientRect();
    return button && origin ? { top: button.getBoundingClientRect().top - origin.top + (stage.current?.scrollTop ?? 0), height: button.offsetHeight } : { top: 0, height: 20 };
  };
  const bubble: Bubble | null = project && sel && !composer ? (() => { const at = lineTop(sel.start), end = lineTop(sel.end); return { x: 64, y: at.top, below: end.top + end.height, why: '' }; })() : null;

  // Each tied note by its title, as the Notes section shows it.
  useEffect(() => {
    if (!project || !notes.length) return;
    let live = true;
    api.noteTitles(project).then((items) => { if (live) setNoteTitles(Object.fromEntries(items.map((item) => [item.path, item.title]))); }).catch(() => { /* file names then */ });
    return () => { live = false; };
  }, [project, notes]);

  // The selected lines as a note of this project (notes/), tied to them and opened in the notebook; the file is not changed.
  const noteFromLines = async () => {
    if (!project || !sel) return;
    setError(''); setNotice('');
    try {
      const { title, text: note } = codeSelectionNote(path, language, lines, sel.start, sel.end);
      const created = await api.createNote(project, title, note);
      await api.setNoteTitle(project, created, title).catch(() => { /* the file name stands in */ });
      setNotes(await api.addCodeNote(project, path, { kind: 'code', line: sel.start, endLine: sel.end, first: (lines[sel.start - 1] ?? '').slice(0, 500) }, created));
      setSel(null);
      await api.openNoteWindow({ project, path: created });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const unlinkNote = async (id: string) => {
    if (!project) return;
    try { setNotes(await api.removeCodeNote(project, path, id)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const open = async () => {
    if (!project) return;
    setError(''); setNotice('');
    try { const ide = await api.openFileInIde(project, path, sel?.start ?? 1); setNotice(t('Opening in {ide}…', { ide })); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="code-file" data-language={language}>
      <div className="code-file-bar">
        <span className="muted small">{language}{sel ? ` · ${sel.start === sel.end ? t('line {n}', { n: sel.start }) : t('lines {a}–{b}', { a: sel.start, b: sel.end })}` : ''}</span>
        {text.length > COLOR_LIMIT && <span className="muted small">{t('Large file: shown without colors.')}</span>}
        <span className="code-file-actions">
          {project && sel && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void noteFromLines(); }} title={t('A note of this project with these lines, tied to them')}><IconNotePlus size={14} /> {t('Create a note from here')}</button>}
          {project && <button type="button" className={`btn btn-ghost btn-sm pdf-rail-toggle${commentsOn ? ' on' : ''}`} title={t('Comments')} aria-label={`${t('Comments')} (${comments.length})`} aria-pressed={commentsOn} onClick={() => setCommentsOn((v) => !v)}><IconChat size={16} />{comments.length > 0 && <span className="pdf-rail-count">{comments.length}</span>}</button>}
          {project && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { void open(); }} title={t('Open this file in VS Code or Cursor, at the selected line')}><IconCode size={14} /> {t('Open in the IDE')}</button>}
        </span>
      </div>
      {error && <p className="result warn" role="alert">{error}</p>}
      {notice && <p className="result" role="status">{notice}</p>}
      <div ref={stage} className={`code-file-stage office-commented${commentsOn && project ? ' with-rail' : ''}`}>
        <div className="code-file-body">
          <div ref={gutter} className="code-gutter" role="group" aria-label={t('Line numbers: click to select, Shift+click for a block')}>
            {lines.map((_, i) => { const n = i + 1; const on = Boolean(sel && n >= sel.start && n <= sel.end); return <button key={i} type="button" className={on ? 'on' : ''} aria-pressed={on} aria-label={t('line {n}', { n })} onClick={(e) => pick(n, e.shiftKey)}>{n}</button>; })}
          </div>
          <pre ref={body} className="code-text">
            {sel && <span className="code-line-mark" style={{ top: `calc(${sel.start - 1} * var(--code-line))`, height: `calc(${sel.end - sel.start + 1} * var(--code-line))` }} />}
            {comments.map((c) => {
              const at = located.get(c.id);
              if (!at) return null;
              const marker = splitMarker(c.text, markers).marker;
              const tone = marker ? markerColor(markers.find((m) => m.icon === marker.icon) ?? marker) : isCommentColor(c.color) ? c.color : 'yellow';
              return <span key={c.id} data-id={c.id} className={`code-area${marker ? ' marked' : ''}${active === c.id ? ' on' : ''}`} data-marker-color={tone}
                style={{ top: `calc(${at.line - 1} * var(--code-line))`, height: `calc(${at.endLine - at.line + 1} * var(--code-line))`, ['--area-color' as string]: SWATCH[tone] }}>
                {marker && <button type="button" className="code-area-icon" aria-label={t('Marker {name}', { name: marker.name })} title={marker.name} aria-expanded={markerMenu === c.id}
                  onClick={() => setMarkerMenu(markerMenu === c.id ? null : c.id)}>{marker.icon}</button>}
                {marker && markerMenu === c.id && <MarkerMenu markers={markers} text={c.text} left={22} top={-6} disabled={busy}
                  onText={(next) => { actions.edit(c.id, next); setCommentsOn(true); }} onRemove={() => actions.remove(c.id)} onClose={() => setMarkerMenu(null)} />}
              </span>;
            })}
            <code className={`hljs language-${language}`} dangerouslySetInnerHTML={{ __html: html }} />
            {notes.map((n) => {
              const at = codeAnchorLine(n.anchor, lines);
              const title = noteTitles[n.note] ?? (n.note.split('/').pop() ?? n.note).replace(/\.md$/, '');
              return <span key={n.id} className="code-note-pin" style={{ top: `calc(${at.line - 1} * var(--code-line))` }}>
                <button type="button" className="code-note-open" onClick={() => { if (project) void api.openNoteWindow({ project, path: n.note }); }} title={t('Open the note {name}', { name: title })}>📝 {title}</button>
                <button type="button" className="code-note-unlink" onClick={() => { void unlinkNote(n.id); }} title={t('Untie the note from these lines (the note stays in Notes)')} aria-label={t('Untie the note {name}', { name: title })}><IconX size={11} /></button>
              </span>;
            })}
          </pre>
        </div>
        {project && <CommentColumn comments={cards} placed={placed} rail={rail} shown={commentsOn} hidden={!commentsOn} onShow={() => setCommentsOn(true)}
          active={active} onActive={setActive} saving={busy} actions={actions}
          onJump={(id) => { const at = located.get(id); if (at) { setSel({ start: at.line, end: at.endLine }); gutter.current?.children[at.line - 1]?.scrollIntoView({ block: 'center' }); } }}
          empty={<p className="muted small">{t('Select lines on their numbers to comment on them or mark them.')}</p>}
          describe={(id) => { const at = located.get(id); return at ? <span className="office-comment-where">{at.line === at.endLine ? t('line {n}', { n: at.line }) : t('lines {a}–{b}', { a: at.line, b: at.endLine })}</span> : null; }} />}
        {bubble && <SelectionBubble bubble={bubble} onComment={() => { if (sel) setComposer({ ...sel, x: 64, y: lineTop(sel.end).top + lineTop(sel.end).height + 6 }); }} />}
        {composer && <CommentComposer x={composer.x} y={composer.y} saving={busy} color={color} onColor={setColor} onAdd={(value) => { void add(value); }} onCancel={() => setComposer(null)} />}
      </div>
    </div>
  );
}
