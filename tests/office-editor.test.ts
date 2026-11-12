// Native Office edits must preserve unrelated parts, visual styles and existing comments, and reject stale saves.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zip, unzip } from '../scripts/lib/zip.mjs';
import { changeWord, wordDocument } from '../scripts/lib/office-word.ts';
import { changeSheet, workbookInfo } from '../scripts/lib/office-sheet.ts';
import { parseXml } from '../scripts/lib/office-xml.ts';
import { buildXlsx } from '../scripts/xlsx.mjs';
import { ROOT } from '../scripts/lib/repo.mjs';
import { createProject } from '../scripts/lib/core.ts';
import { CHANGED_OUTSIDE, createService } from '../desktop/service.ts';
import { convertLegacy } from '../desktop/office-convert.ts';

const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const word = (paragraph = '<w:p><w:pPr><w:pStyle w:val="Title"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Hello </w:t></w:r><w:r><w:rPr><w:i/><w:color w:val="AA1100"/></w:rPr><w:t>world</w:t></w:r></w:p>') => zip([
  ['word/document.xml', `<w:document xmlns:w="${ns}"><w:body>${paragraph}<w:sectPr/></w:body></w:document>`],
  ['word/styles.xml', `<w:styles xmlns:w="${ns}"><w:style w:type="paragraph" w:styleId="Title"><w:rPr><w:rFonts w:ascii="Georgia"/><w:sz w:val="32"/></w:rPr><w:pPr><w:jc w:val="center"/></w:pPr></w:style></w:styles>`],
  ['word/header1.xml', '<unchanged>Company header</unchanged>'],
  ['[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'],
]);
const book = () => buildXlsx({ sheets: [{ key: 'data', title: 'Data', columns: [{ key: 'name', label: 'Name' }, { key: 'value', label: 'Value' }] }] }, { data: [{ name: 'Original', value: '42' }] });
const parts = (buffer: Buffer) => unzip(buffer) as Map<string, Buffer>;

test('Word preview keeps run fonts, sizes, colors and paragraph alignment; a text edit keeps other styles and parts', () => {
  const before = word(), model = wordDocument(before);
  assert.match(model.html, /font-family:&quot;Georgia&quot;/);
  assert.match(model.html, /font-size:16pt/);
  assert.match(model.html, /text-align:center/);
  assert.match(model.html, /font-weight:700/);
  assert.match(model.html, /color:#AA1100/);
  const after = changeWord(before, { op: 'text', paragraph: '0', text: 'Hello beautiful world' });
  assert.equal(wordDocument(after).paragraphs[0].text, 'Hello beautiful world');
  assert.match(parts(after).get('word/document.xml')!.toString(), /<w:i\/><w:color w:val="AA1100"\/>/);
  for (const name of ['word/styles.xml', 'word/header1.xml', '[Content_Types].xml']) assert.deepEqual(parts(after).get(name), parts(before).get(name));
});

test('Word edits preserve the text when deletions cross runs, when inserting at their boundary, and when the paragraph is empty', () => {
  for (const text of ['Hi world', 'Hello world!', 'Hello there world', '', '<script> & "literal"', '🙂 world']) {
    assert.equal(wordDocument(changeWord(word(), { op: 'text', paragraph: '0', text })).paragraphs[0].text, text);
  }
  const empty = changeWord(word('<w:p/>'), { op: 'text', paragraph: '0', text: 'First words' });
  assert.equal(wordDocument(empty).paragraphs[0].text, 'First words');
});

test('Word comments are native package parts with an anchor and can be removed without changing the text', () => {
  const before = word();
  const commented = changeWord(before, { op: 'comment', paragraph: '0', author: 'Ana', text: 'Check <this> & that.' });
  const model = wordDocument(commented);
  assert.deepEqual(model.comments.map((c) => [c.author, c.text, c.anchor]), [['Ana', 'Check <this> & that.', '0']]);
  assert.match(parts(commented).get('word/_rels/document.xml.rels')!.toString(), /relationships\/comments/);
  const deleted = changeWord(commented, { op: 'delete-comment', id: model.comments[0].id });
  assert.deepEqual(wordDocument(deleted).comments, []);
  assert.equal(wordDocument(deleted).paragraphs[0].text, 'Hello world');
  assert.deepEqual(parts(deleted).get('word/styles.xml'), parts(before).get('word/styles.xml'));
});

test('Word selection comments keep exact native ranges across styled runs, overlapping comments and later text edits', () => {
  for (const range of [{ start: 1, end: 4 }, { start: 6, end: 11 }, { start: 3, end: 9 }, { start: 0, end: 11 }]) {
    const before = word(), after = changeWord(before, { op: 'comment', paragraph: '0', range, author: 'Ana', text: 'Selected words', color: 'green' });
    const model = wordDocument(after), xml = parts(after).get('word/document.xml')!.toString();
    assert.deepEqual(model.comments[0].range, range);
    assert.equal(model.paragraphs[0].text, 'Hello world');
    assert.match(xml, /<w:b\/>/); assert.match(xml, /<w:i\/><w:color w:val="AA1100"\/>/);
    for (const name of ['word/styles.xml', 'word/header1.xml']) assert.deepEqual(parts(after).get(name), parts(before).get(name));
    const overlap = changeWord(after, { op: 'comment', paragraph: '0', range: { start: 2, end: 8 }, author: 'Bia', text: 'Overlapping words' });
    assert.deepEqual(wordDocument(overlap).comments.map((c) => c.range), [range, { start: 2, end: 8 }]);
    const removed = changeWord(overlap, { op: 'delete-comment', id: model.comments[0].id });
    assert.equal(wordDocument(removed).paragraphs[0].text, 'Hello world');
    assert.deepEqual(wordDocument(removed).comments[0].range, { start: 2, end: 8 });
  }
  const selected = changeWord(word(), { op: 'comment', paragraph: '0', range: { start: 6, end: 11 }, author: 'Ana', text: 'World' });
  const edited = wordDocument(changeWord(selected, { op: 'text', paragraph: '0', text: 'Dear Hello world' }));
  assert.deepEqual(edited.comments[0].range, { start: 11, end: 16 });
});

test('Word selection comments preserve line breaks, tabs, XML entities and non-text run content, and reject invalid ranges', () => {
  const before = word('<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>A &amp; B</w:t><w:tab/><w:t>Next</w:t><w:br/><w:t>🙂 End</w:t><w:drawing/></w:r></w:p>');
  const originalText = wordDocument(before).paragraphs[0].text;
  for (const range of [{ start: 2, end: 11 }, { start: 0, end: originalText.length }, { start: 11, end: 13 }]) {
    const after = changeWord(before, { op: 'comment', paragraph: '0', range, author: 'Ana', text: 'Range' });
    assert.equal(wordDocument(after).paragraphs[0].text, originalText);
    assert.deepEqual(wordDocument(after).comments[0].range, range);
    assert.equal((parts(after).get('word/document.xml')!.toString().match(/<w:drawing\/>/g) ?? []).length, 1);
  }
  for (const range of [{ start: -1, end: 3 }, { start: 2, end: 2 }, { start: 0.5, end: 3 }, { start: 0, end: 100 }, { start: 12, end: 15 }]) {
    assert.throws(() => changeWord(before, { op: 'comment', paragraph: '0', range, author: 'Ana', text: 'Invalid' }), /Select some text/);
  }
});

test('a paragraph can be marked and a new paragraph can be added after it', () => {
  const bold = changeWord(word(), { op: 'format', paragraph: '0', mark: 'b' });
  const xml = parts(bold).get('word/document.xml')!.toString();
  assert.match(xml, /<w:b\/><\/w:rPr><w:t>Hello /);
  assert.match(xml, /<w:b\/><w:i\/>/);
  const plain = changeWord(bold, { op: 'format', paragraph: '0', mark: 'b' });
  assert.doesNotMatch(parts(plain).get('word/document.xml')!.toString(), /<w:b\/>/);
  const added = changeWord(word(), { op: 'insert', after: '0', text: 'Next line' });
  assert.deepEqual(wordDocument(added).paragraphs.map((paragraph) => paragraph.text), ['Hello world', 'Next line']);
});

test('Word and spreadsheet comments keep a color and replies with the native text', () => {
  const commented = changeWord(word(), { op: 'comment', paragraph: '0', author: 'Ana', text: 'Look', color: 'yellow' });
  const first = wordDocument(commented).comments[0];
  assert.equal(first.text, 'Look');
  assert.equal(first.color, 'yellow');
  const edited = changeWord(changeWord(commented, { op: 'reply', id: first.id, author: 'Luis', text: 'Agreed' }), { op: 'edit-comment', id: first.id, text: 'Look again' });
  const after = wordDocument(edited).comments[0];
  assert.equal(after.text, 'Look again');
  assert.equal(after.color, 'yellow');
  assert.equal(after.replies?.[0]?.text, 'Agreed');
  assert.equal(wordDocument(changeWord(edited, { op: 'delete-comment', id: first.id })).comments.length, 0);
  const noted = changeSheet(book(), { op: 'comment', sheet: 0, ref: 'B2', author: 'Ana', text: 'Confirm', color: 'blue' });
  const note = workbookInfo(noted).sheets[0].comments[0];
  assert.equal(note.text, 'Confirm');
  assert.equal(note.color, 'blue');
  assert.equal(note.author, 'Ana');
  const replied = workbookInfo(changeSheet(noted, { op: 'reply', sheet: 0, ref: 'B2', author: 'Luis', text: 'Done' })).sheets[0].comments[0];
  assert.equal(replied.replies?.[0]?.text, 'Done');
  assert.equal(replied.author, 'Ana');
});

test('Word fields and tracked changes cannot be flattened by an edit; XML entities never expand', () => {
  const field = word('<w:p><w:r><w:fldChar w:fldCharType="begin"/><w:t>Field</w:t></w:r></w:p>');
  assert.equal(wordDocument(field).paragraphs[0].editable, false);
  assert.throws(() => changeWord(field, { op: 'text', paragraph: '0', text: 'Replace' }), /Word processor/);
  assert.throws(() => parseXml('<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///secret">]><x/>'), /declarations/);
});

test('spreadsheet preview reads fonts and fills; editing a value preserves styles, other cells and sheets', () => {
  const before = book(), model = workbookInfo(before);
  assert.equal(model.sheets[0].cells.A1.style.fontWeight, '700');
  assert.match(model.sheets[0].cells.A1.style.backgroundColor, /^#[\da-f]{6}$/i);
  const after = changeSheet(before, { op: 'cell', sheet: 0, ref: 'B2', value: '73.5' });
  assert.equal(workbookInfo(after).sheets[0].cells.B2.value, '73.5');
  assert.equal(workbookInfo(after).sheets[0].cells.A2.value, 'Original');
  assert.deepEqual(parts(after).get('xl/styles.xml'), parts(before).get('xl/styles.xml'));
});

test('spreadsheet notes are native comments and VML, with one note per cell and no sidecar', () => {
  const before = book();
  const added = changeSheet(before, { op: 'comment', sheet: 0, ref: 'B2', text: 'Confirm the value.', author: 'Ana' });
  assert.deepEqual(workbookInfo(added).sheets[0].comments.map((c) => [c.anchor, c.text, c.author]), [['B2', 'Confirm the value.', 'Ana']]);
  assert.ok([...parts(added).keys()].some((name) => name.endsWith('.vml')));
  const updated = changeSheet(added, { op: 'comment', sheet: 0, ref: 'B2', text: 'Confirmed.', author: 'Bia' });
  assert.equal(workbookInfo(updated).sheets[0].comments.length, 1);
  assert.equal(workbookInfo(updated).sheets[0].comments[0].text, 'Confirmed.');
  const removed = changeSheet(updated, { op: 'delete-comment', sheet: 0, ref: 'B2' });
  assert.deepEqual(workbookInfo(removed).sheets[0].comments, []);
  assert.equal(workbookInfo(removed).sheets[0].cells.B2.value, '42');
});

test('spreadsheet edits add missing cells and formulas in place and request recalculation, without changing the style part', () => {
  const before = book();
  const after = changeSheet(before, { op: 'cell', sheet: 0, ref: 'C3', value: '=SUM(B2:B2)' });
  assert.equal(workbookInfo(after).sheets[0].cells.C3.formula, '=SUM(B2:B2)');
  assert.match(parts(after).get('xl/workbook.xml')!.toString(), /fullCalcOnLoad="1"/);
  assert.deepEqual(parts(after).get('xl/styles.xml'), parts(before).get('xl/styles.xml'));
  assert.throws(() => changeSheet(before, { op: 'cell', sheet: 0, ref: 'XFE1', value: 'invalid' }), /Invalid cell/);
});

test('Office service refuses stale writes and paths outside the active project', async () => {
  const root = mkdtempSync(join(tmpdir(), 'moki-office-'));
  try {
    cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
    createProject('acme', 'Acme', root);
    const folder = join(root, 'workspace', 'projects', 'acme', 'inbox'); mkdirSync(folder, { recursive: true });
    const file = join(folder, 'test.docx'); writeFileSync(file, word());
    const service = createService(root, { launch: () => ({ opened: false, message: '' }), openPath: () => {}, openFolder: () => {}, home: root });
    const first = await service.readFile('acme', 'inbox/test.docx'); assert.equal(first.kind, 'docx');
    if (first.kind !== 'docx') return;
    assert.ok(first.version);
    await service.editOffice('acme', 'inbox/test.docx', first.version, { op: 'text', paragraph: '0', text: 'Changed inside Moki' });
    const saved = readFileSync(file);
    await assert.rejects(service.editOffice('acme', 'inbox/test.docx', first.version, { op: 'text', paragraph: '0', text: 'Stale edit' }), new RegExp(CHANGED_OUTSIDE));
    assert.deepEqual(readFileSync(file), saved);
    await assert.rejects(service.editOffice('acme', '../other.docx', first.version, { op: 'text', paragraph: '0', text: 'Outside' }), /outside/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('protected and signed Office packages cannot be changed', () => {
  const protectedWord = parts(word());
  protectedWord.set('word/settings.xml', Buffer.from(`<w:settings xmlns:w="${ns}"><w:documentProtection w:enforcement="1" w:edit="readOnly"/></w:settings>`));
  const doc = zip([...protectedWord]);
  assert.equal(wordDocument(doc).readOnly, true);
  assert.throws(() => changeWord(doc, { op: 'text', paragraph: '0', text: 'Replace' }), /protected/);
  const signed = parts(book()); signed.set('_xmlsignatures/sig1.xml', Buffer.from('<signature/>'));
  assert.equal(workbookInfo(zip([...signed])).readOnly, true);
  assert.throws(() => changeSheet(zip([...signed]), { op: 'cell', sheet: 0, ref: 'A1', value: 'Replace' }), /signed/);
  const protectedSheet = parts(book());
  const path = 'xl/worksheets/sheet1.xml';
  protectedSheet.set(path, Buffer.from(protectedSheet.get(path)!.toString().replace('</worksheet>', '<sheetProtection sheet="1"/></worksheet>')));
  assert.throws(() => changeSheet(zip([...protectedSheet]), { op: 'cell', sheet: 0, ref: 'A1', value: 'Replace' }), /protected/);
});

test('opening a legacy document converts once and the next open uses that copy', async () => {
  const root = mkdtempSync(join(tmpdir(), 'moki-convert-once-'));
  try {
    cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
    createProject('acme', 'Acme', root);
    const folder = join(root, 'workspace', 'projects', 'acme', 'inbox'); mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, 'old.doc'), 'Legacy original');
    let calls = 0;
    const service = createService(root, {
      launch: () => ({ opened: false, message: '' }), openPath: () => {}, openFolder: () => {}, home: root,
      convertOffice: async (_source, destination) => { calls += 1; writeFileSync(destination, word()); },
    });
    const first = await service.convertOffice('acme', 'inbox/old.doc');
    assert.deepEqual(first, { path: 'inbox/old.docx', created: true });
    assert.equal(readFileSync(join(folder, 'old.doc'), 'utf8'), 'Legacy original');
    assert.equal(wordDocument(readFileSync(join(folder, 'old.docx'))).paragraphs[0].text, 'Hello world');
    const second = await service.convertOffice('acme', 'inbox/old.doc');
    assert.deepEqual(second, { path: 'inbox/old.docx', created: false });
    assert.equal(calls, 1);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('legacy conversion preserves the original and refuses to overwrite an existing destination', async () => {
  const root = mkdtempSync(join(tmpdir(), 'moki-convert-test-'));
  try {
    const input = join(root, 'old.doc'), output = join(root, 'old.docx');
    writeFileSync(input, 'Legacy original');
    let temporary = '';
    const engine = async (source: string, destination: string, kind: string) => { temporary = source; assert.equal(readFileSync(source, 'utf8'), 'Legacy original'); assert.equal(kind, 'doc'); writeFileSync(destination, word()); };
    await convertLegacy(input, output, engine);
    assert.equal(readFileSync(input, 'utf8'), 'Legacy original');
    assert.equal(wordDocument(readFileSync(output)).paragraphs[0].text, 'Hello world');
    const originalOutput = readFileSync(output);
    await assert.rejects(convertLegacy(input, output, engine), /exist/i);
    assert.deepEqual(readFileSync(output), originalOutput);
    assert.throws(() => readFileSync(temporary), /ENOENT/);
    await assert.rejects(convertLegacy(input, join(root, 'bad.docx'), async (_a, b) => { writeFileSync(b, 'invalid'); }), /valid converted/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
