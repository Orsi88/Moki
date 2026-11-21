// Build the extension first, then run this smoke test in a disposable VS Code profile and framework.
// Usage: node tests/ide/run.mjs <absolute-path-to-Code.exe-or-code>
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { build } from 'esbuild';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { createProject } from '../../scripts/lib/core.ts';

const executable = process.argv[2];
if (!executable || !existsSync(executable)) throw new Error('Pass the absolute path of the installed VS Code executable.');
const base = realpathSync(tmpdir());
const fixture = realpathSync(mkdtempSync(join(base, 'moki-ide-host-')));
try {
  for (const name of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, name), join(fixture, name), { recursive: true });
  cpSync(join(ROOT, 'package.json'), join(fixture, 'package.json'));
  const extension = join(fixture, 'ide', 'vscode');
  mkdirSync(extension, { recursive: true });
  for (const name of ['package.json', 'resources', 'dist']) cpSync(join(ROOT, 'ide', 'vscode', name), join(extension, name), { recursive: true });
  createProject('fixture', 'IDE fixture', fixture, 'blank');
  const workspace = join(fixture, 'workspace');
  const result = join(fixture, 'result.json');
  const runner = join(fixture, 'runner.cjs');
  await build({ entryPoints: [join(ROOT, 'tests', 'ide', 'extension-host.mjs')], outfile: runner, bundle: true, platform: 'node', format: 'cjs', external: ['vscode'] });
  const args = ['--user-data-dir', join(fixture, 'profile'), '--extensions-dir', join(fixture, 'extensions'),
    '--extensionDevelopmentPath', extension, '--extensionTestsPath', runner, '--disable-extensions', '--disable-workspace-trust', '--skip-welcome', '--skip-release-notes', fixture];
  const env = { ...process.env, QA_ROOT: fixture, QA_WORKSPACE: workspace, QA_WORKSPACE_DATA_ROOT: fixture, MOKI_IDE_TEST_RESULT: result };
  delete env.ELECTRON_RUN_AS_NODE;
  let child;
  if (process.platform === 'win32') {
    // Start-Process hides the test window. All paths are generated here, passed as literal PowerShell values.
    const quote = (text) => `'${text.replaceAll("'", "''")}'`;
    const script = `$ProgressPreference = 'SilentlyContinue'; $ideArgs = @(${args.map(quote).join(',')}); $ideProcess = Start-Process -FilePath ${quote(resolve(executable))} -ArgumentList $ideArgs -WindowStyle Hidden -RedirectStandardOutput ${quote(join(fixture, 'stdout.txt'))} -RedirectStandardError ${quote(join(fixture, 'stderr.txt'))} -PassThru -Wait; exit $ideProcess.ExitCode`;
    child = spawn('powershell.exe', ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { env, windowsHide: true, stdio: 'inherit' });
  } else child = spawn(executable, args, { env, stdio: 'inherit' });
  const exit = new Promise((done) => { child.on('error', (error) => done({ error })); child.on('exit', (code) => done({ code })); });
  const outcome = await exit;
  if (outcome.error) throw outcome.error;
  if (!existsSync(result)) {
    const output = ['stdout.txt', 'stderr.txt'].filter((name) => existsSync(join(fixture, name))).map((name) => readFileSync(join(fixture, name), 'utf8').slice(-6000)).join('\n');
    throw new Error(`VS Code exited (${outcome.code}) without completing the extension tests.\n${output}`);
  }
  const report = JSON.parse(readFileSync(result, 'utf8'));
  if (!report.ok) throw new Error('Extension host tests failed.');
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (dirname(fixture) !== base || !basename(fixture).startsWith('moki-ide-host-')) throw new Error('Refusing to remove an unexpected test folder.');
  rmSync(fixture, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
