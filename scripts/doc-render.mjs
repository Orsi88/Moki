#!/usr/bin/env node
// Renders a Markdown deliverable the way Moki's PDF export does (same renderer,
// the project's template, diagrams drawn) so an AI can look at the result before
// handing the document over: the PDF, and the same page as PNG pictures (A4-sized
// slices) for AI tools that read images but not PDFs. The picture is never a deliverable: it always goes
// to the temporary folder of the document's project (temporary/inspection/),
// which the app empties of old files, and never next to the deliverable.
//
// Usage: node scripts/doc-render.mjs <file.md>
//        node scripts/doc-render.mjs --clean <file.md>   (removes this file's inspection renders)
// Prints the paths of the rendered PDF and pictures. Exit code 2 = no browser (Edge/Chrome/Chromium) found.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ROOT, workspaceDir } from './lib/repo.mjs';
import { projectOf, styleFor } from './lib/doc-style.mjs';
import { findBrowser, renderHtml } from './pdf.mjs';

// The folder that holds one file's inspection renders: its project's temporary/inspection,
// or the workspace's temporary/inspection for a file outside any project.
export function inspectionRoot(file, root = ROOT) {
  const project = projectOf(file, root);
  const base = project ? join(workspaceDir(root), 'projects', project) : workspaceDir(root);
  return join(base, 'temporary', 'inspection');
}

const slug = (file) => basename(file).replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '-').slice(0, 60) || 'document';
const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');

// Where one render goes: <inspection root>/<name>-<UTC stamp>/<name>.pdf
export function inspectionTarget(file, root = ROOT, now = new Date()) {
  const name = slug(file);
  const dir = join(inspectionRoot(file, root), `${name}-${stamp(now)}`);
  return { dir, pdf: join(dir, `${name}.pdf`) };
}

// Removes every render of this file (its folders under the inspection root).
export function cleanInspection(file, root = ROOT) {
  const dirRoot = inspectionRoot(file, root);
  if (!existsSync(dirRoot)) return 0;
  const prefix = `${slug(file)}-`;
  const gone = readdirSync(dirRoot).filter((d) => d.startsWith(prefix));
  for (const d of gone) rmSync(join(dirRoot, d), { recursive: true, force: true });
  return gone.length;
}

const A4 = { width: 794, height: 1123 }; // CSS pixels at 96 dpi

// The rendered page as PNG slices of one A4 page each (page-1.png, page-2.png...), through the
// browser's DevTools protocol, as scripts/lib/diagram-images.mjs photographs diagrams.
export async function photographPages(htmlPath, dir, browser) {
  const profile = join(tmpdir(), `moki-render-shots-${process.pid}`);
  const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=0', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let ws;
  try {
    const port = await new Promise((ok, fail) => {
      let buf = '';
      const timer = setTimeout(() => fail(new Error('browser')), 20000);
      child.stderr.on('data', (chunk) => { buf += chunk; const m = buf.match(/127\.0\.0\.1:(\d+)\//); if (m) { clearTimeout(timer); ok(m[1]); } });
      child.on('exit', () => { clearTimeout(timer); fail(new Error('browser')); });
    });
    const page = (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())).find((t) => t.type === 'page');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((ok, fail) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', fail, { once: true }); });
    let next = 1;
    const waiting = new Map();
    ws.addEventListener('message', (ev) => { const msg = JSON.parse(ev.data); const done = msg.id && waiting.get(msg.id); if (done) { waiting.delete(msg.id); done(msg.result ?? {}); } });
    const call = (method, params = {}) => new Promise((ok) => { const id = next++; waiting.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });
    await call('Page.enable');
    await call('Emulation.setDeviceMetricsOverride', { width: A4.width, height: A4.height, deviceScaleFactor: 1, mobile: false });
    await call('Page.navigate', { url: pathToFileURL(htmlPath).href });
    let height = 0;
    for (let i = 0; i < 40 && !height; i++) {
      await new Promise((r) => setTimeout(r, 250));
      const r = await call('Runtime.evaluate', { expression: 'document.readyState === "complete" ? document.documentElement.scrollHeight : 0', returnByValue: true });
      height = r.result?.value || 0;
    }
    const files = [];
    for (let y = 0, n = 1; y < height; y += A4.height, n++) {
      const shot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y, width: A4.width, height: Math.min(A4.height, height - y), scale: 1 } });
      if (!shot.data) continue;
      const file = join(dir, `page-${n}.png`);
      writeFileSync(file, Buffer.from(shot.data, 'base64'));
      files.push(file);
    }
    return files;
  } finally {
    try { ws?.close(); } catch { /* gone */ }
    try { child.kill(); } catch { /* gone */ }
    await new Promise((r) => setTimeout(r, 300));
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }); } catch { /* locked briefly */ }
  }
}

async function main(argv) {
  const clean = argv.includes('--clean');
  const file = argv.find((a) => !a.startsWith('--'));
  if (!file) { console.error('Usage: node scripts/doc-render.mjs [--clean] <file.md>'); return 1; }
  const full = resolve(file);
  if (clean) { console.log(`Removed ${cleanInspection(full)} inspection render(s) of ${file}.`); return 0; }
  if (!existsSync(full)) { console.error(`${file} does not exist.`); return 1; }
  if (!/\.md$/i.test(full)) { console.error('Only Markdown is rendered here; a PDF deliverable is inspected as it is.'); return 1; }
  const browser = findBrowser();
  if (!browser) { console.error('No Edge/Chrome/Chromium found: the visual inspection is not possible here (set QA_AGENTS_BROWSER).'); return 2; }
  const md = readFileSync(full, 'utf8');
  const title = (md.match(/^#\s+(.+)$/m) || [, 'Document'])[1];
  const { dir, pdf } = inspectionTarget(full);
  mkdirSync(dir, { recursive: true });
  const html = join(dir, 'page.html');
  // The style of the document's own project (styleFor looks at the path it is given).
  const { style, vars } = styleFor(full, { title });
  writeFileSync(html, await renderHtml(md, title, { style, vars, browser }));
  const profile = join(tmpdir(), `moki-render-${process.pid}`);
  let pictures = [];
  try {
    execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--no-pdf-header-footer', `--print-to-pdf=${pdf}`, pathToFileURL(html).href], { stdio: 'ignore', timeout: 120000 });
    try { pictures = await photographPages(html, dir, browser); } catch { pictures = []; }
  } finally {
    rmSync(profile, { recursive: true, force: true });
    rmSync(html, { force: true });
  }
  if (!existsSync(pdf)) { console.error('The browser did not produce the render.'); return 1; }
  console.log(pdf);
  for (const p of pictures) console.log(p);
  if (!pictures.length) console.error('The page pictures could not be taken; inspect the PDF.');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
