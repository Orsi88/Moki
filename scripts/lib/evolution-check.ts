// What a proposed version of an agent, skill or activity must keep (scripts/lib/evolution.ts stores it only when this
// finds nothing): the same rules as the item's own checks, plus what a proposal may never change on its own - an
// agent's name, category and access level (no proposal turns a read-only agent into one that writes), a skill's name
// and status, an activity's id. The skill rules are the ones scripts/validate.mjs applies.

import { existsSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { listAgents, listCategories, parseAgent, validateAgent } from './agents.ts';
import { builtinDir as builtinActivitiesDir, libraryDir as libraryActivitiesDir, parseActivity } from './activities.ts';
import { listSkills } from './core.ts';
import { parseFrontmatter } from './frontmatter.mjs';
import { REQUIRED_SECTIONS } from '../validate.mjs';
import { ROOT } from './repo.mjs';
import { isEvolutionKind, isItemName, type EvolvedItem } from './evolution.ts';

const MAX_SKILL_LINES = 500;

// The item a person or Mycroft names: Moki's own agents, skills and activities, and the person's agents and
// activities of the library. Its `file` is its own text (an evolved built-in's version is elsewhere).
export function evolutionItem(kind: unknown, name: unknown, root = ROOT): EvolvedItem {
  if (!isEvolutionKind(kind) || !isItemName(name)) throw new Error('Name an agent, skill or activity of Moki.');
  if (kind === 'agent') {
    const agent = listAgents(root).find((a) => a.name === name);
    if (!agent) throw new Error(`Moki has no agent "${name}".`);
    return { kind, name, file: resolve(root, agent.originalPath ?? agent.path), builtin: agent.source === 'builtin' };
  }
  if (kind === 'skill') {
    const file = join(root, 'skills', name, 'SKILL.md');
    if (!existsSync(file)) throw new Error(`Moki has no skill "${name}" (only Moki's own skills evolve here).`);
    return { kind, name, file, builtin: true };
  }
  const builtin = join(builtinActivitiesDir(root), `${name}.md`);
  if (existsSync(builtin)) return { kind, name, file: builtin, builtin: true };
  const own = join(libraryActivitiesDir(root), `${name}.md`);
  if (existsSync(own)) return { kind, name, file: own, builtin: false };
  throw new Error(`Moki has no activity "${name}" that can evolve.`);
}
const headings = (body: string) => [...body.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());

export function versionProblems(item: EvolvedItem, text: string, root = ROOT): string[] {
  const original = readFileSync(item.file, 'utf8');
  if (item.kind === 'agent') {
    const source = item.builtin ? 'builtin' : 'custom';
    const { agent, errors } = parseAgent(text, source, item.file);
    if (!agent) return errors;
    const before = parseAgent(original, source, item.file).agent;
    const problems = [...errors, ...validateAgent(agent, {
      skills: listSkills(root).map((s) => s.name), categories: listCategories(root).map((c) => c.id), fileName: item.name, folder: before?.category ?? agent.category,
    })];
    if (before && agent.category !== before.category) problems.push('the category cannot change');
    if (before && agent.access !== before.access) problems.push('the access level cannot change');
    return problems;
  }
  if (item.kind === 'activity') {
    const { activity, errors } = parseActivity(text, item.name, item.builtin ? 'builtin' : 'library');
    return activity ? errors : errors.length ? errors : ['not a valid activity'];
  }
  const { data, body, errors } = parseFrontmatter(text) as { data: Record<string, unknown> | null; body: string; errors: string[] };
  if (!data) return errors.length ? errors : ['missing frontmatter'];
  const before = (parseFrontmatter(original) as { data: Record<string, unknown> | null }).data ?? {};
  const problems = [...errors];
  if (data.name !== item.name) problems.push(`the name must stay "${item.name}"`);
  const description = String(data.description ?? '');
  if (!description || description.length > 1024) problems.push('description is required (max 1024 characters)');
  const status = (data.metadata as Record<string, unknown> | undefined)?.status;
  if (status !== (before.metadata as Record<string, unknown> | undefined)?.status) problems.push('the status cannot change');
  const found = headings(body);
  for (const s of REQUIRED_SECTIONS as string[]) if (!found.includes(s)) problems.push(`missing section "## ${s}"`);
  if (text.split('\n').length > MAX_SKILL_LINES) problems.push(`longer than ${MAX_SKILL_LINES} lines`);
  if (basename(item.file) !== 'SKILL.md') problems.push('not a skill file');
  return problems;
}
