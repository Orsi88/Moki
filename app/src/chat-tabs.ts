// Chat tabs keep independent drafts and conversation ids; the original tab keeps its legacy preferences.
export const isChatTab = (key: string | null | undefined): key is 'chat' | `chat:${string}` => key === 'chat' || Boolean(key?.startsWith('chat:'));
export const chatTabPrefix = (workspace: string, project: string, tab: string): string =>
  `qa-chat:${workspace}:${project}${tab === 'chat' ? '' : `:${tab}`}`;
