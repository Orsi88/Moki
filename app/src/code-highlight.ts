// A small highlighter for the code embed. The text is unchanged; only some words
// get a kind, so the fence can be saved from the same characters.

export interface CodeToken { kind: '' | 'key' | 'str' | 'cmt' | 'num' | 'op'; text: string }

const KEYS: Record<string, string[]> = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new', 'import', 'from', 'export', 'async', 'await', 'of', 'in', 'this', 'typeof'],
  typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'new', 'import', 'from', 'export', 'async', 'await', 'type', 'interface', 'extends', 'implements', 'public', 'private'],
  python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'with', 'try', 'except', 'lambda', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is'],
  java: ['class', 'public', 'private', 'static', 'void', 'return', 'if', 'else', 'new', 'import', 'package', 'extends'],
  go: ['func', 'return', 'if', 'else', 'for', 'package', 'import', 'var', 'const', 'type', 'struct', 'interface', 'defer'],
  rust: ['fn', 'let', 'mut', 'return', 'if', 'else', 'for', 'while', 'struct', 'enum', 'impl', 'use', 'pub', 'mod', 'match'],
  sql: ['select', 'from', 'where', 'and', 'or', 'insert', 'into', 'update', 'delete', 'join', 'on', 'as', 'create', 'table', 'values', 'not', 'null', 'into', 'set', 'group', 'order', 'by', 'limit'],
  bash: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'in', 'case', 'esac', 'function', 'echo', 'exit', 'return', 'local', 'export', 'source', 'cd', 'set', 'unset', 'read', 'printf', 'test'],
  css: ['color', 'background', 'margin', 'padding', 'display', 'flex', 'grid', 'none', 'auto', 'width', 'height', 'border', 'font', 'position', 'content', 'important'],
  json: ['true', 'false', 'null'],
  yaml: ['true', 'false', 'null', 'yes', 'no'],
  c: ['if', 'else', 'for', 'while', 'return', 'int', 'void', 'char', 'struct', 'const'],
  cpp: ['if', 'else', 'for', 'while', 'return', 'int', 'void', 'char', 'struct', 'const', 'class', 'public', 'private', 'namespace', 'new'],
};

const OPS = new Set('=+-*/%<>!&|?:.,;()[]{}');

const HASH = new Set(['python', 'bash', 'yaml', 'ruby']);

// Walks the source once. A hash starts a comment only in the languages that use it.
export function highlightParts(source: string, lang: string): CodeToken[] {
  const words = new Set(KEYS[lang] ?? []);
  const hash = HASH.has(lang);
  const slash = lang !== 'python' && lang !== 'css' && lang !== 'sql';
  const fold = lang === 'sql' || lang === 'bash' || lang === 'css';
  const parts: CodeToken[] = [];
  let i = 0;
  let lineStart = true;
  const push = (kind: CodeToken['kind'], text: string) => { if (text) parts.push({ kind, text }); };
  while (i < source.length) {
    const rest = source.slice(i);
    if ((slash || lang === 'css') && rest.startsWith('/*')) {
      const end = rest.indexOf('*/');
      const n = end === -1 ? rest.length : end + 2;
      push('cmt', rest.slice(0, n));
      i += n;
      continue;
    }
    if (slash && rest.startsWith('//')) {
      const end = rest.indexOf('\n');
      const n = end === -1 ? rest.length : end;
      push('cmt', rest.slice(0, n));
      i += n;
      continue;
    }
    if (lang === 'html') {
      const tag = /^<\/?[A-Za-z][\w:-]*/.exec(rest);
      if (tag) { push('key', tag[0]); i += tag[0].length; continue; }
    }
    if (hash && rest[0] === '#') {
      const end = rest.indexOf('\n');
      const n = end === -1 ? rest.length : end;
      push('cmt', rest.slice(0, n));
      i += n;
      continue;
    }
    const str = /^(?:`[^`\n]*`|'(?:\\.|[^'\n\\])*'|"(?:\\.|[^"\n\\])*")/.exec(rest);
    if (str) { push('str', str[0]); i += str[0].length; continue; }
    const num = /^\d+(?:\.\d+)?/.exec(rest);
    if (num && (i === 0 || !/[A-Za-z0-9_]/.test(source[i - 1]))) { push('num', num[0]); i += num[0].length; continue; }
    const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(rest);
    if (word) {
      const name = fold ? word[0].toLowerCase() : word[0];
      const command = lang === 'bash' && lineStart;
      push(words.has(name) || command ? 'key' : '', word[0]);
      lineStart = false;
      i += word[0].length;
      continue;
    }
    if (rest[0] === '\n') { lineStart = true; push('', '\n'); i++; continue; }
    if (lineStart && (rest[0] === ' ' || rest[0] === '\t')) { push('', rest[0]); i++; continue; }
    lineStart = false;
    if (OPS.has(rest[0])) { push('op', rest[0]); i++; continue; }
    push('', rest[0]);
    i++;
  }
  return parts;
}
