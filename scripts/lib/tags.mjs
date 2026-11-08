// Which projects a workspace item (an agent, a template, an MCP server, an operation)
// applies to, by its tags: no tag = every project; "project:<id>" = that project (every
// project has its own tag); any other tag = the projects that carry it (project.json
// "tags", catalog in workspace/tags.json). One rule for every kind of item. No dependencies.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, workspaceDir } from './repo.mjs';

export const PROJECT_TAG = 'project:';
export const projectTag = (id) => `${PROJECT_TAG}${id}`;
export const isProjectTag = (tag) => typeof tag === 'string' && tag.startsWith(PROJECT_TAG);
const TAG = /^(project:)?[a-z0-9]+(-[a-z0-9]+)*$/;

// A project's own tags (project.json "tags").
export function tagsOfProject(project, root = ROOT) {
  try {
    const data = JSON.parse(readFileSync(join(workspaceDir(root), 'projects', project, 'project.json'), 'utf8'));
    return Array.isArray(data.tags) ? data.tags.filter((t) => typeof t === 'string') : [];
  } catch { return []; }
}

export function appliesTo(tags, project, root = ROOT) {
  if (!Array.isArray(tags) || !tags.length) return true;
  if (tags.includes(projectTag(project))) return true;
  const own = tagsOfProject(project, root);
  return tags.some((t) => own.includes(t));
}

// Any input as a clean list of tags (ids of the catalog or project tags), without repeats.
export const cleanTags = (value) => [...new Set((Array.isArray(value) ? value : []).map(String).filter((t) => TAG.test(t)))].slice(0, 200);

// An item turned off in its last project: no project has this tag (no tag at all would mean every project).
export const NOWHERE = projectTag('none');

// How an item with these tags reaches a project, as the project's settings show it: "all" (no tag),
// "shared" (a tag the project carries, named in `via`; the project cannot drop it alone), "own"
// (the project's own tag) or "off".
export function reachOf(tags, project, root = ROOT) {
  if (!Array.isArray(tags) || !tags.length) return { state: 'all' };
  const carried = tagsOfProject(project, root);
  const via = tags.find((t) => !isProjectTag(t) && carried.includes(t));
  if (via) return { state: 'shared', via };
  return { state: tags.includes(projectTag(project)) ? 'own' : 'off' };
}

// The tags after turning an item on or off in one project, through the project's own tag, so the
// workspace's settings show the same thing. On: the project's tag is added (every project by its
// own tag is the same as no tag). Off: the tag is removed; what reached every project now reaches
// the others (or none). What a shared tag brings cannot be turned off here. `projects`: every
// project id of the workspace.
export function withProject(tags, project, on, projects, root = ROOT) {
  const list = cleanTags(tags);
  const own = projectTag(project);
  const { state, via } = reachOf(list, project, root);
  if (on) {
    if (state !== 'off') return list;
    const next = [...list.filter((t) => t !== NOWHERE), own];
    const everyone = projects.length > 0 && next.every(isProjectTag) && projects.every((p) => next.includes(projectTag(p)));
    return everyone ? [] : next;
  }
  if (state === 'off') return list;
  if (state === 'shared') throw new Error(`It reaches this project through the tag "${via}": change that in the workspace's settings.`);
  const next = state === 'all' ? projects.filter((p) => p !== project).map(projectTag) : list.filter((t) => t !== own);
  return next.length ? next : [NOWHERE];
}
