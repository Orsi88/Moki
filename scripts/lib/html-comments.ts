// A selected passage and its neighbours let comments follow a local HTML page without changing its code.
export interface HtmlAnchor { quote: string; prefix: string; suffix: string }
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
export function isHtmlAnchor(value: unknown): value is HtmlAnchor {
  const anchor = value as HtmlAnchor | null;
  return Boolean(anchor && typeof anchor === 'object' && !Array.isArray(anchor) && !('kind' in anchor) && typeof anchor.quote === 'string' && anchor.quote.trim() && anchor.quote.length <= 4000
    && typeof anchor.prefix === 'string' && anchor.prefix.length <= 96 && typeof anchor.suffix === 'string' && anchor.suffix.length <= 96);
}
