// A terminal tab: xterm.js drawing a pseudo-terminal of the main process
// (desktop/terminals.ts). Hidden tabs stay mounted so their output is kept. The
// terminal outlives this view: unmounted (the project left), it keeps running in
// the main process; mounted again, it draws what it printed meanwhile and goes on.
// Closing its tab (Workspace) is what stops it. The xterm.js terminal (and its scrollback) is only
// created when the tab is first shown; until then the output is kept as plain text.

import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css'; // only the styles are static (a side-effect import needs no types); the code loads when a tab is first shown
import { api } from '../api';
import { t } from '../i18n';
import { acceptsItem, droppedItem, ITEM_DRAG } from '../item-drag';
import { terminalPaths } from '../terminal-links';
import { pastedImages, terminalInput } from '../terminal-drop';

interface Props { id: string; project: string; tool?: string; active: boolean; onExit: (code: number) => void; resolveLink?: (href: string) => boolean; onLink?: (href: string) => void; onDropItem?: (target: { kind: 'skill' | 'agent'; name: string }) => void }

const css = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const KEEP = 128 * 1024; // as much plain output as the main process keeps (desktop/terminals.ts), for a tab not shown yet

export function TerminalView({ id, project, tool, active, onExit, resolveLink, onLink, onDropItem }: Props) {
  const [over, setOver] = useState(false); // a skill or agent of the panel is above this terminal
  const links = useRef({ resolveLink, onLink });
  links.current = { resolveLink, onLink };
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<{ term: Terminal; fit: FitAddon } | null>(null);
  const build = useRef<(() => Promise<void>) | null>(null);
  const exitRef = useRef(onExit);
  exitRef.current = onExit;
  const activeRef = useRef(active);
  activeRef.current = active;
  const toolRef = useRef(tool);
  toolRef.current = tool;

  useEffect(() => {
    const bridge = api.term();
    if (!bridge || !box.current) return;
    const host = box.current;
    let term: Terminal | null = null;
    let pending = ''; // output that came before the xterm.js terminal exists
    let building: Promise<void> | null = null;
    // Until we know whether it already runs, output is held: what it printed so far comes whole with attach.
    let held = true;
    let gone = false;
    // `confirm`: the output came from the process, so the main process learns it was drawn (or kept as text) and can keep the process running.
    const write = (text: string, confirm = false): void => {
      if (term) term.write(text, confirm ? () => bridge.ack?.(id, text.length) : undefined);
      else {
        pending = pending.length + text.length > KEEP ? (pending + text).slice(-KEEP) : pending + text;
        if (confirm) bridge.ack?.(id, text.length);
      }
    };

    const offData = bridge.on('data', (tid, data) => {
      if (tid !== id) return;
      const text = String(data);
      if (held) bridge.ack?.(id, text.length); // dropped: it is in what attach returns
      else write(text, true);
    });
    const offExit = bridge.on('exit', (tid, code) => {
      if (tid !== id) return;
      write(`\r\n\x1b[2m[${t('process exited with code {code}', { code: String(code) })}]\x1b[0m\r\n`);
      exitRef.current(Number(code));
    });
    const listeners: { dispose(): void }[] = [];

    // Creates the xterm.js terminal the first time the tab is shown (its scrollback is the memory cost of a terminal).
    const create = (): Promise<void> => building ??= (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')]);
      if (gone) return;
      const made = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"Cascadia Code", "JetBrains Mono", ui-monospace, Consolas, monospace',
        scrollback: 3000,
        theme: {
          background: css('--cli-bg'),
          foreground: css('--cli-text'),
          cursor: css('--cli-accent'),
          selectionBackground: css('--cli-selection'),
        },
      });
      const fit = new FitAddon();
      made.loadAddon(fit);
      made.open(host);
      listeners.push(made.registerLinkProvider({
        provideLinks(y, callback) {
          callback(terminalPaths(made.buffer.active, made.cols, y, (href) => links.current.resolveLink?.(href) ?? false).map((link) => ({
            ...link,
            activate(event, href) { if (event.ctrlKey || event.metaKey) { event.preventDefault(); links.current.onLink?.(href); } },
          })));
        },
      }));
      fit.fit();
      listeners.push(made.onData((data) => bridge.input(id, data)), made.onResize(({ cols, rows }) => bridge.resize(id, cols, rows)));
      // Images and files for the AI: a pasted screenshot is saved in the project's temporary/pasted/, and dropped
      // files (from the computer or the project tree) are given by their path, typed into the prompt (terminal-drop.ts).
      const give = (paths: string[]) => { if (paths.length) bridge.input(id, terminalInput(paths, toolRef.current)); made.focus(); };
      const fail = (e: Error) => write(`\r\n\x1b[31m${e.message}\x1b[0m\r\n`);
      const onPaste = (e: ClipboardEvent) => {
        const files = e.clipboardData?.files;
        const images = pastedImages(files, e.clipboardData?.getData('text/plain') ?? '');
        if (!files || !images.length) return; // text: xterm pastes it as usual
        e.preventDefault(); e.stopImmediatePropagation();
        void Promise.all(images.map(async (i) => api.savePastedImage(project, new Uint8Array(await files[i].arrayBuffer()), files[i].type))).then(give).catch(fail);
      };
      const fromTree = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes('application/x-moki-move'));
      const onDragOver = (e: DragEvent) => {
        if (!e.dataTransfer || !(e.dataTransfer.types.includes('Files') || fromTree(e))) return;
        e.preventDefault(); e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
        host.classList.add('term-drop');
      };
      const onDragLeave = (e: DragEvent) => { if (!host.contains(e.relatedTarget as Node | null)) host.classList.remove('term-drop'); };
      const onDrop = (e: DragEvent) => {
        host.classList.remove('term-drop');
        if (!e.dataTransfer) return;
        const rel = e.dataTransfer.getData('application/x-moki-move');
        const files = [...e.dataTransfer.files];
        if (!rel && !files.length) return;
        e.preventDefault(); e.stopPropagation(); // not the project's own drop (copying into the inbox)
        if (rel) { void api.fullPath(project, rel).then((p) => give([p])).catch(fail); return; }
        const paths = files.map((f) => window.qa?.filePath(f) ?? '').filter(Boolean);
        const loose = files.filter((f, i) => !paths[i] && /^image\//.test(f.type)); // an image dragged from a browser has no file
        void Promise.all(loose.map(async (f) => api.savePastedImage(project, new Uint8Array(await f.arrayBuffer()), f.type))).then((saved) => give([...paths, ...saved])).catch(fail);
      };
      host.addEventListener('paste', onPaste, true);
      host.addEventListener('dragover', onDragOver);
      host.addEventListener('dragleave', onDragLeave);
      host.addEventListener('drop', onDrop);
      listeners.push({ dispose: () => { host.removeEventListener('paste', onPaste, true); host.removeEventListener('dragover', onDragOver); host.removeEventListener('dragleave', onDragLeave); host.removeEventListener('drop', onDrop); } });
      view.current = { term: made, fit };
      term = made;
      made.write(pending);
      pending = '';
      if (activeRef.current) { fit.fit(); made.focus(); }
    })();
    build.current = create;

    const begin = () => bridge.start(id, term?.cols ?? 80, term?.rows ?? 24, project).then((error) => { if (error && !gone) { write(`\x1b[31m${error}\x1b[0m\r\n`); exitRef.current(-1); } });
    // A tab opened to be seen gets its size before the process starts; a hidden one starts at the default size and is resized when first shown.
    void Promise.all([bridge.attach ? bridge.attach(id) : Promise.resolve(null), activeRef.current ? create() : undefined]).then(([printed]) => {
      if (gone) return undefined;
      held = false; // what came while waiting was printed before attach answered: it is in `printed`
      if (printed === null) return begin();
      write(printed);
      if (term) bridge.resize(id, term.cols, term.rows);
      return undefined;
    });

    // Follow the size of the tab; a hidden tab has no size, so it is skipped.
    const observer = new ResizeObserver(() => { if (host.offsetParent) view.current?.fit.fit(); });
    observer.observe(host);

    return () => {
      gone = true;
      build.current = null;
      observer.disconnect(); listeners.forEach((l) => l.dispose()); offData(); offExit();
      bridge.detach?.(id);
      term?.dispose(); // the terminal itself keeps running: its tab may come back
      view.current = null;
    };
  }, [id]);

  useEffect(() => {
    if (!active) return;
    if (!view.current) { void build.current?.(); return; }
    view.current.fit.fit();
    view.current.term.focus();
  }, [active]);

  // A skill or an agent dragged from the project panel (item-drag.ts). On this container, not on xterm: the events of its
  // canvas bubble up to here. Files and anything else are not ours: left alone, so the workspace's own drop still works.
  const mine = (e: ReactDragEvent) => acceptsItem(Array.from(e.dataTransfer.types), project);
  const drop = (e: ReactDragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes(ITEM_DRAG)) return;
    e.preventDefault();
    setOver(false);
    const target = droppedItem(e.dataTransfer.getData(ITEM_DRAG), project);
    if (!target) return;
    box.current?.querySelector('textarea')?.focus();
    onDropItem?.(target);
  };
  return (
    <div ref={box} className={`term-pane${over ? ' item-over' : ''}`} data-term={id} hidden={!active}
      onDragEnter={(e) => { if (mine(e)) { e.preventDefault(); setOver(true); } }}
      onDragOver={(e) => { if (mine(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false); }}
      onDrop={drop} />
  );
}
