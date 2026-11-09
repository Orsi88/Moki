import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cleanInspection, inspectionRoot, inspectionTarget } from '../scripts/doc-render.mjs';

const norm = (p) => p.replace(/\\/g, '/');

test('doc-render: renders always go to the temporary folder of the document\'s project, never next to it', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-render-'));
  try {
    const doc = join(root, 'workspace', 'projects', 'acme', 'runs', '20261108-0900-x', 'outputs', 'Dossiê final.md');
    assert.equal(norm(inspectionRoot(doc, root)), norm(join(root, 'workspace', 'projects', 'acme', 'temporary', 'inspection')));
    const { dir, pdf } = inspectionTarget(doc, root, new Date('2026-11-08T21:30:05Z'));
    assert.equal(norm(dir), norm(join(root, 'workspace', 'projects', 'acme', 'temporary', 'inspection', 'Dossi-final-20261108-213005')));
    assert.ok(norm(pdf).endsWith('/Dossi-final-20261108-213005/Dossi-final.pdf'));
    assert.ok(!norm(pdf).includes('/outputs/'), 'never in the run outputs');
    // A file outside any project: the workspace's temporary folder.
    assert.equal(norm(inspectionRoot(join(root, 'notes', 'a.md'), root)), norm(join(root, 'workspace', 'temporary', 'inspection')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('doc-render: --clean removes only the renders of that file', () => {
  const root = mkdtempSync(join(tmpdir(), 'qa-render-'));
  try {
    const doc = join(root, 'workspace', 'projects', 'acme', 'outputs', 'report.md');
    const other = join(root, 'workspace', 'projects', 'acme', 'outputs', 'notes.md');
    for (const [f, d] of [[doc, '2026-11-08T10:00:00Z'], [doc, '2026-11-08T11:00:00Z'], [other, '2026-11-08T10:00:00Z']]) {
      const t = inspectionTarget(f, root, new Date(d));
      mkdirSync(t.dir, { recursive: true });
      writeFileSync(t.pdf, '%PDF');
    }
    assert.equal(cleanInspection(doc, root), 2);
    assert.deepEqual(readdirSync(inspectionRoot(doc, root)).map((x) => x.replace(/-\d{8}-\d{6}$/, '')), ['notes']);
    assert.equal(cleanInspection(join(root, 'none.md'), root), 0);
    assert.ok(existsSync(inspectionRoot(doc, root)));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
