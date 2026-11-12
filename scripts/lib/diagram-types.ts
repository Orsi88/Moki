// Portable diagram review contracts; coordinates are fractions of the rendered canvas.
import { isHtmlCommentChange, type HtmlComment, type HtmlCommentChange } from './html-comments.ts';

export type DiagramKind = 'mermaid' | 'plantuml' | 'd2' | 'graphviz';
export interface DiagramSettings { provider: 'local' | 'kroki'; url: string; allowRemote: boolean }
export interface DiagramRenderResult { provider: 'local' | 'kroki'; sourceHash: string; source?: string; svg?: string; width?: number; height?: number }

export interface DiagramAnchor {
  kind: 'diagram';
  x: number;
  y: number;
  width: number;
  height: number;
  sourceHash: string;
  elementId?: string;
  elementLabel?: string;
}

export interface DiagramComment extends Omit<HtmlComment, 'anchor'> {
  anchor: DiagramAnchor;
  resolved?: boolean;
}

export type DiagramCommentChange = HtmlCommentChange | { op: 'resolve'; id: string; resolved: boolean };

export interface DiagramViewState {
  sourceHash: string;
  zoom: number;
  scrollLeft: number;
  scrollTop: number;
  mode: 'select' | 'hand' | 'comment';
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const fraction = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const optionalLabel = (value: unknown): boolean => value === undefined || typeof value === 'string' && value.length > 0 && value.length <= 300;

export function isDiagramAnchor(value: unknown): value is DiagramAnchor {
  if (!record(value) || value.kind !== 'diagram' || !hash(value.sourceHash)
    || !fraction(value.x) || !fraction(value.y) || !fraction(value.width) || !fraction(value.height)) return false;
  return value.x + value.width <= 1.000000001 && value.y + value.height <= 1.000000001
    && optionalLabel(value.elementId) && optionalLabel(value.elementLabel);
}

export function isDiagramCommentChange(value: unknown): value is DiagramCommentChange {
  return isHtmlCommentChange(value) || record(value) && value.op === 'resolve'
    && typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 100 && typeof value.resolved === 'boolean';
}

export function isDiagramViewState(value: unknown): value is DiagramViewState {
  return record(value) && hash(value.sourceHash) && typeof value.zoom === 'number' && Number.isFinite(value.zoom) && value.zoom >= 0.25 && value.zoom <= 5
    && typeof value.scrollLeft === 'number' && Number.isFinite(value.scrollLeft) && value.scrollLeft >= 0 && value.scrollLeft <= 10000000
    && typeof value.scrollTop === 'number' && Number.isFinite(value.scrollTop) && value.scrollTop >= 0 && value.scrollTop <= 10000000
    && (value.mode === 'select' || value.mode === 'hand' || value.mode === 'comment');
}
