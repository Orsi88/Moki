// The PATH the desktop app uses to find the AI tools (claude, codex, gemini…). Started from
// the app menu, the app does not get the PATH of the user's terminal:
// - macOS/Linux give it a minimal PATH; a login shell (-l) adds ~/.zprofile but not ~/.zshrc,
//   where nvm and npm's global folder are usually set, so the PATH comes from an interactive
//   login shell (-il), read between markers because rc files may print things;
// - Windows keeps the PATH of the moment the app (or the program that opened it) started, so a
//   tool installed later looks missing: the current user and machine PATH are read again.
// Then the folders where these tools usually install are added when they exist.

import { execFile, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MARK = '__MOKI_PATH__';
const shellArgs = ['-ilc', `printf '${MARK}%s${MARK}' "$PATH"`];
const REG_ARGS = (key: string) => ['query', key]; // every value: Path and the variables it names (%NVM_SYMLINK%, %PNPM_HOME%...)
const MACHINE_KEY = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment';
const USER_KEY = 'HKCU\\Environment';

// stdout of a command, '' when it fails or times out. The async twin of execFileSync: the app's main process keeps running meanwhile.
function output(file: string, args: string[], timeout: number, windowsHide = false): Promise<string> {
  return new Promise((done) => {
    const child = execFile(file, args, { encoding: 'utf8', timeout, windowsHide, maxBuffer: 8 << 20 }, (err, stdout) => done(err ? '' : stdout));
    child.stdin?.end(); // execFileSync's stdio 'ignore' for stdin: a shell must not wait for input
  });
}

// The PATH of the user's shell, as an interactive login shell sees it ('' when it fails).
export function shellPath(shell = process.env.SHELL || '/bin/bash'): string {
  try {
    const out = execFileSync(shell, shellArgs, { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split(MARK)[1] ?? '';
  } catch { return ''; }
}
export const shellPathAsync = async (shell = process.env.SHELL || '/bin/bash'): Promise<string> => (await output(shell, shellArgs, 8000)).split(MARK)[1] ?? '';

// %VAR% expanded; `vars` by upper-case name.
const expand = (value: string, vars: Record<string, string | undefined>) => value.replace(/%([^%]+)%/g, (all, name: string) => vars[name.toUpperCase()] ?? all);
const upper = (env: NodeJS.ProcessEnv) => Object.fromEntries(Object.entries(env).map(([k, v]) => [k.toUpperCase(), v]));

// Every value in the output of `reg query <key>`, by upper-case name (names may have spaces). Header lines (HKEY_...) have no leading space.
export function registryValues(out: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of out.split(/\r?\n/)) {
    const m = /^\s+(.+?)\s+REG_[A-Z_]+(?:\s+(.*))?$/i.exec(line);
    if (m) values[m[1].toUpperCase()] = (m[2] ?? '').trim();
  }
  return values;
}
function registryKey(key: string): string {
  try { return execFileSync('reg', REG_ARGS(key), { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return ''; }
}
// Machine Path then user Path. %VAR% resolves with this process's variables first, then the registry's,
// so a variable created after the app started (nvm-windows' NVM_SYMLINK...) still resolves; a second
// pass expands registry values that name another variable. Pure, for testing.
export function joinRegistry(outs: string[], env: NodeJS.ProcessEnv): string {
  const [machine = {}, user = {}] = outs.map(registryValues);
  const vars: Record<string, string | undefined> = { ...machine, ...user, ...upper(env) };
  return [machine.PATH, user.PATH].filter(Boolean).map((p) => expand(expand(p!, vars), vars)).join(';');
}

// The machine and user PATH as Windows has them now.
export function windowsPath(env: NodeJS.ProcessEnv = process.env): string {
  return joinRegistry([MACHINE_KEY, USER_KEY].map(registryKey), env);
}
export async function windowsPathAsync(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  return joinRegistry(await Promise.all([MACHINE_KEY, USER_KEY].map((k) => output('reg', REG_ARGS(k), 5000, true))), env);
}

// npm's global folder when the user moved it (npm config set prefix): NPM_CONFIG_PREFIX, else prefix= in ~/.npmrc.
// Windows puts the commands in the prefix itself, the others in <prefix>/bin. '' when not set.
export function npmPrefixBin(platform: NodeJS.Platform, home: string, env: NodeJS.ProcessEnv, read = (f: string) => readFileSync(f, 'utf8')): string {
  let prefix = env.NPM_CONFIG_PREFIX ?? env.npm_config_prefix ?? '';
  if (!prefix) { try { prefix = /^\s*prefix\s*=\s*(.+?)\s*$/m.exec(read(join(home, '.npmrc')))?.[1] ?? ''; } catch { /* no .npmrc */ } }
  prefix = prefix.replace(/^["']|["']$/g, '').replace(/^~(?=$|[\\/])/, home);
  return !prefix ? '' : platform === 'win32' ? prefix : join(prefix, 'bin');
}

// Folders where the AI tools' installers and npm put their commands, per system.
export function toolDirs(platform: NodeJS.Platform, home: string, env: NodeJS.ProcessEnv = process.env): string[] {
  if (platform === 'win32') {
    const appData = env.APPDATA ?? join(home, 'AppData', 'Roaming');
    const local = env.LOCALAPPDATA ?? join(home, 'AppData', 'Local');
    return [join(appData, 'npm'), join(home, '.local', 'bin'), join(local, 'Programs', 'cursor', 'resources', 'app', 'bin'),
      join(local, 'cursor-agent'), join(local, 'agy', 'bin'), // Cursor Agent CLI and Antigravity CLI installers
      join(home, '.bun', 'bin'), join(local, 'Volta', 'bin'), join(home, 'scoop', 'shims'),
      join(local, 'pnpm'), join(appData, 'fnm', 'aliases', 'default'), npmPrefixBin(platform, home, env)].filter(Boolean);
  }
  const nvm = join(home, '.nvm', 'versions', 'node');
  let nvmBins: string[] = [];
  try { nvmBins = readdirSync(nvm).sort().reverse().map((v) => join(nvm, v, 'bin')); } catch { /* no nvm */ }
  return ['/opt/homebrew/bin', '/usr/local/bin', join(home, '.local', 'bin'), join(home, '.npm-global', 'bin'), join(home, '.volta', 'bin'),
    join(home, '.bun', 'bin'), join(home, '.cargo', 'bin'), join(home, '.local', 'share', 'mise', 'shims'), join(home, '.asdf', 'shims'),
    join(home, '.local', 'share', 'fnm', 'aliases', 'default', 'bin'), join(home, '.local', 'share', 'pnpm'), join(home, 'Library', 'pnpm'),
    npmPrefixBin(platform, home, env), ...nvmBins].filter(Boolean);
}

// The current PATH, then the fresher one, then the usual tool folders that exist; no folder twice.
export function mergePath(platform: NodeJS.Platform, parts: string[], exists: (dir: string) => boolean = existsSync): string {
  const sep = platform === 'win32' ? ';' : ':';
  const key = (d: string) => (platform === 'win32' ? d.replace(/[\\/]+$/, '').toLowerCase() : d.replace(/\/+$/, ''));
  const seen = new Set<string>();
  const out: string[] = [];
  parts.forEach((part, i) => {
    for (const dir of part.split(sep).map((d) => d.trim()).filter(Boolean)) {
      if (seen.has(key(dir)) || (i === parts.length - 1 && !exists(dir))) continue; // the usual folders only when they exist
      seen.add(key(dir));
      out.push(dir);
    }
  });
  return out.join(sep);
}

// The last PATH read, for Settings > My AIs > Copy diagnostic: where it came from and how many folders it gave (0: it failed).
let lastRead = { source: '', folders: 0, at: '' };
export const pathRead = () => lastRead;
// Where the PATH comes from, for the diagnostic.
const source = (platform: NodeJS.Platform) => (platform === 'win32' ? 'Windows registry' : process.env.SHELL || '/bin/bash');

// Sets env.PATH from the fresher one: the current PATH, the fresh one and the usual tool folders.
function applyPath(fresh: string, platform: NodeJS.Platform, env: NodeJS.ProcessEnv, home: string, from: string): void {
  const current = env.PATH ?? '';
  const sep = platform === 'win32' ? ';' : ':';
  // On macOS/Linux the shell's PATH comes first (it is what the terminal uses); on Windows the current one does.
  const parts = platform === 'win32' ? [current, fresh] : [fresh, current];
  env.PATH = mergePath(platform, [...parts, toolDirs(platform, home, env).join(sep)]); // on Windows process.env is case-insensitive: this is Path too
  lastRead = { source: from, folders: fresh.split(sep).filter(Boolean).length, at: new Date().toISOString() };
}

// home defaults to os.homedir(): USERPROFILE on Windows (HOME there may be Git Bash's), HOME elsewhere.
// Blocking: for the tool runner, a process of its own, and the launcher's one-off retry (the app's main process uses fixToolPath).
export function fixToolPathSync(platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = homedir()): void {
  applyPath(platform === 'win32' ? windowsPath(env) : shellPath(), platform, env, home, source(platform));
  if (reading) readSync = true; // the read that is running has nothing left to add
}

let reading: Promise<void> | null = null;
let readSync = false;

// Sets process.env.PATH so the app finds the AI tools the user's terminal finds, without blocking the main process.
// Calls made while a read is running share it.
export function fixToolPath(platform = process.platform, env: NodeJS.ProcessEnv = process.env, home = homedir()): Promise<void> {
  reading ??= (async () => applyPath(platform === 'win32' ? await windowsPathAsync(env) : await shellPathAsync(), platform, env, home, source(platform)))().finally(() => { reading = null; readSync = false; });
  return reading;
}

// Resolves when the PATH read that is running ends (at once when none is): what detection, launch and install wait for.
export const pathReady = (): Promise<void> => reading ?? Promise.resolve();
export const pathPending = (): boolean => reading !== null && !readSync;

// The diagnostic text: system, where the PATH came from, each command's file, and every folder searched in order. Pure.
export function pathReport(platform: string, env: NodeJS.ProcessEnv, read: { source: string; folders: number; at: string },
  found: [string, string | null][], exists: (dir: string) => boolean = existsSync): string {
  const dirs = (env.PATH ?? env.Path ?? '').split(platform === 'win32' ? ';' : ':').filter(Boolean);
  return [
    `System: ${platform}`,
    `PATH read from: ${read.source || 'not read (development run)'}${read.source ? ` — ${read.folders ? `${read.folders} folders` : 'failed or empty'}` : ''}${read.at ? ` (${read.at})` : ''}`,
    ...(platform === 'win32' ? [`PATHEXT: ${env.PATHEXT ?? '(default)'}`] : []),
    'Commands:', ...found.map(([cmd, file]) => `  ${cmd}: ${file ?? 'not found'}`),
    'Folders searched, in order:', ...dirs.map((d) => `  ${exists(d) ? '' : '[missing] '}${d}`),
  ].join('\n');
}
