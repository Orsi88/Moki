// Files given to an AI terminal (a pasted image saved first, files dropped from the computer or the project tree)
// are typed into its prompt as paths, the way a terminal does when a file is dropped on it. Claude Code reads an
// image path in the prompt and attaches it. Codex only attaches an image when the path arrives as a paste, so an
// image for Codex is wrapped in a bracketed paste. Pure.

const IMAGE_PATH = /\.(png|jpe?g|gif|webp)$/i;

// One path as the prompt should get it: in double quotes when it has a space or a character a shell would read.
export const quotePath = (path: string): string => (/[\s"'&()^%!;,`$]/.test(path) ? `"${path.replace(/"/g, '')}"` : path);

// What is typed: the paths, separated by spaces, with a space after the last so the person can go on writing.
export const pathsText = (paths: string[]): string => (paths.length ? `${paths.map(quotePath).join(' ')} ` : '');

// Codex attaches an image from a paste of its path, not from characters typed into the prompt.
const bracketedPaste = (text: string): string => `\x1b[200~${text}\x1b[201~`;

// Image paths for Codex go in as pastes. Anything else is still typed, including for Claude.
export function terminalInput(paths: string[], tool?: string): string {
  if (tool !== 'codex') return pathsText(paths);
  const images = paths.filter((p) => IMAGE_PATH.test(p));
  const rest = paths.filter((p) => !IMAGE_PATH.test(p));
  return `${images.map((p) => bracketedPaste(quotePath(p))).join('')}${pathsText(rest)}`;
}

// Images in a paste that carries no text (a screenshot): a paste with text stays a text paste.
export function pastedImages(files: ArrayLike<{ type: string }> | undefined, text: string): number[] {
  if (text.trim() || !files) return [];
  const out: number[] = [];
  for (let i = 0; i < files.length; i++) if (/^image\/(png|jpeg|gif|webp)$/.test(files[i].type)) out.push(i);
  return out;
}
