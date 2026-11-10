import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assistArgs, assistPrompt, cleanAnswer, runAssist } from '../desktop/note-assist.ts';
import { applyAnswer, wordDiff } from '../app/src/note-assist.ts';

test('note-assist: the request carries the note and its task; the language falls back to the chosen one', () => {
  const prompt = assistPrompt('write', 'Minha nota sobre SSO.', 'Portuguese (pt-BR)');
  assert.match(prompt, /<note>\nMinha nota sobre SSO\.\n<\/note>/);
  assert.match(prompt, /Do not add information/);
  assert.match(prompt, /write in Portuguese \(pt-BR\)/);
  assert.match(assistPrompt('research', 'x', 'English'), /never invent a reference/);
  assert.match(assistPrompt('critique', 'x', 'English'), /Do not rewrite the note/);
});

test('note-assist: no tool that writes or runs commands; only research searches the web', () => {
  const claude = assistArgs('claude', 'write', 'out.md');
  assert.deepEqual(claude.slice(0, 2), ['-p', '--output-format']);
  assert.ok(claude.includes('--no-session-persistence') && claude.includes('--strict-mcp-config'));
  assert.equal(claude[claude.indexOf('--disallowedTools') + 1], 'Bash Edit Write NotebookEdit');
  assert.ok(!claude.includes('--allowedTools'));
  assert.equal(assistArgs('claude', 'research', 'out.md').at(-1), 'WebSearch WebFetch');
  const codex = assistArgs('codex', 'summary', 'out.md');
  assert.deepEqual(codex.slice(0, 1), ['exec']);
  assert.equal(codex[codex.indexOf('-s') + 1], 'read-only');
  assert.equal(codex[codex.indexOf('-o') + 1], 'out.md');
  assert.equal(assistArgs('codex', 'research', 'out.md')[0], '--search');
});

test('note-assist: a fence around the whole answer is taken off; the answer goes where its helper puts it', () => {
  assert.equal(cleanAnswer('```markdown\n# Nota\n\nTexto.\n```\n'), '# Nota\n\nTexto.');
  assert.equal(cleanAnswer('Sem cerca.\r\n'), 'Sem cerca.');
  const note = '# Nota\n\nTexto.\n\n';
  assert.equal(applyAnswer(note, '# Nota melhor\n', 'write'), '# Nota melhor\n');
  assert.equal(applyAnswer(note, '## Resumo\n\n- a', 'summary'), '## Resumo\n\n- a\n\n# Nota\n\nTexto.\n');
  assert.equal(applyAnswer(note, '## Pesquisa\n\n- b', 'research'), '# Nota\n\nTexto.\n\n## Pesquisa\n\n- b\n');
  assert.equal(applyAnswer('', '## Revisão', 'critique'), '## Revisão\n');
});

test('note-assist: the differences keep the common words and mark what was removed and added', () => {
  const parts = wordDiff('O sistema faz login com SSO.', 'O sistema faz o login com SSO corporativo.');
  assert.equal(parts.filter((p) => p.kind !== 'added').map((p) => p.text).join(''), 'O sistema faz login com SSO.');
  assert.equal(parts.filter((p) => p.kind !== 'removed').map((p) => p.text).join(''), 'O sistema faz o login com SSO corporativo.');
  assert.ok(parts.some((p) => p.kind === 'added' && p.text.includes('corporativo')));
  assert.ok(parts.some((p) => p.kind === 'removed' && p.text.includes('SSO.')));
});

// A small script stands in for the AI: it reads the note on stdin and answers on stdout.
const node = (script: string) => (_out: string) => ['-e', script];
const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };

test('note-assist: a run reads the note on stdin and answers with Markdown', async () => {
  const script = "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write('```markdown\\n# Resposta\\n\\n'+(s.includes('<note>')?'nota recebida':'sem nota')+'\\n```'))";
  const answer = await runAssist(process.execPath, 'claude', 'write', assistPrompt('write', 'texto', 'English'), env, 30_000, node(script)).done;
  assert.equal(answer, '# Resposta\n\nnota recebida');
});

test('note-assist: a failing run reports the tool\'s last error lines; a cancelled or timed-out run stops', async () => {
  const failing = runAssist(process.execPath, 'claude', 'write', 'x', env, 30_000, node("process.stderr.write('linha 1\\nnot logged in\\n');process.exit(1)"));
  await assert.rejects(failing.done, /not logged in/);
  const slow = runAssist(process.execPath, 'claude', 'write', 'x', env, 30_000, node('setTimeout(()=>{},60000)'));
  slow.cancel();
  await assert.rejects(slow.done, /cancelled/);
  await assert.rejects(runAssist(process.execPath, 'claude', 'write', 'x', env, 300, node('setTimeout(()=>{},60000)')).done, /timeout/);
});
