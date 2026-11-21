// A small but complete .pptx built in code (the repository keeps no binary fixtures): master, layout, theme and slides
// with a title, a bulleted body inherited from the master, a filled shape, a table and speaker notes.
import { zip } from '../scripts/lib/zip.mjs';

const P = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const EMU = 12700; // per point
const rels = (items: [string, string, string][]) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('')}</Relationships>`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xfrm = (x: number, y: number, w: number, h: number) => `<a:xfrm><a:off x="${x * EMU}" y="${y * EMU}"/><a:ext cx="${w * EMU}" cy="${h * EMU}"/></a:xfrm>`;
const run = (text: string, size = 2800) => `<a:r><a:rPr lang="pt-BR" sz="${size}"/><a:t>${esc(text)}</a:t></a:r>`;
const tree = (shapes: string) => `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${shapes}</p:spTree>`;

export interface FixtureSlide { title: string; bullets?: string[]; shape?: string; table?: string[][]; notes?: string }

function slideXml(s: FixtureSlide): string {
  let id = 2;
  const shapes: string[] = [];
  shapes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id++}" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr>${xfrm(66, 28, 828, 104)}</p:spPr><p:txBody><a:bodyPr/><a:p>${run(s.title, 4400)}</a:p></p:txBody></p:sp>`);
  if (s.bullets) shapes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id++}" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr>${xfrm(66, 144, 500, 340)}</p:spPr><p:txBody><a:bodyPr/>${s.bullets.map((b) => `<a:p>${run(b)}</a:p>`).join('')}</p:txBody></p:sp>`);
  if (s.shape) shapes.push(`<p:sp><p:nvSpPr><p:cNvPr id="${id++}" name="Box"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>${xfrm(600, 300, 200, 120)}<a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FF9933"/></a:solidFill></p:spPr><p:txBody><a:bodyPr anchor="ctr"/><a:p><a:pPr algn="ctr"/>${run(s.shape, 1800)}</a:p></p:txBody></p:sp>`);
  if (s.table) {
    const cols = s.table[0].length, col = Math.round((600 / cols) * EMU);
    const grid = Array.from({ length: cols }, () => `<a:gridCol w="${col}"/>`).join('');
    const rows = s.table.map((row) => `<a:tr h="${40 * EMU}">${row.map((cell) => `<a:tc><a:txBody><a:bodyPr/><a:p>${run(cell, 1800)}</a:p></a:txBody><a:tcPr/></a:tc>`).join('')}</a:tr>`).join('');
    shapes.push(`<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id++}" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm><a:off x="${80 * EMU}" y="${150 * EMU}"/><a:ext cx="${600 * EMU}" cy="${120 * EMU}"/></p:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="1" bandRow="1"/><a:tblGrid>${grid}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${P}><p:cSld>${tree(shapes.join(''))}</p:cSld></p:sld>`;
}

const notesXml = (text: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notes ${P}><p:cSld>${tree(`<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:p>${run(text, 1200)}</a:p></p:txBody></p:sp>`)}</p:cSld></p:notes>`;

const solid = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
const THEME = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Moki"><a:themeElements><a:clrScheme name="Moki"><a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="0E2841"/></a:dk2><a:lt2><a:srgbClr val="E8E8E8"/></a:lt2><a:accent1><a:srgbClr val="156082"/></a:accent1><a:accent2><a:srgbClr val="E97132"/></a:accent2><a:accent3><a:srgbClr val="196B24"/></a:accent3><a:accent4><a:srgbClr val="0F9ED5"/></a:accent4><a:accent5><a:srgbClr val="A02B93"/></a:accent5><a:accent6><a:srgbClr val="4EA72E"/></a:accent6><a:hlink><a:srgbClr val="467886"/></a:hlink><a:folHlink><a:srgbClr val="96607D"/></a:folHlink></a:clrScheme><a:fontScheme name="Moki"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Moki"><a:fillStyleLst>${solid}${solid}${solid}</a:fillStyleLst><a:lnStyleLst><a:ln w="6350">${solid}</a:ln><a:ln w="12700">${solid}</a:ln><a:ln w="19050">${solid}</a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>${solid}${solid}${solid}</a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>`;
const MASTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster ${P}><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>${tree('')}</p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr marL="228600" indent="-228600"><a:buFont typeface="Arial"/><a:buChar char="•"/><a:defRPr sz="2800"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles></p:sldMaster>`;
const LAYOUT = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout ${P} type="obj"><p:cSld name="Title and Content">${tree('')}</p:cSld></p:sldLayout>`;
const CT = 'application/vnd.openxmlformats-officedocument';

export function pptx(slides: FixtureSlide[]): Buffer {
  const entries: [string, string][] = [];
  const types = ['<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>', '<Default Extension="xml" ContentType="application/xml"/>',
    `<Override PartName="/ppt/presentation.xml" ContentType="${CT}.presentationml.presentation.main+xml"/>`,
    `<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="${CT}.presentationml.slideMaster+xml"/>`,
    `<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="${CT}.presentationml.slideLayout+xml"/>`,
    `<Override PartName="/ppt/theme/theme1.xml" ContentType="${CT}.theme+xml"/>`];
  slides.forEach((s, i) => {
    const n = i + 1;
    types.push(`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="${CT}.presentationml.slide+xml"/>`);
    entries.push([`ppt/slides/slide${n}.xml`, slideXml(s)]);
    const slideRels: [string, string, string][] = [['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']];
    if (s.notes) {
      types.push(`<Override PartName="/ppt/notesSlides/notesSlide${n}.xml" ContentType="${CT}.presentationml.notesSlide+xml"/>`);
      entries.push([`ppt/notesSlides/notesSlide${n}.xml`, notesXml(s.notes)]);
      entries.push([`ppt/notesSlides/_rels/notesSlide${n}.xml.rels`, rels([['rId1', 'slide', `../slides/slide${n}.xml`]])]);
      slideRels.push(['rId2', 'notesSlide', `../notesSlides/notesSlide${n}.xml`]);
    }
    entries.push([`ppt/slides/_rels/slide${n}.xml.rels`, rels(slideRels)]);
  });
  entries.push(['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${types.join('')}</Types>`]);
  entries.push(['_rels/.rels', rels([['rId1', 'officeDocument', 'ppt/presentation.xml']])]);
  entries.push(['ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation ${P}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 3}"/>`).join('')}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/></p:presentation>`]);
  entries.push(['ppt/_rels/presentation.xml.rels', rels([['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'], ['rId2', 'theme', 'theme/theme1.xml'], ...slides.map((_, i): [string, string, string] => [`rId${i + 3}`, 'slide', `slides/slide${i + 1}.xml`])])]);
  entries.push(['ppt/slideMasters/slideMaster1.xml', MASTER]);
  entries.push(['ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ['rId2', 'theme', '../theme/theme1.xml']])]);
  entries.push(['ppt/slideLayouts/slideLayout1.xml', LAYOUT]);
  entries.push(['ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']])]);
  entries.push(['ppt/theme/theme1.xml', THEME]);
  return zip(entries);
}

export const SAMPLE_DECK: FixtureSlide[] = [
  { title: 'Projeto Libélula', shape: 'Forma laranja', notes: 'Falar sobre o objetivo.' },
  { title: 'Tópicos', bullets: ['Primeiro ponto', 'Segundo ponto'] },
  { title: 'Tabela', table: [['Item', 'Status'], ['Login', 'OK']] },
];
