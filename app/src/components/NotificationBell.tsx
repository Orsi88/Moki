// Notifications open the exact routine or proposal; opening never approves it.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, focusRoutine, type RoutineNote } from '../api';
import { t } from '../i18n';
import { IconBell, IconX } from './Icons';

export function NotificationBell({ onOpenRoutine }: { onOpenRoutine: (projectId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<RoutineNote[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState({ left: 52, top: 16 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const unread = notes.filter((n) => !n.readAt).length;
  const load = useCallback(() => {
    void api.notifications().then((rows) => { setNotes(rows); setError(''); }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
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
      if (box) setPosition({ left: Math.max(12, Math.min(box.right + 8, window.innerWidth - 396)), top: Math.max(12, Math.min(box.top, window.innerHeight - 340)) });
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
  const openNote = (note: RoutineNote) => {
    void mark([note.id]);
    focusRoutine({ projectId: note.projectId, routineId: note.routineId, proposalId: note.proposalId });
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
      {loading ? <p className="notification-empty" role="status">{t('Loading…')}</p> : notes.length === 0 ? <div className="notification-empty"><IconBell size={28} /><strong>{t('No notifications yet.')}</strong><p className="muted small">{t('Changes and requests for your approval will appear here.')}</p></div> : <ul>{notes.slice(0, 50).map((note) => <li key={note.id}>
        <button type="button" className={`note-item${note.readAt ? '' : ' unread'}`} onClick={() => openNote(note)}>
          <img src="./notify-cup.png" alt="" width={32} height={32} /><span className="note-item-copy"><strong>{note.title}</strong><span className="muted small">{note.message}</span><time className="muted small" dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time></span>{!note.readAt && <i className="note-unread-dot" aria-hidden="true" />}
        </button>
      </li>)}</ul>}
      {unread > 0 && <footer><button type="button" className="btn btn-ghost btn-sm" onClick={() => void mark('all')}>{t('Mark all as read')}</button></footer>}
    </aside>}
  </>;
}
