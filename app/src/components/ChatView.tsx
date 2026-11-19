// The single chat tab of a project: an AI tool with the same access as its terminal (project files, skills, MCP
// tools), its answers as they arrive, the history and a new conversation in the same tab. A Claude artifact linked
// in an answer (presentation, spreadsheet, page) opens over the conversation, in an isolated viewer.
import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { api, CHAT_TOOLS, type ArtifactStatus, type ChatState, type ToolInfo } from '../api';
import { isArtifactUrl as isArtifactLink } from '../../../scripts/lib/artifact-links.ts';
import { conversationLanguage, t } from '../i18n';
import { recall, remember } from '../prefs';
import { IconArrowLeft, IconChat, IconExternal, IconHistory, IconPlay, IconPlus, IconRefresh, IconStop } from './Icons';
import { MarkdownBody } from './MarkdownBody';
import './chat.css';

// Names in the chat (brand names, not translated): Codex is the ChatGPT of the terminal.
const CHAT_NAMES: Record<string, string> = { claude: 'Claude', codex: 'ChatGPT (Codex)' };
const SAFETY_POLL_MS = 2000; // while answering, in case a change notice was missed
const RENDER_EVERY_MS = 300; // an answer arriving is formatted at most this often

interface Props {
  project: string; workspace: string; tools: ToolInfo[]; active: boolean;
  pending?: { text: string; tool: string; label?: string; key: number } | null;
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
  const [newMenu, setNewMenu] = useState<{ left: number; top: number } | null>(null);
  const [historyMenu, setHistoryMenu] = useState<{ left: number; top: number } | null>(null);
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
    // A request from Call… is sent at once, in a new conversation (like a new terminal); the person's draft stays.
    const target = usable.find((x) => x.id === pending.tool) ?? tool;
    onPending();
    setArtifact(null);
    if (!target) { setError(t('Install in Settings › My AIs')); return; }
    setChosen(target.id);
    void deliver(pending.text, target.id, undefined, pending.label);
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

  // `chat`: the conversation to continue; undefined starts a new one.
  // `label`: a request Moki wrote (Call…), shown folded under that name.
  const deliver = async (text: string, toolId: string, chat: string | undefined, label?: string) => {
    setSending(true); setError('');
    try {
      const next = await api.chatSend(project, chat, toolId, text, conversationLanguage(), label);
      setState(next); remember(`${prefix}:id`, next.record.id);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; }
    finally { setSending(false); }
  };
  const send = async () => {
    if (!tool || !draft.trim() || sending || state?.busy) return;
    const text = draft;
    if (await deliver(text, tool.id, state?.record.id)) setDraft((current) => current === text ? '' : current);
  };
  const selectHistory = async (chat: string) => {
    if (!chat) return;
    try { const next = await api.chatState(project, chat); setState(next); setChosen(next.record.tool); remember(`${prefix}:id`, chat); setError(''); setArtifact(null); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  // A new conversation, with the AI it is for (a conversation keeps the AI it started with: there is no switch inside it).
  const fresh = (next?: string) => { if (next) setChosen(next); setNewMenu(null); setError(''); setArtifact(null); setState(null); remember(`${prefix}:id`, ''); box.current?.focus(); };
  const startNew = (e: MouseEvent<HTMLElement>) => {
    if (usable.length < 2) { fresh(); return; }
    const r = e.currentTarget.getBoundingClientRect();
    setNewMenu(newMenu ? null : { left: Math.max(8, r.right - 240), top: r.bottom + 4 });
  };
  const link = (href: string) => { if (isArtifactLink(href)) setArtifact(href); else onLink(href); };
  const label = (id: string) => CHAT_NAMES[id] ?? id;

  return <div className="chat-view" hidden={!active}>
    <header className="chat-head">
      <IconChat size={18} />
      <span className="chat-tool">{state ? label(state.record.tool) : tool ? label(tool.id) : t('Chat')}</span>
      <span className="chat-head-space" />
      {history.length > 0 && <button className="icon-btn" type="button" title={t('Conversation history')} aria-label={t('Conversation history')} aria-haspopup="menu" aria-expanded={Boolean(historyMenu)}
        onClick={(e) => { void loadHistory().catch((err: Error) => setError(err.message)); const r = e.currentTarget.getBoundingClientRect(); setHistoryMenu(historyMenu ? null : { left: Math.max(8, r.right - 320), top: r.bottom + 4 }); }}><IconHistory size={17} /></button>}
      <button className="icon-btn" type="button" onClick={startNew} disabled={!tool} title={t('New conversation')} aria-label={t('New conversation')}
        aria-haspopup={usable.length > 1 ? 'menu' : undefined} aria-expanded={usable.length > 1 ? Boolean(newMenu) : undefined}><IconPlus size={17} /></button>
    </header>
    {historyMenu && (
      <div className="menu-backdrop" onMouseDown={() => setHistoryMenu(null)}>
        <ul className="term-menu chat-history-menu" role="menu" aria-label={t('Conversation history')} style={{ left: historyMenu.left, top: historyMenu.top, width: 320 }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setHistoryMenu(null); }}>
          {history.map((c, i) => <li key={c.id}><button type="button" role="menuitem" autoFocus={i === 0} aria-current={c.id === state?.record.id || undefined} onClick={() => { setHistoryMenu(null); void selectHistory(c.id); }}>
            <span className="chat-history-title">{c.title || t('New conversation')}</span>
            <span className="chat-history-meta">{label(c.tool)} · {new Date(c.updated).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}</span>
          </button></li>)}
        </ul>
      </div>
    )}
    {newMenu && (
      <div className="menu-backdrop" onMouseDown={() => setNewMenu(null)}>
        <ul className="term-menu" role="menu" aria-label={t('New conversation')} style={{ left: newMenu.left, top: newMenu.top, minWidth: 240 }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setNewMenu(null); }}>
          {usable.map((x, i) => <li key={x.id}><button type="button" role="menuitem" autoFocus={i === 0} onClick={() => fresh(x.id)}>{t('New conversation with {tool}', { tool: label(x.id) })}</button></li>)}
        </ul>
      </div>
    )}
    {(error || state?.error) && <p className="error chat-notice" role="alert">{t(error || state?.error || '')}</p>}
    {artifact ? <ArtifactPane project={project} url={artifact} active={active} onBack={() => setArtifact(null)} /> : <>
      <div className="chat-messages" role="log" aria-label={t('Conversation')}>
        {!state?.record.messages.length && <div className="chat-empty"><IconChat size={30} />
          <h2>{t('Talk about this project')}</h2>
          <p>{tool ? t('The AI can use the project files, skills and connected tools.') : t('Install in Settings › My AIs')}</p>
        </div>}
        {state?.record.messages.map((message, i) => <article key={i} className={`chat-message chat-${message.role}`}>
          <span className="chat-author">{message.role === 'user' ? t('You') : label(state.record.tool)}</span>
          {message.role === 'user' && message.label
            // A request Moki wrote: its name, and the full text only when opened (the AI got all of it).
            ? <details className="chat-request"><summary>{t('Request from Moki: {name}', { name: message.label })}</summary><p className="chat-user-text">{message.text}</p></details>
            : message.role === 'user' ? <p className="chat-user-text">{message.text}</p>
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
  const latest = useRef(text);
  latest.current = text;
  const timer = useRef<number | undefined>(undefined);
  const seq = useRef(0); // only the newest render shows
  const last = useRef(0);
  useEffect(() => () => { window.clearTimeout(timer.current); seq.current++; }, []);
  useEffect(() => {
    // While the answer arrives, the newest text is formatted at most every RENDER_EVERY_MS (a throttle: text that
    // keeps arriving still shows); once it is done, right away.
    const render = () => {
      timer.current = undefined;
      last.current = Date.now();
      const n = ++seq.current;
      void api.renderMarkdown(latest.current, project, '').then((result) => { if (n === seq.current) setHtml(result); }).catch(() => { if (n === seq.current) setHtml(''); });
    };
    if (!live) { window.clearTimeout(timer.current); render(); return; }
    if (timer.current === undefined) timer.current = window.setTimeout(render, Math.max(0, RENDER_EVERY_MS - (Date.now() - last.current)));
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
