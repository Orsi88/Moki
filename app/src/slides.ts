// What a presentation looks like, from the JSON pptxtojson reads out of a .pptx (lengths in points). Pure helpers, kept
// apart from SlidesView so node --test can check them (the HTML cleaning, which needs the DOM, is in slide-html.ts).
//
// The text of a slide arrives as HTML built by the parser from the file. A .pptx is untrusted input, so that HTML is
// rebuilt from an allow list (a few text tags, the style attribute without url()/expressions, links kept as data only)
// before it reaches the page; nothing of the file runs.

export interface SlideFill { type: 'color' | 'image' | 'gradient' | 'pattern'; value: unknown }
export interface SlideShadow { h: number; v: number; blur: number; color: string }

const SAFE_IMAGE = /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml|x-emf|x-wmf|tiff);base64,[a-z0-9+/=\s]+$/i;
const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]+)$/i;

// A data: URL of an image, or '' (never a remote or script URL).
export const safeImage = (value: unknown): string => (typeof value === 'string' && SAFE_IMAGE.test(value) ? value : '');
export const safeColor = (value: unknown): string => (typeof value === 'string' && SAFE_COLOR.test(value.trim()) ? value.trim() : '');

// The CSS background of a fill ('' = transparent).
export function fillCss(fill: SlideFill | null | undefined): string {
  if (!fill) return '';
  if (fill.type === 'color') return safeColor(fill.value);
  if (fill.type === 'pattern') return safeColor((fill.value as { foregroundColor?: string })?.foregroundColor);
  if (fill.type === 'image') {
    const src = safeImage((fill.value as { base64?: string })?.base64);
    return src ? `center / cover no-repeat url("${src}")` : '';
  }
  if (fill.type === 'gradient') {
    const g = fill.value as { path?: string; rot?: number; colors?: { pos: string | number; color: string }[] };
    const stops = (g?.colors ?? []).map((c) => {
      const color = safeColor(c.color);
      const pos = typeof c.pos === 'number' ? `${c.pos}%` : /^\d+(\.\d+)?%$/.test(String(c.pos)) ? String(c.pos) : '';
      return color ? `${color}${pos ? ` ${pos}` : ''}` : '';
    }).filter(Boolean);
    if (stops.length === 0) return '';
    if (stops.length === 1) return stops[0].split(' ')[0];
    if (g.path === 'circle' || g.path === 'rect' || g.path === 'shape') return `radial-gradient(${stops.join(', ')})`;
    return `linear-gradient(${(Number(g.rot) || 0) + 90}deg, ${stops.join(', ')})`;
  }
  return '';
}

// border shorthand ('' when there is none).
export function borderCss(width: number | undefined, type: string | undefined, color: string | undefined): string {
  const c = safeColor(color);
  if (!width || width <= 0 || !c) return '';
  return `${width}pt ${type === 'dashed' || type === 'dotted' ? type : 'solid'} ${c}`;
}

export const shadowCss = (s: SlideShadow | undefined): string => {
  const c = safeColor(s?.color);
  return s && c ? `drop-shadow(${s.h}pt ${s.v}pt ${s.blur}pt ${c})` : '';
};

// rotate + mirror of an element.
export function transformCss(rotate?: number, flipH?: boolean, flipV?: boolean): string {
  const parts: string[] = [];
  if (rotate) parts.push(`rotate(${rotate}deg)`);
  if (flipH) parts.push('scaleX(-1)');
  if (flipV) parts.push('scaleY(-1)');
  return parts.join(' ');
}

export const vAlignCss = (v: string | undefined): 'flex-start' | 'center' | 'flex-end' => (v === 'mid' ? 'center' : v === 'down' ? 'flex-end' : 'flex-start');

// Where the visible part of a cropped picture sits: the image is drawn larger and shifted (rect in % of the image).
export function cropBox(rect: { t?: number; b?: number; l?: number; r?: number } | undefined): { left: string; top: string; width: string; height: string } {
  const l = rect?.l ?? 0, r = rect?.r ?? 0, t = rect?.t ?? 0, b = rect?.b ?? 0;
  const w = Math.max(1, 100 - l - r), h = Math.max(1, 100 - t - b);
  return { left: `${(-l / w) * 100}%`, top: `${(-t / h) * 100}%`, width: `${(100 / w) * 100}%`, height: `${(100 / h) * 100}%` };
}

// Elements in the order PowerPoint stacks them.
export const byOrder = <T extends { order?: number }>(elements: readonly T[]): T[] => [...elements].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

// The speaker notes as plain lines (they come as HTML paragraphs).
export function notesText(html: string): string {
  return html.replace(/<\/(p|li|div)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .split('\n').map((line) => line.trimEnd()).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// A style attribute kept property by property: no url(), expression(), behaviors or positioning that leaves the box.
const STYLE_PROPS = new Set(['color', 'background-color', 'font-size', 'font-family', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line',
  'text-align', 'line-height', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'text-indent', 'letter-spacing', 'vertical-align', 'text-shadow',
  'white-space', 'word-break', 'padding-left']);
// The file's font first, then the closest ones a computer usually has (a missing Aptos/Calibri must not fall back to serif).
const FALLBACK_FONTS = ['Aptos', 'Calibri', 'Segoe UI', 'Arial', 'sans-serif'];
export function fontStack(value: string): string {
  const named = value.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '')).filter((f) => /^[\p{L}\p{N} ._-]+$/u.test(f));
  const all = [...named, ...FALLBACK_FONTS.filter((f) => !named.some((n) => n.toLowerCase() === f.toLowerCase()))];
  return all.map((f) => (f === 'sans-serif' ? f : `"${f}"`)).join(', ');
}
export function cleanStyle(style: string): string {
  return style.split(';').map((decl) => {
    const i = decl.indexOf(':');
    if (i < 0) return '';
    const prop = decl.slice(0, i).trim().toLowerCase(), value = decl.slice(i + 1).trim();
    if (!STYLE_PROPS.has(prop) || !value || /url\s*\(|expression|javascript:|[<>\\]|@import/i.test(value)) return '';
    return `${prop}: ${prop === 'font-family' ? fontStack(value) : value}`;
  }).filter(Boolean).join('; ');
}

// A hanging indent with no bullet of its own: the parser drops bullets the slide master gives; PowerPoint draws one there.
// Returns the width of the bullet (the hanging part, in points), 0 when the paragraph has none.
export function inheritedBullet(style: string): number {
  const indent = /text-indent:\s*(-[\d.]+)pt/i.exec(style), margin = /margin-left:\s*([\d.]+)pt/i.exec(style);
  const hang = indent ? Math.abs(Number(indent[1])) : 0;
  return margin && Number(margin[1]) > 0 && hang >= 6 && hang <= Number(margin[1]) + 0.5 ? hang : 0;
}
