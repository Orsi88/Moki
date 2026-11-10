// Quick assistants of a note: the user's AI (Claude Code or Codex) runs once without a terminal, in an empty
// temporary folder, with no tool that writes or runs commands, and answers with Markdown. The note itself is
// never written here: the answer comes back as a suggestion the person accepts or discards (NoteDialog;
// app/src/note-assist.ts places it).
// The note travels on stdin, never as an argument or through a shell.

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export type NoteHelper = 'write' | 'summary' | 'research' | 'critique';
export type AssistTool = 'claude' | 'codex';
export const NOTE_HELPERS: NoteHelper[] = ['write', 'summary', 'research', 'critique'];
export const ASSIST_TOOLS: AssistTool[] = ['claude', 'codex'];

const TASK: Record<NoteHelper, string> = {
  write: [
    'You improve the writing of a note. Rewrite it so it reads clearly: fix spelling and grammar, make sentences direct,',
    'and organize it with headings and lists where that helps the reader.',
    'Keep every fact, name, number, date, link, image (![...](...)), table and code block. Do not add information.',
    'Answer with the whole rewritten note in Markdown and nothing else: no preamble, no explanation, no code fence around it.',
  ].join(' '),
  summary: [
    'Summarize the note in 3 to 5 bullet points, using only what the note says.',
    'Answer with Markdown: a level-2 heading with the word "Summary" in the language of the note, then the bullets. Nothing else.',
  ].join(' '),
  research: [
    'You are Sherlock, an investigator. Research the subject of the note on the web: what is missing, outdated or worth checking.',
    'Open every source you cite and never invent a reference, a title or a URL.',
    'Answer with Markdown: a level-2 heading with the word "Research" in the language of the note, then the findings as bullets,',
    'each ending with a link [source](url) to the page it came from. If you cannot search the web, write one line saying so under',
    'the heading instead of answering from memory. Nothing else.',
  ].join(' '),
  critique: [
    'You are Moriarty, a critical reviewer. Find the weak points of the note: claims without support, contradictions, gaps,',
    'ambiguous wording and the questions a reader would ask. Do not rewrite the note.',
    'Answer with Markdown: a level-2 heading with the words "Critical review" in the language of the note, then a numbered list,',
    'most serious first, each item quoting briefly the passage it refers to and saying why. Nothing else.',
  ].join(' '),
};

// The whole request, sent on stdin. `language`: the one to write in when the note does not show one.
export function assistPrompt(helper: NoteHelper, note: string, language: string): string {
  return `${TASK[helper]}\nWrite in the language the note is written in; if that is unclear, write in ${language}.\n\n<note>\n${note}\n</note>\n`;
}

// The arguments for one run. Claude: print mode, no session kept, no MCP servers, no tool that writes or runs
// commands (web search allowed for research). Codex: exec in a read-only sandbox, the last message to `outFile`.
export function assistArgs(tool: AssistTool, helper: NoteHelper, outFile: string): string[] {
  if (tool === 'claude') {
    return ['-p', '--output-format', 'text', '--no-session-persistence', '--strict-mcp-config',
      '--disallowedTools', 'Bash Edit Write NotebookEdit',
      ...(helper === 'research' ? ['--allowedTools', 'WebSearch WebFetch'] : [])];
  }
  return [...(helper === 'research' ? ['--search'] : []), 'exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '--color', 'never', '-o', outFile];
}

// The answer as Markdown: a code fence the AI put around the whole answer is taken off.
export function cleanAnswer(raw: string): string {
  const text = raw.replace(/\r\n/g, '\n').trim();
  const fenced = /^```(?:markdown|md)?\n([\s\S]*?)\n```$/i.exec(text);
  return (fenced ? fenced[1] : text).trim();
}

export interface AssistRun { done: Promise<string>; cancel: () => void }

// Runs the tool (its resolved path) once. Rejects with the tool's own last error lines when it fails, or on timeout.
// `args`: other arguments for the same run (tests run a small script instead of an AI).
export function runAssist(file: string, tool: AssistTool, helper: NoteHelper, prompt: string, env: NodeJS.ProcessEnv, timeoutMs = 10 * 60_000, args?: (outFile: string) => string[]): AssistRun {
  const dir = mkdtempSync(join(tmpdir(), 'moki-assist-'));
  const outFile = join(dir, 'answer.md');
  // A .cmd or .bat (npm installs) only runs through the shell; the arguments are all fixed above.
  const child = spawn(file, args ? args(outFile) : assistArgs(tool, helper, outFile), { cwd: dir, env, windowsHide: true, shell: /\.(cmd|bat)$/i.test(file), stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  let stopped = '';
  child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
  child.stderr.on('data', (chunk: Buffer) => { stderr = (stderr + chunk.toString('utf8')).slice(-4000); });
  child.stdin.on('error', () => { /* the tool may exit before reading everything */ });
  child.stdin.end(prompt, 'utf8');
  const timer = setTimeout(() => { stopped = 'timeout'; child.kill(); }, timeoutMs);
  const done = new Promise<string>((resolve, reject) => {
    const finish = (error: Error | null, answer = '') => {
      clearTimeout(timer);
      try { rmSync(dir, { recursive: true, force: true }); } catch { /* a leftover temporary folder */ }
      if (error) reject(error); else resolve(answer);
    };
    child.on('error', (e) => finish(e));
    child.on('close', (code) => {
      if (stopped) { finish(new Error(stopped)); return; }
      let answer = stdout;
      if (tool === 'codex') { try { answer = readFileSync(outFile, 'utf8'); } catch { answer = ''; } }
      answer = cleanAnswer(answer);
      if (code !== 0 || !answer) { finish(new Error(stderr.trim().split('\n').slice(-3).join('\n') || `exit ${code}`)); return; }
      finish(null, answer);
    });
  });
  return { done, cancel: () => { stopped = 'cancelled'; child.kill(); } };
}
