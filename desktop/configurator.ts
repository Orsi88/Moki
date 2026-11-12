// The Configurador: the person says in their words what they want set up in Moki, their AI answers with a plan of
// changes (JSON only, no tool that writes), and Moki shows it as a checklist. Nothing changes until the person applies
// the steps they keep checked; each one goes through the same service call the Settings screens use, with the same
// checks (service.ts › configApply). The terminal version of the agent is agents/framework/configurador.md.

// What a step may set up. Each kind is one Settings screen.
export const CONFIG_KINDS = ['routine', 'activity', 'agent', 'template', 'mcp', 'tag', 'project'] as const;
export type ConfigKind = (typeof CONFIG_KINDS)[number];
export interface ConfigStep { kind: ConfigKind; title: string; why: string; data: Record<string, unknown> }

// What the workspace has now, short, so the AI reuses names and ids instead of guessing them.
export interface ConfigSnapshot {
  project: { id: string; name: string; description: string; tags: string[] } | null;
  projects: { id: string; name: string }[];
  agents: { name: string; description: string }[];
  skills: string[];
  activities: { id: string; label: string }[];
  operations: { id: string; name: string }[];
  routines: { id: string; name: string }[];
  mcp: { id: string; name: string; access: string; tools: string[] }[];
  templates: { id: string; name: string; baseFile: boolean }[];
  tags: { id: string; name: string }[];
}

const SHAPES = [
  '- "routine" (needs a project): {"name","description","instructions","executionPolicy":"monitor|supervised|authorized","tool":"claude|codex|","schedule":{"kind":"manual|interval|daily|weekly|monthly","time":"HH:mm","daysOfWeek":[0-6],"dayOfMonth":1-31,"intervalMinutes":n,"timezone":"Area/City"},"resources":[source]} where a source is {"kind":"query","serverId","tool","arguments":{...}} or {"kind":"files","paths":["context/x.md"]} or {"kind":"folder","path":"context","recursive":true}. Paths are inside the project. A query is called again on every run; every record it returns is followed.',
  '- "activity" (a ready-made request people pick in the app): {"label","description","category","kind":"prompt|skills|agent|operation","skills":["skill names, when kind is skills"],"target":"agent name or operation id, when kind is agent or operation","files":"none|optional|required","template":"the request sent to the AI (required when kind is prompt); {files} becomes the chosen files, {project} the project id","note":"","tags":[]}.',
  '- "agent" (a new agent): {"name":"kebab-case","description":"what it does and how it works, in the second person","skills":["installed skill names"],"scope":"project|global"}.',
  '- "template" (a visual template): {"name","tags":[],"style":{"font":{"family","size","color"},"accent","table":{"header","headerText","border"},"header":{"left","center","right"},"footer":{"left","center","right"},"watermark":{"text"}}}. Colours are #RRGGBB.',
  '- "mcp" (a connection): {"name","description","transport":"stdio|http","command","args":[],"url","access":"read|execute","enabled":true,"projects":[project ids, empty = every project]}. Never write a password, token or key: leave it out and say in "why" where the person adds it.',
  '- "tag": {"name","description"}.',
  '- "project" (needs a project): {"description","tags":[tag ids]}.',
].join('\n');

// The whole request, sent on stdin.
export function configPrompt(request: string, snapshot: ConfigSnapshot, language: string): string {
  return [
    'You are the Configurador of Moki, a desktop app that organizes QA work with AI agents, skills, activities, operations,',
    'routines, MCP connections, templates, tags and projects. The person describes what they want set up; you answer with a plan',
    'of changes that Moki shows them to approve. You never change anything yourself.',
    snapshot.project ? `The plan is for the project "${snapshot.project.name}" (id ${snapshot.project.id}).` : 'The plan is for the whole workspace (no project is open: routines and project changes are not possible here).',
    'Rules: reuse the ids and names that exist (listed below) instead of guessing; never invent a server, tool, skill or file that is not listed;',
    'when something needed is missing or unclear, do not guess it: leave the step out and ask in "questions".',
    'Prefer few, complete steps. Write "title", "why" and "questions" in ' + language + '; keep ids and JSON keys in English.',
    'Kinds of step and their "data":',
    SHAPES,
    'Answer with JSON only, no other text: {"steps":[{"kind":"...","title":"what this step does, short","why":"why it helps the request","data":{...}}],"questions":["..."],"answer":"one or two sentences for the person, for example when the request is a question about Moki"}',
    '',
    'What exists now:',
    JSON.stringify(snapshot),
    '',
    'The request:',
    request.trim().slice(0, 4000),
    '',
  ].join('\n');
}

export interface ConfigPlan { steps: ConfigStep[]; questions: string[]; answer: string }

// The plan in the AI's answer: only steps of a known kind with an object as data. Routine and project steps need a project.
export function readConfigPlan(answer: string, hasProject: boolean): ConfigPlan {
  const json = /\{[\s\S]*\}/.exec(answer.replace(/^```(?:json)?\s*|\s*```$/g, ''))?.[0];
  let raw: Record<string, unknown> = {};
  try { const parsed: unknown = json ? JSON.parse(json) : null; if (parsed && typeof parsed === 'object') raw = parsed as Record<string, unknown>; } catch { raw = {}; }
  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const steps = (Array.isArray(raw.steps) ? raw.steps : []).flatMap((item): ConfigStep[] => {
    if (!item || typeof item !== 'object') return [];
    const { kind, title, why, data } = item as Record<string, unknown>;
    if (!CONFIG_KINDS.includes(kind as ConfigKind) || !data || typeof data !== 'object' || Array.isArray(data)) return [];
    if (!hasProject && (kind === 'routine' || kind === 'project')) return [];
    if (JSON.stringify(data).length > 20_000) return [];
    return [{ kind: kind as ConfigKind, title: text(title, 200) || String(kind), why: text(why, 500), data: data as Record<string, unknown> }];
  }).slice(0, 20);
  const questions = (Array.isArray(raw.questions) ? raw.questions : []).map((q) => text(q, 400)).filter(Boolean).slice(0, 8);
  return { steps, questions, answer: text(raw.answer, 1000) };
}
