// Codex saves generated images in CODEX_HOME/generated_images/<thread-id>/, outside the project. Only an image of this
// thread's folder - linked by an answer of this conversation, or made during one - is copied into its local history.
// The original reference deterministically names the copy, so history still works after Codex clears its cache.
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readdirSync, readSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { chatFileRefs, chatLocalPath, CHAT_IMAGE } from './chat-files.ts';
import { chatAssetsDir, type ChatRecord } from './chat-store.ts';
import { IMAGE_LIMIT, resolveInside } from './fs-guard.ts';

const same = (a: string, b: string) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

export function keepChatImage(projectDir: string, record: ChatRecord, ref: string, home: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (!record.messages.some((m) => m.role === 'assistant' && chatFileRefs(m.text).includes(ref))) return null;
  return copyCodexImage(projectDir, record, ref, home, env);
}

const codexThread = (record: ChatRecord) => record.tool === 'codex' && Boolean(record.sessionId) && /^[a-zA-Z0-9_-]{1,128}$/.test(record.sessionId ?? '');

// The images Codex generated in this conversation's thread folder since `since` (the answer's start, ms), copied into
// the conversation's own folder: an answer shows what it made even when its text names no path. Paths relative to the
// project, oldest first; the ones the answer already links are left out.
export function newChatImages(projectDir: string, record: ChatRecord, since: number, home: string, env: NodeJS.ProcessEnv = process.env): string[] {
  if (!codexThread(record)) return [];
  let thread: string;
  try { thread = join(realpathSync(env.CODEX_HOME || join(home, '.codex')), 'generated_images', record.sessionId as string); } catch { return []; }
  let names: string[];
  try { names = readdirSync(thread); } catch { return []; }
  const key = (p: string) => (process.platform === 'win32' ? resolve(p).toLowerCase() : resolve(p));
  const linked = new Set(record.messages.flatMap((m) => (m.role === 'assistant' ? chatFileRefs(m.text) : [])).flatMap((r) => { try { return [key(chatLocalPath(r))]; } catch { return []; } }));
  return names
    .map((name) => join(thread, name))
    .filter((file) => CHAT_IMAGE.has(extname(file).toLowerCase()) && !linked.has(key(file)))
    .map((file) => { try { const st = lstatSync(file); return st.isFile() && st.mtimeMs >= since ? { file, at: st.mtimeMs } : null; } catch { return null; } })
    .filter((f): f is { file: string; at: number } => Boolean(f))
    .sort((a, b) => a.at - b.at)
    .map(({ file }) => copyCodexImage(projectDir, record, file, home, env))
    .filter((rel): rel is string => Boolean(rel));
}

// One image of this conversation's Codex thread folder, copied once into the conversation's own folder (named by its
// original path); null when it is not such an image or cannot be read safely.
function copyCodexImage(projectDir: string, record: ChatRecord, ref: string, home: string, env: NodeJS.ProcessEnv): string | null {
  if (!codexThread(record)) return null;
  try {
    const raw = chatLocalPath(ref);
    if (!isAbsolute(raw)) return null;
    const source = resolve(raw);
    const ext = extname(source).toLowerCase();
    if (!CHAT_IMAGE.has(ext)) return null;
    const identity = process.platform === 'win32' ? source.toLowerCase() : source;
    const name = `${createHash('sha256').update(identity).digest('hex')}${ext}`;
    const assets = chatAssetsDir(projectDir, record.id);
    const destination = join(assets, name);
    const rel = relative(realpathSync(projectDir), destination).split(sep).join('/');
    // A copy already owned by this conversation needs no access to the old profile or source file.
    if (existsSync(destination)) {
      if (lstatSync(destination).isSymbolicLink()) return null;
      const stat = statSync(destination);
      return stat.isFile() && stat.size > 0 && stat.size <= IMAGE_LIMIT ? rel : null;
    }
    const profile = realpathSync(env.CODEX_HOME || join(home, '.codex'));
    const generated = join(profile, 'generated_images');
    const thread = join(generated, record.sessionId as string); // checked by codexThread
    // No junction or symlink may turn the thread directory into a different session's outputs.
    if (lstatSync(generated).isSymbolicLink() || lstatSync(thread).isSymbolicLink()) return null;
    if (!same(realpathSync(thread), thread) || !same(resolve(source, '..'), thread)) return null;
    if (lstatSync(source).isSymbolicLink() || !same(realpathSync(source), source)) return null;
    resolveInside(thread, basename(source));
    const fd = openSync(source, 'r');
    let data: Buffer;
    try {
      const stat = fstatSync(fd);
      if (!stat.isFile() || stat.size === 0 || stat.size > IMAGE_LIMIT) return null;
      data = Buffer.alloc(stat.size + 1); // also detect a file growing beyond the checked size
      let size = 0;
      while (size < data.length) { const n = readSync(fd, data, size, data.length - size, null); if (!n) break; size += n; }
      if (size !== stat.size) return null;
      data = data.subarray(0, size);
    } finally { closeSync(fd); }
    mkdirSync(assets, { recursive: true });
    // Recheck after creating the directory and never replace an earlier preview.
    if (chatAssetsDir(projectDir, record.id) !== assets) return null;
    writeFileSync(destination, data, { flag: 'wx', mode: 0o600 });
    return rel;
  } catch { return null; } // the ordinary unavailable-file card explains an absent or unservable output
}
