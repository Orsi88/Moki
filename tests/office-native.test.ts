// Opt-in interoperability check: real hidden Word/Excel, synthetic temporary documents only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDocx } from '../scripts/docx.mjs';
import { buildXlsx } from '../scripts/xlsx.mjs';
import { changeWord, wordDocument } from '../scripts/lib/office-word.ts';
import { changeSheet, workbookInfo } from '../scripts/lib/office-sheet.ts';
import { convertLegacy } from '../desktop/office-convert.ts';

const quote = (value: string) => "'" + value.replace(/'/g, "''") + "'";
const powershell = (code: string) => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from("$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'\n" + code, 'utf16le').toString('base64')], { encoding: 'utf8', windowsHide: true, timeout: 90_000 });

test('Word and Excel open edited packages with native comments and convert real legacy copies', { skip: process.platform !== 'win32' || process.env.QA_NATIVE_OFFICE !== '1', timeout: 240_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'moki-native-office-'));
  try {
    const docx = join(directory, 'edited.docx'), doc = join(directory, 'legacy.doc');
    const original = buildDocx({ blocks: [{ type: 'paragraph', text: 'Original text', bold: true }] }).buffer;
    writeFileSync(docx, changeWord(changeWord(original, { op: 'text', paragraph: '0', text: 'Edited native text' }), { op: 'comment', paragraph: '0', author: 'Moki test', text: 'Native Word comment' }));
    const word = JSON.parse(powershell(`$office=$null; $document=$null
try {
 $office=New-Object -ComObject Word.Application; $office.Visible=$false; $office.DisplayAlerts=0; $office.AutomationSecurity=3
 $document=$office.Documents.Open(${quote(docx)},$false,$true,$false)
 $result=@{text=$document.Content.Text;comments=$document.Comments.Count;bold=$document.Paragraphs.Item(1).Range.Bold}
 $document.SaveAs2(${quote(doc)},0)
 $result | ConvertTo-Json -Compress
} finally { if($document){$document.Close(0);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)};if($office){$office.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($office)} }`));
    assert.match(word.text, /Edited native text/); assert.equal(word.comments, 1); assert.equal(word.bold, -1);
    const convertedDoc = join(directory, 'converted.docx'); await convertLegacy(doc, convertedDoc);
    assert.match(wordDocument(readFileSync(convertedDoc)).paragraphs[0].text, /Edited native text/);
    const xlsx = join(directory, 'edited.xlsx'), xls = join(directory, 'legacy.xls');
    const book = buildXlsx({ sheets: [{ key: 'data', title: 'Data', columns: [{ key: 'name', label: 'Name' }, { key: 'value', label: 'Value' }] }] }, { data: [{ name: 'Original', value: '42' }] });
    writeFileSync(xlsx, changeSheet(changeSheet(book, { op: 'cell', sheet: 0, ref: 'B2', value: '73.5' }), { op: 'comment', sheet: 0, ref: 'B2', author: 'Moki test', text: 'Native Excel note' }));
    const excel = JSON.parse(powershell(`$office=$null; $document=$null
try {
 $office=New-Object -ComObject Excel.Application; $office.Visible=$false; $office.DisplayAlerts=$false; $office.AutomationSecurity=3
 $document=$office.Workbooks.Open(${quote(xlsx)},0,$true)
 $result=@{value=$document.Worksheets.Item(1).Range('B2').Value2;note=$document.Worksheets.Item(1).Range('B2').Comment.Text();bold=$document.Worksheets.Item(1).Range('A1').Font.Bold}
 $document.SaveAs(${quote(xls)},56)
 $result | ConvertTo-Json -Compress
} finally { if($document){$document.Close($false);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document)};if($office){$office.Quit();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($office)} }`));
    assert.equal(excel.value, 73.5); assert.match(excel.note, /Native Excel note/); assert.equal(excel.bold, true);
    const convertedSheet = join(directory, 'converted.xlsx'); await convertLegacy(xls, convertedSheet);
    assert.equal(workbookInfo(readFileSync(convertedSheet)).sheets[0].cells.B2.value, '73.5');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
