// Word's native formatting and comments. Only edited text nodes and comment parts are changed in the package.
import { posix } from 'node:path';
import { unzip, zip } from './zip.mjs';
import { appendXmlChild, attribute as attr, child, descendants, localName, nodeText, parseXml, patchXml, setXmlAttribute, xmlEscape as esc, type XmlNode, type XmlPatch } from './office-xml.ts';

import type { OfficeComment, WordDocument, WordChange } from './office-types.ts';
export type { OfficeComment, WordDocument, WordChange } from './office-types.ts';
type Package = Map<string, Buffer>;
type Style = Record<string, string>;
const textNodes = (node: XmlNode): XmlNode[] => node.children.flatMap((n) => ['t', 'tab', 'br', 'cr'].includes(localName(n.name)) ? [n] : textNodes(n));
const textValue = (xml: string, node: XmlNode) => localName(node.name) === 't' ? nodeText(xml, node) : localName(node.name) === 'tab' ? '\t' : '\n';
const textOf = (xml: string, node: XmlNode) => textNodes(node).map((n) => textValue(xml, n)).join('');
const wordText = (text: string) => text.split(/(\n|\t)/).map((part) => part === '\n' ? '<w:br/>' : part === '\t' ? '<w:tab/>' : `<w:t xml:space="preserve">${esc(part)}</w:t>`).join('');
const val = (node: XmlNode | undefined, name: string) => attr(child(node, name), 'val');
const enabled = (node: XmlNode | undefined) => Boolean(node && !/^(0|false|off)$/i.test(attr(node, 'val')));
const css = (style: Style) => esc(Object.entries(style).map(([key, value]) => `${key}:${value}`).join(';'));
const hex = (value: string) => /^[\da-f]{6}$/i.test(value) ? `#${value}` : '';
const pt = (value: string, divisor = 1) => Number.isFinite(Number(value)) && value !== '' ? `${Math.max(0, Math.min(1000, Number(value) / divisor))}pt` : '';
const read = (files: Package, path: string) => files.get(path)?.toString('utf8') ?? '';
const ROOT = 'word/document.xml';
const REL = 'word/_rels/document.xml.rels';
const COMMENTS = 'word/comments.xml';
const NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const RELNS = 'http://schemas.openxmlformats.org/package/2006/relationships';

function runStyle(properties: XmlNode | undefined): Style {
  const style: Style = {};
  for (const [tag, key, on, off] of [['b', 'font-weight', '700', '400'], ['i', 'font-style', 'italic', 'normal'], ['u', 'text-decoration', 'underline', 'none'], ['strike', 'text-decoration', 'line-through', 'none']]) {
    const node = child(properties, tag); if (node) style[key] = enabled(node) && attr(node, 'val') !== 'none' ? on : off;
  }
  const color = hex(val(properties, 'color')), fill = hex(attr(child(properties, 'shd'), 'fill'));
  if (color) style.color = color;
  if (fill) style['background-color'] = fill;
  const size = pt(val(properties, 'sz'), 2); if (size) style['font-size'] = size;
  const fonts = child(properties, 'rFonts');
  const font = (attr(fonts, 'ascii') || attr(fonts, 'hAnsi')).replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 80);
  if (font) style['font-family'] = `"${font}"`;
  const position = val(properties, 'vertAlign');
  if (position === 'superscript' || position === 'subscript') { style['vertical-align'] = position === 'superscript' ? 'super' : 'sub'; style['font-size'] = 'smaller'; }
  return style;
}
function paragraphStyle(properties: XmlNode | undefined): Style {
  const style: Style = {};
  const align = val(properties, 'jc'); if (['left', 'right', 'center', 'justify', 'both', 'start', 'end'].includes(align)) style['text-align'] = align === 'both' ? 'justify' : align;
  const spacing = child(properties, 'spacing');
  for (const [attrName, key] of [['before', 'margin-top'], ['after', 'margin-bottom']]) { const value = pt(attr(spacing, attrName), 20); if (value) style[key] = value; }
  const indent = child(properties, 'ind');
  const left = pt(attr(indent, 'left') || attr(indent, 'start'), 20); if (left) style['margin-left'] = left;
  return style;
}
function model(files: Package) {
  const xml = read(files, ROOT); if (!xml) throw new Error('Not a Word document.');
  const tree = parseXml(xml), body = descendants(tree, 'body')[0]; if (!body) throw new Error('Word document body missing.');
  const paragraphs = descendants(body, 'p');
  const ids = new Map(paragraphs.map((p, i) => [p, String(i)]));
  const stylesXml = read(files, 'word/styles.xml'), styles = parseXml(stylesXml);
  const defaults = descendants(styles, 'docDefaults')[0];
  const defaultRun = runStyle(descendants(child(defaults, 'rPrDefault'), 'rPr')[0]);
  const definitions = new Map(descendants(styles, 'style').map((s) => [attr(s, 'styleId'), s]));
  const styleOf = (id: string, seen = new Set<string>()): { run: Style; paragraph: Style } => {
    if (!id || seen.has(id) || seen.size > 20) return { run: {}, paragraph: {} };
    seen.add(id); const node = definitions.get(id), base = styleOf(val(node, 'basedOn'), seen);
    return { run: { ...base.run, ...runStyle(child(node, 'rPr')) }, paragraph: { ...base.paragraph, ...paragraphStyle(child(node, 'pPr')) } };
  };
  const defaultStyle = [...definitions.values()].find((s) => attr(s, 'type') === 'paragraph' && /^(1|true)$/.test(attr(s, 'default')));
  const relationships = new Map(descendants(parseXml(read(files, REL)), 'Relationship').map((r) => [attr(r, 'Id'), r]));
  const commentPart = [...relationships.values()].find((r) => attr(r, 'Type').endsWith('/comments'));
  const commentsPath = commentPart ? posix.normalize(posix.join('word', attr(commentPart, 'Target'))) : COMMENTS;
  const commentsXml = read(files, commentsPath);
  const comments = descendants(parseXml(commentsXml), 'comment').map((comment): OfficeComment => {
    const id = attr(comment, 'id');
    const paragraph = paragraphs.find((p) => [...descendants(p, 'commentRangeStart'), ...descendants(p, 'commentReference')].some((n) => attr(n, 'id') === id));
    return { id, author: attr(comment, 'author'), date: attr(comment, 'date'), text: textOf(commentsXml, comment), anchor: paragraph ? ids.get(paragraph) ?? '' : '' };
  });
  return { xml, tree, body, paragraphs, ids, comments, commentsPath, defaultRun, defaultStyle, styleOf, relationships };
}

function isReadOnly(files: Package): boolean {
  const protection = descendants(parseXml(read(files, 'word/settings.xml')), 'documentProtection')[0];
  return Boolean(protection && /^(1|true|on)$/i.test(attr(protection, 'enforcement'))) || [...files.keys()].some((key) => key.startsWith('_xmlsignatures/'));
}
export function wordDocument(buffer: Buffer): WordDocument {
  const files = unzip(buffer, { maxFiles: 10_000, maxFileBytes: 60_000_000, maxTotalBytes: 120_000_000 }) as Package;
  const doc = model(files);
  let imageBytes = 0;
  const render = (node: XmlNode, inherited: Style = {}): string => {
    const name = localName(node.name);
    if (name === 'p') {
      const properties = child(node, 'pPr');
      const style = doc.styleOf(val(properties, 'pStyle') || attr(doc.defaultStyle, 'styleId'));
      const id = doc.ids.get(node);
      const editable = !descendants(node, 'p').length && !descendants(node, 'fldChar').length && !descendants(node, 'fldSimple').length && !descendants(node, 'ins').length && !descendants(node, 'del').length;
      const marked = doc.comments.some((c) => c.anchor === id);
      return `<p data-word-paragraph="${id}" data-editable="${editable}" class="office-paragraph${marked ? ' has-comment' : ''}" style="${css({ ...style.paragraph, ...paragraphStyle(properties) })}">${node.children.map((n) => render(n, { ...doc.defaultRun, ...style.run })).join('') || '<br>'}</p>`;
    }
    if (name === 'r') {
      const style = { ...inherited, ...runStyle(child(node, 'rPr')) };
      if (enabled(child(child(node, 'rPr'), 'vanish'))) return '';
      return `<span style="${css(style)}">${node.children.map((n) => render(n, style)).join('')}</span>`;
    }
    if (name === 't') return esc(nodeText(doc.xml, node));
    if (name === 'tab') return '&#9;';
    if (name === 'br' || name === 'cr') return '<br>';
    if (['pPr', 'rPr', 'tblPr', 'trPr', 'tcPr', 'sectPr', 'del', 'moveFrom'].includes(name)) return '';
    if (name === 'drawing' || name === 'pict') {
      const embedded = descendants(node, 'blip')[0];
      const rel = doc.relationships.get(attr(embedded, 'embed'));
      const target = rel && !attr(rel, 'TargetMode') ? posix.normalize(posix.join('word', attr(rel, 'Target'))) : '';
      const type = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' } as Record<string, string>)[posix.extname(target)];
      const data = type && files.get(target);
      if (!data || imageBytes + data.length > 20_000_000) return '<span class="office-object">[Image]</span>';
      imageBytes += data.length;
      const extent = descendants(node, 'extent')[0];
      const width = Number(attr(extent, 'cx')) / 9525;
      return `<img alt="" draggable="false" src="data:${type};base64,${data.toString('base64')}" style="max-width:100%;${width > 0 ? `width:${Math.min(1600, width)}px` : ''}">`;
    }
    if (name === 'hyperlink') {
      const href = attr(doc.relationships.get(attr(node, 'id')), 'Target');
      const inner = node.children.map((n) => render(n, inherited)).join('');
      return /^(https?:|mailto:)/i.test(href) ? `<a href="${esc(href)}">${inner}</a>` : inner;
    }
    if (name === 'tbl') return `<table>${node.children.map((n) => render(n, inherited)).join('')}</table>`;
    if (name === 'tr') return `<tr>${node.children.map((n) => render(n, inherited)).join('')}</tr>`;
    if (name === 'tc') {
      const properties = child(node, 'tcPr'), span = Math.max(1, Math.min(200, Number(val(properties, 'gridSpan')) || 1));
      const fill = hex(attr(child(properties, 'shd'), 'fill'));
      return `<td colspan="${span}"${fill ? ` style="background-color:${fill}"` : ''}>${node.children.map((n) => render(n, inherited)).join('')}</td>`;
    }
    return node.children.map((n) => render(n, inherited)).join('');
  };
  return { readOnly: isReadOnly(files), html: doc.body.children.map((n) => render(n)).join(''), comments: doc.comments,
    paragraphs: doc.paragraphs.map((p, i) => ({ id: String(i), text: textOf(doc.xml, p), editable: !descendants(p, 'p').length && !descendants(p, 'fldChar').length && !descendants(p, 'fldSimple').length && !descendants(p, 'ins').length && !descendants(p, 'del').length })) };
}

function replaceParagraph(xml: string, paragraph: XmlNode, text: string): string {
  const nodes = textNodes(paragraph), old = textOf(xml, paragraph);
  if (old === text) return xml;
  let prefix = 0, suffix = 0;
  while (prefix < old.length && prefix < text.length && old[prefix] === text[prefix]) prefix++;
  while (suffix < old.length - prefix && suffix < text.length - prefix && old[old.length - 1 - suffix] === text[text.length - 1 - suffix]) suffix++;
  const end = old.length - suffix, inserted = text.slice(prefix, text.length - suffix);
  let offset = 0, applied = false;
  const patches: XmlPatch[] = [];
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index], value = textValue(xml, node), start = offset; offset += value.length;
    const ownsInsertion = !applied && prefix >= start && (prefix < offset || index === nodes.length - 1);
    const left = value.slice(0, Math.max(0, Math.min(value.length, prefix - start)));
    const right = value.slice(Math.max(0, Math.min(value.length, end - start)));
    if (offset <= prefix && !ownsInsertion || start >= end && !ownsInsertion) continue;
    const next = left + (ownsInsertion ? inserted : '') + right;
    if (ownsInsertion) applied = true;
    if (localName(node.name) !== 't' || /[\n\t]/.test(next)) patches.push({ start: node.start, end: node.end, text: wordText(next) });
    else {
      const tag = setXmlAttribute(xml.slice(node.start, node.openEnd).replace(/\/>$/, '>'), 'xml:space', 'preserve');
      patches.push({ start: node.start, end: node.end, text: `${tag}${esc(next)}</${node.name}>` });
    }
  }
  if (!nodes.length) return appendXmlChild(xml, paragraph, `<w:r>${wordText(text)}</w:r>`);
  return patchXml(xml, patches);
}

export function changeWord(buffer: Buffer, change: WordChange): Buffer {
  const files = unzip(buffer, { maxFiles: 10_000, maxFileBytes: 60_000_000, maxTotalBytes: 120_000_000 }) as Package;
  const doc = model(files);
  if (isReadOnly(files)) throw new Error('This Office file is protected or digitally signed.');
  let xml = doc.xml;
  if (change.op === 'text') {
    if (!/^\d+$/.test(change.paragraph) || typeof change.text !== 'string' || change.text.length > 200_000) throw new Error('Invalid paragraph edit.');
    const paragraph = doc.paragraphs[Number(change.paragraph)];
    if (!paragraph || descendants(paragraph, 'p').length || descendants(paragraph, 'fldChar').length || descendants(paragraph, 'fldSimple').length || descendants(paragraph, 'ins').length || descendants(paragraph, 'del').length) throw new Error('This paragraph must be edited in a Word processor.');
    xml = replaceParagraph(xml, paragraph, change.text);
  } else if (change.op === 'comment') {
    const paragraph = /^\d+$/.test(change.paragraph) ? doc.paragraphs[Number(change.paragraph)] : undefined;
    if (!paragraph || typeof change.text !== 'string' || !change.text.trim() || change.text.length > 10_000) throw new Error('Choose a paragraph and write a comment.');
    const id = String(Math.max(-1, ...doc.comments.map((c) => Number(c.id) || 0)) + 1);
    const properties = child(paragraph, 'pPr');
    if (doc.xml.slice(paragraph.start, paragraph.openEnd).endsWith('/>')) {
      files.set(ROOT, Buffer.from(appendXmlChild(doc.xml, paragraph, '')));
      return changeWord(zip([...files]), change);
    }
    const start = properties?.end ?? paragraph.openEnd;
    xml = patchXml(xml, [{ start, end: start, text: `<w:commentRangeStart w:id="${id}"/>` }, { start: paragraph.closeStart, end: paragraph.closeStart, text: `<w:commentRangeEnd w:id="${id}"/><w:r><w:commentReference w:id="${id}"/></w:r>` }]);
    let comments = read(files, doc.commentsPath) || `<?xml version="1.0" encoding="UTF-8"?><w:comments xmlns:w="${NS}"></w:comments>`;
    comments = appendXmlChild(comments, parseXml(comments).children[0], `<w:comment w:id="${id}" w:author="${esc(change.author.slice(0, 100))}" w:date="${new Date().toISOString()}"><w:p><w:r><w:t xml:space="preserve">${esc(change.text.trim())}</w:t></w:r></w:p></w:comment>`);
    files.set(doc.commentsPath, Buffer.from(comments));
    if (![...doc.relationships.values()].some((r) => attr(r, 'Type').endsWith('/comments'))) {
      let relationships = read(files, REL) || `<?xml version="1.0"?><Relationships xmlns="${RELNS}"></Relationships>`;
      const id = `mokiComments${Date.now()}`;
      relationships = appendXmlChild(relationships, parseXml(relationships).children[0], `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>`);
      files.set(REL, Buffer.from(relationships));
    }
    let types = read(files, '[Content_Types].xml');
    if (!types.includes(`PartName="/${doc.commentsPath}"`)) types = appendXmlChild(types, parseXml(types).children[0], `<Override PartName="/${doc.commentsPath}" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>`);
    files.set('[Content_Types].xml', Buffer.from(types));
  } else if (change.op === 'delete-comment') {
    if (!doc.comments.some((c) => c.id === change.id)) throw new Error('Comment not found.');
    const nodes = ['commentRangeStart', 'commentRangeEnd', 'commentReference'].flatMap((name) => descendants(doc.tree, name)).filter((n) => attr(n, 'id') === change.id);
    xml = patchXml(xml, nodes.map((n) => ({ start: n.start, end: n.end, text: '' })));
    const comments = read(files, doc.commentsPath), comment = descendants(parseXml(comments), 'comment').find((n) => attr(n, 'id') === change.id);
    if (comment) files.set(doc.commentsPath, Buffer.from(patchXml(comments, [{ start: comment.start, end: comment.end, text: '' }])));
  } else throw new Error('Unknown Word change.');
  files.set(ROOT, Buffer.from(xml));
  return zip([...files]);
}
