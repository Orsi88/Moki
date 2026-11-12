// Renderer responses are untrusted SVG. Only drawing primitives and local references reach the image.
import type { DiagramSize } from './diagram-viewport';

const ELEMENTS = new Set(['svg', 'g', 'a', 'path', 'text', 'tspan', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'marker', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'stop', 'pattern', 'title', 'desc', 'textpath', 'symbol', 'use', 'style']);
const ATTRIBUTES = new Set(['id', 'class', 'style', 'xmlns', 'viewbox', 'preserveaspectratio', 'width', 'height', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'dx', 'dy', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'alignment-baseline', 'text-decoration', 'letter-spacing', 'word-spacing', 'marker-start', 'marker-mid', 'marker-end', 'markerwidth', 'markerheight', 'markerunits', 'refx', 'refy', 'orient', 'clip-path', 'clippathunits', 'mask', 'maskunits', 'maskcontentunits', 'gradientunits', 'gradienttransform', 'offset', 'stop-color', 'stop-opacity', 'spreadmethod', 'patternunits', 'patterncontentunits', 'patterntransform', 'vector-effect', 'color', 'display', 'visibility', 'role', 'aria-label', 'aria-hidden', 'href', 'xlink:href']);
const localReference = /^#[a-zA-Z_][\w:.-]*$/;
const unsafeCss = (value: string) => /[\\@<>]|\/\*|url\s*\(|(?:expression|javascript|vbscript|behavior|-moz-binding)\s*[:(]/i.test(
  value.replace(/url\(\s*(['"]?)#[a-zA-Z_][\w:.-]*\1\s*\)/gi, ''));
const CSS_PROPERTIES = new Set(['fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'opacity', 'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant', 'font-kerning', 'text-anchor', 'text-decoration', 'text-transform', 'dominant-baseline', 'alignment-baseline', 'letter-spacing', 'word-spacing', 'white-space', 'line-height', 'paint-order', 'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'mask', 'color', 'background-color', 'display', 'visibility', 'vector-effect', 'transform', 'transform-origin']);

function diagramStyle(source: string): string {
  if (source.length > 1000000) return '';
  try {
    // Constructed sheets are never attached. CSSOM separates resource-loading at-rules from drawing rules.
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(source);
    if (sheet.cssRules.length > 10000) return '';
    const safe: string[] = [];
    let declarations = 0;
    for (const rule of sheet.cssRules) {
      if (!(rule instanceof CSSStyleRule) || rule.selectorText.length > 4000 || /[{};]/.test(rule.selectorText) || unsafeCss(rule.selectorText)) continue;
      const properties: string[] = [];
      for (const property of rule.style) {
        if (++declarations > 50000) return '';
        if (property.length > 80 || !CSS_PROPERTIES.has(property) && !/^--[\w-]+$/.test(property)) continue;
        const value = rule.style.getPropertyValue(property);
        if (value.length > 4096 || unsafeCss(value)) continue;
        properties.push(`${property}:${value}${rule.style.getPropertyPriority(property) === 'important' ? '!important' : ''}`);
      }
      if (properties.length) safe.push(`${rule.selectorText}{${properties.join(';')}}`);
    }
    return safe.join('\n');
  } catch { return ''; }
}

export function sanitizeDiagramSvg(source: string): { svg: string; size: DiagramSize } {
  if (source.length > 8_000_000 || /<!\s*ENTITY/i.test(source)) throw new Error('Invalid diagram image.');
  // Graphviz may emit an external SVG DTD. Remove the declaration before parsing; internal subsets are refused.
  const xml = source.replace(/<!DOCTYPE\s+svg(?:\s+[^<>\[\]]*)?>/gi, '');
  if (/<!\s*DOCTYPE/i.test(xml)) throw new Error('Invalid diagram image.');
  const parsed = new DOMParser().parseFromString(xml, 'image/svg+xml');
  const root = parsed.documentElement;
  if (root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg' || parsed.querySelector('parsererror')) throw new Error('Invalid diagram image.');
  const elements = [root, ...root.querySelectorAll('*')];
  if (elements.length > 50000) throw new Error('Invalid diagram image.');
  for (const element of elements) {
    let depth = 0;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) if (++depth > 256) throw new Error('Invalid diagram image.');
    if (element.namespaceURI !== 'http://www.w3.org/2000/svg' || !ELEMENTS.has(element.localName.toLowerCase())) { element.remove(); continue; }
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase(), value = attribute.value;
      if (!ATTRIBUTES.has(name) || name.startsWith('on') || ((name === 'href' || name === 'xlink:href') && !localReference.test(value)) || unsafeCss(value)) element.removeAttributeNode(attribute);
    }
    if (element.localName.toLowerCase() === 'style') {
      const css = diagramStyle(element.textContent ?? '');
      if (css) element.textContent = css; else element.remove();
    }
  }
  // The SVG is loaded as an image: its styling and ids never share the application document.
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const viewBox = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  const width = viewBox.length === 4 ? viewBox[2] : Number.parseFloat(root.getAttribute('width') ?? '');
  const height = viewBox.length === 4 ? viewBox[3] : Number.parseFloat(root.getAttribute('height') ?? '');
  const size = { width: Number.isFinite(width) && width > 0 ? Math.min(100000, width) : 800,
    height: Number.isFinite(height) && height > 0 ? Math.min(100000, height) : 600 };
  root.setAttribute('width', String(size.width));
  root.setAttribute('height', String(size.height));
  return { svg: new XMLSerializer().serializeToString(root), size };
}
