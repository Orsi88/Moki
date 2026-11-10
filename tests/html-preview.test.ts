import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPreviewGrants, PREVIEW_CSP } from '../desktop/html-preview.ts';

test('HTML capabilities serve local modules and assets, reject secrets/traversal/writes and expire with scope/workspace/project', async () => {
  const root = mkdtempSync(join(tmpdir(), 'moki-preview-'));
  try {
    const project = join(root, 'acme'); mkdirSync(join(project, 'demo'), { recursive: true });
    writeFileSync(join(project, 'demo', 'index.html'), '<script type="module" src="./app.js"></script>');
    writeFileSync(join(project, 'demo', 'app.js'), 'export const value = 42;');
    writeFileSync(join(project, 'demo', 'data.json'), '{"value":42}');
    writeFileSync(join(project, '.env'), 'SECRET=hidden');
    writeFileSync(join(project, 'private.md'), 'Private notes');
    writeFileSync(join(root, 'outside.js'), 'outside');
    let workspace = root;
    const grants = createPreviewGrants({ workspace: () => workspace, bases: (id) => id === 'acme' ? [project] : null });
    const url = grants.grant(1, 'acme', join(project, 'demo', 'index.html'))!;
    assert.match(url, /^moki-preview:\/\/[a-f0-9]{48}\/demo\/index.html$/);
    const js = await grants.serve('GET', new URL('app.js', url).href);
    assert.equal(js.status, 200); assert.match(js.headers.get('Content-Type')!, /javascript/);
    assert.equal(await js.text(), 'export const value = 42;');
    assert.equal((await grants.serve('HEAD', url)).body, null);
    assert.equal((await grants.serve('POST', url)).status, 405);
    for (const relative of ['../.env', '../private.md', '../../outside.js', '%2e%2e%5coutside.js', '../../../outside.js']) assert.equal((await grants.serve('GET', new URL(relative, url).href)).status, 404, relative);
    assert.equal(grants.grant(1, 'other', join(project, 'demo', 'index.html')), null);
    assert.match(PREVIEW_CSP, /sandbox allow-scripts allow-forms/);
    assert.doesNotMatch(PREVIEW_CSP, /allow-same-origin|https?:/);
    workspace = root + '-other'; assert.equal((await grants.serve('GET', url)).status, 404);
    workspace = root; grants.revokeOutside(1, 'other'); assert.equal((await grants.serve('GET', url)).status, 404);
    const fresh = grants.grant(2, 'acme', join(project, 'demo', 'index.html'))!;
    grants.revokeScope(2); assert.equal((await grants.serve('GET', fresh)).status, 404);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
