// Native IDE chat launches use a single command that creates an editor session and sends to its URI.
// VS Code 1.147's ChatSessionsService openNewSessionEditor contract was verified in the shipped source.
// Focus + paste/submit is deliberately not a launch adapter: focus may change while a command is pending.
import type { IdeAi, IdeChatCapability, IdeChatRequest, IdeChatResult } from '../companion-types.ts';

const INTEGRATIONS: { id: IdeAi; label: string; types: string[] }[] = [
  { id: 'copilot', label: 'GitHub Copilot', types: ['agent-host-copilotcli', 'copilotcli', 'local'] },
  { id: 'claude', label: 'Claude Code', types: ['agent-host-claude', 'claude-code'] },
  { id: 'codex', label: 'Codex', types: ['agent-host-codex', 'openai-codex'] },
  { id: 'cursor', label: 'Cursor', types: [] },
];
const prefix = 'workbench.action.chat.openNewSessionEditor.';
export const isIdeAi = (v: unknown): v is IdeAi => INTEGRATIONS.some((i) => i.id === v);
const supported = (version: string): boolean => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-|$)/.exec(version);
  return Boolean(match && (Number(match[1]) > 1 || Number(match[1]) === 1 && Number(match[2]) >= 147));
};
export interface IdeChatHost {
  version: string;
  commands: () => Promise<readonly string[]>;
  execute: (command: string, options: { prompt: string }) => Promise<unknown>;
  current: (request: IdeChatRequest) => boolean;
  workspaceIssue?: () => string | undefined;
}

export function createIdeChatIntegration(host: IdeChatHost) {
  const commandOf = (id: IdeAi, commands: Set<string>): string | undefined =>
    supported(host.version) ? INTEGRATIONS.find((i) => i.id === id)?.types.map((t) => prefix + t).find((c) => commands.has(c)) : undefined;
  return {
    async capabilities(): Promise<IdeChatCapability[]> {
      const commands = new Set(await host.commands());
      return INTEGRATIONS.map(({ id, label }) => {
        const available = Boolean(commandOf(id, commands));
        const workspaceIssue = available ? host.workspaceIssue?.() : undefined;
        const automatic = available && !workspaceIssue;
        return { id, label, available, automatic, reason: workspaceIssue || (automatic ? '' : id === 'cursor'
          ? 'Cursor prompt links require you to confirm the request. Automatic chat launch is not available.'
          : 'This AI does not expose a supported new-session command here. Enable its VS Code agent integration, or use a terminal.') };
      });
    },
    async start(request: IdeChatRequest): Promise<IdeChatResult> {
      const blocked = (message: string): IdeChatResult => ({ status: 'blocked', requestId: request.requestId, message });
      if (!isIdeAi(request.ai) || !request.prompt.trim()) return blocked('Choose an AI and a request first.');
      const command = commandOf(request.ai, new Set(await host.commands()));
      if (!command) return blocked('Automatic launch is not supported by this AI in this IDE version.');
      const workspaceIssue = host.workspaceIssue?.();
      if (workspaceIssue) return blocked(workspaceIssue);
      if (!host.current(request)) return blocked('The project or folder changed. Start the request again from its project.');
      try {
        const value = await host.execute(command, { prompt: request.prompt });
        // The native command returns the created URI, not a tool/turn acknowledgement. Never report completion.
        const resource = value && typeof value === 'object' ? value as { scheme?: unknown; path?: unknown } : null;
        const session = resource && typeof resource.scheme === 'string' && typeof resource.path === 'string'
          ? `${resource.scheme}:${resource.path}` : undefined;
        return { status: 'unconfirmed', requestId: request.requestId, session,
          message: session ? 'Request dispatched to a new chat tab. Follow its execution there.'
            : 'The IDE did not confirm a new chat tab. Check the chat before trying again.' };
      } catch {
        // A command can fail after delivery; retrying here could run an activity twice.
        return { status: 'unconfirmed', requestId: request.requestId, message: 'Chat delivery could not be confirmed. Check the chat before trying again.' };
      }
    },
  };
}
