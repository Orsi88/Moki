// Files given to an AI terminal (a pasted image saved first, files dropped from the computer or the project tree)
// are typed into its prompt as paths, the way a terminal does when a file is dropped on it: the AI tool reads the
// file from there (Claude Code and Codex attach an image path as an image). Pure.

// One path as the prompt should get it: in double quotes when it has a space or a character a shell would read.
export const quotePath = (path: string): string => (/[\s"'&()^%!;,`$]/.test(path) ? `"${path.replace(/"/g, '')}"` : path);

// What is typed: the paths, separated by spaces, with a space after the last so the person can go on writing.
export const pathsText = (paths: string[]): string => (paths.length ? `${paths.map(quotePath).join(' ')} ` : '');

// Images in a paste that carries no text (a screenshot): a paste with text stays a text paste.
export function pastedImages(files: ArrayLike<{ type: string }> | undefined, text: string): number[] {
  if (text.trim() || !files) return [];
  const out: number[] = [];
  for (let i = 0; i < files.length; i++) if (/^image\/(png|jpeg|gif|webp)$/.test(files[i].type)) out.push(i);
  return out;
}
