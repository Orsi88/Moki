// Native spreadsheet values, visual styles and notes. Edits keep every other worksheet/package part intact.
import { posix } from 'node:path';
import { unzip, zip } from './zip.mjs';
import { appendXmlChild, attribute as attr, child, descendants, localName, nodeText, parseXml, patchXml, setXmlAttribute, xmlEscape as esc, type XmlNode } from './office-xml.ts';
import { applyOfficeNote, isOfficeColor, officeNotes, saveOfficeNote } from './office-notes.ts';
import type { OfficeComment, CellInfo, WorkbookInfo, SheetChange } from './office-types.ts';
export type { CellInfo, WorksheetInfo, WorkbookInfo, SheetChange } from './office-types.ts';
type Package = Map<string, Buffer>;
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const RNS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const RELNS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const read = (files: Package, name: string) => files.get(name)?.toString('utf8') ?? '';
const root = (xml: string) => parseXml(xml).children[0];
const relPath = (part: string) => posix.join(posix.dirname(part), '_rels', `${posix.basename(part)}.rels`);
const relationships = (files: Package, part: string) => descendants(parseXml(read(files, relPath(part))), 'Relationship');
const targetOf = (part: string, rel: XmlNode | undefined) => rel && !attr(rel, 'TargetMode') ? posix.normalize(attr(rel, 'Target').startsWith('/') ? attr(rel, 'Target').slice(1) : posix.join(posix.dirname(part), attr(rel, 'Target'))) : '';
const textOf = (xml: string, node: XmlNode) => descendants(node, 't').map((t) => nodeText(xml, t)).join('');
export const columnName = (column: number): string => column >= 26 ? columnName(Math.floor(column / 26) - 1) + String.fromCharCode(65 + column % 26) : String.fromCharCode(65 + column);
export function cellPosition(ref: string): { row: number; column: number } {
  const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(ref);
  if (!match) throw new Error('Invalid cell reference.');
  const column = [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1, row = Number(match[2]) - 1;
  if (column >= 16384 || row >= 1048576) throw new Error('Invalid cell reference.');
  return { row, column };
}
function sheetParts(files: Package): { name: string; path: string }[] {
  const rels = relationships(files, 'xl/workbook.xml');
  return descendants(parseXml(read(files, 'xl/workbook.xml')), 'sheet').map((sheet) => ({ name: attr(sheet, 'name'), path: targetOf('xl/workbook.xml', rels.find((r) => attr(r, 'Id') === attr(sheet, 'id'))) }));
}
function visualStyles(files: Package): Record<string, string>[] {
  const styles = root(read(files, 'xl/styles.xml'));
  const fonts = child(styles, 'fonts')?.children ?? [], fills = child(styles, 'fills')?.children ?? [], borders = child(styles, 'borders')?.children ?? [];
  const theme = descendants(parseXml(read(files, 'xl/theme/theme1.xml')), 'clrScheme')[0];
  const colors = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map((name) => { const value = child(theme, name)?.children[0]; return attr(value, 'lastClr') || attr(value, 'val'); });
  const color = (node: XmlNode | undefined): string => {
    const rgb = attr(node, 'rgb'), themed = attr(node, 'theme');
    const value = rgb ? rgb.slice(-6) : themed ? colors[Number(themed)] : '';
    if (!/^[\da-f]{6}$/i.test(value)) return '';
    const tint = Math.max(-1, Math.min(1, Number(attr(node, 'tint')) || 0));
    return '#' + [0, 2, 4].map((at) => { const n = parseInt(value.slice(at, at + 2), 16); return Math.round(tint < 0 ? n * (1 + tint) : n + (255 - n) * tint).toString(16).padStart(2, '0'); }).join('');
  };
  return (child(styles, 'cellXfs')?.children ?? []).map((format) => {
    const font = fonts[Number(attr(format, 'fontId')) || 0], fill = fills[Number(attr(format, 'fillId')) || 0], border = borders[Number(attr(format, 'borderId')) || 0];
    const result: Record<string, string> = {};
    const on = (name: string) => { const n = child(font, name); return n && !/^(0|false)$/.test(attr(n, 'val')); };
    if (on('b')) result.fontWeight = '700';
    if (on('i')) result.fontStyle = 'italic';
    if (on('u')) result.textDecoration = 'underline';
    if (on('strike')) result.textDecoration = 'line-through';
    const size = Number(attr(child(font, 'sz'), 'val')); if (size > 0 && size < 200) result.fontSize = `${size}pt`;
    const family = attr(child(font, 'name'), 'val').replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 80); if (family) result.fontFamily = `"${family}"`;
    const foreground = color(child(font, 'color')); if (foreground) result.color = foreground;
    const pattern = child(fill, 'patternFill');
    if (attr(pattern, 'patternType') === 'solid') { const background = color(child(pattern, 'fgColor')); if (background) result.backgroundColor = background; }
    const alignment = child(format, 'alignment');
    const horizontal = attr(alignment, 'horizontal'); if (['left', 'center', 'right', 'justify'].includes(horizontal)) result.textAlign = horizontal;
    const vertical = attr(alignment, 'vertical'); if (['top', 'bottom', 'center'].includes(vertical)) result.verticalAlign = vertical === 'center' ? 'middle' : vertical;
    if (/^(1|true)$/.test(attr(alignment, 'wrapText'))) result.whiteSpace = 'pre-wrap';
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      const side = child(border, edge), style = attr(side, 'style');
      if (style && style !== 'none') result[`border${edge[0].toUpperCase()}${edge.slice(1)}`] = `${style === 'thick' ? 3 : style === 'medium' ? 2 : 1}px ${style === 'double' ? 'double' : /dash|dot/i.test(style) ? 'dashed' : 'solid'} ${color(child(side, 'color')) || '#808080'}`;
    }
    return result;
  });
}

export function workbookInfo(buffer: Buffer): WorkbookInfo {
  const files = unzip(buffer, { maxFiles: 10_000, maxFileBytes: 60_000_000, maxTotalBytes: 120_000_000 }) as Package;
  const sharedXml = read(files, 'xl/sharedStrings.xml');
  const shared = descendants(parseXml(sharedXml), 'si').map((n) => textOf(sharedXml, n));
  const styles = visualStyles(files), notes = officeNotes(files);
  return { readOnly: [...files.keys()].some((key) => key.startsWith('_xmlsignatures/')), sheets: sheetParts(files).map(({ name, path }, index) => {
    const xml = read(files, path), tree = parseXml(xml), cells: Record<string, CellInfo> = {};
    for (const cell of descendants(tree, 'c')) {
      const ref = attr(cell, 'r');
      if (!/^[A-Z]{1,3}[1-9]\d*$/.test(ref)) continue;
      const position = cellPosition(ref); if (position.row >= 2000 || position.column >= 200) continue;
      const type = attr(cell, 't'), valueNode = child(cell, 'v'), formula = child(cell, 'f');
      const value = valueNode ? nodeText(xml, valueNode) : '';
      cells[ref] = { value: type === 's' ? shared[Number(value)] ?? '' : type === 'inlineStr' ? textOf(xml, cell) : type === 'b' ? value === '1' ? 'TRUE' : 'FALSE' : value,
        ...(formula ? { formula: '=' + nodeText(xml, formula) } : {}), style: styles[Number(attr(cell, 's')) || 0] ?? {} };
    }
    const rels = relationships(files, path), part = targetOf(path, rels.find((r) => attr(r, 'Type').endsWith('/comments')));
    const commentsXml = read(files, part), commentTree = parseXml(commentsXml);
    const authors = descendants(commentTree, 'author').map((n) => nodeText(commentsXml, n));
    const comments = descendants(commentTree, 'comment').map((n): OfficeComment => applyOfficeNote({ id: attr(n, 'ref'), anchor: attr(n, 'ref'), author: authors[Number(attr(n, 'authorId'))] ?? '', text: textOf(commentsXml, n), date: '' }, notes[`${index}:${attr(n, 'ref')}`]));
    return { name, path, cells, comments, protected: Boolean(descendants(tree, 'sheetProtection').length) };
  }) };
}

function addRelationship(files: Package, part: string, type: string, target: string): string {
  const path = relPath(part), old = read(files, path);
  const rels = descendants(parseXml(old), 'Relationship');
  const existing = rels.find((r) => attr(r, 'Type') === `${RNS}/${type}`);
  if (existing) return attr(existing, 'Id');
  let id = 'moki1'; for (let n = 2; rels.some((r) => attr(r, 'Id') === id); n++) id = `moki${n}`;
  const xml = old || `<?xml version="1.0"?><Relationships xmlns="${RELNS}"></Relationships>`;
  files.set(path, Buffer.from(appendXmlChild(xml, root(xml), `<Relationship Id="${id}" Type="${RNS}/${type}" Target="${esc(posix.relative(posix.dirname(part), target))}"/>`)));
  return id;
}
function addNoteShape(xml: string, ref: string): string {
  const position = cellPosition(ref), tree = parseXml(xml);
  if (descendants(tree, 'ClientData').some((n) => attr(n, 'ObjectType') === 'Note' && Number(nodeText(xml, child(n, 'Row') ?? n)) === position.row && Number(nodeText(xml, child(n, 'Column') ?? n)) === position.column)) return xml;
  const id = Math.max(1024, ...descendants(tree, 'shape').map((n) => Number(attr(n, 'id').replace(/\D/g, '')) || 0)) + 1;
  const type = xml.includes('_x0000_t202') ? '' : '<v:shapetype id="_x0000_t202" coordsize="21600,21600" o:spt="202" path="m,l,21600r21600,l21600,xe"><v:stroke joinstyle="miter"/><v:path gradientshapeok="t" o:connecttype="rect"/></v:shapetype>';
  const shape = `<v:shape id="_x0000_s${id}" type="#_x0000_t202" style="position:absolute;width:144pt;height:80pt;visibility:hidden" fillcolor="#ffffe1" o:insetmode="auto"><v:fill color2="#ffffe1"/><v:shadow on="t" color="black" obscured="t"/><v:path o:connecttype="none"/><v:textbox style="mso-direction-alt:auto"><div style="text-align:left"/></v:textbox><x:ClientData ObjectType="Note"><x:MoveWithCells/><x:SizeWithCells/><x:AutoFill>False</x:AutoFill><x:Row>${position.row}</x:Row><x:Column>${position.column}</x:Column></x:ClientData></v:shape>`;
  return xml.replace(/<\/xml>\s*$/, type + shape + '</xml>');
}

export function changeSheet(buffer: Buffer, change: SheetChange): Buffer {
  const files = unzip(buffer, { maxFiles: 10_000, maxFileBytes: 60_000_000, maxTotalBytes: 120_000_000 }) as Package;
  if ([...files.keys()].some((key) => key.startsWith('_xmlsignatures/'))) throw new Error('This Office file is protected or digitally signed.');
  const parts = sheetParts(files);
  if (!Number.isInteger(change.sheet) || !parts[change.sheet]) throw new Error('Unknown worksheet.');
  const { path } = parts[change.sheet], position = cellPosition(change.ref);
  let xml = read(files, path), tree = parseXml(xml);
  if (descendants(tree, 'sheetProtection').length) throw new Error('This worksheet is protected.');
  const merge = descendants(tree, 'mergeCell').map((n) => attr(n, 'ref')).find((range) => {
    const [first, last] = range.split(':'); if (!last) return false;
    const a = cellPosition(first), b = cellPosition(last);
    return position.row >= a.row && position.row <= b.row && position.column >= a.column && position.column <= b.column && first !== change.ref;
  });
  if (merge) throw new Error('Edit the first cell of this merged area.');
  if (change.op === 'cell') {
    if (typeof change.value !== 'string' || change.value.length > 32000) throw new Error('Invalid cell value.');
    const cell = descendants(tree, 'c').find((n) => attr(n, 'r') === change.ref);
    if (cell && child(cell, 'f') && ['array', 'dataTable', 'shared'].includes(attr(child(cell, 'f'), 't'))) throw new Error('This formula must be edited in a spreadsheet program.');
    let tag = cell ? xml.slice(cell.start, cell.openEnd).replace(/\s+t\s*=\s*(?:"[^"]*"|'[^']*')/, '').replace(/\/>$/, '>') : `<c r="${change.ref}">`;
    const value = change.value;
    const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value) && !/^0\d/.test(value) && Number.isFinite(Number(value));
    const formula = value.startsWith('=') && value.length > 1;
    if (!numeric && !formula) tag = setXmlAttribute(tag, 't', 'inlineStr');
    const content = formula ? `<f>${esc(value.slice(1))}</f>` : numeric ? `<v>${esc(value)}</v>` : `<is><t xml:space="preserve">${esc(value)}</t></is>`;
    const other = cell ? cell.children.filter((n) => !['v', 'f', 'is'].includes(localName(n.name))).map((n) => xml.slice(n.start, n.end)).join('') : '';
    const next = tag + content + other + '</c>';
    if (cell) xml = patchXml(xml, [{ start: cell.start, end: cell.end, text: next }]);
    else {
      const row = descendants(tree, 'row').find((n) => Number(attr(n, 'r')) === position.row + 1);
      if (row) {
        if (xml.slice(row.start, row.openEnd).endsWith('/>')) xml = patchXml(xml, [{ start: row.start, end: row.end, text: xml.slice(row.start, row.openEnd).replace(/\/>$/, '>') + next + '</row>' }]);
        else { const after = row.children.find((n) => localName(n.name) === 'c' && cellPosition(attr(n, 'r')).column > position.column)?.start ?? row.closeStart; xml = patchXml(xml, [{ start: after, end: after, text: next }]); }
      } else {
        const data = descendants(tree, 'sheetData')[0]; if (!data) throw new Error('Worksheet data missing.');
        const rowXml = `<row r="${position.row + 1}">${next}</row>`;
        if (xml.slice(data.start, data.openEnd).endsWith('/>')) xml = patchXml(xml, [{ start: data.start, end: data.end, text: '<sheetData>' + rowXml + '</sheetData>' }]);
        else { const before = data.children.find((n) => Number(attr(n, 'r')) > position.row + 1)?.start ?? data.closeStart; xml = patchXml(xml, [{ start: before, end: before, text: rowXml }]); }
      }
    }
    // Extend the used range without changing existing styles or cell data.
    const dimension = descendants(parseXml(xml), 'dimension')[0];
    if (dimension) {
      const refs = [attr(dimension, 'ref').split(':')[0], attr(dimension, 'ref').split(':').at(-1), change.ref].filter((ref): ref is string => Boolean(ref)).map(cellPosition);
      const first = columnName(Math.min(...refs.map((p) => p.column))) + (Math.min(...refs.map((p) => p.row)) + 1);
      const last = columnName(Math.max(...refs.map((p) => p.column))) + (Math.max(...refs.map((p) => p.row)) + 1);
      xml = patchXml(xml, [{ start: dimension.start, end: dimension.openEnd, text: setXmlAttribute(xml.slice(dimension.start, dimension.openEnd), 'ref', first === last ? first : first + ':' + last) }]);
    }
    // Cached formula results are stale after an edit; calculation stays with the spreadsheet engine.
    files.delete('xl/calcChain.xml');
    const workbook = read(files, 'xl/workbook.xml');
    const calc = descendants(parseXml(workbook), 'calcPr')[0];
    const properties = '<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>';
    files.set('xl/workbook.xml', Buffer.from(calc ? patchXml(workbook, [{ start: calc.start, end: calc.end, text: properties }]) : patchXml(workbook, [{ start: child(root(workbook), 'extLst')?.start ?? root(workbook).closeStart, end: child(root(workbook), 'extLst')?.start ?? root(workbook).closeStart, text: properties }])));
    for (const name of ['xl/_rels/workbook.xml.rels', '[Content_Types].xml']) {
      const source = read(files, name), nodes = descendants(parseXml(source), name.endsWith('.rels') ? 'Relationship' : 'Override').filter((n) => (attr(n, 'Type') || attr(n, 'PartName')).includes('calcChain'));
      if (nodes.length) files.set(name, Buffer.from(patchXml(source, nodes.map((n) => ({ start: n.start, end: n.end, text: '' })))));
    }
  } else if (change.op === 'comment' || change.op === 'delete-comment') {
    const rels = relationships(files, path);
    if (rels.some((r) => /threadedComment/i.test(attr(r, 'Type')))) throw new Error('Threaded comments must be edited in a spreadsheet program.');
    let part = targetOf(path, rels.find((r) => attr(r, 'Type').endsWith('/comments')));
    if (!part) { part = `xl/comments-moki-${change.sheet + 1}.xml`; for (let n = 2; files.has(part); n++) part = `xl/comments-moki-${change.sheet + 1}-${n}.xml`; }
    let commentsXml = read(files, part) || `<?xml version="1.0"?><comments xmlns="${NS}"><authors></authors><commentList></commentList></comments>`;
    let comments = parseXml(commentsXml), existing = descendants(comments, 'comment').find((n) => attr(n, 'ref') === change.ref);
    if (change.op === 'delete-comment') {
      if (!existing) throw new Error('Comment not found.');
      commentsXml = patchXml(commentsXml, [{ start: existing.start, end: existing.end, text: '' }]);
      const vml = targetOf(path, rels.find((r) => attr(r, 'Type').endsWith('/vmlDrawing')));
      if (vml) {
        const source = read(files, vml);
        const shapes = descendants(parseXml(source), 'shape').filter((shape) => descendants(shape, 'ClientData').some((data) => attr(data, 'ObjectType') === 'Note' && Number(nodeText(source, child(data, 'Row') ?? data)) === position.row && Number(nodeText(source, child(data, 'Column') ?? data)) === position.column));
        files.set(vml, Buffer.from(patchXml(source, shapes.map((shape) => ({ start: shape.start, end: shape.end, text: '' })))));
      }
      saveOfficeNote(files, `${change.sheet}:${change.ref}`, null);
    } else {
      if (typeof change.text !== 'string' || !change.text.trim() || change.text.length > 10_000) throw new Error('Write a comment.');
      const previousAuthor = existing ? attr(existing, 'authorId') : '';
      const authors = descendants(comments, 'author').map((n) => nodeText(commentsXml, n));
      let author = authors.indexOf(change.author.slice(0, 100));
      if (previousAuthor === '' && author < 0) {
        author = authors.length;
        commentsXml = appendXmlChild(commentsXml, descendants(parseXml(commentsXml), 'authors')[0], `<author>${esc(change.author.slice(0, 100))}</author>`);
        comments = parseXml(commentsXml);
        existing = descendants(comments, 'comment').find((n) => attr(n, 'ref') === change.ref);
      }
      const value = `<comment ref="${change.ref}" authorId="${previousAuthor === '' ? author : previousAuthor}"><text><t xml:space="preserve">${esc(change.text.trim())}</t></text></comment>`;
      commentsXml = existing ? patchXml(commentsXml, [{ start: existing.start, end: existing.end, text: value }]) : appendXmlChild(commentsXml, descendants(parseXml(commentsXml), 'commentList')[0], value);
      addRelationship(files, path, 'comments', part);
      let vml = targetOf(path, rels.find((r) => attr(r, 'Type').endsWith('/vmlDrawing')));
      if (!vml) vml = `xl/drawings/comments-moki-${change.sheet + 1}.vml`;
      const vmlId = addRelationship(files, path, 'vmlDrawing', vml);
      const source = read(files, vml) || '<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"></xml>';
      files.set(vml, Buffer.from(addNoteShape(source, change.ref)));
      if (!descendants(tree, 'legacyDrawing').length) {
        const worksheet = tree.children[0];
        const before = worksheet.children.find((n) => ['legacyDrawingHF', 'picture', 'oleObjects', 'controls', 'webPublishItems', 'tableParts', 'extLst'].includes(localName(n.name)))?.start ?? worksheet.closeStart;
        xml = patchXml(xml, [{ start: before, end: before, text: `<legacyDrawing r:id="${vmlId}"/>` }]);
        const updated = parseXml(xml).children[0];
        xml = patchXml(xml, [{ start: updated.start, end: updated.openEnd, text: setXmlAttribute(xml.slice(updated.start, updated.openEnd), 'xmlns:r', RNS) }]);
      }
      let types = read(files, '[Content_Types].xml');
      if (!types.includes(`PartName="/${part}"`)) types = appendXmlChild(types, root(types), `<Override PartName="/${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"/>`);
      if (!/Extension="vml"/.test(types)) { const at = root(types).openEnd; types = patchXml(types, [{ start: at, end: at, text: '<Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>' }]); }
      files.set('[Content_Types].xml', Buffer.from(types));
      const key = `${change.sheet}:${change.ref}`, current = officeNotes(files)[key] ?? { replies: [] };
      saveOfficeNote(files, key, { ...current, at: current.at || new Date().toISOString(), ...(isOfficeColor(change.color) ? { color: change.color } : {}) });
    }
    files.set(part, Buffer.from(commentsXml));
  } else if (change.op === 'reply' || change.op === 'color') {
    const part = targetOf(path, relationships(files, path).find((r) => attr(r, 'Type').endsWith('/comments')));
    if (!descendants(parseXml(read(files, part)), 'comment').some((n) => attr(n, 'ref') === change.ref)) throw new Error('Comment not found.');
    const key = `${change.sheet}:${change.ref}`, current = officeNotes(files)[key] ?? { replies: [] };
    if (change.op === 'color') {
      if (!isOfficeColor(change.color)) throw new Error('Invalid comment color.');
      saveOfficeNote(files, key, { ...current, color: change.color });
    } else {
      if (typeof change.text !== 'string' || !change.text.trim() || change.text.length > 10_000) throw new Error('Write a comment.');
      saveOfficeNote(files, key, { ...current, replies: [...current.replies, { author: change.author.slice(0, 100), at: new Date().toISOString(), text: change.text.trim() }].slice(-50) });
    }
  } else throw new Error('Unknown spreadsheet change.');
  files.set(path, Buffer.from(xml));
  return zip([...files]);
}
