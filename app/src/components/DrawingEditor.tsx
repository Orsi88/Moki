// Excalidraw side of the diagrams: drawing a scene to SVG and the editor dialog.
// Loaded on demand by Diagrams.tsx, so the library stays out of the app's first chunk.
import { useEffect, useRef, useState } from 'react';
import { Excalidraw, exportToSvg, restore, serializeAsJSON } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import '@excalidraw/excalidraw/index.css';
import { t } from '../i18n';
import { IconCheck } from './Icons';
import { useModalLayer } from '../modal-layer';
import { useThemeSettings } from '../theme';

function sceneOf(source: string) {
  const parsed = JSON.parse(source) as { type?: string; elements?: unknown[]; appState?: object; files?: never };
  if (!parsed || parsed.type !== 'excalidraw' || !Array.isArray(parsed.elements)) throw new Error('invalid');
  return restore({ elements: parsed.elements as never, appState: parsed.appState ?? {}, files: parsed.files ?? ({} as never) }, null, null);
}

export async function exportDrawing(host: HTMLElement, source: string) {
  const restored = sceneOf(source);
  const paper = String(restored.appState.viewBackgroundColor || '');
  const plain = !paper || paper.toLowerCase() === '#ffffff' || paper.toLowerCase() === '#fff';
  const svg = await exportToSvg({
    elements: restored.elements,
    appState: { ...restored.appState, exportBackground: !plain, viewBackgroundColor: plain ? 'transparent' : paper },
    files: restored.files,
    exportPadding: 16,
  });
  host.replaceChildren(svg);
}

function savedScene(json: string) {
  return json.replace(/,?"viewModeEnabled":(?:true|false)/, '');
}

// A .excalidraw file fills the document pane. It opens for viewing; the pencil in the
// document bar turns editing on and the tools appear. Edits go back to the file.
export function DrawingFile({ source, editing = false, onSave }: { source: string; editing?: boolean; onSave: (body: string) => Promise<void> | void }) {
  const theme = useThemeSettings().documents;
  const live = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined), last = useRef(source), board = useRef<ExcalidrawImperativeAPI | null>(null), canSave = useRef(editing);
  canSave.current = editing;
  const [error, setError] = useState('');
  const [initial] = useState(() => {
    try {
      const restored = sceneOf(source);
      return { elements: restored.elements, appState: { ...restored.appState, viewModeEnabled: true }, files: restored.files };
    } catch { return null; }
  });
  useEffect(() => {
    const arm = setTimeout(() => { live.current = true; }, 500);
    return () => { clearTimeout(arm); clearTimeout(timer.current); };
  }, []);
  if (!initial) return <p className="diagram-notice" role="alert">{t('This diagram could not be drawn.')}</p>;
  return (
    <div className={`drawing-file${editing ? ' is-editing' : ''}`}>
      {error && <p className="diagram-notice" role="alert">{error}</p>}
      <div className="drawing-file-canvas">
        <Excalidraw theme={theme} viewModeEnabled={!editing} initialData={initial} excalidrawAPI={(next) => { board.current = next; }} onChange={() => {
          if (!live.current || !board.current || !canSave.current) return;
          clearTimeout(timer.current);
          timer.current = setTimeout(() => {
            const ex = board.current;
            if (!ex) return;
            const next = savedScene(serializeAsJSON(ex.getSceneElements(), ex.getAppState(), ex.getFiles(), 'local'));
            if (next === last.current) return;
            last.current = next;
            Promise.resolve(onSave(next)).then(() => setError('')).catch((failure: Error) => setError(failure.message));
          }, 600);
        }} />
      </div>
    </div>
  );
}

export function DrawingEditor({ source, onSave, onClose }: { source: string; onSave: (body: string) => void; onClose: () => void }) {
  const theme = useThemeSettings().documents;
  const host = useRef<HTMLDivElement>(null);
  useModalLayer(host, onClose);
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const [initial] = useState(() => {
    try {
      const restored = sceneOf(source);
      return { elements: restored.elements, appState: restored.appState, files: restored.files };
    } catch {
      return { elements: [], appState: { viewBackgroundColor: '#ffffff' } };
    }
  });
  const save = () => {
    const ex = api.current;
    if (!ex) return;
    onSave(serializeAsJSON(ex.getSceneElements(), ex.getAppState(), ex.getFiles(), 'local'));
  };
  return (
    <div ref={host} className="drawing-editor" role="dialog" aria-modal="true" aria-label={t('Drawing')} tabIndex={-1}>
      <div className="drawing-editor-bar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t('Cancel')}</button>
        <button type="button" className="btn btn-icon" onClick={save} title={t('Save drawing')} aria-label={t('Save drawing')}><IconCheck size={16} /></button>
      </div>
      <div className="drawing-editor-canvas">
        <Excalidraw theme={theme} initialData={initial} excalidrawAPI={(next) => { api.current = next; }} />
      </div>
    </div>
  );
}
