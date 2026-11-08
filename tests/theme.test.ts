import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';
import { ROOT } from '../scripts/lib/repo.mjs';

const code = buildSync({
  entryPoints: [join(ROOT, 'app', 'src', 'theme.ts')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  define: { 'process.env.NODE_ENV': '"production"' },
}).outputFiles[0].text;

interface ThemeApi {
  DEFAULT_THEME_SETTINGS: { mokiPalette: string; mokiMode: string; cli: string; documents: string };
  currentTheme: () => string;
  installTheme: () => void;
  persistThemeSettings: (settings: { mokiPalette: string; mokiMode: string; cli: string; documents: string }) => void;
}

function load(saved: Record<string, string> = {}) {
  const storage = new Map(Object.entries(saved));
  const root = { dataset: {} as Record<string, string> };
  const handlers = new Map<string, (event: { key: string | null }) => void>();
  const module = { exports: {} as ThemeApi };
  runInNewContext(code, {
    module,
    exports: module.exports,
    process: { env: { NODE_ENV: 'production' } },
    document: { documentElement: root },
    window: {
      matchMedia: () => ({ matches: false, addEventListener: () => {} }),
      addEventListener: (name: string, handler: (event: { key: string | null }) => void) => { handlers.set(name, handler); },
    },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    },
  });
  return { api: module.exports, storage, root, handlers };
}

test('theme settings keep the Moki palette and the CLI/document modes independent', () => {
  const { api, storage, root } = load();
  api.persistThemeSettings({ ...api.DEFAULT_THEME_SETTINGS, mokiPalette: 'blue', mokiMode: 'dark', cli: 'light', documents: 'dark' });
  assert.equal(api.currentTheme(), 'dark');
  assert.deepEqual(root.dataset, { theme: 'dark', mokiPalette: 'blue', cliTheme: 'light', docTheme: 'dark' });
  assert.deepEqual(JSON.parse(storage.get('qa-theme-settings') ?? '{}'), { mokiPalette: 'blue', mokiMode: 'dark', cli: 'light', documents: 'dark' });
});

test('the old Moki theme preference is migrated and other settings use their safe defaults', () => {
  const { api } = load({ 'qa-theme': 'light' });
  assert.equal(api.currentTheme(), 'light');
  assert.equal(JSON.stringify(api.DEFAULT_THEME_SETTINGS), JSON.stringify({ mokiPalette: 'amber', mokiMode: 'system', cli: 'dark', documents: 'light' }));
});

test('already-open windows follow theme changes from another window, including reset', () => {
  const { api, storage, root, handlers } = load();
  api.installTheme();
  storage.set('qa-theme-settings', JSON.stringify({ mokiPalette: 'purple', mokiMode: 'light', cli: 'dark', documents: 'dark' }));
  handlers.get('storage')?.({ key: 'qa-theme-settings' });
  assert.deepEqual(root.dataset, { theme: 'light', mokiPalette: 'purple', cliTheme: 'dark', docTheme: 'dark' });
  storage.clear();
  handlers.get('storage')?.({ key: null });
  assert.deepEqual(root.dataset, { theme: 'dark', mokiPalette: 'amber', cliTheme: 'dark', docTheme: 'light' });
});
