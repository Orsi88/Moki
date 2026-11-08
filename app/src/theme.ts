// The user's visual preferences: Moki's palette and mode, plus independent CLI and document modes.

import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';
export type ThemeMode = Theme | 'system';
export type MokiPalette = 'amber' | 'blue' | 'purple' | 'green' | 'red';

export interface ThemeSettings {
  mokiPalette: MokiPalette;
  mokiMode: ThemeMode;
  cli: Theme;
  documents: Theme;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  mokiPalette: 'amber',
  mokiMode: 'system',
  cli: 'dark',
  documents: 'light',
};

export const MOKI_PALETTES: { id: MokiPalette; dark: string; light: string }[] = [
  { id: 'amber', dark: '#f1d27c', light: '#c99a22' },
  { id: 'blue', dark: '#86b8ff', light: '#3f72c4' },
  { id: 'purple', dark: '#c8a5ff', light: '#7651b8' },
  { id: 'green', dark: '#9bd49b', light: '#4b8c58' },
  { id: 'red', dark: '#ff9b91', light: '#bd5149' },
];

const KEY = 'qa-theme-settings';
const LEGACY_KEY = 'qa-theme';
const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';
const isMode = (value: unknown): value is ThemeMode => value === 'system' || isTheme(value);
const isPalette = (value: unknown): value is MokiPalette => MOKI_PALETTES.some((item) => item.id === value);

function stored(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

function normalize(value: unknown): ThemeSettings {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const legacy = stored(LEGACY_KEY);
  return {
    mokiPalette: isPalette(source.mokiPalette) ? source.mokiPalette : DEFAULT_THEME_SETTINGS.mokiPalette,
    mokiMode: isMode(source.mokiMode) ? source.mokiMode : isTheme(legacy) ? legacy : DEFAULT_THEME_SETTINGS.mokiMode,
    cli: isTheme(source.cli) ? source.cli : DEFAULT_THEME_SETTINGS.cli,
    documents: isTheme(source.documents) ? source.documents : DEFAULT_THEME_SETTINGS.documents,
  };
}

function read(): ThemeSettings {
  try {
    const value = stored(KEY);
    return value ? normalize(JSON.parse(value) as unknown) : normalize({});
  } catch {
    return normalize({});
  }
}

let settings = read();
const listeners = new Set<() => void>();

export function systemTheme(): Theme {
  try { return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; } catch { return 'dark'; }
}

export function resolvedTheme(mode: ThemeMode): Theme {
  return mode === 'system' ? systemTheme() : mode;
}

export function savedTheme(): Theme | null {
  return settings.mokiMode === 'system' ? null : settings.mokiMode;
}

export function currentTheme(): Theme {
  return resolvedTheme(settings.mokiMode);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

function applyAttributes(): void {
  const root = document.documentElement;
  root.dataset.theme = currentTheme();
  root.dataset.mokiPalette = settings.mokiPalette;
  root.dataset.cliTheme = settings.cli;
  root.dataset.docTheme = settings.documents;
}

function notify(): void {
  applyAttributes();
  listeners.forEach((listener) => listener());
}

export function themeSettings(): ThemeSettings {
  return settings;
}

export function persistThemeSettings(next: ThemeSettings): void {
  settings = normalize(next);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* optional */ }
  notify();
}

export function persistTheme(theme: Theme): void {
  persistThemeSettings({ ...settings, mokiMode: theme });
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const useThemeSettings = (): ThemeSettings => useSyncExternalStore(subscribe, () => settings, () => DEFAULT_THEME_SETTINGS);

// Call once, before the first render, so the window does not flash the wrong palette.
export function installTheme(): void {
  applyAttributes();
  try {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (settings.mokiMode === 'system') notify();
    });
  } catch { /* optional */ }
}
