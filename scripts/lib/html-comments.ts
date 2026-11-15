// A selected passage and its neighbours let comments follow a local HTML page without changing its code.
// A passage (its text and the text around it), or an area of the page dragged as a rectangle (CSS pixels from the
// top-left of the document, scroll included).
export interface HtmlTextAnchor { quote: string; prefix: string; suffix: string }
// path/dx/dy: the element at the area's top-left (child indexes from <body>) and the area's offset from it, so the area
// follows the page's layout when the window is resized; x/y stay as the fallback.
export interface HtmlAreaAnchor { kind: 'area'; x: number; y: number; width: number; height: number; path?: number[]; dx?: number; dy?: number }
export type HtmlAnchor = HtmlTextAnchor | HtmlAreaAnchor;
export interface HtmlReply { author: string; at: string; text: string }
export interface HtmlComment { id: string; author: string; date: string; text: string; anchor: HtmlAnchor; color?: string; replies?: HtmlReply[] }
export type HtmlCommentChange = { op: 'edit' | 'reply'; id: string; text: string } | { op: 'color'; id: string; color: string };
export const isHtmlColor = (value: unknown): value is string => typeof value === 'string' && ['yellow', 'green', 'blue', 'pink', 'orange', 'red', 'purple'].includes(value);
export function isHtmlCommentChange(value: unknown): value is HtmlCommentChange {
  if (!value || typeof value !== 'object') return false;
  const change = value as Record<string, unknown>;
  return typeof change.id === 'string' && change.id.length > 0 && change.id.length <= 100
    && (change.op === 'color' ? isHtmlColor(change.color) : (change.op === 'edit' || change.op === 'reply') && typeof change.text === 'string' && Boolean(change.text.trim()) && change.text.length <= 10000);
}
export function isHtmlAreaAnchor(value: unknown): value is HtmlAreaAnchor {
  const a = value as HtmlAreaAnchor | null;
  const n = (v: unknown, min: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= 1_000_000;
  const offset = (v: unknown) => v === undefined || typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1_000_000;
  const path = a?.path === undefined || Array.isArray(a.path) && a.path.length <= 60 && a.path.every((i) => Number.isSafeInteger(i) && i >= 0 && i < 100000);
  return Boolean(a && typeof a === 'object' && a.kind === 'area' && n(a.x, 0) && n(a.y, 0) && n(a.width, 4) && n(a.height, 4) && path && offset(a.dx) && offset(a.dy));
}
export function isHtmlAnchor(value: unknown): value is HtmlAnchor {
  if (isHtmlAreaAnchor(value)) return true;
  const anchor = value as HtmlTextAnchor | null;
  return Boolean(anchor && typeof anchor === 'object' && !Array.isArray(anchor) && !('kind' in anchor) && typeof anchor.quote === 'string' && anchor.quote.trim() && anchor.quote.length <= 4000
    && typeof anchor.prefix === 'string' && anchor.prefix.length <= 96 && typeof anchor.suffix === 'string' && anchor.suffix.length <= 96);
}
