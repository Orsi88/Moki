// Diagram rendering uses synthetic sources and a loopback HTTP stub; no public service or real project is contacted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import { linkSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDiagramSource, DIAGRAM_OUTPUT_LIMIT, DIAGRAM_SOURCE_LIMIT, diagramHash, diagramKind, parseDiagramSettings, readDiagramSettings, renderDiagramSource, verifyPngExport, verifySvgExport } from '../desktop/diagrams.ts';
import { createService } from '../desktop/service.ts';
import type { DiagramKind } from '../scripts/lib/diagram-types.ts';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><text x="10" y="20">Synthetic</text></svg>';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhC0AAAAASUVORK5CYII=';
const LOCAL = { provider: 'local' as const, url: '', allowRemote: false };
const SOURCES: Record<DiagramKind, string> = { mermaid: 'flowchart LR\n A --> B', plantuml: '@startuml\nAlice -> Bob\n@enduml', d2: 'a -> b', graphviz: 'digraph G { a -> b }' };

async function stub(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port.');
  return { url: `http://127.0.0.1:${address.port}/`, close: async () => { server.closeAllConnections(); await new Promise<void>((done, fail) => server.close((error) => error ? fail(error) : done())); } };
}

function fixture(extra: Parameters<typeof createService>[1] = { launch: () => ({ opened: false, message: '' }), openFolder: () => {}, openPath: () => {} }) {
  const root = mkdtempSync(join(tmpdir(), 'moki-diagram-render-'));
  for (const name of ['acme', 'other']) {
    const directory = join(root, 'workspace', 'projects', name);
    mkdirSync(join(directory, 'inbox'), { recursive: true });
    writeFileSync(join(directory, 'project.json'), JSON.stringify({ schemaVersion: '1.0.0', project: name, name }));
  }
  const directory = join(root, 'workspace', 'projects', 'acme');
  return { root, directory, service: createService(root, extra), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('diagram extensions preview as read-only source and a file read never calls a renderer', async () => {
  let calls = 0;
  const setup = fixture({ launch: () => ({ opened: false, message: '' }), openFolder: () => {}, openPath: () => {}, fetch: async () => { calls++; throw new Error('No network during reads.'); } });
  try {
    for (const [extension, kind] of Object.entries({ mmd: 'mermaid', mermaid: 'mermaid', puml: 'plantuml', plantuml: 'plantuml', d2: 'd2', dot: 'graphviz', gv: 'graphviz' } as const)) {
      const path = `inbox/review.${extension}`;
      writeFileSync(join(setup.directory, path), SOURCES[kind]);
      const content = await setup.service.readFile('acme', path);
      assert.deepEqual(content, { kind: 'diagram', path, text: SOURCES[kind], diagram: kind, editable: false, version: diagramHash(SOURCES[kind]) });
      assert.equal(diagramKind(path.toUpperCase()), kind);
      assert.throws(() => setup.service.writeFile('acme', path, 'changed'), /Only Markdown and text/);
    }
    assert.equal(calls, 0);
    assert.deepEqual(await setup.service.renderDiagram('acme', 'inbox/review.mmd'), { provider: 'local', sourceHash: diagramHash(SOURCES.mermaid), source: SOURCES.mermaid });
    await assert.rejects(setup.service.renderDiagram('acme', 'inbox/review.d2'), /Configure Kroki/);
    writeFileSync(join(setup.directory, 'inbox/review.mmd'), 'flowchart LR\n Changed --> Current');
    assert.equal((await setup.service.renderDiagram('acme', 'inbox/review.mmd')).source, 'flowchart LR\n Changed --> Current');
    assert.equal(calls, 0);
    await assert.rejects(setup.service.renderDiagram('acme', '../elsewhere.mmd'), /outside/i);
    await assert.rejects(setup.service.renderDiagram('unknown', 'inbox/review.mmd'), /Unknown project/);
    writeFileSync(join(setup.directory, 'inbox/huge.mmd'), 'x'.repeat(DIAGRAM_SOURCE_LIMIT + 1));
    assert.equal((await setup.service.readFile('acme', 'inbox/huge.mmd')).kind, 'binary');
    await assert.rejects(setup.service.renderDiagram('acme', 'inbox/huge.mmd'), /too large/);
  } finally { setup.cleanup(); }
});

test('Kroki settings stay in their project and remote source transmission requires explicit HTTPS consent', async () => {
  let calls = 0;
  const setup = fixture();
  try {
    assert.deepEqual(setup.service.diagramSettings('acme'), LOCAL);
    const configured = setup.service.saveDiagramSettings('acme', { provider: 'kroki', url: 'https://example.invalid/kroki', allowRemote: false });
    assert.equal(configured.url, 'https://example.invalid/kroki/');
    assert.deepEqual(setup.service.diagramSettings('other'), LOCAL);
    assert.deepEqual(readDiagramSettings(setup.directory), configured);
    const fake: typeof fetch = async (_url, options) => { calls++; assert.equal(options?.redirect, 'error'); return new Response(SVG, { headers: { 'content-type': 'image/svg+xml' } }); };
    await assert.rejects(renderDiagramSource('d2', SOURCES.d2, configured, fake), /Authorize/);
    assert.equal(calls, 0);
    await renderDiagramSource('d2', SOURCES.d2, { ...configured, allowRemote: true }, fake);
    assert.equal(calls, 1);
    for (const url of ['http://example.invalid', 'file:///x', 'https://user:password@example.invalid', 'https://example.invalid/?token=x', 'https://example.invalid/#fragment']) assert.throws(() => parseDiagramSettings({ provider: 'kroki', url, allowRemote: true })); // qa-agents:allow-secret — fake credentials in a URL rejection fixture
    assert.equal(parseDiagramSettings({ provider: 'kroki', url: 'http://localhost:8000', allowRemote: false }).url, 'http://127.0.0.1:8000/');
    assert.deepEqual(parseDiagramSettings({ provider: 'local', url: 'https://unused.invalid', allowRemote: true }), LOCAL);
  } finally { setup.cleanup(); }
});

test('Kroki POSTs only synthetic source to the four fixed SVG routes with bounded response handling', async () => {
  const requests: { path?: string; body: Record<string, unknown> }[] = [];
  const server = await stub((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => { requests.push({ path: request.url, body: JSON.parse(Buffer.concat(chunks).toString()) }); response.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' }); response.end(SVG); });
  });
  try {
    for (const kind of Object.keys(SOURCES) as DiagramKind[]) {
      const result = await renderDiagramSource(kind, SOURCES[kind], { provider: 'kroki', url: server.url, allowRemote: false });
      assert.deepEqual(result, { provider: 'kroki', source: SOURCES[kind], sourceHash: diagramHash(SOURCES[kind]), svg: SVG, width: 320, height: 180 });
    }
    assert.deepEqual(requests.map((r) => r.path), ['/mermaid/svg', '/plantuml/svg', '/d2/svg', '/graphviz/svg']);
    assert.deepEqual(requests[0].body, { diagram_source: SOURCES.mermaid });
    assert.deepEqual(requests[1].body, { diagram_source: SOURCES.plantuml, diagram_options: { 'no-metadata': '' } });
    assert.ok(requests.every((r) => !('path' in r.body) && !('project' in r.body)));
  } finally { await server.close(); }
});

test('renderer redirects, non-SVG responses, large bodies, HTTP errors and timeouts fail without a fallback', async () => {
  let redirected = 0;
  const destination = await stub((_request, response) => { redirected++; response.end(SVG); });
  const server = await stub((request, response) => {
    if (request.url?.startsWith('/redirect/')) { response.writeHead(302, { location: destination.url }); response.end(); }
    else if (request.url?.startsWith('/mime/')) { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<script>bad()</script>'); }
    else if (request.url?.startsWith('/large/')) { response.writeHead(200, { 'content-type': 'image/svg+xml', 'content-length': DIAGRAM_OUTPUT_LIMIT + 1 }); response.end(); }
    else if (request.url?.startsWith('/error/')) { response.writeHead(400); response.end('Synthetic parse error'); }
    else if (request.url?.startsWith('/slow/')) { /* wait for the test client to abort */ }
  });
  try {
    const settings = (path: string) => ({ provider: 'kroki' as const, url: server.url + path + '/', allowRemote: false });
    await assert.rejects(renderDiagramSource('d2', SOURCES.d2, settings('redirect')), /connect/);
    assert.equal(redirected, 0);
    await assert.rejects(renderDiagramSource('d2', SOURCES.d2, settings('mime')), /SVG image/);
    await assert.rejects(renderDiagramSource('d2', SOURCES.d2, settings('large')), /too large/);
    await assert.rejects(renderDiagramSource('d2', SOURCES.d2, settings('error')), /HTTP 400/);
    await assert.rejects(renderDiagramSource('d2', SOURCES.d2, settings('slow'), fetch, 30), /timed out/);
    const streaming: typeof fetch = async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(DIAGRAM_OUTPUT_LIMIT)); controller.enqueue(new Uint8Array(1)); controller.close(); } }), { headers: { 'content-type': 'image/svg+xml' } });
    await assert.rejects(renderDiagramSource('d2', SOURCES.d2, settings('unused'), streaming), /too large/);
  } finally { await server.close(); await destination.close(); }
});

test('source resource loaders are refused before rendering and local Mermaid makes no HTTP call', async () => {
  const malicious: [DiagramKind, string][] = [
    ['plantuml', '@startuml\n!includeurl https://example.invalid/x\n@enduml'], ['plantuml', '!include ./private.puml'],
    ['plantuml', '!$data = %load_json("https://example.invalid/x")'], ['plantuml', '!$data = %load_yaml("/private/file")'], ['plantuml', '!$data = %getenv("SECRET")'],
    ['plantuml', '!$data = %call_user_func("loader", "file")'], ['plantuml', '!$data = %eval("%lo" + "ad_json(1)")'], ['plantuml', '!$data = %loadJSON("/private/file")'],
    ['d2', '...@https://example.invalid/x'], ['d2', 'icon: https://example.invalid/icon.svg'], ['d2', 'x: @local'],
    ['graphviz', 'digraph G { a [image="/private/file"] }'], ['graphviz', 'digraph G { a [shapefile="x"] }'],
    ['mermaid', 'flowchart LR\n A@{ img: "https://example.invalid/a" }'], ['mermaid', '%%{init: {"securityLevel":"loose"}}%%\nflowchart LR\n A-->B'],
    ['mermaid', 'flowchart LR\n A["<script>bad()</script>"]'],
  ];
  let calls = 0;
  const fake: typeof fetch = async () => { calls++; return new Response(SVG); };
  for (const [kind, source] of malicious) {
    assert.throws(() => checkDiagramSource(kind, source), /External resources/);
    await assert.rejects(renderDiagramSource(kind, source, { provider: 'kroki', url: 'http://127.0.0.1:8000', allowRemote: false }, fake), /External resources/);
  }
  await renderDiagramSource('mermaid', SOURCES.mermaid, LOCAL, fake);
  assert.equal(calls, 0);
});

test('SVG export accepts drawing primitives and local references but refuses active XML, CSS and namespaces', () => {
  const safe = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 50 50" aria-label="mail@example.invalid"><defs><linearGradient id="color"><stop offset="1" stop-color="#fff"/></linearGradient><marker id="arrow"><path d="M0 0L5 5"/></marker><symbol id="node"><rect width="5" height="5"/></symbol></defs><style>.box{fill:url(#color)}</style><use xlink:href="#node"/><path marker-end="url(#arrow)" d="M1 1L2 2"/><a><text>A &amp; B @ C</text></a></svg>';
  assert.equal(verifySvgExport(safe).toString(), safe);
  for (const body of ['<script>bad()</script>', '<foreignObject/>', '<image href="https://example.invalid/x"/>', '<g onload="bad()"/>', '<use href="https://example.invalid/x"/>', '<g style="fill:url(https://example.invalid/x)"/>', '<g style="fill:u\\72l(https://example.invalid/x)"/>', '<g style="fill:u&#114;l(https://example.invalid/x)"/>', '<g xmlns="http://www.w3.org/1999/xhtml"/>', '<g xml:base="https://example.invalid/"/>', '<style>@import "https://example.invalid/x";</style>', '<style>/*x*/.a{fill:red}</style>']) assert.throws(() => verifySvgExport(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`));
  assert.throws(() => verifySvgExport('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///private">]><svg/>'));
  assert.throws(() => verifySvgExport('<svg><g></svg>'));
  assert.throws(() => verifySvgExport('<svg/><svg/>'));
  assert.throws(() => verifySvgExport('<svg><g arbitrary="x"/></svg>'));
});

test('export and copy validate PNGs and SVGs, use native destinations and preserve the source', async () => {
  let clipboard = '', selected: string | null = null, dialogs = 0;
  const setup = fixture({ launch: () => ({ opened: false, message: '' }), openPath: () => {}, openFolder: () => {}, saveFile: async () => { dialogs++; return selected; }, copyImage: (data) => { clipboard = data; } });
  try {
    const path = 'inbox/review.d2', source = join(setup.directory, path);
    writeFileSync(source, SOURCES.d2);
    assert.deepEqual(await setup.service.exportDiagram('acme', path, 'svg', SVG), { saved: false });
    selected = join(setup.root, 'export.svg');
    assert.deepEqual(await setup.service.exportDiagram('acme', path, 'svg', SVG), { saved: true });
    assert.equal(readFileSync(selected, 'utf8'), SVG);
    selected = join(setup.root, 'export.png');
    await setup.service.exportDiagram('acme', path, 'png', PNG);
    assert.deepEqual(readFileSync(selected), verifyPngExport(PNG));
    assert.equal(setup.service.copyDiagramImage('acme', path, PNG), true);
    assert.equal(clipboard, PNG);
    const before = dialogs;
    await assert.rejects(setup.service.exportDiagram('acme', path, 'svg', '<svg onload="bad()"/>'));
    await assert.rejects(setup.service.exportDiagram('acme', path, 'png', 'data:image/png;base64,YmFk'));
    assert.equal(dialogs, before);
    selected = source;
    await assert.rejects(setup.service.exportDiagram('acme', path, 'svg', SVG), /different file/);
    selected = join(setup.root, 'source-alias.svg'); linkSync(source, selected);
    await assert.rejects(setup.service.exportDiagram('acme', path, 'svg', SVG), /different file/);
    assert.equal(readFileSync(source, 'utf8'), SOURCES.d2);
    const giant = Buffer.from(verifyPngExport(PNG)); giant.writeUInt32BE(100000, 16);
    assert.throws(() => verifyPngExport('data:image/png;base64,' + giant.toString('base64')), /too large/);
  } finally { setup.cleanup(); }
});

test('diagram service caps simultaneous Kroki renders and releases slots after completion', async () => {
  const release: (() => void)[] = [];
  const setup = fixture({ launch: () => ({ opened: false, message: '' }), openPath: () => {}, openFolder: () => {}, fetch: async () => { await new Promise<void>((done) => release.push(done)); return new Response(SVG, { headers: { 'content-type': 'image/svg+xml' } }); } });
  try {
    writeFileSync(join(setup.directory, 'inbox/review.d2'), SOURCES.d2);
    setup.service.saveDiagramSettings('acme', { provider: 'kroki', url: 'http://127.0.0.1:8000', allowRemote: false });
    const first = setup.service.renderDiagram('acme', 'inbox/review.d2'), second = setup.service.renderDiagram('acme', 'inbox/review.d2');
    await assert.rejects(setup.service.renderDiagram('acme', 'inbox/review.d2'), /already rendering/);
    release.splice(0).forEach((done) => done());
    await Promise.all([first, second]);
    const third = setup.service.renderDiagram('acme', 'inbox/review.d2');
    release.splice(0).forEach((done) => done());
    assert.equal((await third).provider, 'kroki');
  } finally { release.forEach((done) => done()); setup.cleanup(); }
});
