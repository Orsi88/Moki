import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readComments } from '../app/src/md-comments.ts';
import { preserveBlocks, preserveSource, splitSource } from '../app/src/md-preserve.ts';

const split = (text: string) => splitSource(text, readComments(text).body);

test('md-preserve: an edit rewrites only its stretch; Windows line endings and original spacing stay', () => {
  const source = '# Título\r\n\r\nTexto.\r\n\r\n## Regras\r\n- Primeira\r\n- Segunda';
  const before = '# Título\n\nTexto.\n\n## Regras\n\n- Primeira\n- Segunda'; // the editor writes a blank line after a heading
  const after = before.replace('- Segunda', '- Segunda revisada');
  assert.equal(preserveSource(before, after, source, '\r\n'), source.replace('- Segunda', '- Segunda revisada'));
  assert.equal(preserveSource('a', 'b', 'not the same text', '\n'), null); // the source does not match what was drawn: no patch
});

test('md-preserve: the file is split into the drawn text, its tail (blank lines, comment block) and its line ending', () => {
  const block = '<!-- moki-comments\n[]\n-->\n';
  const parts = split(`Um\r\nDois\r\n\r\n${block}`);
  assert.equal(parts.core, 'Um\r\nDois');
  assert.equal(parts.newline, '\r\n');
  assert.equal(parts.core + parts.tail, `Um\r\nDois\r\n\r\n${block}`);
  assert.equal(split('Um\nDois\r\n').newline, '\n'); // mixed endings count as LF
});

test('md-preserve: when the editor writes the file its own way, an edit rewrites only the blocks it touched', () => {
  const source = '* um\n* dois\n\n| A | B |\n|---|---|\n| x | y |\n\nParágrafo __forte__ aqui.\n\nFim  com  espaços.';
  const before = '- um\n- dois\n\n| A | B |\n| - | - |\n| x | y |\n\nParágrafo **forte** aqui.\n\nFim com espaços.';
  const edit = (from: string, to: string) => preserveBlocks(before, before.replace(from, to), source, '\n');
  assert.equal(edit('aqui.', 'editado.'), source.replace('Parágrafo __forte__ aqui.', 'Parágrafo **forte** editado.'));
  assert.equal(edit('\n\nParágrafo', '\n\nNovo bloco.\n\nParágrafo'), source.replace('\n\nParágrafo', '\n\nNovo bloco.\n\nParágrafo'));
  assert.equal(edit('Parágrafo **forte** aqui.\n\n', ''), source.replace('Parágrafo __forte__ aqui.\n\n', ''));
  assert.equal(edit('dois', 'três'), source.replace('* um\n* dois', '- um\n- três'));
});

test('md-preserve: blocks kept with Windows line endings; added at the end, the file stays whole', () => {
  const source = '* um\r\n* dois\r\n\r\nFim  aqui.';
  const before = '- um\n- dois\n\nFim aqui.';
  assert.equal(preserveBlocks(before, `${before}\n\nÚltimo.`, source, '\r\n'), `${source}\r\n\r\nÚltimo.`);
  assert.equal(preserveBlocks(before, before.replace('Fim', 'Começo'), source, '\r\n'), '* um\r\n* dois\r\n\r\nComeço aqui.');
  assert.equal(preserveBlocks('Outro texto.', 'Outro texto!', source, '\r\n'), null); // the words do not pair: nothing patched
});
