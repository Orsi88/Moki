// Codex saves generated images in CODEX_HOME/generated_images/<thread-id>/, outside the project. Only an image
// linked by an assistant in this conversation, in this thread's folder, can be copied into its local history.
// The original reference deterministically names the copy, so history still works after Codex clears its cache.
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { chatFileRefs, chatLocalPath, CHAT_IMAGE } from './chat-files.ts';
import { chatAssetsDir, type ChatRecord } from './chat-store.ts';
import { IMAGE_LIMIT, resolveInside } from './fs-guard.ts';

const same = (a: string, b: string) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

export function keepChatImage(projectDir: string, record: ChatRecord, ref: string, home: string, env: NodeJS.ProcessEnv = process.env): string | null {
  if (record.tool !== 'codex' || !record.sessionId || !/^[a-zA-Z0-9_-]{1,128}$/.test(record.sessionId)
    || !record.messages.some((m) => m.role === 'assistant' && chatFileRefs(m.text).includes(ref))) return null;
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
    const thread = join(generated, record.sessionId);
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
