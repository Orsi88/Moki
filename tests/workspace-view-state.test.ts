// View-state persistence must never mix projects or keep drafts, even with corrupt storage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';
import { ROOT } from '../scripts/lib/repo.mjs';

interface View {
  version: 1;
  tabs: { path: string; mode: 'preview' | 'edit' | 'source'; scrollTop: number }[];
  active: string | null;
}

const code = buildSync({
  entryPoints: [join(ROOT, 'app/src/workspace-view-state.ts')],
  bundle: true, write: false, format: 'cjs',
}).outputFiles[0].text;

function fixture(unavailable = false) {
  const storage = new Map<string, string>();
  const module = { exports: {} as {
    readWorkspaceView: (workspace: string, project: string) => View;
    writeWorkspaceView: (workspace: string, project: string, state: View) => void;
  } };
  runInNewContext(code, {
    module, exports: module.exports,
    window: { localStorage: {
      getItem: (key: string) => { if (unavailable) throw new Error('unavailable'); return storage.get(key) ?? null; },
      setItem: (key: string, value: string) => { if (unavailable) throw new Error('unavailable'); storage.set(key, value); },
    } },
  });
  return { ...module.exports, storage };
}

const saved: View = {
  version: 1,
  tabs: [{ path: 'context/a.md', mode: 'edit', scrollTop: 750 }, { path: 'inbox/b.txt', mode: 'preview', scrollTop: 300 }],
  active: 'inbox/b.txt',
};

test('view state preserves tab order, active file and scroll without crossing workspace/project boundaries', () => {
  const api = fixture();
  api.writeWorkspaceView('one', 'acme', saved);
  assert.equal(JSON.stringify(api.readWorkspaceView('one', 'acme')), JSON.stringify(saved));
  assert.equal(api.readWorkspaceView('one', 'beta').tabs.length, 0);
  assert.equal(api.readWorkspaceView('two', 'acme').tabs.length, 0);
  api.writeWorkspaceView('one:two', 'acme', saved);
  assert.equal(api.readWorkspaceView('one', 'two:acme').tabs.length, 0);
});

test('malformed or newer storage and unavailable localStorage safely fall back to empty tabs', () => {
  const api = fixture();
  for (const value of ['{bad', 'null', '[]', '{"version":2,"tabs":[]}', '{"version":1,"tabs":null}']) {
    api.storage.set('qa-workspace-view:one:acme', value);
    assert.equal(api.readWorkspaceView('one', 'acme').tabs.length, 0);
  }
  const unavailable = fixture(true);
  assert.doesNotThrow(() => unavailable.writeWorkspaceView('one', 'acme', saved));
  assert.equal(unavailable.readWorkspaceView('one', 'acme').active, null);
});

test('invalid paths and duplicate tabs are discarded, scroll is bounded and a missing active tab falls back', () => {
  const api = fixture();
  api.storage.set('qa-workspace-view:one:acme', JSON.stringify({
    version: 1, active: 'gone.md',
    tabs: [
      saved.tabs[0], saved.tabs[0],
      ...['../outside.md', '/outside.md', 'C:/file.md', 'a\\b.md', 'a//b.md'].map((path) => ({ path, mode: 'edit' })),
      { path: 'invalid-mode.md', mode: 'other' },
      { path: 'negative.txt', mode: 'preview', scrollTop: -1 },
      { path: 'large.txt', mode: 'source', scrollTop: 1e20 },
    ],
  }));
  const state = api.readWorkspaceView('one', 'acme');
  assert.equal(state.tabs.map((tab) => tab.path).join(','), 'context/a.md,negative.txt,large.txt');
  assert.equal(state.active, 'context/a.md');
  assert.equal(state.tabs[1].scrollTop, 0);
  assert.equal(state.tabs[2].scrollTop, 1e7);
});

test('only view metadata is written: no content, drafts or stale fields are persisted', () => {
  const api = fixture();
  const tabWithDraft = { ...saved.tabs[0], draft: 'private unsaved text', content: { text: 'file body' } };
  api.writeWorkspaceView('one', 'acme', { ...saved, tabs: [tabWithDraft] });
  const raw = api.storage.get('qa-workspace-view:one:acme') ?? '';
  assert.ok(!raw.includes('private') && !raw.includes('content') && !raw.includes('draft'));
});
