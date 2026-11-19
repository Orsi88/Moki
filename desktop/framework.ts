// The installed app carries a copy of the framework (skills, AGENTS.md,
// templates...) and keeps it in a normal folder the AI tools can open
// (normally Documents/Moki). A Git checkout keeps its workspace data there
// and gets a separate location for the installed framework files.
// The desktop app and the IDE extension share that folder, and the AI tools opened there watch some of its
// folders (.claude/skills, .agents/skills): the copy is identified by its content, so two installs of the same
// framework never redo it, and it is refreshed file by file, never by deleting a folder another program holds.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const MARKER = '.qa-framework-build';
const PROTECTED = new Set(['workspace', 'workspaces']);
// A file or folder another program holds open (Windows): left as it is, and tried again on the next start.
const IN_USE = new Set(['EPERM', 'EBUSY', 'EACCES', 'ENOTEMPTY']);
const inUse = (e: unknown) => IN_USE.has((e as NodeJS.ErrnoException)?.code ?? '');

export interface FrameworkSync { changed: boolean; skipped: string[] } // skipped: paths in use, relative to the target

function isInsideGitCheckout(target: string): boolean {
  let dir = resolve(target);
  // Resolve the nearest existing directory, including symlinks, before looking for .git.
  while (!lstatSync(dir, { throwIfNoEntry: false })) {
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
  dir = realpathSync(dir);
  for (;;) {
    // Worktrees and submodules use a .git file. Permission errors must stop the refresh.
    if (lstatSync(join(dir, '.git'), { throwIfNoEntry: false })) return true;
    const parent = dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

function appFrameworkDirectory(): string {
  const home = homedir();
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), 'Moki', 'framework');
  if (process.platform === 'darwin') return join(home, 'Library', 'Application Support', 'Moki', 'framework');
  const xdgData = process.env.XDG_DATA_HOME;
  return join(xdgData && isAbsolute(xdgData) ? xdgData : join(home, '.local', 'share'), 'Moki', 'framework');
}

// The bundled framework's identity: every file it refreshes (outside workspace/ and workspaces/), by path and content.
export function frameworkId(bundled: string): string {
  const hash = createHash('sha256');
  const walk = (dir: string, rel: string) => {
    for (const name of readdirSync(dir).sort()) {
      if (!rel && PROTECTED.has(name)) continue;
      const path = join(dir, name);
      const key = rel ? `${rel}/${name}` : name;
      if (statSync(path).isDirectory()) { hash.update(`d ${key}\n`); walk(path, key); }
      else { hash.update(`f ${key}\n`); hash.update(readFileSync(path)); hash.update('\n'); }
    }
  };
  walk(bundled, '');
  const readme = join(bundled, 'workspace', 'README.md');
  if (existsSync(readme)) { hash.update('f workspace/README.md\n'); hash.update(readFileSync(readme)); }
  return hash.digest('hex');
}

const sameFile = (a: string, b: string): boolean => {
  const target = lstatSync(b, { throwIfNoEntry: false });
  return Boolean(target?.isFile() && target.size === statSync(a).size && readFileSync(a).equals(readFileSync(b)));
};

// Makes `to` match `from`: changed files are written over, files and folders the bundle no longer has are removed.
// An item another program holds is left as it is and listed in `skipped`. Inside a folder Windows is still deleting
// (removed while another program has it open), even reading an entry fails, so every step on `to` is guarded.
function mirror(from: string, to: string, rel: string, skipped: string[]): void {
  const attempt = (fn: () => void, at = rel): boolean => {
    try { fn(); return true; } catch (e) { if (!inUse(e)) throw e; skipped.push(at); return false; }
  };
  let existing: ReturnType<typeof lstatSync>;
  if (!attempt(() => { existing = lstatSync(to, { throwIfNoEntry: false }); })) return;
  if (statSync(from).isDirectory()) {
    if (existing && !existing.isDirectory() && !attempt(() => rmSync(to, { force: true }))) return;
    if (!existing?.isDirectory() && !attempt(() => mkdirSync(to, { recursive: true }))) return;
    const names = new Set(readdirSync(from));
    for (const name of names) mirror(join(from, name), join(to, name), `${rel}/${name}`, skipped);
    let present: string[] = [];
    if (!attempt(() => { present = readdirSync(to); })) return;
    for (const name of present) {
      if (!names.has(name)) attempt(() => rmSync(join(to, name), { recursive: true, force: true }), `${rel}/${name}`);
    }
    return;
  }
  if (existing?.isDirectory() && !attempt(() => rmSync(to, { recursive: true, force: true }))) return;
  attempt(() => { if (!sameFile(from, to)) copyFileSync(from, to); });
}

export function syncFramework(bundled: string, target: string): FrameworkSync {
  if (isInsideGitCheckout(target)) throw new Error(`Cannot refresh the installed framework inside a Git checkout: ${target}`);
  mkdirSync(target, { recursive: true });
  const marker = join(target, MARKER);
  const id = frameworkId(bundled);
  if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === id) return { changed: false, skipped: [] };

  const skipped: string[] = [];
  for (const name of readdirSync(bundled)) {
    if (PROTECTED.has(name)) continue;
    mirror(join(bundled, name), join(target, name), name, skipped);
  }
  // workspace/: create what is missing, keep everything that exists.
  for (const dir of ['projects', 'temporary']) mkdirSync(join(target, 'workspace', dir), { recursive: true });
  const readme = join(bundled, 'workspace', 'README.md');
  if (existsSync(readme)) mirror(readme, join(target, 'workspace', 'README.md'), 'workspace/README.md', skipped);

  // Written only when everything was refreshed: an item in use is tried again on the next start.
  if (!skipped.length) writeFileSync(marker, `${id}\n`);
  return { changed: true, skipped };
}

// Where an installed copy keeps the framework: QA_ROOT, the folder of installs made
// before the rename, or <Documents>/Moki. The desktop app and the VS Code extension share it.
export function frameworkTarget(documents: string): string {
  const legacy = join(documents, 'Quality Agents');
  return process.env.QA_ROOT || (existsSync(legacy) ? legacy : join(documents, 'Moki'));
}

// Both installed entry points set these before importing the modules that resolve ROOT.
// Returns a warning when some files could not be refreshed but a framework is there to use; throws only when there
// is none (a first install that failed).
export function prepareInstalledFramework(bundled: string, documents: string, fallback = appFrameworkDirectory()): { warning?: string } {
  const target = resolve(frameworkTarget(documents));
  const fallbackRoot = resolve(fallback);
  const frameworkRoot = isInsideGitCheckout(target) ? fallbackRoot : target;
  // A tool started by an installed copy can inherit its fallback and original workspace location.
  const inheritedDataRoot = relative(fallbackRoot, target) === '' ? process.env.QA_WORKSPACE_DATA_ROOT : undefined;
  const dataRoot = resolve(inheritedDataRoot || target);
  let warning: string | undefined;
  try {
    const { skipped } = syncFramework(bundled, frameworkRoot);
    if (skipped.length) {
      warning = `Some Moki files are in use by another program (often an AI tool open in ${frameworkRoot}) and were not updated: `
        + `${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? ` and ${skipped.length - 5} more` : ''}. Moki tries again the next time it opens.`;
    }
  } catch (error) {
    if (!existsSync(join(frameworkRoot, 'AGENTS.md'))) throw error;
    warning = `Moki could not update its files in ${frameworkRoot} and uses the ones there. ${error instanceof Error ? error.message : String(error)}`;
  }
  process.env.QA_ROOT = frameworkRoot;
  if (dataRoot !== frameworkRoot) process.env.QA_WORKSPACE_DATA_ROOT = dataRoot;
  else delete process.env.QA_WORKSPACE_DATA_ROOT;
  return warning ? { warning } : {};
}
