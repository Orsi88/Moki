// Accounts of the AI tools: each account is a profile folder in the user folder, which the tool uses when an
// environment variable points to it - Claude Code: ~/.claude or ~/.claude-<name> (CLAUDE_CONFIG_DIR); Codex: ~/.codex
// or ~/.codex-<name> (CODEX_HOME). Moki keeps one account active per AI: it sets that variable in the main process,
// so everything Moki starts afterwards (terminal tabs, the external terminal, the project chat, the plan usage in the
// status bar) inherits it, and a tool already running stays with the account it started with. The person can hide an
// account from Moki (its folder stays). Only tools whose profile mechanism is known are here.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export type AccountTool = 'claude' | 'codex';
export interface AccountProvider { tool: AccountTool; label: string; env: string; base: string; email: (home: string, id: string) => string; signedIn: (home: string, id: string) => boolean }
export interface AiAccount { id: string; name: string; email: string; signedIn: boolean; active: boolean; hidden: boolean }
export interface AiAccounts { tool: AccountTool; label: string; accounts: AiAccount[] }

type Json = Record<string, unknown>;
const readJson = (file: string): Json => {
  try { const v: unknown = JSON.parse(readFileSync(file, 'utf8')); return v && typeof v === 'object' ? v as Json : {}; } catch { return {}; }
};
const isDir = (path: string) => { try { return statSync(path).isDirectory(); } catch { return false; } };

// Claude Code: the default profile keeps its account file next to the folder (~/.claude.json), another one inside it.
// Codex: the account is in auth.json, its e-mail in the id_token's claims.
export const PROVIDERS: Record<AccountTool, AccountProvider> = {
  claude: {
    tool: 'claude', label: 'Claude', env: 'CLAUDE_CONFIG_DIR', base: '.claude',
    email: (home, id) => {
      const value = (readJson(id === '.claude' ? join(home, '.claude.json') : join(home, id, '.claude.json')).oauthAccount as Json | undefined)?.emailAddress;
      return typeof value === 'string' ? value : '';
    },
    // Windows and Linux keep the login in the folder; macOS in the keychain, so there the account e-mail says it.
    signedIn: (home, id) => existsSync(join(home, id, '.credentials.json')) || Boolean(PROVIDERS.claude.email(home, id)),
  },
  codex: {
    tool: 'codex', label: 'ChatGPT (Codex)', env: 'CODEX_HOME', base: '.codex',
    email: (home, id) => {
      const token = (readJson(join(home, id, 'auth.json')).tokens as Json | undefined)?.id_token;
      if (typeof token !== 'string') return '';
      try { const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as Json; return typeof claims.email === 'string' ? claims.email : ''; } catch { return ''; }
    },
    signedIn: (home, id) => existsSync(join(home, id, 'auth.json')),
  },
};
export const ACCOUNT_TOOLS = Object.keys(PROVIDERS) as AccountTool[];
export const isAccountTool = (v: unknown): v is AccountTool => typeof v === 'string' && v in PROVIDERS;

const pattern = (p: AccountProvider) => new RegExp(`^\\${p.base}(?:-[a-z0-9][a-z0-9-]{0,39})?$`, 'i');
export const isAccountId = (tool: AccountTool, v: unknown): v is string => typeof v === 'string' && pattern(PROVIDERS[tool]).test(v);

// The profile folder an environment variable names, when it is one of the user folder's profiles of that tool.
export function accountOf(tool: AccountTool, home: string, dir: string | undefined): string {
  if (!dir) return PROVIDERS[tool].base;
  const full = resolve(dir);
  const same = (a: string, b: string) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  if (!same(dirname(full), resolve(home))) return '';
  const id = full.slice(dirname(full).length + 1);
  return isAccountId(tool, id) ? id : '';
}

export function listAccounts(tool: AccountTool, home: string, active: string, hidden: string[] = []): AiAccount[] {
  const p = PROVIDERS[tool];
  let names: string[] = [];
  try { names = readdirSync(home).filter((n) => n !== p.base && isAccountId(tool, n) && isDir(join(home, n))); } catch { /* no user folder */ }
  return [p.base, ...names.sort((a, b) => a.localeCompare(b))].map((id) => {
    const email = p.email(home, id);
    return { id, name: email || id, email, signedIn: p.signedIn(home, id), active: id === active, hidden: hidden.includes(id) };
  });
}

interface Saved { active: Partial<Record<AccountTool, string>>; hidden: Partial<Record<AccountTool, string[]>> }

// `settingsFile`: Moki's own record of the choices. `legacy`: the file of the first version (Claude only), read once.
export function createAiAccounts(home: string, settingsFile: string, env: NodeJS.ProcessEnv = process.env, legacy?: string) {
  const read = (): Saved => {
    const data = readJson(settingsFile);
    if (!existsSync(settingsFile) && legacy) {
      const old = readJson(legacy).profile;
      return { active: typeof old === 'string' ? { claude: old } : {}, hidden: {} };
    }
    const active = (data.active && typeof data.active === 'object' ? data.active : {}) as Json;
    const hidden = (data.hidden && typeof data.hidden === 'object' ? data.hidden : {}) as Json;
    return {
      active: Object.fromEntries(ACCOUNT_TOOLS.flatMap((t) => (isAccountId(t, active[t]) ? [[t, active[t]]] : []))),
      hidden: Object.fromEntries(ACCOUNT_TOOLS.map((t) => [t, Array.isArray(hidden[t]) ? (hidden[t] as unknown[]).filter((id) => isAccountId(t, id)) as string[] : []])),
    };
  };
  const saved = read();
  // The active account per tool: the saved choice while its folder exists; else what Moki was started with.
  const active: Record<AccountTool, string> = Object.fromEntries(ACCOUNT_TOOLS.map((t) => {
    const p = PROVIDERS[t];
    const choice = saved.active[t];
    return [t, choice && (choice === p.base || isDir(join(home, choice))) ? choice : accountOf(t, home, env[p.env])];
  })) as Record<AccountTool, string>;
  const hidden = saved.hidden;
  // An environment variable outside the user folder (set by the person) is left as it is until an account is chosen.
  const apply = (t: AccountTool) => {
    const { env: name, base } = PROVIDERS[t];
    if (!active[t]) return;
    if (active[t] === base) delete env[name]; else env[name] = join(home, active[t]);
  };
  ACCOUNT_TOOLS.forEach(apply);
  const save = () => {
    mkdirSync(dirname(settingsFile), { recursive: true });
    writeFileSync(settingsFile, `${JSON.stringify({ active, hidden }, null, 2)}\n`, 'utf8');
  };
  const known = (t: unknown, id: unknown): AccountTool => {
    if (!isAccountTool(t)) throw new Error('This AI has no accounts in Moki.');
    if (!isAccountId(t, id) || !listAccounts(t, home, active[t]).some((a) => a.id === id)) throw new Error('Unknown account.');
    return t;
  };

  return {
    list: (): AiAccounts[] => ACCOUNT_TOOLS.map((t) => ({ tool: t, label: PROVIDERS[t].label, accounts: listAccounts(t, home, active[t], hidden[t]) })),
    active: (t: AccountTool) => active[t],
    use(t: unknown, id: unknown) {
      const tool = known(t, id);
      active[tool] = id as string;
      hidden[tool] = (hidden[tool] ?? []).filter((h) => h !== id); // the account in use is never hidden
      apply(tool);
      save();
      return this.list();
    },
    // Hidden: out of the quick switch and of the list (shown again on request); its folder stays. Not the one in use.
    hide(t: unknown, id: unknown, on: boolean) {
      const tool = known(t, id);
      if (on && active[tool] === id) throw new Error('Choose another account before hiding the one in use.');
      hidden[tool] = on ? [...new Set([...(hidden[tool] ?? []), id as string])] : (hidden[tool] ?? []).filter((h) => h !== id);
      save();
      return this.list();
    },
    // A new, empty profile (~/.claude-<name>, ~/.codex-<name>), made active: the next start of the tool asks to sign in.
    add(t: unknown, name: unknown) {
      if (!isAccountTool(t)) throw new Error('This AI has no accounts in Moki.');
      const slug = typeof name === 'string' ? name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) : '';
      const id = `${PROVIDERS[t].base}-${slug}`;
      if (!slug || !isAccountId(t, id)) throw new Error('Name the account with letters or numbers.');
      if (existsSync(join(home, id))) throw new Error('There is already an account with this name.');
      mkdirSync(join(home, id));
      active[t] = id;
      apply(t);
      save();
      return this.list();
    },
  };
}
