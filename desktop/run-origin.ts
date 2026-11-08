// What a run is called in the app: the activity it came from (state.json `activity`) and its scenario, the
// words of its slug. A run id is YYYYMMDD-HHMM-<skill or workflow>-<slug>; the app's own tracking slug
// (moki-<32 hex>) names no scenario. Pure: the service gives it the activities the project sees.

export interface RunOrigin {
  activity: { id: string; label: string } | null; // null: a request that did not come from an activity
  scenario: string; // "erro no login"; '' when the slug only tracks the request
}

export function runOrigin(run: { id: string; skill?: unknown; workflow?: unknown; activity?: unknown }, labels: ReadonlyMap<string, string>): RunOrigin {
  const id = typeof run.activity === 'string' && run.activity ? run.activity : '';
  // A deleted or renamed activity still names its runs: its id.
  const activity = id ? { id, label: labels.get(id) ?? id } : null;
  const after = /^\d{8}-\d{4}-(.+)$/.exec(run.id)?.[1] ?? run.id;
  const kind = [run.skill, run.workflow].find((k): k is string => typeof k === 'string' && Boolean(k)) ?? '';
  const slug = kind && after.startsWith(`${kind}-`) ? after.slice(kind.length + 1) : after;
  const scenario = slug.replace(/(^|-)moki-[a-f0-9]{32}$/, '').replace(/-+/g, ' ').trim();
  return { activity, scenario };
}
