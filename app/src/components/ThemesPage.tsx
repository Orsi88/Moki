// Workspace-wide visual preferences: Moki's palette, the CLI and document views.

import type { CSSProperties } from 'react';
import { t } from '../i18n';
import { DEFAULT_THEME_SETTINGS, MOKI_PALETTES, persistThemeSettings, useThemeSettings, type MokiPalette, type Theme, type ThemeMode } from '../theme';

const paletteName = (palette: MokiPalette): string => ({
  amber: t('🧈 Moki classic'),
  blue: t('🌊 Ocean blue'),
  purple: t('🔮 Cosmic purple'),
  green: t('👽 Green light'),
  red: t('👀 Red better'),
}[palette]);

function ModeChoices({ name, value, onChange, system = false }: { name: string; value: Theme | ThemeMode; onChange: (value: Theme | ThemeMode) => void; system?: boolean }) {
  const choices: { id: Theme | ThemeMode; label: string }[] = system
    ? [{ id: 'system', label: t('Follow system') }, { id: 'light', label: t('Light') }, { id: 'dark', label: t('Dark') }]
    : [{ id: 'light', label: t('Light') }, { id: 'dark', label: t('Dark') }];
  return (
    <div className="choice-grid" role="radiogroup" aria-label={name}>
      {choices.map((choice) => (
        <label key={choice.id} className={'choice' + (value === choice.id ? ' on' : '')}>
          <input type="radio" name={name} checked={value === choice.id} onChange={() => onChange(choice.id)} />
          <span className="choice-title">{choice.label}</span>
        </label>
      ))}
    </div>
  );
}

export function ThemesPage() {
  const settings = useThemeSettings();
  const set = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    persistThemeSettings({ ...settings, [key]: value });
  };
  return (
    <div className="settings-themes">
      <h1>{t('Themes')}</h1>
      <p className="muted">{t('Configure Moki, CLI and document themes independently.')}</p>

      <section className="theme-section">
        <h2>{t('Moki theme')}</h2>
        <p className="muted small">{t('Choose a ready-made color palette for the Moki interface.')}</p>
        <div className="theme-swatches" role="radiogroup" aria-label={t('Moki palette')}>
          {MOKI_PALETTES.map((palette) => (
            <button
              type="button"
              key={palette.id}
              className={'theme-swatch' + (settings.mokiPalette === palette.id ? ' on' : '')}
              aria-pressed={settings.mokiPalette === palette.id}
              onClick={() => set('mokiPalette', palette.id)}
              style={{ '--theme-dark': palette.dark, '--theme-light': palette.light } as CSSProperties}
            >
              <span className="theme-swatch-colors" aria-hidden="true"><i /><i /></span>
              <span>{paletteName(palette.id)}</span>
            </button>
          ))}
        </div>
        <span className="label">{t('Moki mode')}</span>
        <ModeChoices name="moki-mode" value={settings.mokiMode} system onChange={(value) => set('mokiMode', value as ThemeMode)} />
      </section>

      <section className="theme-section">
        <h2>{t('CLI theme')}</h2>
        <p className="muted small">{t('Choose whether the CLI uses a light or dark palette.')}</p>
        <ModeChoices name="cli-theme" value={settings.cli} onChange={(value) => set('cli', value as Theme)} />
      </section>

      <section className="theme-section">
        <h2>{t('Document and file theme')}</h2>
        <p className="muted small">{t('Choose whether documents and files use a light or dark palette.')}</p>
        <ModeChoices name="document-theme" value={settings.documents} onChange={(value) => set('documents', value as Theme)} />
      </section>

      <button type="button" className="btn btn-ghost" onClick={() => persistThemeSettings(DEFAULT_THEME_SETTINGS)}>{t('Restore default themes')}</button>
    </div>
  );
}
