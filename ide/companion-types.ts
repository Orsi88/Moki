// Data exchanged by the IDE panel and its host. No editor, filesystem or renderer dependencies.
export type IdeAi = 'copilot' | 'claude' | 'codex' | 'cursor';
export interface IdeChatCapability {
  id: IdeAi;
  label: string;
  available: boolean;
  automatic: boolean;
  reason: string;
}
export interface IdeChatRequest { project: string; folder: string; ai: IdeAi; prompt: string; requestId: string }
export interface IdeChatResult {
  status: 'submitted' | 'blocked' | 'unconfirmed';
  requestId: string;
  message: string;
  session?: string;
}
export interface IdeMcpDiagnostic {
  id: string;
  name: string;
  transport: string;
  access: string;
  issues: string[];
  authentication: boolean;
}
export interface IdeConnections {
  ai: IdeAi | '';
  choices: IdeChatCapability[];
  folder: string | null;
  workspace: string;
  configuration: 'automatic' | 'current' | 'missing' | 'outdated' | 'invalid';
  servers: IdeMcpDiagnostic[];
}
