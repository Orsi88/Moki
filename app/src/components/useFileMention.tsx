// "@" in a text box: typing @ lists the project's files (the linked folder's "@folder/…" ones included), filtered
// by what follows it; arrows, Enter or Tab pick one, Escape closes. The caller decides what a pick writes
// (a note writes a Markdown link, an activity's notes the @path) through `onPick`.

import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { t } from '../i18n';
import { FileIcon } from '../icons';
import type { TreeNode } from '../api';

// Every file of a project tree.
export const flattenTree = (nodes: TreeNode[]): string[] => nodes.flatMap((n) => (n.type === 'dir' ? flattenTree(n.children ?? []) : [n.path]));

export function useFileMention(files: string[], onPick: (file: string, start: number) => void) {
  const [mention, setMention] = useState<{ start: number; query: string; index: number } | null>(null);
  const matches = useMemo(() => {
    if (!mention) return [];
    const q = mention.query.toLowerCase();
    return files.filter((f) => f.toLowerCase().includes(q)).slice(0, 8);
  }, [mention, files]);
  // Opens (or closes) the list from the text before the caret.
  const find = (value: string, caret: number) => {
    const m = value.slice(0, caret).match(/(^|[\s(])@([^\s@()[\]]*)$/);
    setMention(m ? { start: caret - m[2].length - 1, query: m[2], index: 0 } : null);
  };
  const pick = (file: string) => {
    if (!mention) return;
    onPick(file, mention.start);
    setMention(null);
  };
  // True when the key drove the list (the caller then does nothing else with it).
  const key = (e: ReactKeyboardEvent): boolean => {
    if (!mention || !matches.length) return false;
    if (e.key === 'ArrowDown') { e.preventDefault(); setMention({ ...mention, index: (mention.index + 1) % matches.length }); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setMention({ ...mention, index: (mention.index - 1 + matches.length) % matches.length }); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(matches[mention.index]); return true; }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMention(null); return true; }
    return false;
  };
  // `empty`: what the list says instead of files (e.g. no project yet).
  const list = (empty?: ReactNode): ReactNode => mention && (
    <div className="note-mention" role="listbox" aria-label={t('Project files')}>
      {empty ? <p className="muted small">{empty}</p>
        : !matches.length ? <p className="muted small">{t('No file matches "{q}".', { q: mention.query })}</p>
          : matches.map((f, i) => (
            <button key={f} type="button" role="option" aria-selected={i === mention.index} className={i === mention.index ? 'on' : ''}
              onMouseDown={(e) => { e.preventDefault(); pick(f); }}>
              <FileIcon name={f} size={16} /><span className="note-mention-name">{f.split('/').pop()}</span><span className="note-mention-path">{f}</span>
            </button>
          ))}
    </div>
  );
  return { find, key, list, close: () => setMention(null) };
}
