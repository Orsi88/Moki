// Diagram review uses the real desktop window and local Mermaid; Kroki exchanges use a loopback fixture.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { diagramComments, readDiagramView } from '../../desktop/html-comments.ts';
import { launchMoki } from './launch.ts';

declare global { interface Window { diagramTestImages?: string[] } }

test.describe.serial('Diagram review', () => {
  let app: ElectronApplication;
  let page: Page;
  let root: string;
  let project: string;
  let server: Server;
  const requests: string[] = [];
  const errors: string[] = [];
  const source = 'flowchart LR\n A[Start] --> B[Review] --> C[Discuss] --> D[Verify] --> E[Approve] --> F[Finish]\n';

  test.beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'moki-diagrams-ui-'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
    for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
    project = join(root, 'workspace', 'projects', 'acme');
    cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
    const config = JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'));
    writeFileSync(join(project, 'project.json'), JSON.stringify({ ...config, project: 'acme', name: 'Diagram review' }));
    mkdirSync(join(project, 'inbox'), { recursive: true });
    const files = { 'review.mmd': source, 'review.puml': '@startuml\nAlice -> Bob: Review\n@enduml', 'review.d2': 'start -> finish', 'review.dot': 'digraph { start -> finish }' };
    for (const [name, text] of Object.entries(files)) writeFileSync(join(project, 'inbox', name), text);
    app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: join(root, 'profile'), QA_OPEN_PROJECT: 'acme', QA_FAKE_TOOLS: '1' });
    page = await app.firstWindow();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const create = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (value) => {
        if (value instanceof Blob && value.type === 'image/svg+xml') void value.text().then((svg) => { (window.diagramTestImages ??= []).push(svg); });
        return create(value);
      };
    });
    await page.evaluate(() => localStorage.setItem('qa-ui-language', 'en'));
    await page.reload();
    await page.locator('.tree-row[title="inbox"]').waitFor();
  });

  test.afterAll(async () => {
    await app?.close();
    await new Promise<void>((done) => { if (server) server.close(() => done()); else done(); });
    if (root) {
      const safe = resolve(root);
      if (!safe.startsWith(resolve(tmpdir()) + sep) || !safe.includes('moki-diagrams-ui-')) throw new Error('Unexpected fixture path.');
      rmSync(safe, { recursive: true, force: true });
    }
  });

  test('My AIs distributes cards across the available width', async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('tab', { name: 'My AIs', exact: true }).click();
    await expect(page.locator('.ai-card').first()).toBeVisible();
    for (const width of [900, 1306, 1920]) {
      await app.evaluate(({ BrowserWindow }, next) => BrowserWindow.getAllWindows()[0].setContentSize(next, 860), width);
      await expect.poll(() => page.locator('.ai-grid').evaluate((grid) => {
        const bounds = grid.getBoundingClientRect();
        const cards = Array.from(grid.children).map((card) => card.getBoundingClientRect());
        const row = cards.filter((card) => Math.abs(card.top - cards[0].top) < 1);
        return Math.abs(bounds.right - row[row.length - 1].right);
      })).toBeLessThan(1);
      expect(await page.locator('.ai-grid').evaluate((grid) => grid.scrollWidth <= grid.clientWidth)).toBe(true);
    }
    await page.getByRole('button', { name: 'Close settings', exact: true }).click();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1360, 860));
  });

  test('local Mermaid supports zoom, hand movement and persistent region discussions without changing its source', async () => {
    await page.locator('.tree-row[title="inbox"]').click();
    await page.locator('.tree-row[title="inbox/review.mmd"]').click();
    const viewer = page.locator('.diagram-view');
    const image = viewer.locator('.diagram-image img');
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const viewport = viewer.locator('.diagram-viewport');
    const before = await viewer.locator('.diagram-zoom-value').innerText();
    await viewport.hover();
    await page.keyboard.down('Control'); await page.mouse.wheel(0, -200); await page.keyboard.up('Control');
    await expect(viewer.locator('.diagram-zoom-value')).not.toHaveText(before);
    await page.keyboard.down('Control'); await page.mouse.wheel(0, 200); await page.keyboard.up('Control');
    await viewer.getByRole('button', { name: 'Reset zoom', exact: true }).click();
    await viewer.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await viewer.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await viewer.getByRole('button', { name: 'Pan diagram', exact: true }).click();
    const canvas = await viewport.boundingBox();
    if (!canvas) throw new Error('Diagram viewport is missing.');
    await page.mouse.move(canvas.x + canvas.width * 0.6, canvas.y + canvas.height / 2);
    await page.mouse.down(); await page.mouse.move(canvas.x + canvas.width * 0.2, canvas.y + canvas.height / 2, { steps: 6 }); await page.mouse.up();
    await expect.poll(() => viewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    await viewer.getByRole('button', { name: 'Fit diagram to screen', exact: true }).click();
    await viewer.getByRole('button', { name: 'Comment on a diagram region', exact: true }).click();
    const drawing = await image.boundingBox();
    if (!drawing) throw new Error('Rendered diagram is missing.');
    await page.mouse.move(drawing.x + drawing.width * 0.2, drawing.y + drawing.height * 0.2);
    await page.mouse.down(); await page.mouse.move(drawing.x + drawing.width * 0.4, drawing.y + drawing.height * 0.8, { steps: 6 }); await page.mouse.up();
    const composer = viewer.getByRole('dialog', { name: 'Comment', exact: true });
    await composer.getByPlaceholder('Your comment').fill('Review this transition');
    await composer.getByRole('button', { name: 'Add the comment', exact: true }).click();
    const card = viewer.locator('.md-card').filter({ hasText: 'Review this transition' });
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Reply', exact: true }).click();
    await card.getByPlaceholder('Your reply').fill('Confirmed by the reviewer');
    await card.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(card).toContainText('Confirmed by the reviewer');
    await page.screenshot({ path: test.info().outputPath('diagram-review.png') });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await expect(image).toBeVisible();
    await page.screenshot({ path: test.info().outputPath('diagram-review-dark.png') });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
    await card.getByRole('button', { name: 'Resolve comment', exact: true }).click();
    await expect.poll(() => diagramComments(project, 'inbox/review.mmd')[0]?.resolved).toBe(true);
    const stored = diagramComments(project, 'inbox/review.mmd')[0];
    expect(stored.anchor.width).toBeGreaterThan(0);
    expect(readFileSync(join(project, 'inbox', 'review.mmd'), 'utf8')).toBe(source);
    await viewer.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect.poll(() => readDiagramView(project, 'inbox/review.mmd')?.zoom).toBeGreaterThan(0.25);
    const savedZoom = await viewer.locator('.diagram-zoom-value').innerText();
    await expect.poll(() => Math.round((readDiagramView(project, 'inbox/review.mmd')?.zoom ?? 0) * 100) + '%').toBe(savedZoom);
    await page.reload();
    await expect(page.locator('.diagram-image img')).toBeVisible();
    await expect(page.locator('.diagram-zoom-value')).toHaveText(savedZoom);
    expect(diagramComments(project, 'inbox/review.mmd')[0].id).toBe(stored.id);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1050, 760));
    await expect(page.locator('.diagram-mark')).toHaveCount(1);
    await expect.poll(() => page.locator('.diagram-image').evaluate((drawing, anchor) => {
      const imageBox = drawing.getBoundingClientRect(), mark = drawing.querySelector('.diagram-mark')?.getBoundingClientRect();
      if (!mark) return 1;
      return Math.abs((mark.left - imageBox.left) / imageBox.width - anchor.x) + Math.abs((mark.top - imageBox.top) / imageBox.height - anchor.y);
    }, stored.anchor)).toBeLessThan(0.01);
    await page.locator('.diagram-mark').click();
    await expect(page.locator('.md-card')).toContainText('Confirmed by the reviewer');
    writeFileSync(join(project, 'inbox', 'review.mmd'), source.replace('Review', 'Revised review'));
    await expect(page.getByText('The diagram source changed. This region could not be located.', { exact: true })).toBeVisible();
    expect(diagramComments(project, 'inbox/review.mmd')[0].id).toBe(stored.id);
    await page.locator('.diagram-view').getByRole('button', { name: 'Diagram source', exact: true }).click();
    await expect(page.locator('.diagram-source')).toContainText('Revised review');
    await page.locator('.diagram-view').getByRole('button', { name: 'Diagram source', exact: true }).click();
    await expect(page.locator('.diagram-view [role="alert"]')).toHaveCount(0);
  });

  test('a configured loopback Kroki renders each format and returned SVG is sanitized', async () => {
    let unwanted = 0;
    server = createServer((request, response) => {
      if (request.method !== 'POST') { unwanted++; response.writeHead(404).end(); return; }
      requests.push(request.url ?? '');
      request.resume();
      request.on('end', () => response.writeHead(200, { 'content-type': 'image/svg+xml' }).end('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg" width="600" height="240" viewBox="0 0 600 240" onload="alert(1)"><style>@font-face{font-family:unsafe;src:url(data:font/woff2;base64,AA==)} .node{fill:rgb(1,2,3);stroke:url(http://127.0.0.1/tracker)}</style><script>alert(1)</script><foreignObject><div>unsafe</div></foreignObject><image href="http://127.0.0.1/tracker"/><rect class="node" x="20" y="20" width="200" height="120" fill="#eee" stroke="#222"/><text x="40" y="70">Fixture diagram</text></svg>'));
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Kroki fixture did not start.');
    const viewer = page.locator('.diagram-view');
    if (!await page.locator('.tree-row[title="inbox/review.puml"]').isVisible()) await page.locator('.tree-row[title="inbox"]').click();
    if (!await viewer.isVisible()) await page.locator('.tree-row[title="inbox/review.mmd"]').click();
    await viewer.getByRole('button', { name: 'Diagram renderer', exact: true }).click();
    await viewer.locator('.diagram-settings select').selectOption('kroki');
    await viewer.getByLabel('Kroki server URL', { exact: true }).fill(`http://127.0.0.1:${address.port}`);
    await viewer.locator('.diagram-settings').getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => requests.includes('/mermaid/svg')).toBe(true);
    for (const [file, kind] of [['review.puml', 'plantuml'], ['review.d2', 'd2'], ['review.dot', 'graphviz']]) {
      await page.locator(`.tree-row[title="inbox/${file}"]`).click();
      await expect(viewer.locator('.diagram-image img')).toBeVisible();
      await expect.poll(() => requests.includes(`/${kind}/svg`)).toBe(true);
      const svg = await page.evaluate(() => window.diagramTestImages?.at(-1) ?? '');
      expect(svg).toContain('Fixture diagram');
      expect(svg).not.toMatch(/<script|foreignObject|onload|127\.0\.0\.1\/tracker|@font-face|DOCTYPE/);
      expect(svg).toMatch(/fill:\s*rgb\(1,\s*2,\s*3\)/);
    }
    expect(unwanted).toBe(0);
    expect(errors).toEqual([]);
  });
});
