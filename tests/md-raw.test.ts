import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MarkdownManager } from '@tiptap/markdown';
import { StarterKit } from '@tiptap/starter-kit';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { encodeCommentMarks, readComments } from '../app/src/md-comments.ts';
import { MdCommentMark } from '../app/src/md-comment-mark.ts';
import { RawMarkdown, shieldFrontMatter, shieldLosses } from '../app/src/md-raw.ts';
import { preserveBlocks, wordsOf } from '../app/src/md-preserve.ts';

// The formatted editor's Markdown pipeline, as TipTapEditor builds it (the code block card and diagrams aside).
const manager = new MarkdownManager({ extensions: [StarterKit.configure({ codeBlock: false }), Table, TableRow, TableHeader, TableCell, TaskList, TaskItem, MdCommentMark, ...RawMarkdown] });
const roundTrip = (text: string) => manager.serialize(manager.parse(encodeCommentMarks(shieldFrontMatter(readComments(text).body))));

// What AI-written files hold and the editor used to drop or escape, so it refused to edit them.
const kept: Record<string, string> = {
  'front matter': '---\ntitle: Relatório\nstatus: draft\n---\n\n# Título\n\nTexto.',
  'an HTML block around Markdown': '<details>\n<summary>Mais</summary>\n\nConteúdo escondido.\n\n</details>\n\nDepois.',
  'an HTML anchor': '<a id="topo"></a>\n\n## Seção',
  'an HTML comment': 'Antes\n\n<!-- nota para a IA -->\n\nDepois',
  'inline HTML': 'Texto <kbd>Ctrl</kbd> e <span style="color:red">vermelho</span>.',
  '<br> in a list': '- item <br> dois\n- <b>x</b>',
  'a callout': '> [!NOTE]\n> Observação importante.',
  'footnotes': 'Texto com nota[^1].\n\n[^1]: A nota.',
};

for (const [name, source] of Object.entries(kept)) {
  test(`md-raw: the formatted editor writes ${name} back exactly as it was`, () => {
    assert.equal(roundTrip(source), source);
  });
}

test('md-raw: <br> in a table cell and a reference definition keep every word and their own text', () => {
  const table = roundTrip('| A | B |\n|---|---|\n| um<br>dois | três |');
  assert.match(table, /\| um<br>dois +\| três +\|/);
  const reference = roundTrip('Veja [o site][ms].\n\n[ms]: https://example.com');
  assert.match(reference, /\n\n\[ms\]: https:\/\/example\.com$/);
});

test('md-raw: a block the editor would lose words of is shielded and comes back unchanged', () => {
  const body = 'Antes.\n\n<custom-widget>\nsegredo\n</custom-widget>\n\nDepois.';
  // A stand-in for an editor that drops the unknown element, as the browser parser does.
  const lossy = (md: string) => md.replace(/<custom-widget>[\s\S]*?<\/custom-widget>/, '');
  const shielded = shieldLosses(body, lossy);
  assert.notEqual(shielded, body);
  assert.equal(roundTrip(shielded), body);
  assert.equal(shieldLosses('Só texto.\n\n- lista', (md) => md), 'Só texto.\n\n- lista'); // nothing lost: nothing shielded
});

test('md-raw: editing one paragraph of an AI file rewrites only that paragraph', () => {
  const source = [
    '---', 'title: Relatório', '---', '',
    '* item um', '* item dois', '',
    '| Caso | Resultado |', '|---|---|', '| CT-01 | ok<br>revisado |', '',
    '<details><summary>Log</summary>', '', 'linha do log', '', '</details>', '',
    'Parágrafo __forte__ para editar.', '',
    'Fim.',
  ].join('\n');
  const before = roundTrip(source);
  const after = before.replace('para editar.', 'já editado.');
  const saved = preserveBlocks(before, after, source, '\n');
  assert.ok(saved);
  assert.equal(saved, source.replace('Parágrafo __forte__ para editar.', 'Parágrafo **forte** já editado.'));
  assert.equal(wordsOf(saved), wordsOf(after));
});
