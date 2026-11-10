// "Skills and agents" card of the project panel (skills and agents under their own headings): what the project uses (its own, the global ones it links, Moki's
// tagged for it). A row opens the file when it is the project's; ▶ sends the request to the AI (the owner of that
// choice is the workspace screen: it pastes into the focused AI terminal or opens a new one).

import { Fragment, useEffect, useState, type DragEvent } from 'react';
import { api, type InvokeTarget, type UsedItem } from '../api';
import { t } from '../i18n';
import { dragging, ITEM_DRAG, itemPayload } from '../item-drag';
import { IconAgent, IconChevron, IconPlay, IconSkill } from './Icons';

interface Props {
  project: string;
  refreshKey: number; // bumped when the project's files change
  settings: string; // changes when what the project links or sets as default does
  onOpenPath: (path: string) => void;
  onInvoke: (target: InvokeTarget) => void;
  onSetup: () => void; // Project settings: where skills are linked
  canInvoke: boolean; // an AI is there to receive it
}

const originLabel = (scope: UsedItem['scope']) => (scope === 'project' ? t('Only this project') : scope === 'global' ? t('For all projects') : t('From Moki'));

export function ProjectItems({ project, refreshKey, settings, onOpenPath, onInvoke, onSetup, canInvoke }: Props) {
  const [items, setItems] = useState<UsedItem[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<boolean | null>(null); // null: open while there is something to show

  useEffect(() => {
    let live = true;
    api.usedItems(project).then((list) => { if (live) { setItems(list); setError(''); } }).catch((e: Error) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [project, refreshKey, settings]);

  if (!items) return error ? <p className="pp-msg" role="alert">{error}</p> : null;
  const expanded = open ?? items.length > 0;

  const row = (item: UsedItem) => {
    const target: InvokeTarget = { kind: item.kind, name: item.name };
    const drag = item.missing ? {} : {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        dragging.current = { project, kind: item.kind, name: item.name };
        e.dataTransfer.setData(ITEM_DRAG, itemPayload(dragging.current));
        e.dataTransfer.effectAllowed = 'copy';
      },
      onDragEnd: () => { dragging.current = null; },
    };
    const hint = (text: string) => (item.missing ? text : `${text}\n${t('Drag to the terminal')}`);
    const label = (
      <>
        <span className="pp-item-icon" aria-hidden="true">{item.kind === 'skill' ? <IconSkill size={14} /> : <IconAgent size={14} />}</span>
        <span className="pp-item-name">{item.name}</span>
        <span className="chip pp-item-origin">{item.missing ? t('Not installed any more') : originLabel(item.scope)}</span>
      </>
    );
    return (
      <li key={`${item.kind}:${item.name}`} className={`pp-item${item.missing ? '' : ' draggable'}`} {...drag}>
        {item.open && !item.missing
          ? <button type="button" className="pp-item-main" title={hint(item.description || t('Open {name}', { name: item.name }))} onClick={() => onOpenPath(item.open as string)}>{label}</button>
          : <span className="pp-item-main" title={item.missing ? item.description || undefined : hint(item.description || item.name)}>{label}</span>}
        {!item.missing && (
          <button type="button" className="icon-btn pp-item-run" disabled={!canInvoke} onClick={() => onInvoke(target)}
            title={t('Use {name} in the AI', { name: item.name })} aria-label={t('Use {name} in the AI', { name: item.name })}><IconPlay size={13} /></button>
        )}
      </li>
    );
  };

  return (
    <section className="pp-skills" aria-label={t('Skills and agents')}>
      <button type="button" className="pp-skills-head" onClick={() => setOpen(!expanded)} aria-expanded={expanded}>
        <span className={`pp-skills-chevron${expanded ? ' open' : ''}`} aria-hidden="true"><IconChevron size={14} /></span>
        {t('Skills and agents ({n})', { n: items.length })}
      </button>
      {expanded && (items.length ? (
        <div className="pp-skills-list">
          {(['skill', 'agent'] as const).map((kind) => {
            const group = items.filter((i) => i.kind === kind);
            const title = `${kind === 'skill' ? t('Skills') : t('Agents')} (${group.length})`;
            // A kind with nothing has no heading: the card's own empty state covers "nothing at all".
            return group.length > 0 && (
              <Fragment key={kind}>
                <p className="pp-group-head" aria-hidden="true">{title}</p>
                <ul className="pp-group" aria-label={title}>{group.map(row)}</ul>
              </Fragment>
            );
          })}
        </div>
      ) : (
        <p className="pp-hint">{t('No skill or agent linked.')} <button type="button" className="link" onClick={onSetup}>{t('Link in Project settings')}</button></p>
      ))}
      {error && <p className="pp-msg" role="alert">{error}</p>}
    </section>
  );
}
