// A selected passage and its neighbours let comments follow a local HTML page without changing its code.
export interface HtmlAnchor { quote: string; prefix: string; suffix: string }
export interface HtmlComment { id: string; author: string; date: string; text: string; anchor: HtmlAnchor }
export function isHtmlAnchor(value: unknown): value is HtmlAnchor {
  const anchor = value as HtmlAnchor | null;
  return Boolean(anchor && typeof anchor === 'object' && typeof anchor.quote === 'string' && anchor.quote.trim() && anchor.quote.length <= 4000
    && typeof anchor.prefix === 'string' && anchor.prefix.length <= 96 && typeof anchor.suffix === 'string' && anchor.suffix.length <= 96);
}
