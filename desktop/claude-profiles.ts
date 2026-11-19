// Claude accounts: each Claude Code profile is a folder in the user folder - ~/.claude (the default) or
// ~/.claude-<name> - with its own sign-in, settings and sessions; Claude Code uses one when CLAUDE_CONFIG_DIR points
// to it. Moki keeps one profile active: it sets CLAUDE_CONFIG_DIR in the main process, so every Claude it starts
// afterwards (terminal tabs, the external terminal, the project chat, the plan usage in the status bar) inherits it,
// and a Claude already running stays with the profile it started with. The choice is kept in Moki's own data folder.

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface ClaudeProfile {
  id: string; // the folder name: '.claude' or '.claude-<name>'
  name: string; // what the person reads: the account e-mail, or the folder's name before signing in
  email: string;
  signedIn: boolean;
  active: boolean;
}

export const DEFAULT_PROFILE = '.claude';
const PROFILE = /^\.claude(?:-[a-z0-9][a-z0-9-]{0,39})?$/i;
export const isProfileId = (v: unknown): v is string => typeof v === 'string' && PROFILE.test(v);

type Json = Record<string, unknown>;
const readJson = (file: string): Json => {
  try { const v: unknown = JSON.parse(readFileSync(file, 'utf8')); return v && typeof v === 'object' ? v as Json : {}; } catch { return {}; }
};
const isDir = (path: string) => { try { return statSync(path).isDirectory(); } catch { return false; } };

// The default profile keeps its account file next to the folder (~/.claude.json); another one inside it.
const accountFile = (home: string, id: string) => (id === DEFAULT_PROFILE ? join(home, '.claude.json') : join(home, id, '.claude.json'));
const email = (home: string, id: string): string => {
  const value = (readJson(accountFile(home, id)).oauthAccount as Json | undefined)?.emailAddress;
  return typeof value === 'string' ? value : '';
};

// The profile folder CLAUDE_CONFIG_DIR names, when it is one of the user folder's profiles.
export function profileOf(home: string, dir: string | undefined): string {
  if (!dir) return DEFAULT_PROFILE;
  const full = resolve(dir);
  const same = (a: string, b: string) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  if (!same(dirname(full), resolve(home))) return '';
  const id = full.slice(dirname(full).length + 1);
  return isProfileId(id) ? id : '';
}

export function listClaudeProfiles(home: string, active: string): ClaudeProfile[] {
  let names: string[] = [];
  try { names = readdirSync(home).filter((n) => n !== DEFAULT_PROFILE && isProfileId(n) && isDir(join(home, n))); } catch { /* no user folder */ }
  return [DEFAULT_PROFILE, ...names.sort((a, b) => a.localeCompare(b))].map((id) => {
    const mail = email(home, id);
    // Windows and Linux keep the login in the folder; macOS in the keychain, so there the account e-mail says it.
    const signedIn = existsSync(join(home, id, '.credentials.json')) || Boolean(mail);
    return { id, name: mail || id, email: mail, signedIn, active: id === active };
  });
}

// The active profile, from the saved choice; without one, the CLAUDE_CONFIG_DIR Moki was started with.
export function createClaudeProfiles(home: string, settingsFile: string, env: NodeJS.ProcessEnv = process.env) {
  const started = profileOf(home, env.CLAUDE_CONFIG_DIR);
  const saved = readJson(settingsFile).profile;
  let active = isProfileId(saved) && (saved === DEFAULT_PROFILE || isDir(join(home, saved))) ? saved : started;
  // A CLAUDE_CONFIG_DIR outside the user folder (set by the person) is left as it is until a profile is chosen.
  const apply = () => { if (!active) return; if (active === DEFAULT_PROFILE) delete env.CLAUDE_CONFIG_DIR; else env.CLAUDE_CONFIG_DIR = join(home, active); };
  apply();

  const choose = (id: string) => {
    active = id;
    apply();
    mkdirSync(dirname(settingsFile), { recursive: true });
    writeFileSync(settingsFile, `${JSON.stringify({ profile: id }, null, 2)}\n`, 'utf8');
  };

  return {
    list: () => listClaudeProfiles(home, active),
    active: () => active,
    use(id: unknown) {
      if (!isProfileId(id) || !listClaudeProfiles(home, active).some((p) => p.id === id)) throw new Error('Unknown Claude account.');
      choose(id);
      return listClaudeProfiles(home, active);
    },
    // A new, empty profile (~/.claude-<name>), made active: the next Claude asks the person to sign in.
    add(name: unknown) {
      const slug = typeof name === 'string' ? name.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) : '';
      const id = `${DEFAULT_PROFILE}-${slug}`;
      if (!slug || !isProfileId(id)) throw new Error('Name the account with letters or numbers.');
      if (existsSync(join(home, id))) throw new Error('There is already an account with this name.');
      mkdirSync(join(home, id));
      choose(id);
      return listClaudeProfiles(home, active);
    },
  };
}
