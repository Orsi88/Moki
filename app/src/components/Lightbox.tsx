// A picture or a video seen large over the whole window, without opening a tab: the folder view and the tree open
// pictures and videos here (a video plays with its controls). ← and → go through the others of the same folder in the
// order they were shown, Open in a tab takes the file to its full viewer (comments, markers), and Esc, a click outside
// or × closes it, giving the focus back to where it was. The file is read through moki-file:// (api.readFile), never
// as bytes over IPC.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api';
import { t } from '../i18n';
import { IconCheck, IconChevron, IconCopy, IconExternal, IconX } from './Icons';
import './lightbox.css';

export interface MediaItem { path: string; name: string }
const PICTURE = /\.(png|jpe?g|gif|webp|bmp)$/i;
const VIDEO = /\.(mp4|m4v|webm|mov)$/i;
export const isPicture = (name: string) => PICTURE.test(name);
export const isVideo = (name: string) => VIDEO.test(name);
export const isMedia = (name: string) => isPicture(name) || isVideo(name);

interface Props {
  project: string;
  items: MediaItem[];
  start: number;
  onClose: () => void;
  onOpenTab: (path: string) => void;
}

export function Lightbox({ project, items, start, onClose, onOpenTab }: Props) {
  const [at, setAt] = useState(Math.min(Math.max(0, start), items.length - 1));
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<'' | 'done' | string>(''); // '' nothing yet, 'done', or why it failed
  const close = useRef<HTMLButtonElement>(null);
  const before = useRef<Element | null>(document.activeElement);
  const item = items[at];
  const video = item ? isVideo(item.name) : false;
  const many = items.length > 1;
  const step = (by: number) => setAt((i) => (i + by + items.length) % items.length);

  useEffect(() => {
    if (!item) return;
    let gone = false;
    setUrl(''); setFailed(false); setCopied('');
    api.readFile(project, item.path).then((c) => {
      if (gone) return;
      if ((c.kind === 'image' || c.kind === 'video') && c.url) setUrl(c.url); else setFailed(true);
    }).catch(() => { if (!gone) setFailed(true); });
    return () => { gone = true; };
  }, [project, item?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    close.current?.focus();
    const back = before.current;
    return () => { if (back instanceof HTMLElement) back.focus(); };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); return; }
      // Arrows over a playing video seek it; elsewhere they go to the previous or next item.
      if (!many || event.target instanceof HTMLVideoElement) return;
      if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [many, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={item.name} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <header className="lightbox-bar">
        <span className="lightbox-name" title={item.path}>{item.name}</span>
        {many && <span className="lightbox-count">{t('{at} of {n}', { at: at + 1, n: items.length })}</span>}
        <span className="lightbox-space" />
        {/\.(png|jpe?g)$/i.test(item.name) && (
          <button type="button" className="lightbox-btn" title={copied && copied !== 'done' ? t(copied) : t('Copy the picture, to paste it into a document or a note')}
            onClick={() => { void api.copyImageFile(project, item.path).then(() => setCopied('done'), (e: Error) => setCopied(e.message)); }}>
            {copied === 'done' ? <IconCheck size={15} /> : <IconCopy size={15} />}{copied === 'done' ? t('Copied') : t('Copy')}
          </button>
        )}
        <button type="button" className="lightbox-btn" onClick={() => { onOpenTab(item.path); onClose(); }}><IconExternal size={15} />{t('Open in a tab')}</button>
        <button ref={close} type="button" className="lightbox-btn icon" title={t('Close')} aria-label={t('Close')} onClick={onClose}><IconX size={18} /></button>
      </header>
      <div className="lightbox-stage" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {failed ? <p className="lightbox-note">{t('This file could not be shown here.')}</p>
          : !url ? <span className="lightbox-note" aria-hidden="true">…</span>
          : video ? <video key={url} src={url} controls autoPlay preload="metadata" />
          : <img key={url} src={url} alt={item.name} />}
      </div>
      {many && <>
        <button type="button" className="lightbox-nav prev" title={t('Previous')} aria-label={t('Previous')} onClick={() => step(-1)}><IconChevron size={22} /></button>
        <button type="button" className="lightbox-nav next" title={t('Next')} aria-label={t('Next')} onClick={() => step(1)}><IconChevron size={22} /></button>
      </>}
    </div>,
    document.body,
  );
}
