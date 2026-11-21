// PowerPoint speaker notes and comments, read from and written into the presentation itself. A change touches only
// the notes slide of its slide, the comment parts, their relationships and content types (and, when the deck has no
// notes master yet, a new one with a copy of the deck's theme); every other part is copied as it is (rezip).
//
// Comments are written in the PowerPoint comment format every version reads (ppt/comments/commentN.xml, a point on the
// slide); what PowerPoint has no field for (the marked area, the color, the replies) goes in moki/comments.json, as for
// Word and Excel. Comments of the newer PowerPoint format (modernComment_*.xml, threaded) are read and shown, not edited.
import { posix } from 'node:path';
import { rezip, unzip } from './zip.mjs';
import { appendXmlChild, attribute as attr, child, descendants, localName, nodeText, parseXml, patchXml, setXmlAttribute, xmlEscape as esc, type XmlNode } from './office-xml.ts';
import { isOfficeArea, isOfficeColor, officeNotes, saveOfficeNote, type OfficeNote } from './office-notes.ts';
import type { DeckNotes, OfficeReply, SlideChange, SlideComment, SlideNotes } from './office-types.ts';
export type { DeckNotes, SlideChange, SlideComment, SlideNotes, SlideArea } from './office-types.ts';

type Package = Map<string, Buffer>;
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const T = {
  office: `${REL}/officeDocument`, slide: `${REL}/slide`, notes: `${REL}/notesSlide`, notesMaster: `${REL}/notesMaster`, theme: `${REL}/theme`,
  comments: `${REL}/comments`, authors: `${REL}/commentAuthors`, modern: 'http://schemas.microsoft.com/office/2018/10/relationships/comments',
  modernAuthors: 'http://schemas.microsoft.com/office/2018/10/relationships/authors',
};
const CT = 'application/vnd.openxmlformats-officedocument';
const TYPES = {
  notes: `${CT}.presentationml.notesSlide+xml`, notesMaster: `${CT}.presentationml.notesMaster+xml`, theme: `${CT}.theme+xml`,
  comments: `${CT}.presentationml.comments+xml`, authors: `${CT}.presentationml.commentAuthors+xml`,
};
const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const EMU_PER_PT = 12700;
const NOTES_LIMIT = 20000, COMMENT_LIMIT = 4000;
// Only the XML of the package is read; pictures, video and fonts stay compressed in the original bytes.
const LIMITS = { maxFiles: 20_000, maxFileBytes: 60_000_000, maxTotalBytes: 200_000_000, only: (name: string) => /\.(xml|rels)$/i.test(name) || name === 'moki/comments.json' };

const read = (files: Package, path: string) => files.get(path)?.toString('utf8') ?? '';
const write = (files: Package, path: string, xml: string) => files.set(path, Buffer.from(xml, 'utf8'));
const relsPath = (part: string) => posix.join(posix.dirname(part), '_rels', `${posix.basename(part)}.rels`);
const resolve = (part: string, target: string) => target.startsWith('/') ? target.slice(1) : posix.normalize(posix.join(posix.dirname(part), target));
const relative = (from: string, to: string) => posix.relative(posix.dirname(from), to);
const rootOf = (xml: string) => parseXml(xml).children[0];
// The r:id of an element, whatever prefix the file gives the relationships namespace.
const rid = (node: XmlNode) => Object.entries(node.attrs).find(([key]) => key.includes(':') && localName(key) === 'id')?.[1] ?? '';
// The prefix a part uses for a namespace (PowerPoint writes a: and p:, other programs may not).
function prefix(root: XmlNode | undefined, uri: string, fallback: string): string {
  const found = Object.entries(root?.attrs ?? {}).find(([key, value]) => key.startsWith('xmlns:') && value === uri);
  return found ? found[0].slice(6) : fallback;
}
const DML = 'http://schemas.openxmlformats.org/drawingml/2006/main';

interface Rel { id: string; type: string; target: string; external: boolean }
function relsOf(files: Package, part: string): Rel[] {
  const xml = read(files, relsPath(part));
  if (!xml) return [];
  return descendants(parseXml(xml), 'Relationship').map((node) => {
    const external = attr(node, 'TargetMode') === 'External';
    return { id: attr(node, 'Id'), type: attr(node, 'Type'), target: external ? attr(node, 'Target') : resolve(part, attr(node, 'Target')), external };
  });
}
function addRel(files: Package, part: string, type: string, target: string): string {
  const path = relsPath(part);
  let xml = read(files, path) || `${HEAD}<Relationships xmlns="${RELS_NS}"></Relationships>`;
  const used = new Set(descendants(parseXml(xml), 'Relationship').map((node) => attr(node, 'Id')));
  let n = used.size + 1;
  while (used.has(`rId${n}`)) n++;
  const id = `rId${n}`;
  xml = appendXmlChild(xml, rootOf(xml), `<Relationship Id="${id}" Type="${type}" Target="${esc(relative(part, target))}"/>`);
  write(files, path, xml);
  return id;
}
function removeRel(files: Package, part: string, id: string): void {
  const path = relsPath(part), xml = read(files, path);
  const node = descendants(parseXml(xml), 'Relationship').find((n) => attr(n, 'Id') === id);
  if (node) write(files, path, patchXml(xml, [{ start: node.start, end: node.end, text: '' }]));
}
function addType(files: Package, part: string, type: string): void {
  const xml = read(files, '[Content_Types].xml');
  if (!xml || descendants(parseXml(xml), 'Override').some((node) => attr(node, 'PartName') === `/${part}`)) return;
  write(files, '[Content_Types].xml', appendXmlChild(xml, rootOf(xml), `<Override PartName="/${esc(part)}" ContentType="${type}"/>`));
}
function removeType(files: Package, part: string): void {
  const xml = read(files, '[Content_Types].xml');
  const node = descendants(parseXml(xml), 'Override').find((n) => attr(n, 'PartName') === `/${part}`);
  if (node) write(files, '[Content_Types].xml', patchXml(xml, [{ start: node.start, end: node.end, text: '' }]));
}
// A part name not taken yet: ppt/comments/comment3.xml, ppt/notesSlides/notesSlide7.xml...
function freeName(files: Package, folder: string, stem: string): string {
  let n = 1;
  while (files.has(`${folder}/${stem}${n}.xml`)) n++;
  return `${folder}/${stem}${n}.xml`;
}

interface Deck { main: string; slides: string[]; width: number; height: number }
function deckOf(files: Package): Deck {
  const main = relsOf(files, '').find((r) => r.type === T.office)?.target ?? 'ppt/presentation.xml';
  const xml = read(files, main);
  if (!xml) throw new Error('Not a PowerPoint presentation.');
  const tree = parseXml(xml), rels = new Map(relsOf(files, main).map((r) => [r.id, r]));
  const slides = descendants(child(tree.children[0], 'sldIdLst'), 'sldId').map((node) => rels.get(rid(node))).filter((r): r is Rel => Boolean(r && !r.external)).map((r) => r.target);
  const size = descendants(tree, 'sldSz')[0];
  return { main, slides, width: Number(attr(size, 'cx')) / EMU_PER_PT || 960, height: Number(attr(size, 'cy')) / EMU_PER_PT || 540 };
}
const notesPart = (files: Package, slide: string) => relsOf(files, slide).find((r) => r.type === T.notes && !r.external)?.target ?? '';

// The body placeholder of a notes slide holds the notes; the slide picture and the number are other placeholders.
const bodyShape = (tree: XmlNode) => descendants(tree, 'sp').find((sp) => descendants(sp, 'ph').some((ph) => attr(ph, 'type') === 'body'));
function paragraphText(xml: string, p: XmlNode): string {
  const walk = (node: XmlNode): string => node.children.map((n) => localName(n.name) === 't' ? nodeText(xml, n) : localName(n.name) === 'br' ? '\n' : localName(n.name) === 'rPr' || localName(n.name) === 'pPr' ? '' : walk(n)).join('');
  return walk(p);
}
function readNotes(files: Package, slide: string): { notes: string; formatted: boolean } {
  const part = notesPart(files, slide), xml = part ? read(files, part) : '';
  if (!xml) return { notes: '', formatted: false };
  const body = child(bodyShape(parseXml(xml)), 'txBody');
  if (!body) return { notes: '', formatted: false };
  const paragraphs = body.children.filter((n) => localName(n.name) === 'p');
  const notes = paragraphs.map((p) => paragraphText(xml, p)).join('\n').replace(/\s+$/, '');
  // Bold, italics, underline, bullets or levels: what plain text editing would not keep.
  const formatted = Boolean(notes) && paragraphs.some((p) => descendants(p, 'rPr').some((r) => /^(1|true)$/.test(attr(r, 'b')) || /^(1|true)$/.test(attr(r, 'i')) || (attr(r, 'u') && attr(r, 'u') !== 'none'))
    || descendants(p, 'pPr').some((pr) => Number(attr(pr, 'lvl')) > 0 || descendants(pr, 'buChar').length > 0 || descendants(pr, 'buAutoNum').length > 0));
  return { notes, formatted };
}

const isoDate = (value: string) => { const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(value) || !value ? value : `${value}Z`); return Number.isNaN(d.getTime()) ? '' : d.toISOString(); };
const noteKey = (slide: string, id: string) => `${slide}#${id}`;
const authorsPart = (files: Package, deck: Deck) => relsOf(files, deck.main).find((r) => r.type === T.authors && !r.external)?.target ?? '';
const legacyPart = (files: Package, slide: string) => relsOf(files, slide).find((r) => r.type === T.comments && !r.external);

function legacyComments(files: Package, deck: Deck, slide: string, notes: Record<string, OfficeNote>): SlideComment[] {
  const rel = legacyPart(files, slide), xml = rel ? read(files, rel.target) : '';
  if (!xml) return [];
  const authorsXml = read(files, authorsPart(files, deck));
  const names = new Map(descendants(authorsXml ? parseXml(authorsXml) : undefined, 'cmAuthor').map((a) => [attr(a, 'id'), attr(a, 'name')]));
  return descendants(parseXml(xml), 'cm').map((cm): SlideComment => {
    const id = `${attr(cm, 'authorId')}-${attr(cm, 'idx')}`, pos = child(cm, 'pos'), text = child(cm, 'text');
    const note = notes[noteKey(slide, id)];
    const x = Number(attr(pos, 'x')) / 8 / deck.width, y = Number(attr(pos, 'y')) / 8 / deck.height;
    return {
      id, author: names.get(attr(cm, 'authorId')) ?? '', date: isoDate(attr(cm, 'dt')), text: text ? nodeText(xml, text) : '',
      ...(note?.color ? { color: note.color } : {}), ...(note?.replies.length ? { replies: note.replies } : {}),
      ...(note?.area ? { area: note.area } : Number.isFinite(x) && Number.isFinite(y) ? { pin: { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) } } : {}),
    };
  });
}

function modernComments(files: Package, deck: Deck, slide: string): SlideComment[] {
  const parts = relsOf(files, slide).filter((r) => r.type === T.modern && !r.external);
  if (!parts.length) return [];
  const authorsTarget = relsOf(files, deck.main).find((r) => r.type === T.modernAuthors && !r.external)?.target ?? 'ppt/authors.xml';
  const authorsXml = read(files, authorsTarget);
  const names = new Map(descendants(authorsXml ? parseXml(authorsXml) : undefined, 'author').map((a) => [attr(a, 'id'), attr(a, 'name')]));
  const textOf = (xml: string, node: XmlNode | undefined) => (node ? node.children.filter((n) => localName(n.name) === 'p').map((p) => paragraphText(xml, p)).join('\n').trim() : '');
  return parts.flatMap((part) => {
    const xml = read(files, part.target);
    if (!xml) return [];
    return descendants(parseXml(xml), 'cm').map((cm): SlideComment => {
      const replies: OfficeReply[] = descendants(child(cm, 'replyLst'), 'reply').map((r) => ({ author: names.get(attr(r, 'authorId')) ?? '', at: isoDate(attr(r, 'created')), text: textOf(xml, child(r, 'txBody')) }));
      return { id: `modern-${attr(cm, 'id')}`, author: names.get(attr(cm, 'authorId')) ?? '', date: isoDate(attr(cm, 'created')), text: textOf(xml, child(cm, 'txBody')), ...(replies.length ? { replies } : {}), readOnly: true };
    });
  });
}

const loadPackage = (buffer: Buffer): Package => unzip(buffer, { ...LIMITS }) as Package;
const isReadOnly = (buffer: Buffer) => Boolean(unzip(buffer, { maxFiles: LIMITS.maxFiles, only: (name: string) => name.startsWith('_xmlsignatures/') }).size);

export function deckNotes(buffer: Buffer): DeckNotes {
  const files = loadPackage(buffer), deck = deckOf(files), notes = officeNotes(files);
  const slides = deck.slides.map((slide): SlideNotes => ({ ...readNotes(files, slide), comments: [...legacyComments(files, deck, slide, notes), ...modernComments(files, deck, slide)] }));
  return { ...(isReadOnly(buffer) ? { readOnly: true } : {}), slides };
}

// Plain lines as DrawingML paragraphs (an empty line keeps its place).
function paragraphs(text: string, a: string, lang: string): string {
  const rPr = `${lang ? ` lang="${esc(lang)}"` : ''} dirty="0"`;
  return text.split('\n').map((line) => line ? `<${a}:p><${a}:r><${a}:rPr${rPr}/><${a}:t>${esc(line)}</${a}:t></${a}:r></${a}:p>` : `<${a}:p><${a}:endParaRPr${rPr}/></${a}:p>`).join('');
}
const NOTES_BODY = (id: number, content: string) => `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Notes Placeholder ${id - 1}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${content}</p:txBody></p:sp>`;
const GROUP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';
const CLR_MAP = 'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"';

// A notes master like the one PowerPoint creates: the slide picture above, the notes below, on a portrait page.
function notesMasterXml(cx: number, cy: number): string {
  const img = { x: Math.round(cx * 0.125), y: Math.round(cy * 0.125), w: Math.round(cx * 0.75), h: Math.round(cy * 0.3375) };
  const body = { x: Math.round(cx * 0.1), y: Math.round(cy * 0.48), w: Math.round(cx * 0.8), h: Math.round(cy * 0.39) };
  const levels = Array.from({ length: 9 }, (_, i) => `<a:lvl${i + 1}pPr marL="${i * 457200}" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl${i + 1}pPr>`).join('');
  return `${HEAD}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>${GROUP}`
    + `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${img.x}" y="${img.y}"/><a:ext cx="${img.w}" cy="${img.h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln></p:spPr></p:sp>`
    + `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="${body.x}" y="${body.y}"/><a:ext cx="${body.w}" cy="${body.h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr vert="horz" lIns="91440" tIns="45720" rIns="91440" bIns="45720" rtlCol="0"/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:endParaRPr lang="en-US"/></a:p></p:txBody></p:sp>`
    + `</p:spTree></p:cSld><p:clrMap ${CLR_MAP}/><p:notesStyle>${levels}</p:notesStyle></p:notesMaster>`;
}

// The deck's notes master, created (with a copy of the deck's theme) when the deck never had notes.
function ensureNotesMaster(files: Package, deck: Deck): string {
  const existing = relsOf(files, deck.main).find((r) => r.type === T.notesMaster && !r.external)?.target;
  if (existing && files.has(existing)) return existing;
  const xml = read(files, deck.main), root = rootOf(xml);
  const theme = relsOf(files, deck.main).find((r) => r.type === T.theme && !r.external)?.target;
  const themeXml = theme ? read(files, theme) : '';
  if (!themeXml) throw new Error('This presentation has no theme to give its notes.');
  const master = freeName(files, 'ppt/notesMasters', 'notesMaster'), copy = freeName(files, 'ppt/theme', 'theme');
  const size = descendants(root, 'notesSz')[0];
  write(files, copy, themeXml);
  addType(files, copy, TYPES.theme);
  write(files, master, notesMasterXml(Number(attr(size, 'cx')) || 6858000, Number(attr(size, 'cy')) || 9144000));
  addRel(files, master, T.theme, copy);
  addType(files, master, TYPES.notesMaster);
  const id = addRel(files, deck.main, T.notesMaster, master);
  // Schema order: sldMasterIdLst, notesMasterIdLst, handoutMasterIdLst, sldIdLst...
  const p = prefix(root, 'http://schemas.openxmlformats.org/presentationml/2006/main', 'p'), r = prefix(root, REL, 'r');
  const list = `<${p}:notesMasterIdLst><${p}:notesMasterId ${r}:id="${id}"/></${p}:notesMasterIdLst>`;
  const current = parseXml(read(files, deck.main)), top = current.children[0];
  const old = child(top, 'notesMasterIdLst'), after = child(top, 'sldMasterIdLst');
  const text = read(files, deck.main);
  if (old) write(files, deck.main, patchXml(text, [{ start: old.start, end: old.end, text: list }]));
  else if (after) write(files, deck.main, patchXml(text, [{ start: after.end, end: after.end, text: list }]));
  else write(files, deck.main, patchXml(text, [{ start: top.openEnd, end: top.openEnd, text: list }]));
  return master;
}

function setNotes(files: Package, deck: Deck, slide: string, text: string): void {
  const part = notesPart(files, slide);
  if (part && files.has(part)) {
    const xml = read(files, part), tree = parseXml(xml), a = prefix(tree.children[0], DML, 'a');
    const shape = bodyShape(tree), body = child(shape, 'txBody');
    const lang = attr(descendants(body ?? tree, 'rPr')[0] ?? descendants(body ?? tree, 'endParaRPr')[0], 'lang');
    if (body) {
      const ps = body.children.filter((n) => localName(n.name) === 'p');
      const content = paragraphs(text, a, lang);
      write(files, part, ps.length ? patchXml(xml, [{ start: ps[0].start, end: ps[ps.length - 1].end, text: content }]) : appendXmlChild(xml, body, content));
      return;
    }
    const spTree = descendants(tree, 'spTree')[0];
    if (!spTree) throw new Error('The notes of this slide could not be read.');
    if (a !== 'a' || prefix(tree.children[0], 'http://schemas.openxmlformats.org/presentationml/2006/main', 'p') !== 'p') throw new Error('The notes of this slide could not be read.');
    const next = Math.max(1, ...descendants(tree, 'cNvPr').map((n) => Number(attr(n, 'id')) || 0)) + 1;
    write(files, part, appendXmlChild(xml, spTree, NOTES_BODY(next, paragraphs(text, 'a', lang))));
    return;
  }
  if (!text) return; // no notes slide and nothing to write
  const master = ensureNotesMaster(files, deck);
  const created = freeName(files, 'ppt/notesSlides', 'notesSlide');
  write(files, created, `${HEAD}<p:notes ${NS}><p:cSld><p:spTree>${GROUP}`
    + '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp>'
    + `${NOTES_BODY(3, paragraphs(text, 'a', ''))}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`);
  addRel(files, created, T.notesMaster, master);
  addRel(files, created, T.slide, slide);
  addType(files, created, TYPES.notes);
  if (part) removeRel(files, slide, relsOf(files, slide).find((r) => r.type === T.notes)?.id ?? '');
  addRel(files, slide, T.notes, created);
}

// PowerPoint's own date form for a comment (no time zone: it reads it as UTC).
const commentDate = () => new Date().toISOString().replace(/Z$/, '');
const initials = (name: string) => name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'M';

// The comment author list of the deck (created on the first comment); returns the author's id and the comment's idx.
function authorFor(files: Package, deck: Deck, name: string): { authorId: string; idx: number } {
  let part = authorsPart(files, deck);
  if (!part || !files.has(part)) {
    part = part || 'ppt/commentAuthors.xml';
    write(files, part, `${HEAD}<p:cmAuthorLst ${NS}></p:cmAuthorLst>`);
    addType(files, part, TYPES.authors);
    if (!authorsPart(files, deck)) addRel(files, deck.main, T.authors, part);
  }
  let xml = read(files, part);
  const root = rootOf(xml), p = prefix(root, 'http://schemas.openxmlformats.org/presentationml/2006/main', 'p');
  const authors = descendants(root, 'cmAuthor');
  let author = authors.find((a) => attr(a, 'name') === name);
  if (!author) {
    const id = Math.max(-1, ...authors.map((a) => Number(attr(a, 'id')) || 0)) + 1;
    xml = appendXmlChild(xml, root, `<${p}:cmAuthor id="${id}" name="${esc(name)}" initials="${esc(initials(name))}" lastIdx="0" clrIdx="${id % 8}"/>`);
    author = descendants(parseXml(xml), 'cmAuthor').find((a) => attr(a, 'name') === name);
    if (!author) throw new Error('The comment author could not be saved.');
  }
  const idx = (Number(attr(author, 'lastIdx')) || 0) + 1;
  const tag = xml.slice(author.start, author.openEnd);
  write(files, part, patchXml(xml, [{ start: author.start, end: author.openEnd, text: setXmlAttribute(tag, 'lastIdx', String(idx)) }]));
  return { authorId: attr(author, 'id'), idx };
}

function findComment(files: Package, slide: string, id: string): { part: string; relId: string; xml: string; node: XmlNode; count: number } {
  if (id.startsWith('modern-')) throw new Error('This comment was made in a newer PowerPoint: change it in PowerPoint.');
  const rel = legacyPart(files, slide), xml = rel ? read(files, rel.target) : '';
  const all = xml ? descendants(parseXml(xml), 'cm') : [];
  const node = all.find((cm) => `${attr(cm, 'authorId')}-${attr(cm, 'idx')}` === id);
  if (!rel || !node) throw new Error('This comment is not in the presentation any more.');
  return { part: rel.target, relId: rel.id, xml, node, count: all.length };
}

const clean = (text: string, limit: number) => text.replace(/\r\n?/g, '\n').slice(0, limit);
export function isSlideChange(value: unknown): value is SlideChange {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  const slide = Number.isInteger(c.slide) && (c.slide as number) >= 0;
  const text = typeof c.text === 'string', id = typeof c.id === 'string' && (c.id as string).length < 200;
  switch (c.op) {
    case 'notes': return slide && text && (c.text as string).length <= NOTES_LIMIT;
    case 'comment': return slide && text && (c.text as string).length <= COMMENT_LIMIT && typeof c.author === 'string' && isOfficeArea(c.area) && (c.color === undefined || isOfficeColor(c.color));
    case 'edit-comment': return slide && id && text && (c.text as string).length <= COMMENT_LIMIT;
    case 'reply': return slide && id && text && (c.text as string).length <= COMMENT_LIMIT && typeof c.author === 'string';
    case 'color': return slide && id && isOfficeColor(c.color);
    case 'delete-comment': return slide && id;
    default: return false;
  }
}

export function changeSlides(buffer: Buffer, change: SlideChange): Buffer {
  if (!isSlideChange(change)) throw new Error('Invalid presentation change.');
  if (isReadOnly(buffer)) throw new Error('This presentation is signed: change it in PowerPoint.');
  const files = loadPackage(buffer), before = new Map(files), deck = deckOf(files);
  const slide = deck.slides[change.slide];
  if (!slide || !files.has(slide)) throw new Error('This slide is not in the presentation any more.');
  const notes = officeNotes(files);
  if (change.op === 'notes') setNotes(files, deck, slide, clean(change.text, NOTES_LIMIT).replace(/\s+$/, ''));
  else if (change.op === 'comment') {
    const text = clean(change.text, COMMENT_LIMIT), author = change.author.slice(0, 100) || 'Moki';
    const { authorId, idx } = authorFor(files, deck, author);
    let rel = legacyPart(files, slide);
    if (!rel || !files.has(rel.target)) {
      const part = freeName(files, 'ppt/comments', 'comment');
      write(files, part, `${HEAD}<p:cmLst ${NS}></p:cmLst>`);
      addType(files, part, TYPES.comments);
      if (!rel) addRel(files, slide, T.comments, part);
      rel = legacyPart(files, slide)!;
    }
    const xml = read(files, rel.target), root = rootOf(xml), p = prefix(root, 'http://schemas.openxmlformats.org/presentationml/2006/main', 'p');
    // The point PowerPoint shows the comment at: the top left corner of the marked area (in eighths of a point).
    const x = Math.round(change.area.x * deck.width * 8), y = Math.round(change.area.y * deck.height * 8);
    write(files, rel.target, appendXmlChild(xml, root, `<${p}:cm authorId="${authorId}" dt="${commentDate()}" idx="${idx}"><${p}:pos x="${x}" y="${y}"/><${p}:text>${esc(text)}</${p}:text></${p}:cm>`));
    saveOfficeNote(files, noteKey(slide, `${authorId}-${idx}`), { replies: [], area: change.area, ...(change.color ? { color: change.color as OfficeNote['color'] } : {}) });
  } else {
    const found = findComment(files, slide, change.id), key = noteKey(slide, change.id), note = notes[key] ?? { replies: [] };
    if (change.op === 'edit-comment') {
      const text = child(found.node, 'text');
      const value = esc(clean(change.text, COMMENT_LIMIT));
      if (text) write(files, found.part, patchXml(found.xml, [{ start: text.openEnd, end: text.closeStart, text: value }]));
      else write(files, found.part, appendXmlChild(found.xml, found.node, `<${found.node.name.replace(/cm$/, 'text')}>${value}</${found.node.name.replace(/cm$/, 'text')}>`));
    } else if (change.op === 'reply') {
      saveOfficeNote(files, key, { ...note, replies: [...note.replies, { author: change.author.slice(0, 100), at: new Date().toISOString(), text: clean(change.text, COMMENT_LIMIT) }].slice(-50) });
    } else if (change.op === 'color') {
      saveOfficeNote(files, key, { ...note, color: change.color as OfficeNote['color'] });
    } else {
      if (found.count === 1) {
        files.delete(found.part);
        removeType(files, found.part);
        removeRel(files, slide, found.relId);
      } else write(files, found.part, patchXml(found.xml, [{ start: found.node.start, end: found.node.end, text: '' }]));
      saveOfficeNote(files, key, null);
    }
  }
  const changes = new Map<string, Buffer | null>();
  for (const [name, content] of files) if (!before.get(name)?.equals(content)) changes.set(name, content);
  for (const name of before.keys()) if (!files.has(name)) changes.set(name, null);
  return changes.size ? rezip(buffer, changes) : buffer;
}
