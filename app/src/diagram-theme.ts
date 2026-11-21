// The colors of Mermaid diagrams drawn in the app (Diagrams.tsx): the theme tokens where the diagram is drawn (a chat
// answer, or a document with its own light or dark palette), so it looks like part of Moki in any theme. Mermaid reads hex colors
// only, so a theme with any other color form keeps Mermaid's built-in theme. No app imports: tests read it directly.
// The PDF export (scripts/lib/diagram-frame.mjs) and the .mmd file view keep their neutral print colors.

export interface MermaidTheme {
  key: string; // the diagram cache key's theme part: another palette is another drawing
  config: { theme: 'base' | 'dark' | 'neutral'; themeVariables?: Record<string, string | boolean> };
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// Relative brightness of a hex color, 0 (black) to 1 (white).
function luminance(hex: string): number {
  let h = hex.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// token: a CSS custom property's value on the root ('' when unset); dark: the app's theme, for the built-in fallback;
// font: the app's text font.
export function mermaidTheme(token: (name: string) => string, dark: boolean, font = ''): MermaidTheme {
  const color = (name: string) => token(name).trim();
  const colors = {
    background: color('--bg'),
    primaryColor: color('--bg-3'), // a node
    primaryTextColor: color('--text'),
    primaryBorderColor: color('--accent'),
    secondaryColor: color('--bg-2'),
    tertiaryColor: color('--bg-2'),
    lineColor: color('--muted'),
    textColor: color('--text'),
    titleColor: color('--text'),
    edgeLabelBackground: color('--bg-2'),
    clusterBkg: color('--bg-2'),
    clusterBorder: color('--border'),
    noteBkgColor: color('--bg-2'),
    noteTextColor: color('--text'),
    noteBorderColor: color('--border'),
  };
  if (!Object.values(colors).every((v) => HEX.test(v))) {
    const theme = dark ? 'dark' as const : 'neutral' as const;
    return { key: theme, config: { theme } };
  }
  // Dark or light from the background itself: a theme that follows the system has no data-theme to read.
  const themeVariables = { darkMode: luminance(colors.background) < 0.5, ...colors, ...(font.trim() ? { fontFamily: font.trim() } : {}) };
  return { key: `app:${JSON.stringify(themeVariables)}`, config: { theme: 'base', themeVariables } };
}
