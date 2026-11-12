// The installed app carries a copy of the framework (skills, AGENTS.md,
// templates...) and keeps it in a normal folder the AI tools can open
// (normally Documents/Moki). A Git checkout keeps its workspace data there
// and gets a separate location for the installed framework files.

import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const MARKER = '.qa-framework-build';
const PROTECTED = new Set(['workspace', 'workspaces']);

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

export function syncFramework(bundled: string, target: string, buildId: string): boolean {
  if (isInsideGitCheckout(target)) throw new Error(`Cannot refresh the installed framework inside a Git checkout: ${target}`);
  mkdirSync(target, { recursive: true });
  const marker = join(target, MARKER);
  if (existsSync(marker) && readFileSync(marker, 'utf8').trim() === buildId) return false;

  for (const name of readdirSync(bundled)) {
    if (PROTECTED.has(name)) continue;
    rmSync(join(target, name), { recursive: true, force: true });
    cpSync(join(bundled, name), join(target, name), { recursive: true });
  }
  // workspace/: create what is missing, keep everything that exists.
  for (const dir of ['projects', 'temporary']) mkdirSync(join(target, 'workspace', dir), { recursive: true });
  const readme = join(bundled, 'workspace', 'README.md');
  if (existsSync(readme)) cpSync(readme, join(target, 'workspace', 'README.md'));

  writeFileSync(marker, `${buildId}\n`);
  return true;
}

// Where an installed copy keeps the framework: QA_ROOT, the folder of installs made
// before the rename, or <Documents>/Moki. The desktop app and the VS Code extension share it.
export function frameworkTarget(documents: string): string {
  const legacy = join(documents, 'Quality Agents');
  return process.env.QA_ROOT || (existsSync(legacy) ? legacy : join(documents, 'Moki'));
}

// Both installed entry points set these before importing the modules that resolve ROOT.
export function prepareInstalledFramework(bundled: string, documents: string, buildId: string, fallback = appFrameworkDirectory()): void {
  const target = resolve(frameworkTarget(documents));
  const fallbackRoot = resolve(fallback);
  const frameworkRoot = isInsideGitCheckout(target) ? fallbackRoot : target;
  // A tool started by an installed copy can inherit its fallback and original workspace location.
  const inheritedDataRoot = relative(fallbackRoot, target) === '' ? process.env.QA_WORKSPACE_DATA_ROOT : undefined;
  const dataRoot = resolve(inheritedDataRoot || target);
  syncFramework(bundled, frameworkRoot, buildId);
  process.env.QA_ROOT = frameworkRoot;
  if (dataRoot !== frameworkRoot) process.env.QA_WORKSPACE_DATA_ROOT = dataRoot;
  else delete process.env.QA_WORKSPACE_DATA_ROOT;
}
