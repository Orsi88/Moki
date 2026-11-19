// CLI entry points stay inert when imported, including when a bundle shares its URL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { isMain } from '../scripts/lib/is-main.mjs';

test('CLI guards check the entry path and allowed name, including spaces, Unicode and missing argv', () => {
  const dir = join(tmpdir(), 'Moki space ç');
  const script = join(dir, 'build.mjs');
  const bundle = join(dir, 'mcp.cjs');
  const url = (file) => pathToFileURL(file).href;
  const argv = process.argv;
  try {
    for (const [entry, moduleUrl, names, expected] of [
      [script, url(script), ['build.mjs'], true],
      [script, url(join(dir, 'other', 'build.mjs')), ['build.mjs'], false],
      [bundle, url(bundle), ['build.mjs'], false],
      [undefined, url(script), ['build.mjs'], false],
      ['', url(script), ['build.mjs'], false],
      ...['server.ts', 'mcp.cjs', 'mcp.mjs'].map((name) => [join(dir, name), url(join(dir, name)), ['server.ts', 'mcp.cjs', 'mcp.mjs'], true]),
    ]) {
      process.argv = entry === undefined ? [argv[0]] : [argv[0], entry];
      assert.equal(isMain(moduleUrl, names), expected, String(entry));
    }
  } finally { process.argv = argv; }
});
