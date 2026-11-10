// Legacy formats are converted by an installed Office engine, never by changing the extension.
import { execFile } from 'node:child_process';
import { constants, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { which } from '../scripts/lib/core.ts';

export type ConvertEngine = (input: string, output: string, kind: 'doc' | 'xls') => Promise<void>;
const run = (command: string, args: string[]) => new Promise<void>((resolve, reject) => {
  execFile(command, args, { windowsHide: true, timeout: 120_000, maxBuffer: 256_000 }, (error) => error ? reject(new Error('Office conversion failed. Check that the file opens in your Office program.', { cause: error })) : resolve());
});
const quotePS = (s: string) => "'" + s.replace(/'/g, "''") + "'";

export const installedOfficeEngine: ConvertEngine = async (input, output, kind) => {
  let nativeFailure: unknown;
  if (process.platform === 'win32') {
    // Explicit passwords prevent an encrypted document from opening an invisible password dialog.
    const source = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'
$office=$null; $document=$null
try {
  $office=New-Object -ComObject ${kind === 'doc' ? 'Word.Application' : 'Excel.Application'}
  $office.Visible=$false
  $office.AutomationSecurity=3
  ${kind === 'doc' ? `$office.DisplayAlerts=0
  $office.Options.UpdateLinksAtOpen=$false
  $document=$office.Documents.Open(${quotePS(input)},$false,$true,$false,'moki-locked')
  $document.SaveAs2(${quotePS(output)},12)` : `$office.DisplayAlerts=$false
  $office.AskToUpdateLinks=$false
  $document=$office.Workbooks.Open(${quotePS(input)},0,$true,5,'moki-locked','moki-locked',$true)
  $document.SaveAs(${quotePS(output)},51)`}
} finally {
  if($null -ne $document) { $document.Close($false); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) }
  if($null -ne $office) { $office.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($office) }
}`;
    try { await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')]); return; }
    catch (error) { nativeFailure = error; }
  }
  const command = which('soffice') || which('libreoffice') || (process.platform === 'darwin' && existsSync('/Applications/LibreOffice.app/Contents/MacOS/soffice') ? '/Applications/LibreOffice.app/Contents/MacOS/soffice' : null);
  if (!command) {
    const cause = nativeFailure instanceof Error ? nativeFailure.cause as { stderr?: string } | undefined : undefined;
    if (nativeFailure && !/80040154|REGDB_E_CLASSNOTREG/i.test(cause?.stderr ?? '')) throw nativeFailure;
    throw new Error('To convert this file, install Microsoft Word/Excel or LibreOffice.');
  }
  const directory = join(input, '..');
  const { pathToFileURL } = await import('node:url');
  await run(command, [`-env:UserInstallation=${pathToFileURL(join(directory, 'profile')).href}`, '--headless', '--convert-to', kind === 'doc' ? 'docx:Office Open XML Text' : 'xlsx:Calc MS Excel 2007 XML', '--outdir', directory, input]);
};

export async function convertLegacy(input: string, output: string, engine: ConvertEngine = installedOfficeEngine): Promise<void> {
  const extension = extname(input).toLowerCase(), kind = extension === '.doc' ? 'doc' : extension === '.xls' ? 'xls' : null;
  if (!kind || extname(output).toLowerCase() !== `.${kind}x`) throw new Error('Choose a legacy Word document or spreadsheet.');
  const temporary = mkdtempSync(join(tmpdir(), 'moki-office-convert-'));
  try {
    const source = join(temporary, `document.${kind}`), converted = join(temporary, `document.${kind}x`);
    copyFileSync(input, source);
    await engine(source, converted, kind);
    if (!existsSync(converted) || readFileSync(converted).subarray(0, 2).toString() !== 'PK') throw new Error('The Office program did not produce a valid converted file.');
    copyFileSync(converted, output, constants.COPYFILE_EXCL); // original and existing destinations are never overwritten
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
