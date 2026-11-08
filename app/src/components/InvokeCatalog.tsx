// One searchable list for calling an activity, agent, skill or operation from the panel or an AI terminal.
import { useState } from 'react';
import { activityTargetLabel, type ActivityInfo, type AgentInfo, type Invocation, type Operation, type ProjectDefault, type SkillInfo } from '../api';
import { t } from '../i18n';
import { SearchField, matchesQuery } from './CatalogModal';
import { ListTabs } from './ListPage';

interface Props {
  activities: ActivityInfo[]; agents: AgentInfo[]; skills: SkillInfo[]; operations: Operation[];
  onPick: (item: Invocation) => void;
  defaults?: ProjectDefault[]; // the project's defaults come first, marked
}
type Kind = 'all' | Invocation['kind'];
const kindLabel = (kind: Kind) => ({ all: t('All'), activity: t('Activities'), agent: t('Agents'), skill: t('Skills'), operation: t('Operations') })[kind];

export function InvokeCatalog({ activities, agents, skills, operations, onPick, defaults = [] }: Props) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const isDefault = (item: Invocation) => defaults.some((d) => d.kind === item.kind && d.id === item.id);
  const rows: (Invocation & { description: string; search?: string; operation: boolean; favorite: boolean })[] = [
    ...activities.map((a) => ({ kind: 'activity' as const, id: a.id, label: a.label, description: a.hint, search: activityTargetLabel(a.target), operation: a.target.kind === 'operation', favorite: a.favorite })),
    ...agents.map((a) => ({ kind: 'agent' as const, id: a.name, label: a.name, description: a.description, operation: false, favorite: false })),
    ...skills.map((s) => ({ kind: 'skill' as const, id: s.name, label: s.name, description: s.description, operation: false, favorite: false })),
    ...operations.map((o) => ({ kind: 'operation' as const, id: o.id, label: o.name, description: o.description, operation: true, favorite: false })),
  ];
  const shown = rows.filter((item) => (kind === 'all' || item.kind === kind)
    && matchesQuery(query, t(item.label), t(item.description), item.id, item.search ?? '', kindLabel(item.kind)))
    .sort((a, b) => Number(isDefault(b)) - Number(isDefault(a)) || Number(b.favorite) - Number(a.favorite));
  return <div className="invoke-catalog">
    <SearchField value={query} onChange={setQuery} placeholder={t('Search activities, agents, skills and operations')} autoFocus />
    <ListTabs<Kind> label={t('Call type')} value={kind} onChange={setKind}
      tabs={(['all', 'activity', 'agent', 'skill', 'operation'] as const).map((id) => ({ id, label: kindLabel(id) }))} />
    <div className="answer-list">
      {shown.map((item) => <button key={`${item.kind}:${item.id}`} type="button" className="answer invoke-row" onClick={() => onPick(item)}>
        <span className="answer-text">
          <span className="answer-title">{t(item.label)}</span>
          <span className="answer-hint">{t(item.description)}</span>
          {item.operation && <span className="invoke-operation">{t('Each step uses its own terminal. Opens the operation form.')}</span>}
        </span>
        <span className="invoke-chips">
          {isDefault(item) && <span className="chip chip-accent">{t('Default')}</span>}
          <span className="chip">{kindLabel(item.kind)}</span>
        </span>
      </button>)}
      {!shown.length && <p className="muted small">{t('Nothing matches this search.')}</p>}
    </div>
  </div>;
}
