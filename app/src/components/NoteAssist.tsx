// The quick assistants of a note: improve the writing, summarize, research (Sherlock) and review critically
// (Moriarty). One click runs the person's AI without a terminal (desktop/note-assist.ts); the answer comes back
// as a suggestion above the note, accepted or discarded. Nothing changes in the note until it is accepted.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type NoteHelper } from '../api';
import { t } from '../i18n';
import { applyAnswer, PLACEMENT, wordDiff } from '../note-assist';
import { defaultTool, recall } from '../prefs';
import { IconAlert, IconHighlight, IconList, IconSearch, IconSparkle, IconX } from './Icons';

interface Running { id: string; helper: NoteHelper; base: string }
type State =
  | (Running & { status: 'running' })
  | (Running & { status: 'done'; answer: string; tool: string })
  | (Running & { status: 'error'; error: string });

const HELPERS: NoteHelper[] = ['write', 'summary', 'research', 'critique'];
const ICON: Record<NoteHelper, ReactNode> = { write: <IconHighlight size={15} />, summary: <IconList size={15} />, research: <IconSearch size={15} />, critique: <IconAlert size={15} /> };
const label = (helper: NoteHelper) => ({ write: t('Improve the writing'), summary: t('Summarize'), research: t('Research (Sherlock)'), critique: t('Review critically (Moriarty)') })[helper];
const working = (helper: NoteHelper) => ({ write: t('Improving the writing…'), summary: t('Summarizing…'), research: t('Sherlock is researching…'), critique: t('Moriarty is reviewing…') })[helper];
const where = (helper: NoteHelper) => ({ replace: t('Accepting replaces the note with this version.'), prepend: t('Accepting adds this at the top of the note.'), append: t('Accepting adds this at the end of the note.') })[PLACEMENT[helper]];
const toolName = (tool: string) => (tool === 'codex' ? 'Codex' : 'Claude Code');

export function useNoteAssist({ text, onApply }: { text: string; onApply: (next: string) => void }) {
  const [state, setState] = useState<State | null>(null);
  const current = useRef<State | null>(null);
  current.current = state;
  // A run still going when the note closes is stopped.
  useEffect(() => () => { const s = current.current; if (s?.status === 'running') void api.noteAssistCancel(s.id); }, []);

  const run = (helper: NoteHelper) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    const base = text;
    setState({ id, helper, base, status: 'running' });
    void api.noteAssist({ id, helper, text: base, prefer: defaultTool(), language: recall('qa-language') ?? 'English' }).then((result) => {
      setState((now) => {
        if (!now || now.id !== id) return now; // cancelled or replaced meanwhile
        if (result.answer) return { id, helper, base, status: 'done', answer: result.answer, tool: result.tool ?? '' };
        return { id, helper, base, status: 'error', error: result.error ?? '' };
      });
    });
  };
  const stop = () => { if (state?.status === 'running') void api.noteAssistCancel(state.id); setState(null); };
  const accept = () => { if (state?.status === 'done') onApply(applyAnswer(text, state.answer, state.helper)); setState(null); };
  return { state, run, stop, accept, busy: state?.status === 'running' };
}

// The four buttons, as icons with their names as tooltips, for the note's toolbar: one group set apart from the
// formatting tools, a sparkle and "AI" in front, so it reads as the AI's.
// When the note is narrow (a container query on the toolbar), only "✦ AI" shows, keeping the tools on one line:
// a click opens the four below it, and choosing one or clicking elsewhere closes them.
export function AssistButtons({ assist, empty }: { assist: ReturnType<typeof useNoteAssist>; empty: boolean }) {
  const [open, setOpen] = useState(false);
  const group = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!group.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc, true); };
  }, [open]);
  return (
    <span ref={group} className={`note-assist-buttons${open ? ' open' : ''}`} role="group" aria-label={t('Quick assistants')}>
      <button type="button" className="note-assist-mark" aria-expanded={open} title={t('Quick assistants')} onClick={() => setOpen((v) => !v)}>
        <IconSparkle size={14} /> {t('AI')}
      </button>
      <span className="note-assist-list">
        {HELPERS.map((helper) => {
          const why = empty ? t('Write something in the note first.') : assist.busy ? t('An assistant is working on this note.') : '';
          return (
            <button key={helper} type="button" className={`icon-btn${assist.state?.helper === helper ? ' on' : ''}`} disabled={Boolean(why)}
              title={why ? `${label(helper)}: ${why}` : label(helper)} aria-label={label(helper)} onClick={() => { setOpen(false); assist.run(helper); }}>
              {ICON[helper]}
            </button>
          );
        })}
      </span>
    </span>
  );
}

// The suggestion above the note: working, the answer to accept or discard, or what went wrong.
export function AssistPanel({ assist, text, project, path, onMyAis }: { assist: ReturnType<typeof useNoteAssist>; text: string; project?: string | null; path?: string | null; onMyAis?: () => void }) {
  const { state } = assist;
  const [view, setView] = useState<'result' | 'diff'>('result');
  const [html, setHtml] = useState('');
  const answer = state?.status === 'done' ? state.answer : '';
  useEffect(() => { setView('result'); }, [state?.id]);
  useEffect(() => {
    if (!answer) { setHtml(''); return; }
    let live = true;
    api.renderMarkdown(answer, project ?? undefined, path ?? undefined).then((next) => { if (live) setHtml(next); }).catch(() => { if (live) setHtml(''); });
    return () => { live = false; };
  }, [answer, project, path]);
  if (!state) return null;

  const head = (
    <div className="note-assist-head">
      <span className="note-assist-icon">{ICON[state.helper]}</span>
      <strong>{label(state.helper)}</strong>
      {state.status === 'done' && state.tool && <span className="muted small">· {toolName(state.tool)}</span>}
      <span className="statusbar-spacer" />
      {state.status !== 'running' && <button type="button" className="icon-btn" onClick={assist.stop} title={t('Close')} aria-label={t('Close')}><IconX size={14} /></button>}
    </div>
  );

  if (state.status === 'running') {
    return (
      <section className="note-assist" aria-label={t('Quick assistants')} aria-busy="true">
        {head}
        <div className="note-assist-working" role="status">
          <span className="note-assist-spinner" aria-hidden="true" />
          <span>{working(state.helper)}</span>
          <span className="statusbar-spacer" />
          <button type="button" className="btn btn-sm btn-ghost" onClick={assist.stop}>{t('Cancel')}</button>
        </div>
      </section>
    );
  }

  if (state.status === 'error') {
    return (
      <section className="note-assist note-assist-error" aria-label={t('Quick assistants')}>
        {head}
        <p role="alert">
          {state.error === 'no-tool'
            ? <>{t('The quick assistants use Claude Code or Codex, and neither was found on this computer.')} {onMyAis && <button type="button" className="link" onClick={onMyAis}>{t('Install in Settings › My AIs')}</button>}</>
            : <>{t('The assistant did not answer.')} {state.error && state.error !== 'cancelled' && <span className="muted small note-assist-detail">{state.error}</span>}</>}
        </p>
        {state.error !== 'no-tool' && <div className="note-assist-actions"><button type="button" className="btn btn-sm" onClick={() => assist.run(state.helper)}>{t('Try again')}</button></div>}
      </section>
    );
  }

  const replaces = PLACEMENT[state.helper] === 'replace';
  const changed = text !== state.base; // the note was edited while the assistant worked
  return (
    <section className="note-assist" aria-label={t('Quick assistants')}>
      {head}
      {replaces && (
        <div className="note-assist-tabs" role="tablist" aria-label={t('Suggestion')}>
          <button type="button" role="tab" aria-selected={view === 'result'} className={view === 'result' ? 'on' : ''} onClick={() => setView('result')}>{t('New version')}</button>
          <button type="button" role="tab" aria-selected={view === 'diff'} className={view === 'diff' ? 'on' : ''} onClick={() => setView('diff')}>{t('Differences')}</button>
        </div>
      )}
      <div className="note-assist-body">
        {view === 'diff' && replaces
          ? <p className="note-assist-diff">{wordDiff(state.base, state.answer).map((part, i) => (part.kind === 'same' ? <span key={i}>{part.text}</span>
            : part.kind === 'added' ? <ins key={i}>{part.text}</ins> : <del key={i}>{part.text}</del>))}</p>
          // HTML from the main process renderer, which escapes all markup of the answer.
          : html ? <div className="markdown note-assist-result" dangerouslySetInnerHTML={{ __html: html }} /> : <pre className="note-assist-result plain">{state.answer}</pre>}
      </div>
      <div className="note-assist-actions">
        <span className="muted small">{changed && replaces ? t('The note changed while the assistant worked: accepting replaces those changes too.') : where(state.helper)}</span>
        <span className="statusbar-spacer" />
        <button type="button" className="btn btn-sm btn-ghost" onClick={assist.stop}>{t('Discard')}</button>
        <button type="button" className="btn btn-sm" onClick={assist.accept}>{t('Accept')}</button>
      </div>
    </section>
  );
}
