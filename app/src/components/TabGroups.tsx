// The pieces of the tab groups and split views (state in tab-groups.ts). Each view has one row, like a browser
// window: a colored chip per group and, after the chip of the group it shows, that group's tabs (dragged between
// views); a click on another chip shows that group there. The layout button and New sit at the end of the top-right
// view's row. Menus: a group's (name, color, close its files) and a tab's (move it to another group).

import { useEffect, useState, type CSSProperties, type DragEvent, type MouseEvent, type ReactNode } from 'react';
import { t } from '../i18n';
import { ARRANGEMENTS, GENERAL, GROUP_COLORS, type Arrangement, type Group, type GroupColor, type TabKey } from '../tab-groups';
import { IconX } from './Icons';

export const TAB_DRAG = 'application/x-moki-tab';
export const groupLabel = (g: Group): string => (g.id === GENERAL ? t('General') : g.name || t('Group'));
export const colorStyle = (c: GroupColor): CSSProperties => ({ '--group': `var(--group-${c})`, '--group-soft': `var(--group-${c}-soft)`, '--group-ink': `var(--group-${c}-ink)` } as CSSProperties);
export const groupStyle = (g: Group | undefined): CSSProperties | undefined => (g && g.id !== GENERAL ? colorStyle(g.color) : undefined);
const COLOR_NAMES: Record<GroupColor, string> = { blue: 'Blue', red: 'Red', yellow: 'Yellow', green: 'Green', pink: 'Pink', purple: 'Purple', cyan: 'Cyan', orange: 'Orange', grey: 'Grey' };

// The layout picker's icons: the views as boxes.
function LayoutIcon({ arrangement }: { arrangement: Arrangement }) {
  const box = (x: number, y: number, w: number, h: number) => <rect key={`${x}${y}${w}${h}`} x={x} y={y} width={w} height={h} rx="1" />;
  const shapes: Record<Arrangement, ReactNode[]> = {
    1: [box(3, 4, 18, 16)],
    2: [box(3, 4, 8.5, 16), box(12.5, 4, 8.5, 16)],
    '2r': [box(3, 4, 18, 7.5), box(3, 12.5, 18, 7.5)],
    3: [box(3, 4, 8.5, 16), box(12.5, 4, 8.5, 7.5), box(12.5, 12.5, 8.5, 7.5)],
    4: [box(3, 4, 8.5, 7.5), box(12.5, 4, 8.5, 7.5), box(3, 12.5, 8.5, 7.5), box(12.5, 12.5, 8.5, 7.5)],
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{shapes[arrangement]}</svg>;
}
const LAYOUT_NAMES: Record<Arrangement, string> = { 1: 'One view', 2: 'Two side by side', '2r': 'Two stacked', 3: 'Three', 4: 'Four' };

// Splits the screen: 1, 2 side by side, 2 stacked, 3 or 4 views.
export function LayoutButton({ arrangement, onArrange }: { arrangement: Arrangement; onArrange: (a: Arrangement) => void }) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  return (<>
    <button type="button" className="icon-btn" aria-haspopup="menu" title={t('Split the screen')} aria-label={t('Split the screen')}
      onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setAt({ left: Math.min(r.left, window.innerWidth - 200), top: r.bottom + 4 }); }}>
      <LayoutIcon arrangement={arrangement} />
    </button>
    {at && (
      <div className="menu-backdrop" onMouseDown={() => setAt(null)}>
        <ul className="term-menu layout-menu" role="menu" aria-label={t('Split the screen')} style={at} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setAt(null); }}>
          {ARRANGEMENTS.map((a, i) => (
            <li key={a}><button type="button" role="menuitemradio" aria-checked={a === arrangement} autoFocus={i === 0} onClick={() => { setAt(null); onArrange(a); }}>
              <LayoutIcon arrangement={a} /> {t(LAYOUT_NAMES[a])}
            </button></li>
          ))}
        </ul>
      </div>
    )}
  </>);
}

export interface PaneTab { key: TabKey; label: string; title: string; icon: ReactNode; dirty?: boolean; fresh?: boolean; exited?: boolean; term?: boolean }

// The row of one view: the groups' chips, the shown group's tabs right after its chip, and (top-right view) actions.
// Groups only show when there is more than General; General shows then too, when it has tabs.
export function PaneHead({ groups, shown, counts, fresh, tabs, active, onShowGroup, onGroupMenu, onSelect, onClose, onTabMenu, onDropTab, actions }: {
  groups: Group[]; shown: string; counts: (id: string) => number; fresh: (id: string) => number; tabs: PaneTab[]; active: TabKey | null;
  onShowGroup: (id: string) => void; onGroupMenu: (id: string, at: { left: number; top: number }) => void;
  onSelect: (key: TabKey) => void; onClose: (key: TabKey) => void; onTabMenu: (key: TabKey, at: { left: number; top: number }) => void;
  onDropTab: (key: TabKey) => void; actions?: ReactNode;
}) {
  const [over, setOver] = useState(false);
  const accepts = (e: DragEvent) => Array.from(e.dataTransfer.types).includes(TAB_DRAG);
  const grouped = groups.some((g) => g.id !== GENERAL && counts(g.id) > 0);
  const chips = grouped ? groups.filter((g) => counts(g.id) > 0 || g.id === shown) : [];
  const tabRow = tabs.map((tab) => (
    <div key={tab.key} role="tab" aria-selected={tab.key === active} draggable
      className={`tab${tab.term ? ' tab-term' : ''}${tab.key === active ? ' active' : ''}${tab.exited ? ' exited' : ''}`}
      onClick={() => onSelect(tab.key)} title={tab.title} onAuxClick={(e) => { if (e.button === 1) onClose(tab.key); }}
      onContextMenu={(e) => { e.preventDefault(); onTabMenu(tab.key, { left: e.clientX, top: e.clientY }); }}
      onDragStart={(e) => { e.dataTransfer.setData(TAB_DRAG, tab.key); e.dataTransfer.effectAllowed = 'move'; }}>
      {tab.icon}
      <span className="tab-name">{tab.label}</span>
      {tab.fresh && <span className="tab-new" title={t('New: written by the AI')} aria-label={t('New')} />}
      {tab.dirty && <span className="tab-dirty" title={t('Unsaved changes')}>●</span>}
      <button type="button" className="tab-close" onClick={(e) => { e.stopPropagation(); onClose(tab.key); }} title={tab.term ? t('Close the terminal') : t('Close (Ctrl+W)')} aria-label={`${t('Close')} ${tab.label}`}><IconX size={13} /></button>
    </div>
  ));
  const chip = (g: Group) => {
    const n = g.id === shown ? 0 : fresh(g.id);
    const openMenu = (e: MouseEvent<HTMLElement>) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); onGroupMenu(g.id, { left: r.left, top: r.bottom + 4 }); };
    return (
      <button key={`chip-${g.id}`} type="button" className={`group-chip${g.id === GENERAL ? ' general' : ''}${g.id === shown ? ' on' : ''}`} style={groupStyle(g)}
        aria-pressed={g.id === shown} aria-label={groupLabel(g)} onClick={() => onShowGroup(g.id)} onContextMenu={openMenu}
        title={n ? t('{name}: {n} new', { name: groupLabel(g), n }) : t('{name} (right click: name and color)', { name: groupLabel(g) })}>
        <span className="group-chip-name">{groupLabel(g)}</span>
        {n > 0 && <span className="group-chip-new" aria-label={t('{n} new', { n })}>{n}</span>}
      </button>
    );
  };
  return (
    <div className={`tabs pane-tabs${over ? ' drop-over' : ''}`} role="tablist"
      onDragOver={(e) => { if (accepts(e)) { e.preventDefault(); setOver(true); } }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { if (!accepts(e)) return; e.preventDefault(); setOver(false); onDropTab(e.dataTransfer.getData(TAB_DRAG)); }}>
      {chips.length ? chips.map((g) => (g.id === shown
        ? <span key={`seg-${g.id}`} className={`tab-group${g.id === GENERAL ? ' general' : ''}`} style={groupStyle(g)}>{chip(g)}{tabRow}</span>
        : chip(g))) : tabRow}
      {actions && <span className="pane-actions">{actions}</span>}
    </div>
  );
}

// A group's menu: its name, its color, close its files. General has no name or color to change.
export function GroupMenu({ group, at, onRename, onColor, onCloseFiles, onClose }: {
  group: Group; at: { left: number; top: number }; onRename: (name: string) => void; onColor: (c: GroupColor) => void; onCloseFiles: () => void; onClose: () => void;
}) {
  const [name, setName] = useState(group.name);
  useEffect(() => setName(group.name), [group.name]);
  const done = () => { if (name.trim() && name !== group.name) onRename(name); onClose(); };
  const style = { left: Math.min(at.left, window.innerWidth - 250), top: Math.min(at.top, window.innerHeight - 220) };
  return (
    <div className="menu-backdrop" onMouseDown={done}>
      <div className="term-menu group-menu" role="dialog" aria-label={t('Group {name}', { name: groupLabel(group) })} style={style} onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
        {group.id !== GENERAL && <>
          <input className="group-name" value={name} maxLength={40} autoFocus aria-label={t('Group name')} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') done(); }} />
          <div className="group-colors" role="radiogroup" aria-label={t('Group color')}>
            {GROUP_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={group.color === c} className={`group-swatch${group.color === c ? ' on' : ''}`}
                style={colorStyle(c)} title={t(COLOR_NAMES[c])} aria-label={t(COLOR_NAMES[c])} onClick={() => onColor(c)} />
            ))}
          </div>
          <div className="ws-menu-sep" />
        </>}
        <button type="button" role="menuitem" className="group-menu-item" onClick={() => { onClose(); onCloseFiles(); }}>{t('Close the files of this group')}</button>
      </div>
    </div>
  );
}

// A tab's menu: move it to another group, or to a new one.
export function TabMenu({ at, groups, current, onMove, onNewGroup, onClose }: {
  at: { left: number; top: number }; groups: Group[]; current: string; onMove: (group: string) => void; onNewGroup: () => void; onClose: () => void;
}) {
  const style = { left: Math.min(at.left, window.innerWidth - 240), top: Math.min(at.top, window.innerHeight - 60 - groups.length * 34) };
  return (
    <div className="menu-backdrop" onMouseDown={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <ul className="term-menu" role="menu" aria-label={t('Move to group')} style={style} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
        <li className="menu-head" role="presentation">{t('Move to group')}</li>
        {groups.filter((g) => g.id !== current).map((g, i) => (
          <li key={g.id}><button type="button" role="menuitem" autoFocus={i === 0} onClick={() => { onClose(); onMove(g.id); }}>
            <span className="group-dot" style={groupStyle(g)} /> {groupLabel(g)}
          </button></li>
        ))}
        <li><button type="button" role="menuitem" onClick={() => { onClose(); onNewGroup(); }}>{t('New group…')}</button></li>
      </ul>
    </div>
  );
}
