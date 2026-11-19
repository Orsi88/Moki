// Notifications open the exact routine or proposal; opening never approves it. Changes Mycroft proposes to an agent,
// skill or activity show apart, and open that item's tab in Settings (where only the person approves them).
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, focusRoutine, type EvolutionKind, type RoutineNote } from '../api';
import { t } from '../i18n';
import { IconBell, IconX } from './Icons';

// A routine check sums itself up in one note: how many updates it found (the report opens from it), or none.
const noteMessage = (note: RoutineNote): string => note.changes === undefined ? note.message
  : note.changes > 1 ? t('{n} updates. Open the report to see what changed.', { n: note.changes })
  : note.changes === 1 ? t('1 update. Open the report to see what changed.')
  : t('No updates.');

const TAB: Record<EvolutionKind, 'agents' | 'skills' | 'activities'> = { agent: 'agents', skill: 'skills', activity: 'activities' };

export function NotificationBell({ onOpenRoutine, onOpenSettings }: { onOpenRoutine: (projectId: string) => void; onOpenSettings?: (tab: 'agents' | 'skills' | 'activities') => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<RoutineNote[]>([]);
  const [waiting, setWaiting] = useState<Awaited<ReturnType<typeof api.evolutionWaiting>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState({ left: 52, top: 16, maxHeight: 480 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const unread = notes.filter((n) => !n.readAt).length + waiting.length;
  const load = useCallback(() => {
    void api.notifications().then((rows) => { setNotes(rows); setError(''); }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
    void api.evolutionWaiting().then(setWaiting).catch(() => setWaiting([]));
  }, []);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 20_000);
    window.addEventListener('qa:notifications-read', load);
    return () => { window.clearInterval(timer); window.removeEventListener('qa:notifications-read', load); };
  }, [load]);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const place = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      // The status bar is 24px. Keep the panel above that line, with a small gap.
      const bottom = window.innerHeight - 32;
      let top = Math.max(12, box.top);
      let maxHeight = bottom - top;
      if (maxHeight < 220) {
        top = Math.max(12, bottom - Math.min(480, bottom - 12));
        maxHeight = bottom - top;
      }
      setPosition({ left: Math.max(12, Math.min(box.right + 8, window.innerWidth - 396)), top, maxHeight: Math.min(480, maxHeight) });
    };
    const outside = (e: PointerEvent) => { if (e.target instanceof Node && !panel.current?.contains(e.target) && !trigger.current?.contains(e.target)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); } };
    place();
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    window.addEventListener('resize', place);
    window.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', key, true); };
  }, [open]);
  const mark = async (ids: string[] | 'all') => {
    try { setNotes(await api.readNotifications(ids)); setError(''); window.dispatchEvent(new Event('qa:notifications-read')); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const dismiss = async (ids: string[] | 'all') => {
    try { setNotes(await api.dismissNotifications(ids)); setError(''); window.dispatchEvent(new Event('qa:notifications-read')); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const openNote = (note: RoutineNote) => {
    void mark([note.id]);
    focusRoutine({ projectId: note.projectId, routineId: note.routineId, proposalId: note.proposalId, ...(note.navigationTarget.executionId ? { executionId: note.navigationTarget.executionId } : {}) });
    onOpenRoutine(note.projectId);
    setOpen(false);
  };
  return <>
    <button ref={trigger} type="button" className={`icon-btn notification-trigger${open ? ' on' : ''}`} aria-expanded={open} aria-haspopup="dialog" title={t('Notifications')} aria-label={t('Notifications')} onClick={() => { setOpen((v) => !v); load(); }}>
      <IconBell size={19} />{unread > 0 && <span className="ribbon-count">{unread > 9 ? '9+' : unread}</span>}
    </button>
    {open && <aside ref={panel} className="note-panel" role="dialog" aria-label={t('Notifications')} style={position}>
      <header><div><strong>{t('Notifications')}</strong><span className="muted small">{unread ? t('{n} unread', { n: unread }) : t('You are all caught up.')}</span></div><button type="button" className="icon-btn" aria-label={t('Close notifications')} onClick={close}><IconX size={17} /></button></header>
      {error && <p className="result warn" role="alert">{error}<button type="button" className="link" onClick={load}>{t('Try again')}</button></p>}
      {waiting.length > 0 && onOpenSettings && <section className="note-evolution" aria-label={t('Waiting for your approval')}>
        <p className="muted small">{waiting.length === 1 ? t('Mycroft has 1 improvement waiting for you') : t('Mycroft has {n} improvements waiting for you', { n: waiting.length })}</p>
        <ul>{waiting.map((w) => <li key={w.id} className="note-row unread"><button type="button" className="note-item" onClick={() => { setOpen(false); onOpenSettings(TAB[w.kind]); }}>
          <span className="note-item-copy"><strong>{w.name}</strong><span className="muted small">{w.reason}</span><time className="muted small" dateTime={w.at}>{new Date(w.at).toLocaleString()}</time></span><i className="note-unread-dot" aria-hidden="true" />
        </button></li>)}</ul>
      </section>}
      {loading ? <p className="notification-empty" role="status">{t('Loading…')}</p> : notes.length === 0 && waiting.length === 0 ? <div className="notification-empty"><IconBell size={28} /><strong>{t('No notifications yet.')}</strong><p className="muted small">{t('Changes and requests for your approval will appear here.')}</p></div> : <ul>{notes.slice(0, 50).map((note) => <li key={note.id} className={`note-row${note.readAt ? '' : ' unread'}`}>
        <button type="button" className="note-item" onClick={() => openNote(note)}>
          <img src="./notify-cup.png" alt="" width={32} height={32} /><span className="note-item-copy"><strong>{note.title}</strong><span className="muted small">{noteMessage(note)}</span><time className="muted small" dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time></span>{!note.readAt && <i className="note-unread-dot" aria-hidden="true" />}
        </button>
        <button type="button" className="icon-btn note-dismiss" aria-label={t('Dismiss notification')} onClick={() => { void dismiss([note.id]); }}><IconX size={14} /></button>
      </li>)}</ul>}
      {notes.length > 0 && <footer>
        {unread > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => void mark('all')}>{t('Mark all as read')}</button>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void dismiss('all')}>{t('Clear all')}</button>
      </footer>}
    </aside>}
  </>;
}
