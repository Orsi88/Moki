// The single chat tab of a project: an AI tool with the same access as its terminal (project files, skills, MCP
// tools), its answers as they arrive, the history and a new conversation in the same tab. A Claude artifact linked
// in an answer (presentation, spreadsheet, page) opens over the conversation, in an isolated viewer, by itself when
// the answer that made it ends. The files an answer names show under it (pictures with a preview), the person's
// attachments with their message; what the AI is doing shows while it works.
import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type MouseEvent } from 'react';
import { api, CHAT_TOOLS, type ArtifactStatus, type ChatFile, type ChatState, type ToolInfo } from '../api';

type ChatToolCall = { name: string; summary: string; ok?: boolean };
import { isArtifactUrl as isArtifactLink } from '../../../scripts/lib/artifact-links.ts';
import { conversationLanguage, t } from '../i18n';
import { recall, remember } from '../prefs';
import { copyText } from '../clipboard';
import { IconArrowDown, IconArrowLeft, IconArrowUp, IconChat, IconCheck, IconCopy, IconEdit, IconExternal, IconFile, IconHistory, IconPaperclip, IconPlus, IconRefresh, IconStop, IconX } from './Icons';
import { MarkdownBody } from './MarkdownBody';
import './chat.css';

// Names in the chat (brand names, not translated): Codex is the ChatGPT of the terminal.
const CHAT_NAMES: Record<string, string> = { claude: 'Claude', codex: 'ChatGPT (Codex)' };
const SAFETY_POLL_MS = 2000; // while answering, in case a change notice was missed
const RENDER_EVERY_MS = 300; // an answer arriving is formatted at most this often
const COMPOSE_MAX_PX = 200; // the message box grows with its text up to this height
// Files dragged from the project tree (FileTree): their project-relative paths, one per line.
const TREE_DRAG = 'application/x-moki-move';
// Starting points in an empty conversation: a click puts the text in the message box (it is not sent).
const SUGGESTIONS = ['Summarize what this project already knows and what is missing.', 'Which test scenarios fit the stories in the inbox?', 'Review the latest delivery and tell me what to check.'];
const ARTIFACT = /https:\/\/claude\.ai\/(?:code\/)?artifacts?\/[\w-]+/g;

interface Props {
  project: string; workspace: string; tools: ToolInfo[]; active: boolean;
  pending?: { text: string; tool: string; label?: string; key: number } | null;
  onPending: () => void;
  onLink: (href: string) => void;
}
// An attachment in the message box: its path in the project once saved, a preview for a picture, an error.
interface Draft { key: number; name: string; path: string; image: boolean; preview?: string; error?: string }

// What a tool call means for the person: "Consulting the project context", "Reading context/rules.md"…
// MCP tools are named mcp__<server>__<tool> by Claude Code and <server>.<tool> by Codex.
function activity(call: ChatToolCall): string {
  const mcp = /^mcp__(.+?)__/.exec(call.name) ?? /^([\w-]+)\.[\w-]+$/.exec(call.name);
  if (mcp) return mcp[1] === 'moki' ? t('Consulting the project context') : t('Consulting {server}', { server: mcp[1] });
  const file = call.summary.split(/[\\/]/).slice(-2).join('/');
  if (/^(Read|View|NotebookRead)$/.test(call.name)) return t('Reading {file}', { file });
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(call.name)) return /\.(png|jpe?g|gif|webp|svg)$/i.test(call.summary) ? t('Generating an image') : t('Writing {file}', { file });
  if (/^(Grep|Glob|LS|Search)$/.test(call.name)) return t('Searching the project');
  if (/^(Bash|Shell|PowerShell)$/.test(call.name)) return /\.(png|jpe?g|svg)\b/i.test(call.summary) ? t('Generating an image') : t('Running a command');
  if (/^Web(Search|Fetch)$/.test(call.name)) return t('Searching the web');
  if (call.name === 'Skill') return t('Using the skill {skill}', { skill: call.summary });
  if (call.name === 'Task' || call.name === 'Agent') return t('Working with a helper agent');
  return `${call.name} ${call.summary}`.trim();
}
// A failed connection, named: what the person must know about an answer built without it.
const failedConnection = (call: ChatToolCall): string | null => {
  if (call.ok !== false) return null;
  const mcp = /^mcp__(.+?)__/.exec(call.name) ?? /^([\w-]+)\.[\w-]+$/.exec(call.name);
  return mcp ? mcp[1] : null;
};

export function ChatView({ project, workspace, tools, active, pending, onPending, onLink }: Props) {
  const prefix = `qa-chat:${workspace}:${project}`;
  const usable = tools.filter((tool) => CHAT_TOOLS.includes(tool.id) && tool.available);
  const [chosen, setChosen] = useState(() => recall(`${prefix}:tool`) || 'claude');
  const tool = usable.find((x) => x.id === chosen) ?? usable[0];
  const [history, setHistory] = useState<Awaited<ReturnType<typeof api.chats>>>([]);
  const [state, setState] = useState<ChatState | null>(null);
  const [draft, setDraft] = useState(() => recall(`${prefix}:draft`) || '');
  const [attachments, setAttachments] = useState<Draft[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [artifact, setArtifact] = useState<string | null>(null);
  const [newMenu, setNewMenu] = useState<{ left: number; top: number } | null>(null);
  const [historyMenu, setHistoryMenu] = useState<{ left: number; top: number } | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [dropping, setDropping] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const lastPending = useRef<number | null>(null);
  const attachKey = useRef(0);
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
  // The message box grows with what is written, up to COMPOSE_MAX_PX, and shrinks back when it is sent.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, COMPOSE_MAX_PX)}px`;
  }, [draft, active]);
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

  // An artifact the answer just made opens by itself, as Claude Code does in a terminal (once per link): only when an
  // answer ends here, not when an older conversation is read again.
  const wasBusy = useRef(false);
  const opened = useRef(new Set<string>());
  useEffect(() => {
    const ended = wasBusy.current && !busy;
    wasBusy.current = busy;
    if (!ended) return;
    const answer = state?.record.messages.at(-1);
    const link = answer?.role === 'assistant' ? [...answer.text.matchAll(ARTIFACT)].map((m) => m[0]).find((u) => !opened.current.has(u)) : undefined;
    if (link) { opened.current.add(link); setArtifact(link); }
  }, [busy, state]);

  // The conversation follows what is written while the person is at its end (also when an answer's formatting or a
  // picture makes it taller); scrolled up to read, it stays put and the down arrow appears.
  const scroller = useRef<HTMLDivElement>(null);
  const thread = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [away, setAway] = useState(false);
  const toEnd = useCallback((smooth = false) => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);
  const followScroll = () => {
    const el = scroller.current;
    if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setAway(!stick.current);
  };
  useEffect(() => {
    const el = thread.current;
    if (!el || !active || artifact) return;
    const grew = new ResizeObserver(() => { if (stick.current) toEnd(); });
    grew.observe(el);
    if (stick.current) toEnd();
    return () => grew.disconnect();
  }, [active, artifact, state?.record.id, toEnd]);
  useEffect(() => { stick.current = true; setAway(false); }, [state?.record.id]);

  const running = state?.record.messages.at(-1)?.tools?.filter((call) => call.ok === undefined).at(-1);
  const working = busy && running ? activity(running) : '';

  // `chat`: the conversation to continue; undefined starts a new one. `label`: a request Moki wrote (Call…), shown
  // folded under that name. `files`: attachments, paths in the project.
  const deliver = async (text: string, toolId: string, chat: string | undefined, label?: string, files: string[] = []) => {
    setSending(true); setError('');
    stick.current = true; setAway(false);
    try {
      const next = await api.chatSend(project, chat, toolId, text, conversationLanguage(), label, files);
      setState(next); remember(`${prefix}:id`, next.record.id);
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); return false; }
    finally { setSending(false); }
  };
  // "Ask again": the last question once more, with its attachments, in this conversation.
  const retry = () => {
    const question = [...(state?.record.messages ?? [])].reverse().find((m) => m.role === 'user');
    if (!question || !state || sending || busy) return;
    void deliver(question.text, state.record.tool, state.record.id, question.label, question.attachments);
  };

  // Attachments: pictures pasted, files dropped or picked from the computer (saved in the project's temporary/ from
  // their bytes), files dragged from the project tree. Each shows in the message box until it is sent or removed.
  const add = (name: string, image: boolean, save: () => Promise<string>, preview?: string) => {
    const key = ++attachKey.current;
    setAttachments((list) => [...list, { key, name, path: '', image, preview }]);
    void save().then((path) => setAttachments((list) => list.map((a) => (a.key === key ? { ...a, path } : a))))
      .catch((e: Error) => setAttachments((list) => list.map((a) => (a.key === key ? { ...a, error: e.message } : a))));
  };
  const addFiles = (files: File[]) => {
    for (const f of files) {
      const image = f.type.startsWith('image/');
      add(f.name || t('Pasted picture'), image, async () => {
        const bytes = new Uint8Array(await f.arrayBuffer());
        if (image && !f.name) { // a picture pasted from the clipboard: saved like a terminal's print
          const [file] = await api.chatFiles(project, [await api.savePastedImage(project, bytes, f.type)]);
          return file.path;
        }
        return api.saveAttachment(project, f.name, bytes);
      }, image ? URL.createObjectURL(f) : undefined);
    }
  };
  const addFromTree = (paths: string[]) => {
    for (const path of paths) {
      const name = path.split('/').pop() ?? path;
      const image = /\.(png|jpe?g|gif|webp)$/i.test(name);
      add(name, image, async () => {
        const [file] = await api.chatFiles(project, [path]);
        if (file.status !== 'ok') throw new Error(t('This file is not in the project any more.'));
        return file.path;
      });
      // A picture of the project: its miniature through the app's file protocol.
      if (image) {
        const key = attachKey.current;
        void api.readFile(project, path).then((content) => {
          if (content.kind === 'image') setAttachments((list) => list.map((a) => (a.key === key ? { ...a, preview: content.url } : a)));
        }).catch(() => { /* the card shows without a miniature */ });
      }
    }
  };
  const remove = (key: number) => setAttachments((list) => {
    const gone = list.find((a) => a.key === key);
    if (gone?.preview?.startsWith('blob:')) URL.revokeObjectURL(gone.preview);
    return list.filter((a) => a.key !== key);
  });
  const onDrop = (e: DragEvent<HTMLElement>) => {
    setDropping(false);
    const tree = e.dataTransfer.getData(TREE_DRAG);
    const files = [...e.dataTransfer.files];
    if (!tree && !files.length) return;
    e.preventDefault();
    if (tree) addFromTree(tree.split('\n').filter(Boolean)); else addFiles(files);
    box.current?.focus();
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files];
    if (!files.length) return; // text: pasted as usual
    e.preventDefault();
    addFiles(files);
  };
  const ready = attachments.filter((a) => a.path && !a.error);
  const waiting = attachments.some((a) => !a.path && !a.error);
  const canSend = Boolean(tool) && (draft.trim() !== '' || ready.length > 0) && !waiting && !sending && !busy;
  const send = async () => {
    if (!tool || !canSend) return;
    const text = draft;
    const sent = attachments;
    if (await deliver(text, tool.id, state?.record.id, undefined, ready.map((a) => a.path))) {
      setDraft((current) => (current === text ? '' : current));
      setAttachments((list) => list.filter((a) => !sent.includes(a)));
      for (const a of sent) if (a.preview?.startsWith('blob:')) URL.revokeObjectURL(a.preview);
    }
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
  const label = (key: string) => CHAT_NAMES[key] ?? key;
  const stop = () => { if (state) void api.chatStop(project, state.record.id).catch((e: Error) => setError(e.message)); };

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
      <div className="chat-messages" role="log" aria-label={t('Conversation')} ref={scroller} onScroll={followScroll}>
        <div className="chat-thread" ref={thread}>
          {!state?.record.messages.length && <div className="chat-empty"><IconChat size={30} />
            <h2>{t('Talk about this project')}</h2>
            <p>{tool ? t('The AI can use the project files, skills and connected tools.') : t('Install in Settings › My AIs')}</p>
            {tool && <div className="chat-suggestions">{SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chat-suggestion" onClick={() => { setDraft(t(s)); box.current?.focus(); }}>{t(s)}</button>
            ))}</div>}
          </div>}
          {state?.record.messages.map((message, i) => {
            const live = busy && i === state.record.messages.length - 1;
            const lastUser = message.role === 'user' && !state.record.messages.slice(i + 1).some((m) => m.role === 'user');
            const failed = [...new Set((message.tools ?? []).map(failedConnection).filter((s): s is string => Boolean(s)))];
            // The files an answer made or names: its text, and what its Write/Edit calls wrote.
            const written = (message.tools ?? []).filter((c) => /^(Write|Edit|MultiEdit)$/.test(c.name) && c.ok !== false).map((c) => `\`${c.summary}\``).join(' ');
            return <article key={i} className={`chat-message chat-${message.role}`}>
              {message.role === 'assistant' && <span className="chat-author">{label(state.record.tool)}</span>}
              {message.role === 'user' && message.label
                // A request Moki wrote: its name, and the full text only when opened (the AI got all of it).
                ? <details className="chat-request"><summary>{t('Request from Moki: {name}', { name: message.label })}</summary><p className="chat-user-text">{message.text}</p></details>
                : message.role === 'user' ? message.text.trim() && <p className="chat-user-text">{message.text}</p>
                : <ChatMarkdown text={message.text} project={project} live={live} onLink={link} />}
              {message.role === 'user' && message.attachments?.length ? <ChatFiles project={project} refs={message.attachments} onOpen={onLink} compact /> : null}
              {message.tools?.length ? <details className="chat-tools"><summary>{t('Tools used')} ({message.tools.length})</summary><ul>{message.tools.map((call, index) => <li key={index}><span aria-hidden="true">{call.ok === false ? '×' : call.ok ? '✓' : '·'}</span> {activity(call)}</li>)}</ul></details> : null}
              {failed.length > 0 && <p className="warn-text small" role="status">{t('{servers} did not answer: this answer was made without its data.', { servers: failed.join(', ') })}</p>}
              {message.error && <p className="error" role="status">{message.error === 'stopped' ? t('Response stopped.') : message.error}</p>}
              {message.role === 'assistant' && !live && (message.text.trim() || written) ? <ChatFiles project={project} text={`${message.text}\n${written}`} onOpen={onLink} /> : null}
              {!live && !busy && (message.role === 'assistant' ? message.text.trim() !== '' || Boolean(message.error) : lastUser && !message.label) && (
                <div className="chat-actions">
                  {message.role === 'assistant' && message.text.trim() && <button type="button" className="icon-btn" title={copied === i ? t('Copied') : t('Copy')} aria-label={t('Copy the answer')}
                    onClick={() => { void copyText(message.text).then(() => { setCopied(i); window.setTimeout(() => setCopied((c) => (c === i ? null : c)), 1500); }); }}>{copied === i ? <IconCheck size={14} /> : <IconCopy size={14} />}</button>}
                  {message.role === 'assistant' && i === state.record.messages.length - 1 && <button type="button" className="icon-btn" title={t('Ask again')} aria-label={t('Ask again')} onClick={retry}><IconRefresh size={14} /></button>}
                  {message.role === 'user' && <button type="button" className="icon-btn" title={t('Edit and send again')} aria-label={t('Edit and send again')} onClick={() => { setDraft(message.text); box.current?.focus(); }}><IconEdit size={14} /></button>}
                </div>
              )}
            </article>;
          })}
          {(busy || sending) && <div className="chat-working" role="status"><span className="chat-dots" aria-hidden="true"><i /><i /><i /></span>
            {working || t('{tool} is working…', { tool: label(state?.record.tool ?? tool?.id ?? 'claude') })}</div>}
        </div>
      </div>
      <form className={`chat-compose${dropping ? ' dropping' : ''}`} onSubmit={(e) => { e.preventDefault(); void send(); }}
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes(TREE_DRAG)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropping(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false); }} onDrop={onDrop}>
        {away && <button type="button" className="icon-btn chat-to-end" title={t('Go to the latest')} aria-label={t('Go to the latest')}
          onClick={() => { stick.current = true; setAway(false); toEnd(true); }}><IconArrowDown size={16} /></button>}
        <div className="chat-compose-box">
          {attachments.length > 0 && <ul className="chat-attachments" aria-label={t('Attachments')}>
            {attachments.map((a) => <li key={a.key} className={a.error ? 'failed' : !a.path ? 'saving' : ''}>
              {a.preview ? <img src={a.preview} alt="" /> : <span className="chat-attachment-icon"><IconFile size={16} /></span>}
              <span className="chat-attachment-name" title={a.error || a.name}>{a.name}{a.error && <span className="error small"> · {t(a.error)}</span>}</span>
              <button type="button" className="icon-btn" title={t('Remove')} aria-label={t('Remove {file}', { file: a.name })} onClick={() => remove(a.key)}><IconX size={13} /></button>
            </li>)}
          </ul>}
          <div className="chat-compose-row">
            <button type="button" className="icon-btn" title={t('Attach files')} aria-label={t('Attach files')} disabled={!tool} onClick={() => picker.current?.click()}><IconPaperclip size={17} /></button>
            <input ref={picker} type="file" multiple hidden onChange={(e) => { addFiles([...(e.target.files ?? [])]); e.target.value = ''; box.current?.focus(); }} />
            <textarea ref={box} aria-label={t('Message')} placeholder={t('Ask about the project…')} value={draft} rows={1} maxLength={1_000_000} disabled={!tool}
              title={t('Enter sends, Shift+Enter starts a new line. Paste or drop files to attach them.')} onPaste={onPaste}
              onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
            {busy && state
              ? <button type="button" className="chat-send stop" onClick={stop} title={t('Stop the answer')} aria-label={t('Stop the answer')}><IconStop size={15} /></button>
              : <button type="submit" className="chat-send" disabled={!canSend} title={t('Send')} aria-label={t('Send')}><IconArrowUp size={17} /></button>}
          </div>
        </div>
      </form>
    </>}
  </div>;
}

// The files a message names or carries: a preview for a picture, a card with Open in the project for the others,
// and why a file cannot be opened (moved or removed, another project, outside the projects).
function ChatFiles({ project, text, refs, onOpen, compact }: { project: string; text?: string; refs?: string[]; onOpen: (path: string) => void; compact?: boolean }) {
  const [files, setFiles] = useState<ChatFile[]>([]);
  const key = refs ? refs.join('\n') : text ?? '';
  useEffect(() => {
    let cancelled = false;
    const ask = refs ? api.chatFiles(project, refs) : api.chatAnswerFiles(project, text ?? '');
    ask.then((list) => { if (!cancelled) setFiles(list); }).catch(() => { if (!cancelled) setFiles([]); });
    return () => { cancelled = true; };
  }, [project, key]);
  if (!files.length) return null;
  return <ul className={`chat-files${compact ? ' compact' : ''}`} aria-label={t('Files')}>
    {files.map((f) => <li key={f.ref} className={`chat-file${f.status === 'ok' ? '' : ' unavailable'}`}>
      {f.status === 'ok' && f.image ? <ChatPicture project={project} path={f.path} name={f.name} onOpen={() => onOpen(f.path)} /> : null}
      <div className="chat-file-line">
        <span className="chat-file-icon" aria-hidden="true"><IconFile size={15} /></span>
        <span className="chat-file-name" title={f.path || f.ref}>{f.name}</span>
        {f.status === 'ok'
          ? <button type="button" className="link small" onClick={() => onOpen(f.path)}>{t('Open in the project')}</button>
          : <span className="muted small">{f.status === 'missing' ? t('Not found: moved or removed') : f.status === 'other-project' ? t('Another project: not available in this conversation') : t('Outside the project: not available')}</span>}
      </div>
    </li>)}
  </ul>;
}

// A picture of the project, shown through the app's file protocol; when it cannot load, its card stays and says so.
function ChatPicture({ project, path, name, onOpen }: { project: string; path: string; name: string; onOpen: () => void }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    api.readFile(project, path).then((content) => { if (!cancelled) { if (content.kind === 'image') setUrl(content.url); else setFailed(true); } }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [project, path]);
  if (failed) return <p className="muted small chat-picture-failed">{t('The picture could not be shown.')}</p>;
  return url ? <button type="button" className="chat-picture" onClick={onOpen} title={t('Open {file} larger', { file: name })} aria-label={t('Open {file} larger', { file: name })}>
    <img src={url} alt={name} onError={() => setFailed(true)} />
  </button> : <div className="chat-picture loading" aria-hidden="true" />;
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
