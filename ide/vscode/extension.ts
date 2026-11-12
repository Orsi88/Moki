// Entry point of the Moki VS Code extension (the IDE Companion). Like desktop/boot.ts:
// installed, it prepares the same framework and workspace paths as the desktop
// app before host.ts loads. The Extension Development Host uses the checkout.

import * as vscode from 'vscode';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { prepareInstalledFramework } from '../../desktop/framework.ts';

export function activate(context: vscode.ExtensionContext): void {
  const dist = join(context.extensionPath, 'dist');
  if (context.extensionMode === vscode.ExtensionMode.Production) {
    let buildId = String(context.extension.packageJSON.version);
    try { buildId = (JSON.parse(readFileSync(join(dist, 'build-info.json'), 'utf8')) as { buildId: string }).buildId; } catch { /* use the version */ }
    try {
      prepareInstalledFramework(join(dist, 'framework'), documentsDir(), buildId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void vscode.window.showErrorMessage(`Moki could not prepare its framework files. Check access to the folder and reload VS Code. ${message}`);
      return;
    }
  } else {
    process.env.QA_ROOT = resolve(context.extensionPath, '..', '..');
    delete process.env.QA_WORKSPACE_DATA_ROOT;
  }
  // The tool runner (Windows terminals) and Moki's MCP server, as built next to this file.
  process.env.QA_RUN_TOOL = join(dist, 'run-tool.mjs');
  process.env.QA_MCP_SERVER = join(dist, 'mcp.cjs');
  // host.cjs is a separate built file: ROOT (scripts/lib/repo.mjs) is read when it loads.
  (createRequire(import.meta.url)('./host.cjs') as typeof import('./host.ts')).start(context);
}

// The folder Electron's app.getPath('documents') returns, so both share <Documents>/Moki:
// the XDG folder on Linux (~/Documentos in Portuguese), the known folder on Windows (OneDrive included).
function documentsDir(): string {
  const query: [string, string[]] | null = process.platform === 'win32'
    ? ['powershell.exe', ['-NoProfile', '-Command', '[Environment]::GetFolderPath("MyDocuments")']]
    : process.platform === 'linux' ? ['xdg-user-dir', ['DOCUMENTS']] : null;
  try {
    const dir = query ? execFileSync(query[0], query[1], { encoding: 'utf8', timeout: 5000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim() : '';
    if (dir && dir !== homedir()) return dir;
  } catch { /* fall back to ~/Documents */ }
  return join(homedir(), 'Documents');
}
