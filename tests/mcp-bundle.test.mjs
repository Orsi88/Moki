// The shipped MCP formats must start without running any bundled helper's CLI,
// touching the framework/workspace, or mixing ordinary console output into JSON-RPC.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { ROOT, relPosix, walkFiles } from '../scripts/lib/repo.mjs';

const snapshot = (root) => Object.fromEntries(walkFiles(root).map((file) => [relPosix(root, file), {
  content: readFileSync(file).toString('base64'), modified: statSync(file).mtimeMs,
}]));

for (const format of ['cjs', 'esm']) {
  test(`bundled MCP (${format}): initialize, tool discovery and ping preserve files and stdout is only JSON-RPC`, async () => {
    const base = realpathSync(tmpdir());
    const dir = mkdtempSync(join(base, 'moki-mcp-bundle-'));
    try {
      const root = join(dir, 'framework');
      const workspace = join(dir, 'workspace');
      for (const path of ['.claude/skills', '.claude/agents', '.agents/skills']) {
        mkdirSync(join(root, path), { recursive: true });
        writeFileSync(join(root, path, 'keep.txt'), `Keep ${path}.\n`);
      }
      mkdirSync(workspace);
      writeFileSync(join(workspace, 'keep.txt'), 'Keep the workspace.\n');
      writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
      const file = join(dir, format === 'cjs' ? 'mcp.cjs' : 'mcp.mjs');
      // These are the entry point and import.meta.url handling used by build-vscode
      // and build-desktop. No real project or installed framework is used.
      await build({
        entryPoints: [join(ROOT, 'ide', 'mcp', 'server.ts')], outfile: file,
        bundle: true, platform: 'node', target: format === 'cjs' ? 'node20' : 'node24', format,
        logLevel: 'silent', external: ['electron', 'node-pty'],
        ...(format === 'cjs' ? {
          define: { 'import.meta.url': '__importMetaUrl' },
          banner: { js: 'const __importMetaUrl = require("node:url").pathToFileURL(__filename).href;' },
        } : {}),
      });
      const before = { framework: snapshot(root), workspace: snapshot(workspace) };
      const env = { ...process.env, QA_ROOT: root, QA_WORKSPACE: workspace, QA_WORKSPACE_DATA_ROOT: root };
      const input = [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        { jsonrpc: '2.0', id: 2, method: 'tools/list' },
        { jsonrpc: '2.0', id: 3, method: 'ping' },
      ].map((message) => JSON.stringify(message)).join('\n') + '\n';
      const out = spawnSync(process.execPath, [file, '--project', 'missing'], { cwd: root, env, input, encoding: 'utf8', timeout: 20000 });
      assert.ifError(out.error);
      assert.equal(out.status, 0, out.stderr);
      assert.equal(out.stderr, '');
      const replies = out.stdout.trim().split('\n').map((line) => JSON.parse(line));
      assert.deepEqual(replies.map((reply) => reply.id), [1, 2, 3]);
      assert.ok(replies.every((reply) => reply.jsonrpc === '2.0' && !reply.error));
      assert.equal(replies[0].result.serverInfo.name, 'moki');
      assert.equal(replies[0].result.protocolVersion, '2025-06-18');
      assert.ok(replies[1].result.tools.some((tool) => tool.name === 'moki_record_learning'));
      assert.deepEqual(replies[2].result, {});
      assert.deepEqual({ framework: snapshot(root), workspace: snapshot(workspace) }, before);

      const imported = spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(pathToFileURL(file).href)});`], { cwd: root, env, encoding: 'utf8', timeout: 20000 });
      assert.ifError(imported.error);
      assert.equal(imported.status, 0, imported.stderr);
      assert.equal(imported.stdout, '');
      assert.equal(imported.stderr, '');
      assert.deepEqual({ framework: snapshot(root), workspace: snapshot(workspace) }, before);
    } finally {
      assert.equal(dirname(dir), base);
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
