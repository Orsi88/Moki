// Speaker notes and comments written into a .pptx: only the parts they live in change, PowerPoint's own comment format
// is used, what it has no field for goes in moki/comments.json, and stale or signed packages are refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rezip, unzip, zip } from '../scripts/lib/zip.mjs';
import { changeSlides, deckNotes } from '../scripts/lib/office-slides.ts';
import { ROOT } from '../scripts/lib/repo.mjs';
import { createProject } from '../scripts/lib/core.ts';
import { CHANGED_OUTSIDE, createService } from '../desktop/service.ts';
import { pptx, SAMPLE_DECK } from './pptx-fixture.ts';

const parts = (buffer: Buffer) => unzip(buffer) as Map<string, Buffer>;
const text = (buffer: Buffer, name: string) => parts(buffer).get(name)?.toString('utf8') ?? '';
const AREA = { x: 0.5, y: 0.25, w: 0.3, h: 0.2 };

test('rezip keeps unchanged entries byte for byte and applies additions, replacements and removals', () => {
  const before = zip([['a.xml', '<a/>'], ['media/pic.png', Buffer.alloc(5000, 7)], ['b.xml', '<b/>']]);
  const after = rezip(before, new Map<string, Buffer | null>([['a.xml', Buffer.from('<a>new</a>')], ['b.xml', null], ['c.xml', Buffer.from('<c/>')]]));
  const files = parts(after);
  assert.deepEqual([...files.keys()], ['media/pic.png', 'a.xml', 'c.xml']);
  assert.equal(files.get('a.xml')!.toString(), '<a>new</a>');
  assert.deepEqual(files.get('media/pic.png'), Buffer.alloc(5000, 7));
  // The picture's compressed bytes are copied, not compressed again.
  assert.ok(after.includes(before.subarray(before.indexOf('media/pic.png') + 'media/pic.png'.length, before.indexOf('media/pic.png') + 'media/pic.png'.length + 20)));
});

test('notes are read slide by slide and an edit changes only that notes slide', () => {
  const before = pptx(SAMPLE_DECK);
  assert.deepEqual(deckNotes(before).slides.map((s) => s.notes), ['Falar sobre o objetivo.', '', '']);
  const after = changeSlides(before, { op: 'notes', slide: 0, text: 'Primeira linha\n\nTerceira & <última>' });
  assert.equal(deckNotes(after).slides[0].notes, 'Primeira linha\n\nTerceira & <última>');
  assert.match(text(after, 'ppt/notesSlides/notesSlide1.xml'), /<a:rPr lang="pt-BR" dirty="0"\/><a:t>Terceira &amp; &lt;última&gt;<\/a:t>/);
  for (const [name, content] of parts(before)) if (name !== 'ppt/notesSlides/notesSlide1.xml') assert.deepEqual(parts(after).get(name), content, name);
  // Clearing keeps the notes slide with one empty paragraph.
  assert.equal(deckNotes(changeSlides(after, { op: 'notes', slide: 0, text: '' })).slides[0].notes, '');
});

test('a slide without notes gets a notes slide, and a deck without a notes master gets one with a copy of its theme', () => {
  const after = changeSlides(pptx(SAMPLE_DECK), { op: 'notes', slide: 1, text: 'Nota nova' });
  const files = parts(after);
  assert.equal(deckNotes(after).slides[1].notes, 'Nota nova');
  assert.ok(files.has('ppt/notesMasters/notesMaster1.xml'));
  assert.deepEqual(files.get('ppt/theme/theme2.xml'), files.get('ppt/theme/theme1.xml'));
  assert.match(text(after, 'ppt/presentation.xml'), /<\/p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId\d+"\/><\/p:notesMasterIdLst><p:sldIdLst>/);
  assert.match(text(after, 'ppt/slides/_rels/slide2.xml.rels'), /relationships\/notesSlide" Target="..\/notesSlides\/notesSlide2.xml"/);
  assert.match(text(after, 'ppt/notesSlides/_rels/notesSlide2.xml.rels'), /notesMaster" Target="..\/notesMasters\/notesMaster1.xml"/);
  for (const part of ['/ppt/notesSlides/notesSlide2.xml', '/ppt/notesMasters/notesMaster1.xml', '/ppt/theme/theme2.xml']) assert.ok(text(after, '[Content_Types].xml').includes(`PartName="${part}"`), part);
  // A second slide reuses the master.
  const again = changeSlides(after, { op: 'notes', slide: 2, text: 'Outra' });
  assert.equal([...parts(again).keys()].filter((name) => name.startsWith('ppt/notesMasters/') && name.endsWith('.xml')).length, 1);
  // Writing nothing on a slide without notes changes nothing.
  const deck = pptx(SAMPLE_DECK);
  assert.equal(changeSlides(deck, { op: 'notes', slide: 1, text: '  ' }), deck);
});

test('notes with bold or bullets are flagged, since plain text editing does not keep them', () => {
  const files = parts(pptx(SAMPLE_DECK));
  files.set('ppt/notesSlides/notesSlide1.xml', Buffer.from(text(pptx(SAMPLE_DECK), 'ppt/notesSlides/notesSlide1.xml').replace('<a:rPr lang="pt-BR" sz="1200"/>', '<a:rPr lang="pt-BR" b="1"/>')));
  assert.equal(deckNotes(zip([...files])).slides[0].formatted, true);
  assert.equal(deckNotes(pptx(SAMPLE_DECK)).slides[0].formatted, false);
});

test('comments use PowerPoint\'s format, keep area, color and replies in moki/comments.json, and are removed cleanly', () => {
  let deck = changeSlides(pptx(SAMPLE_DECK), { op: 'comment', slide: 1, text: 'Ver esta área', author: 'ana', color: 'green', area: AREA });
  deck = changeSlides(deck, { op: 'comment', slide: 1, text: 'O slide todo', author: 'ana', area: { x: 0, y: 0, w: 1, h: 1 } });
  deck = changeSlides(deck, { op: 'comment', slide: 1, text: 'Outra pessoa', author: 'bia', area: AREA });
  // Point at the area's corner, in eighths of a point of a 960 x 540 pt slide.
  assert.match(text(deck, 'ppt/comments/comment1.xml'), /<p:cm authorId="0" dt="[\d-]+T[\d:.]+" idx="1"><p:pos x="3840" y="1080"\/><p:text>Ver esta área<\/p:text><\/p:cm>/);
  assert.match(text(deck, 'ppt/commentAuthors.xml'), /<p:cmAuthor id="0" name="ana" initials="A" lastIdx="2" clrIdx="0"\/><p:cmAuthor id="1" name="bia" initials="B" lastIdx="1" clrIdx="1"\/>/);
  assert.match(text(deck, 'ppt/slides/_rels/slide2.xml.rels'), /relationships\/comments" Target="..\/comments\/comment1.xml"/);
  assert.match(text(deck, 'ppt/_rels/presentation.xml.rels'), /relationships\/commentAuthors" Target="commentAuthors.xml"/);
  deck = changeSlides(deck, { op: 'reply', slide: 1, id: '0-1', text: 'Concordo', author: 'bia' });
  deck = changeSlides(deck, { op: 'color', slide: 1, id: '0-2', color: 'pink' });
  deck = changeSlides(deck, { op: 'edit-comment', slide: 1, id: '0-1', text: 'Ver esta área, por favor' });
  const comments = deckNotes(deck).slides[1].comments;
  assert.deepEqual(comments.map((c) => [c.id, c.author, c.text, c.color ?? '', c.replies?.map((r) => r.text) ?? []]), [
    ['0-1', 'ana', 'Ver esta área, por favor', 'green', ['Concordo']], ['0-2', 'ana', 'O slide todo', 'pink', []], ['1-1', 'bia', 'Outra pessoa', '', []]]);
  assert.deepEqual(comments[0].area, AREA);
  assert.deepEqual(deckNotes(deck).slides[0].comments, []);
  assert.throws(() => changeSlides(deck, { op: 'delete-comment', slide: 0, id: '0-1' }), /not in the presentation/);
  for (const id of ['0-1', '0-2', '1-1']) deck = changeSlides(deck, { op: 'delete-comment', slide: 1, id });
  const files = parts(deck);
  assert.equal(files.has('ppt/comments/comment1.xml'), false);
  assert.equal(files.has('moki/comments.json'), false);
  assert.doesNotMatch(text(deck, 'ppt/slides/_rels/slide2.xml.rels'), /comments/);
  assert.doesNotMatch(text(deck, '[Content_Types].xml'), /comment1\.xml|moki\/comments\.json/);
});

test('a comment made in PowerPoint without an area shows at its point; newer threaded comments are shown read-only', () => {
  const files = parts(pptx(SAMPLE_DECK));
  const rels = text(pptx(SAMPLE_DECK), 'ppt/slides/_rels/slide1.xml.rels').replace('</Relationships>',
    '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="../comments/comment1.xml"/>'
    + '<Relationship Id="rId10" Type="http://schemas.microsoft.com/office/2018/10/relationships/comments" Target="../comments/modernComment_1.xml"/></Relationships>');
  files.set('ppt/slides/_rels/slide1.xml.rels', Buffer.from(rels));
  files.set('ppt/comments/comment1.xml', Buffer.from('<p:cmLst xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cm authorId="3" dt="2024-02-01T10:00:00.000" idx="4"><p:pos x="3840" y="2160"/><p:text>Do PowerPoint</p:text></p:cm></p:cmLst>'));
  files.set('ppt/commentAuthors.xml', Buffer.from('<p:cmAuthorLst xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cmAuthor id="3" name="Carla" initials="C" lastIdx="4" clrIdx="0"/></p:cmAuthorLst>'));
  files.set('ppt/_rels/presentation.xml.rels', Buffer.from(text(pptx(SAMPLE_DECK), 'ppt/_rels/presentation.xml.rels').replace('</Relationships>', '<Relationship Id="rId90" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/commentAuthors" Target="commentAuthors.xml"/></Relationships>')));
  files.set('ppt/comments/modernComment_1.xml', Buffer.from('<p188:cmLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p188="http://schemas.microsoft.com/office/powerpoint/2018/8/main"><p188:cm id="{A1}" authorId="{U1}" created="2025-05-05T08:00:00.000"><p188:replyLst><p188:reply id="{R1}" authorId="{U2}" created="2025-05-05T09:00:00.000"><p188:txBody><a:bodyPr/><a:p><a:r><a:t>Resposta nova</a:t></a:r></a:p></p188:txBody></p188:reply></p188:replyLst><p188:txBody><a:bodyPr/><a:p><a:r><a:t>Comentário novo</a:t></a:r></a:p></p188:txBody></p188:cm></p188:cmLst>'));
  files.set('ppt/authors.xml', Buffer.from('<p188:authorLst xmlns:p188="http://schemas.microsoft.com/office/powerpoint/2018/8/main"><p188:author id="{U1}" name="Davi"/><p188:author id="{U2}" name="Eva"/></p188:authorLst>'));
  const deck = zip([...files]);
  const [legacy, modern] = deckNotes(deck).slides[0].comments;
  assert.deepEqual([legacy.id, legacy.author, legacy.text, legacy.date, legacy.pin], ['3-4', 'Carla', 'Do PowerPoint', '2024-02-01T10:00:00.000Z', { x: 0.5, y: 0.5 }]);
  assert.deepEqual([modern.author, modern.text, modern.readOnly, modern.replies], ['Davi', 'Comentário novo', true, [{ author: 'Eva', at: '2025-05-05T09:00:00.000Z', text: 'Resposta nova' }]]);
  assert.throws(() => changeSlides(deck, { op: 'delete-comment', slide: 0, id: modern.id }), /newer PowerPoint/);
  // A reply to the PowerPoint comment is added by Moki without touching its text.
  const replied = changeSlides(deck, { op: 'reply', slide: 0, id: '3-4', text: 'Visto', author: 'ana' });
  assert.deepEqual(deckNotes(replied).slides[0].comments[0].replies?.map((r) => r.text), ['Visto']);
  assert.deepEqual(parts(replied).get('ppt/comments/comment1.xml'), files.get('ppt/comments/comment1.xml'));
});

test('signed presentations and invalid changes are refused', () => {
  const files = parts(pptx(SAMPLE_DECK)); files.set('_xmlsignatures/sig1.xml', Buffer.from('<signature/>'));
  const signed = zip([...files]);
  assert.equal(deckNotes(signed).readOnly, true);
  assert.throws(() => changeSlides(signed, { op: 'notes', slide: 0, text: 'x' }), /signed/);
  const deck = pptx(SAMPLE_DECK);
  assert.throws(() => changeSlides(deck, { op: 'notes', slide: 9, text: 'x' }), /not in the presentation/);
  assert.throws(() => changeSlides(deck, { op: 'comment', slide: 0, text: 'x', author: 'a', area: { x: 0.9, y: 0, w: 0.5, h: 0.1 } }), /Invalid/);
  assert.throws(() => changeSlides(deck, { op: 'notes', slide: 0, text: 'x'.repeat(20001) }), /Invalid/);
});

test('the slide notes service refuses stale writes, other file types and paths outside the project', async () => {
  const root = mkdtempSync(join(tmpdir(), 'moki-slide-notes-'));
  try {
    cpSync(join(ROOT, 'templates'), join(root, 'templates'), { recursive: true });
    createProject('acme', 'Acme', root);
    const folder = join(root, 'workspace', 'projects', 'acme', 'inbox'); mkdirSync(folder, { recursive: true });
    const file = join(folder, 'deck.pptx'); writeFileSync(file, pptx(SAMPLE_DECK));
    writeFileSync(join(folder, 'notes.txt'), 'text');
    const service = createService(root, { launch: () => ({ opened: false, message: '' }), openPath: () => {}, openFolder: () => {}, home: root });
    const first = service.slideNotes('acme', 'inbox/deck.pptx');
    assert.match(first.version, /^[a-f0-9]{64}$/);
    const next = service.editSlides('acme', 'inbox/deck.pptx', first.version, { op: 'comment', slide: 0, text: 'Oi', area: AREA, author: 'spoofed' });
    assert.equal(next.slides[0].comments[0].text, 'Oi');
    assert.notEqual(next.slides[0].comments[0].author, 'spoofed'); // the computer's user name, never the caller's
    assert.equal(next.version, service.slideNotes('acme', 'inbox/deck.pptx').version);
    const saved = readFileSync(file);
    assert.throws(() => service.editSlides('acme', 'inbox/deck.pptx', first.version, { op: 'notes', slide: 0, text: 'Stale' }), new RegExp(CHANGED_OUTSIDE));
    assert.deepEqual(readFileSync(file), saved);
    assert.throws(() => service.slideNotes('acme', 'inbox/notes.txt'), /PowerPoint/);
    assert.throws(() => service.slideNotes('acme', '../other.pptx'), /outside/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
