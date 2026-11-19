// The single chat tab of a project: an AI tool with the same access as its terminal (project files, skills, MCP
// tools), its answers as they arrive, the history and a new conversation in the same tab. A Claude artifact linked
// in an answer (presentation, spreadsheet, page) opens over the conversation, in an isolated viewer.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ArtifactStatus, type ChatState, type ToolInfo } from '../api';
import { isArtifactUrl as isArtifactLink } from '../../../scripts/lib/artifact-links.ts';
import { conversationLanguage, t } from '../i18n';
import { recall, remember } from '../prefs';
import { IconArrowLeft, IconChat, IconExternal, IconPlay, IconPlus, IconRefresh, IconStop } from './Icons';
import { MarkdownBody } from './MarkdownBody';
import './chat.css';

// The AI tools with a chat (desktop/chat.ts, CHAT_TOOLS).
const CHAT_TOOLS = ['claude'];
const SAFETY_POLL_MS = 2000; // while answering, in case a change notice was missed
const RENDER_EVERY_MS = 300; // an answer arriving is formatted at most this often

interface Props {
  project: string; workspace: string; tools: ToolInfo[]; active: boolean;
  pending?: { text: string; tool: string; key: number } | null;
  onPending: () => void;
  onLink: (href: string) => void;
}

export function ChatView({ project, workspace, tools, active, pending, onPending, onLink }: Props) {
  const prefix = `qa-chat:${workspace}:${project}`;
  const usable = tools.filter((tool) => CHAT_TOOLS.includes(tool.id) && tool.available);
  const [chosen, setChosen] = useState(() => recall(`${prefix}:tool`) || 'claude');
  const tool = usable.find((x) => x.id === chosen) ?? usable[0];
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.chats>>>([]);
  const [state, setState] = useState<ChatState | null>(null);
  const [draft, setDraft] = useState(() => recall(`${prefix}:draft`) || '');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [artifact, setArtifact] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const lastPending = useRef<number | null>(null);
  const loadHistory = useCallback(() => api.chats(project).then(setHistory), [project]);

  useEffect(() => {
    let cancelled = false;
    void loadHistory().catch((e: Error) => { if (!cancelled) setError(e.message); });
    const id = recall(`${prefix}:id`);
    if (id) void api.chatState(project, id).then((s) => { if (!cancelled) setState(s); }).catch(() => remember(`${prefix}:id`, ''));
    return () => { cancelled = true; };
  }, [project, prefix, loadHistory]);
  useEffect(() => { remember(`${prefix}:tool`, chosen); }, [prefix, chosen]);
  useEffect(() => { remember(`${prefix}:draft`, draft); }, [prefix, draft]);
  useEffect(() => {
    if (!pending || pending.key === lastPending.current) return;
    lastPending.current = pending.key;
    if (CHAT_TOOLS.includes(pending.tool)) setChosen(pending.tool);
    setArtifact(null);
    setDraft((current) => `${current}${current.trim() ? '\n\n' : ''}${pending.text}`);
    onPending();
    requestAnimationFrame(() => box.current?.focus());
  }, [pending]);

  // The answer arriving: the app says when the conversation changed, and it is read then (one read at a time).
  const id = state?.record.id;
  const busy = Boolean(state?.busy);
  useEffect(() => {
    if (!id) return;
    let cancelled = false, reading = false, again = false;
    const read = async () => {
      if (reading) { again = true; return; }
      reading = true;
      try {
        const next = await api.chatState(project, id);
        if (!cancelled) { setState(next); if (!next.busy) void loadHistory().catch((e: Error) => setError(e.message)); }
      } catch (e) { if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setState((old) => old ? { ...old, busy: false } : old); } }
      finally { reading = false; if (again && !cancelled) { again = false; void read(); } }
    };
    const off = api.onChatChanged((p, changed) => { if (p === project && changed === id) void read(); });
    const timer = busy ? setInterval(() => { void read(); }, SAFETY_POLL_MS) : undefined;
    return () => { cancelled = true; off(); if (timer) clearInterval(timer); };
  }, [id, busy, project, loadHistory]);
  useEffect(() => { if (active && !artifact) end.current?.scrollIntoView({ block: 'nearest' }); }, [active, artifact, state?.record.messages.at(-1)?.text]);

  const send = async () => {
    if (!tool || !draft.trim() || sending || state?.busy) return;
    setSending(true); setError('');
    const text = draft;
    try {
      const next = await api.chatSend(project, state?.record.id, tool.id, text, conversationLanguage());
      setState(next); remember(`${prefix}:id`, next.record.id);
      setDraft((current) => current === text ? '' : current);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSending(false); }
  };
  const selectHistory = async (chat: string) => {
    if (!chat) return;
    try { const next = await api.chatState(project, chat); setState(next); setChosen(next.record.tool); remember(`${prefix}:id`, chat); setError(''); setArtifact(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const fresh = () => { setError(''); setArtifact(null); setState(null); remember(`${prefix}:id`, ''); box.current?.focus(); };
  const link = (href: string) => { if (isArtifactLink(href)) setArtifact(href); else onLink(href); };
  const label = (id: string) => usable.find((x) => x.id === id)?.label.replace(/ \(.*\)$/, '') ?? 'Claude';
  // A conversation stays with the AI it started with; another AI starts a new one.
  const pick = (next: string) => { setChosen(next); if (state && state.record.tool !== next) fresh(); };

  return <div className="chat-view" hidden={!active}>
    <header className="chat-head">
      <IconChat size={18} />
      {usable.length > 1
        ? <select aria-label={t('Chat AI')} value={tool?.id ?? ''} onChange={(e) => pick(e.target.value)}>
          {usable.map((x) => <option key={x.id} value={x.id}>{t(x.label)}</option>)}
        </select>
        : <span className="chat-tool">{tool ? t(tool.label) : t('Chat')}</span>}
      {(history.length > 0 || state) && <select className="chat-history" aria-label={t('Conversation history')} value={state?.record.id ?? ''} onFocus={() => { void loadHistory().catch((e: Error) => setError(e.message)); }} onChange={(e) => { void selectHistory(e.target.value); }}>
        <option value="">{t('Conversation history')}</option>
        {state && !history.some((c) => c.id === state.record.id) && <option value={state.record.id}>{state.record.title || t('New conversation')}</option>}
        {history.map((c) => <option key={c.id} value={c.id}>{c.title || t('New conversation')}</option>)}
      </select>}
      <button className="icon-btn" type="button" onClick={fresh} disabled={!tool} title={t('New conversation')} aria-label={t('New conversation')}><IconPlus size={17} /></button>
    </header>
    {(error || state?.error) && <p className="error chat-notice" role="alert">{t(error || state?.error || '')}</p>}
    {artifact ? <ArtifactPane project={project} url={artifact} active={active} onBack={() => setArtifact(null)} /> : <>
      <div className="chat-messages" role="log" aria-label={t('Conversation')}>
        {!state?.record.messages.length && <div className="chat-empty"><IconChat size={30} />
          <h2>{t('Talk about this project')}</h2>
          <p>{tool ? t('The AI can use the project files, skills and connected tools.') : t('Install Claude Code in Settings › My AIs to use the chat.')}</p>
        </div>}
        {state?.record.messages.map((message, i) => <article key={i} className={`chat-message chat-${message.role}`}>
          <span className="chat-author">{message.role === 'user' ? t('You') : label(state.record.tool)}</span>
          {message.role === 'user' ? <p className="chat-user-text">{message.text}</p>
            : <ChatMarkdown text={message.text} project={project} live={busy && i === state.record.messages.length - 1} onLink={link} />}
          {message.tools?.length ? <details className="chat-tools"><summary>{t('Tools used')} ({message.tools.length})</summary><ul>{message.tools.map((call, index) => <li key={index}><span aria-hidden="true">{call.ok === false ? '×' : call.ok ? '✓' : '·'}</span> {call.name} {call.summary}</li>)}</ul></details> : null}
          {message.error && <p className="error" role="status">{message.error === 'stopped' ? t('Response stopped.') : message.error}</p>}
        </article>)}
        {(busy || sending) && <p className="muted small" role="status">{t('{tool} is working…', { tool: label(state?.record.tool ?? tool?.id ?? 'claude') })}</p>}
        <div ref={end} />
      </div>
      <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <textarea ref={box} aria-label={t('Message')} placeholder={t('Ask about the project…')} value={draft} rows={3} maxLength={1_000_000} disabled={!tool}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
        <div className="chat-compose-actions"><span className="muted small">{t('Shift+Enter for a new line')}</span>
          {busy && state ? <button type="button" className="btn btn-sm" onClick={() => { void api.chatStop(project, state.record.id).catch((e: Error) => setError(e.message)); }}><IconStop size={15} />{t('Stop')}</button>
            : <button className="btn btn-sm" type="submit" disabled={!tool || !draft.trim() || sending}><IconPlay size={15} />{t('Send')}</button>}
        </div>
      </form>
    </>}
  </div>;
}

// An answer as formatted Markdown. While it is still arriving it is formatted at most every RENDER_EVERY_MS.
function ChatMarkdown({ text, project, live, onLink }: { text: string; project: string; live: boolean; onLink: (href: string) => void }) {
  const [html, setHtml] = useState('');
  useEffect(() => {
    let cancelled = false;
    const render = () => { void api.renderMarkdown(text, project, '').then((result) => { if (!cancelled) setHtml(result); }).catch(() => { if (!cancelled) setHtml(''); }); };
    const timer = live ? setTimeout(render, RENDER_EVERY_MS) : undefined;
    if (!live) render();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [text, project, live]);
  return html ? <MarkdownBody html={html} className="chat-markdown" onClick={(e) => {
    const anchor = (e.target as Element).closest('a');
    if (anchor) { e.preventDefault(); const href = anchor.getAttribute('href'); if (href) onLink(href); }
  }} /> : <p className="chat-user-text">{text}</p>;
}

// The artifact over the conversation: the main process places an isolated browser view on this area and hides it
// while the tab is hidden or a dialog covers it.
function ArtifactPane({ project, url, active, onBack }: { project: string; url: string; active: boolean; onBack: () => void }) {
  const area = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<ArtifactStatus | null>(null);
  useEffect(() => {
    let cancelled = false, frame = 0;
    const update = () => {
      const rect = area.current?.getBoundingClientRect();
      const covered = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"], .menu-backdrop, .note-host, .drop-veil')).some((el) => el.getClientRects().length > 0);
      if (!active || covered || !rect || rect.width < 1 || rect.height < 1) { void api.hideArtifact(project).catch(() => {}); return; }
      void api.showArtifact(project, url, { x: rect.x, y: rect.y, width: rect.width, height: rect.height }).then((next) => {
        if (!cancelled) setStatus((old) => old?.url === next.url && old.loading === next.loading && old.error === next.error ? old : next);
      }).catch((e: Error) => { if (!cancelled) setStatus({ url, loading: false, error: e.message }); });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); };
    const resize = new ResizeObserver(schedule);
    if (area.current) resize.observe(area.current);
    const overlays = new MutationObserver(schedule);
    overlays.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-modal', 'hidden'] });
    window.addEventListener('resize', schedule);
    const timer = setInterval(schedule, 1000); // loading state and moves the observers do not see
    schedule();
    return () => { cancelled = true; cancelAnimationFrame(frame); clearInterval(timer); resize.disconnect(); overlays.disconnect(); window.removeEventListener('resize', schedule); void api.hideArtifact(project).catch(() => {}); };
  }, [project, url, active]);
  return <div className="chat-artifact">
    <div className="chat-artifact-bar">
      <button className="btn btn-ghost btn-sm" type="button" onClick={onBack}><IconArrowLeft size={14} />{t('Back to the conversation')}</button>
      <span className="muted small" role="status">{status?.loading ? t('Loading…') : t('Claude artifact')}</span>
      <button className="icon-btn" type="button" aria-label={t('Reload')} title={t('Reload')} onClick={() => { void api.reloadArtifact(project); }}><IconRefresh size={15} /></button>
      <button className="icon-btn" type="button" aria-label={t('Open in the browser')} title={t('Open in the browser')} onClick={() => { void api.openLink(status?.url || url); }}><IconExternal size={15} /></button>
    </div>
    <div className="chat-artifact-area" ref={area}>{status?.error && <div className="chat-empty"><p className="error" role="alert">{status.error}</p><p>{t('If sign-in is blocked here, open the artifact in your browser.')}</p></div>}</div>
  </div>;
}
