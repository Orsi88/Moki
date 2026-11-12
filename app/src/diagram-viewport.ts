// Diagram coordinates stay independent of zoom, scroll and the size of the document pane.
export interface DiagramSize { width: number; height: number }
export interface DiagramScroll { scrollLeft: number; scrollTop: number }
export interface DiagramPoint { x: number; y: number }
export interface DiagramLayout extends DiagramSize { left: number; top: number }

export const MIN_DIAGRAM_ZOOM = 0.25;
export const MAX_DIAGRAM_ZOOM = 5;
const PADDING = 24;
export const clampDiagramZoom = (zoom: number): number => Math.min(MAX_DIAGRAM_ZOOM, Math.max(MIN_DIAGRAM_ZOOM, Number.isFinite(zoom) ? zoom : 1));

export function diagramLayout(size: DiagramSize, viewport: DiagramSize, zoom: number): DiagramLayout {
  const width = Math.max(1, size.width) * clampDiagramZoom(zoom), height = Math.max(1, size.height) * clampDiagramZoom(zoom);
  return { left: Math.max(PADDING, (viewport.width - width) / 2), top: Math.max(PADDING, (viewport.height - height) / 2),
    width: Math.max(viewport.width, width + PADDING * 2), height: Math.max(viewport.height, height + PADDING * 2) };
}

export function fitDiagram(size: DiagramSize, viewport: DiagramSize, mode: 'screen' | 'width'): number {
  const width = Math.max(1, viewport.width - PADDING * 2) / Math.max(1, size.width);
  return clampDiagramZoom(mode === 'width' ? width : Math.min(width, Math.max(1, viewport.height - PADDING * 2) / Math.max(1, size.height)));
}

// Keep the same diagram point under the mouse while changing magnification.
export function zoomDiagramAt(size: DiagramSize, viewport: DiagramSize, current: DiagramScroll & { zoom: number }, zoom: number, point: DiagramPoint): DiagramScroll {
  const before = diagramLayout(size, viewport, current.zoom), after = diagramLayout(size, viewport, zoom);
  const x = (point.x + current.scrollLeft - before.left) / current.zoom;
  const y = (point.y + current.scrollTop - before.top) / current.zoom;
  return {
    scrollLeft: Math.max(0, Math.min(after.width - viewport.width, x * clampDiagramZoom(zoom) + after.left - point.x)),
    scrollTop: Math.max(0, Math.min(after.height - viewport.height, y * clampDiagramZoom(zoom) + after.top - point.y)),
  };
}

export function diagramPoint(size: DiagramSize, viewport: DiagramSize, current: DiagramScroll & { zoom: number }, point: DiagramPoint): DiagramPoint | null {
  const layout = diagramLayout(size, viewport, current.zoom);
  const x = (point.x + current.scrollLeft - layout.left) / (size.width * current.zoom);
  const y = (point.y + current.scrollTop - layout.top) / (size.height * current.zoom);
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null;
}

export function diagramRegion(start: DiagramPoint, end: DiagramPoint): DiagramPoint & DiagramSize {
  const x = Math.max(0, Math.min(1, Math.min(start.x, end.x))), y = Math.max(0, Math.min(1, Math.min(start.y, end.y)));
  return { x, y, width: Math.min(1 - x, Math.abs(start.x - end.x)), height: Math.min(1 - y, Math.abs(start.y - end.y)) };
}
