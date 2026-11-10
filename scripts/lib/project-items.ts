// The skills and agents a project uses: one list for the project panel, the ▶ request and the AI's
// start prompt (scripts/lib/core.ts, buildStartPrompt and buildInvokePrompt). It lives apart from
// core.ts because it needs agent-tags.ts, which already imports core.ts.
//
// Where each one comes from: skills installed only for the project, global skills it links
// (~/.claude/skills, ~/.agents/skills) and Moki's ArtCraft skills, its defaults, and the agents installed
// for it or that Moki's library reaches it through its own tag or a shared tag, and the agents for every project
// (no tag) that were brought from this project's settings (library/uploads.json). The other agents for every
// project are not listed.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './repo.mjs';
import { parseFrontmatter } from './frontmatter.mjs';
import { reachOf } from './tags.mjs';
import { installedAgents, installedSkills, isUsable, projectAgentsDir, projectSkillsDir, projectSummary, skillFolders } from './core.ts';
import { isUsableAgent, listAgents } from './agents.ts';
import { agentTags } from './agent-tags.ts';
import { listUploads } from './uploads.ts';

// project: installed only for this project; global: in the user's folder, for every project; moki: Moki's own skill or agent.
export type ProjectItemScope = 'project' | 'global' | 'moki';
export interface ProjectItem {
  kind: 'skill' | 'agent';
  name: string;
  scope: ProjectItemScope;
  path: string; // what the AI is told to read: relative to the Moki folder, or absolute ('' when missing)
  description: string; // first line of the frontmatter description, '' when there is none
  default?: boolean; // set as a default of the project
  missing?: boolean; // linked or set as a default, but no longer installed
}

const DESCRIPTION_LIMIT = 300;

// ponytail: one readFileSync + parse per item, on each call; cache by mtime if a project ever has hundreds.
function describe(file: string): string {
  try {
    const data = parseFrontmatter(readFileSync(file, 'utf8')).data as { description?: unknown } | null;
    return String(data?.description ?? '').split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_LIMIT);
  } catch { return ''; }
}

const globalSkillDirs = (home: string): string[] => [join(home, '.claude', 'skills'), join(home, '.agents', 'skills')];

// Moki's own ArtCraft skills (the ones its built-in artcraft agents use) can be linked to a project like global skills.
export const artcraftSkills = (root = ROOT): string[] => [...new Set(listAgents(root).filter((a) => a.source === 'builtin' && a.category === 'artcraft').flatMap((a) => a.skills))]
  .filter((n) => isUsable(n, root)).sort();

// Global and ArtCraft skills the project links by name (project.json linkedSkills); skills no longer installed are left out.
// ArtCraft skills are named relative to the Moki folder, where AI tools start.
export function linkedGlobalSkills(project: string, root = ROOT, home = ''): { name: string; path: string }[] {
  return projectSummary(project, root).linkedSkills.flatMap((name) => {
    const base = globalSkillDirs(home).find((dir) => skillFolders(dir).includes(name));
    if (base) return [{ name, path: join(base, name, 'SKILL.md') }];
    return artcraftSkills(root).includes(name) ? [{ name, path: `skills/${name}/SKILL.md` }] : [];
  });
}

export function projectItems(project: string, root = ROOT, home = ''): ProjectItem[] {
  const summary = projectSummary(project, root);
  const defaults = new Set(summary.defaults.map((d) => `${d.kind}:${d.id}`));
  const items: ProjectItem[] = [];
  const add = (item: Omit<ProjectItem, 'default'>) => {
    if (items.some((i) => i.kind === item.kind && i.name === item.name)) return; // the first source wins: the project's own
    items.push({ ...item, ...(defaults.has(`${item.kind}:${item.name}`) ? { default: true } : {}) });
  };
  const missingSkill = (name: string): Omit<ProjectItem, 'default'> => ({ kind: 'skill', name, scope: 'global', path: '', description: '', missing: true });

  const skills = projectSkillsDir(project, root);
  for (const name of installedSkills(project, root)) {
    add({ kind: 'skill', name, scope: 'project', path: `${skills.label}/${name}/SKILL.md`, description: describe(join(skills.dir, name, 'SKILL.md')) });
  }

  const linked = linkedGlobalSkills(project, root, home);
  for (const name of summary.linkedSkills) {
    const found = linked.find((l) => l.name === name);
    if (!found) { add(missingSkill(name)); continue; }
    const mokiOwn = found.path.startsWith('skills/');
    add({ kind: 'skill', name, scope: mokiOwn ? 'moki' : 'global', path: found.path, description: describe(mokiOwn ? join(root, found.path) : found.path) });
  }

  for (const d of summary.defaults) {
    if (d.kind === 'skill') {
      if (existsSync(join(root, 'skills', d.id, 'SKILL.md')) && isUsable(d.id, root)) {
        add({ kind: 'skill', name: d.id, scope: 'moki', path: `skills/${d.id}/SKILL.md`, description: describe(join(root, 'skills', d.id, 'SKILL.md')) });
      } else {
        const base = globalSkillDirs(home).find((dir) => skillFolders(dir).includes(d.id));
        add(base ? { kind: 'skill', name: d.id, scope: 'global', path: join(base, d.id, 'SKILL.md'), description: describe(join(base, d.id, 'SKILL.md')) } : missingSkill(d.id));
      }
    }
  }

  const agents = projectAgentsDir(project, root);
  for (const name of installedAgents(project, root)) {
    add({ kind: 'agent', name, scope: 'project', path: `${agents.label}/${name}.md`, description: describe(join(agents.dir, `${name}.md`)) });
  }

  const tags = agentTags(root);
  const uploads = listUploads(root);
  for (const a of listAgents(root).filter(isUsableAgent)) {
    const reach = reachOf(tags[a.name] ?? [], project, root).state; // 'all' (no tag) is every project's: listed only when this project brought it
    if (reach === 'own' || reach === 'shared' || defaults.has(`agent:${a.name}`) || (reach === 'all' && uploads[`agent:${a.name}`]?.project === project)) add({ kind: 'agent', name: a.name, scope: 'moki', path: a.path, description: a.description.split('\n')[0].replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_LIMIT) });
  }
  for (const d of summary.defaults) {
    if (d.kind === 'agent') add({ kind: 'agent', name: d.id, scope: 'moki', path: '', description: '', missing: true }); // ignored when listed above
  }

  const order = { skill: 0, agent: 1 };
  return items.sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name));
}
