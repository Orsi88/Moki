// The project chat: one tab, answers as they arrive, a Claude artifact opened in an isolated viewer, Ctrl+L left to
// a focused terminal, and Call sending its request at once in a new conversation. QA_FAKE_TOOLS puts a script in place of Claude.
import { test, expect, type ElectronApplication } from '@playwright/test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { ROOT } from '../../scripts/lib/repo.mjs';
import { launchMoki } from './launch.ts';

test('one project chat tab, artifacts in an isolated viewer, history and a request sent from Call', async () => {
  const base = realpathSync(tmpdir());
  const root = mkdtempSync(join(base, 'moki-chat-ui-'));
  let app: ElectronApplication | undefined;
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
    for (const dir of ['skills', 'agents', 'activities', 'templates']) cpSync(join(ROOT, dir), join(root, dir), { recursive: true });
    const project = join(root, 'workspace', 'projects', 'acme');
    cpSync(join(ROOT, 'templates', 'project-context'), project, { recursive: true });
    const config = JSON.parse(readFileSync(join(project, 'project.json'), 'utf8'));
    writeFileSync(join(project, 'project.json'), JSON.stringify({ ...config, project: 'acme', name: 'Chat project' }));
    for (const folder of ['inbox', 'runs', 'temporary']) mkdirSync(join(project, folder), { recursive: true });
    app = await launchMoki({ QA_ROOT: root, QA_USER_DATA: join(root, 'profile'), QA_OPEN_PROJECT: 'acme', QA_FAKE_TOOLS: '1' });
    const page = await app.firstWindow();
    await page.evaluate(() => localStorage.setItem('qa-ui-language', 'en'));
    await page.reload();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // Ctrl+L in a focused terminal belongs to the shell or the AI there: the chat does not open.
    await page.getByRole('button', { name: 'New: terminal, AI or file', exact: true }).click();
    await page.getByRole('menuitem', { name: 'AI', exact: true }).click();
    await page.getByRole('menuitem', { name: /Claude Code/ }).click();
    const terminal = page.locator('.term-pane:not([hidden])');
    await expect(terminal).toContainText('[ready]');
    await terminal.locator('textarea').focus();
    await page.keyboard.press('Control+l');
    await expect(page.locator('.chat-view:not([hidden])')).toHaveCount(0);

    // The ribbon and Ctrl+L elsewhere open the same single tab.
    await page.getByRole('button', { name: 'Chat (Ctrl+L)', exact: true }).click();
    await expect(page.locator('.chat-view:not([hidden])')).toBeVisible();
    await page.getByRole('button', { name: 'Chat (Ctrl+L)', exact: true }).click();
    await page.locator('.chat-head').click();
    await page.keyboard.press('Control+l');
    await expect(page.locator('.chat-view')).toHaveCount(1);
    // Claude and Codex installed: the conversation's AI is named in the header; no history before the first conversation.
    // No AI switch inside a conversation: the header names its AI, and a new conversation is where the AI is chosen.
    await expect(page.getByRole('combobox', { name: 'Chat AI' })).toHaveCount(0);
    await expect(page.locator('.chat-tool')).toHaveText('Claude');
    await page.getByRole('button', { name: 'New conversation', exact: true }).click();
    await expect(page.getByRole('menu', { name: 'New conversation' }).getByRole('menuitem')).toHaveText(['New conversation with Claude', 'New conversation with ChatGPT (Codex)']);
    await page.getByRole('menuitem', { name: 'New conversation with Claude' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Conversation history' })).toHaveCount(0);

    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('See [the deck](https://claude.ai/artifact/deck-123)');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    // An artifact the answer made opens by itself when the answer ends, as Claude Code does in a terminal.
    await expect(page.locator('.chat-artifact')).toBeVisible();
    await page.getByRole('button', { name: 'Back to the conversation', exact: true }).click();
    const answer = page.locator('.chat-assistant');
    await expect(answer).toContainText('Answer: See the deck');
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conversation history' })).toBeVisible();

    // The artifact link opens over the conversation in a view with nothing of Moki.
    const look = () => app!.evaluate(({ BrowserWindow, WebContentsView }) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('file:'));
      const view = win?.contentView.children.find((v) => v instanceof WebContentsView);
      return view instanceof WebContentsView && view.getVisible() ? { preferences: view.webContents.getLastWebPreferences(), url: view.webContents.getURL() } : null;
    });
    // Playwright sometimes loses the answer of an evaluate while the window is busy ("promise was garbage collected"): ask again.
    const viewer = async () => {
      for (let attempt = 1; ; attempt++) {
        try { return await look(); } catch (e) { if (attempt === 3 || !String(e).includes('garbage collected')) throw e; }
      }
    };
    await answer.getByRole('link', { name: 'the deck' }).click();
    await expect(page.locator('.chat-artifact')).toBeVisible();
    await expect.poll(async () => decodeURIComponent((await viewer())?.url || '')).toContain('https://claude.ai/artifact/deck-123');
    const prefs = (await viewer())!.preferences;
    expect(prefs.nodeIntegration).toBe(false);
    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.sandbox).toBe(true);
    expect(prefs.preload).toBeFalsy();
    expect(await app.evaluate(({ BrowserWindow, WebContentsView }) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('file:'));
      const view = win?.contentView.children.find((v) => v instanceof WebContentsView);
      return view instanceof WebContentsView ? view.webContents.executeJavaScript('typeof window.qa') : 'missing';
    })).toBe('undefined');
    // Moki's shortcuts still work with the focus in the artifact; a dialog hides the view.
    await app.evaluate(({ BrowserWindow, WebContentsView }) => {
      const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('file:'));
      const view = win?.contentView.children.find((v) => v instanceof WebContentsView);
      if (view instanceof WebContentsView) view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'K', modifiers: ['control', 'shift'] });
    });
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect.poll(viewer).toBeNull();
    await page.keyboard.press('Escape');
    await expect.poll(viewer).not.toBeNull();
    await page.getByRole('button', { name: 'Back to the conversation', exact: true }).click();
    await expect.poll(viewer).toBeNull();
    await expect(answer).toContainText('Answer: See the deck');

    // The conversation comes back after a reload.
    await page.reload();
    await expect(page.locator('.chat-assistant')).toContainText('Answer: See the deck');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      const width = await page.locator('.chat-view').evaluate((el) => ({ own: el.clientWidth, scroll: el.scrollWidth }));
      expect(width.scroll).toBeLessThanOrEqual(width.own + 1);
      if (process.env.QA_CHAT_INSPECTION) {
        const destination = realpathSync(process.env.QA_CHAT_INSPECTION);
        const png = await app.evaluate(async ({ BrowserWindow }) => {
          const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('file:'));
          if (!win) throw new Error('Missing Moki window.');
          const image = await win.webContents.capturePage(undefined, { stayHidden: true, stayAwake: true });
          return image.toPNG().toString('base64');
        });
        writeFileSync(join(destination, `chat-${theme}.png`), Buffer.from(png, 'base64'));
      }
    }

    // As in the AI apps: suggestions in an empty conversation, code blocks (Moki's card: language, Copy, colors),
    // actions on the messages, the files an answer names, and attachments shown as files, not as paths in the text.
    await page.getByRole('button', { name: 'New conversation', exact: true }).click();
    await page.getByRole('menuitem', { name: 'New conversation with Claude' }).click();
    const box = page.getByRole('textbox', { name: 'Message', exact: true });
    await page.getByRole('button', { name: 'Which test scenarios fit the stories in the inbox?' }).click();
    await expect(box).toHaveValue('Which test scenarios fit the stories in the inbox?');
    await box.fill('the code:\n```js\nconst total = 1;\n```');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const code = page.locator('.chat-assistant pre').first();
    await expect(code.locator('.code-embed-bar')).toHaveCount(1); // one bar: Moki's own code card
    await expect(code.locator('.tok-key').first()).toHaveText('const');
    // The conversation follows the answer by itself.
    await expect.poll(() => page.locator('.chat-messages').evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(4);
    await expect(page.locator('.chat-message.chat-user')).toHaveCount(1);
    await page.getByRole('button', { name: 'Copy the answer' }).click();
    expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toContain('const total = 1;');
    await page.getByRole('button', { name: 'Ask again' }).click();
    await expect(page.locator('.chat-message.chat-user')).toHaveCount(2);
    await expect(page.locator('.chat-assistant')).toHaveCount(2);
    await page.getByRole('button', { name: 'Edit and send again' }).click();
    await expect(box).toHaveValue('the code:\n```js\nconst total = 1;\n```');

    // The files an answer names (the stand-in AI repeats the message): a picture of the project shows with Open in the
    // project; one that is gone and one of another project say why they cannot open.
    mkdirSync(join(project, 'inbox'), { recursive: true });
    writeFileSync(join(project, 'inbox', 'grafico.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
    await box.fill('Made `inbox/grafico.png`, kept `runs/old/outputs/gone.png`, saw `workspace/projects/other/context/a.md`.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const named = page.locator('.chat-assistant').last().locator('.chat-file');
    await expect(named).toHaveCount(3);
    await expect.poll(() => named.nth(0).locator('.chat-picture img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1);
    await expect(named.nth(1)).toContainText('Not found: moved or removed');
    await expect(named.nth(2)).toContainText('Another project: not available in this conversation');

    // Attachments: a file from the project tree becomes a file in the message box (no path in the text), and a
    // message may be only an attachment.
    await box.fill('');
    await page.locator('.chat-compose').evaluate((form) => {
      const data = new DataTransfer();
      data.setData('application/x-moki-move', 'inbox/grafico.png');
      form.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }));
      form.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    });
    await expect(page.locator('.chat-attachments li')).toContainText('grafico.png');
    await expect.poll(() => page.locator('.chat-attachments li img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(1); // its miniature
    await expect(box).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeEnabled();
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      if (process.env.QA_CHAT_INSPECTION) {
        const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('file:'))!.webContents.capturePage()).toPNG().toString('base64'));
        writeFileSync(join(realpathSync(process.env.QA_CHAT_INSPECTION), `chat-compose-${theme}.png`), Buffer.from(png, 'base64'));
      }
    }
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('.chat-attachments')).toHaveCount(0);
    await expect(page.locator('.chat-user').last().locator('.chat-file')).toContainText('grafico.png');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      if (process.env.QA_CHAT_INSPECTION) {
        const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('file:'))!.webContents.capturePage()).toPNG().toString('base64'));
        writeFileSync(join(realpathSync(process.env.QA_CHAT_INSPECTION), `chat-polish-${theme}.png`), Buffer.from(png, 'base64'));
      }
    }
    await box.fill('');

    // Charts: bar, line and pie drawn in the answer, View data shows the same numbers, an invalid one says why and the
    // rest of the message stays readable; after a reload the charts are there again.
    await page.getByRole('button', { name: 'New conversation', exact: true }).click();
    await page.getByRole('menuitem', { name: 'New conversation with Claude' }).click();
    const chart = (spec: object) => `\n\`\`\`chart\n${JSON.stringify(spec)}\n\`\`\`\n`;
    await box.fill(`charts:${chart({ type: 'bar', title: 'Bugs per module', labels: ['Cart', 'Login'], series: [{ name: 'Open', values: [3, 4] }] })}`
      + `${chart({ type: 'line', title: 'Runs', labels: ['Mon', 'Tue', 'Wed'], series: [{ name: 'Passed', values: [5, 7, 6] }] })}`
      + `${chart({ type: 'pie', title: 'Status', labels: ['Done', 'Open'], series: [{ name: 'Items', values: [6, 2] }] })}`
      + '\n```chart\n{"type":"bar","labels":["a"],"series":[{"values":["x"]}]}\n```\nThe end of the answer.');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    const charts = page.locator('.chat-assistant').last().locator('figure.chat-chart');
    await expect(charts).toHaveCount(3);
    await expect(charts.nth(0).locator('rect')).toHaveCount(2);
    await expect(charts.nth(1).locator('polyline')).toHaveCount(1);
    await expect(charts.nth(2).locator('path, circle')).toHaveCount(2);
    await expect(charts.nth(0).locator('figcaption')).toHaveText('Bugs per module');
    await charts.nth(0).getByRole('button', { name: 'View data' }).click();
    await expect(charts.nth(0).locator('table tbody tr')).toHaveText([/Cart\s*3/, /Login\s*4/]);
    await expect(page.locator('.chat-assistant').last().locator('.chat-chart-error')).toContainText('This chart could not be drawn: Each series needs one number per label.');
    await expect(page.locator('.chat-assistant').last()).toContainText('The end of the answer.');
    for (const theme of ['light', 'dark']) {
      await page.evaluate((value) => { document.documentElement.dataset.theme = value; }, theme);
      if (process.env.QA_CHAT_INSPECTION) {
        const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('file:'))!.webContents.capturePage()).toPNG().toString('base64'));
        writeFileSync(join(realpathSync(process.env.QA_CHAT_INSPECTION), `chat-charts-${theme}.png`), Buffer.from(png, 'base64'));
      }
    }
    await page.reload();
    await expect(page.locator('.chat-assistant').last().locator('figure.chat-chart')).toHaveCount(3);

    // Call › In the chat sends the request at once, in a new conversation; the draft in the box stays.
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('my draft');
    await page.keyboard.press('Control+Shift+k');
    await page.getByRole('tab', { name: /^Agents/ }).click();
    await page.getByPlaceholder('Search activities, agents, skills and operations').fill('qa-lead');
    await page.locator('.invoke-row').first().click();
    await page.getByRole('button', { name: 'Continue without files', exact: true }).click();
    await page.getByRole('button', { name: 'Nothing else — continue', exact: true }).click();
    await page.getByRole('button', { name: /^In the chat/ }).click();
    await page.locator('.answer-list .answer').first().click();
    await page.getByRole('button', { name: 'Send to the chat', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.chat-user')).toHaveCount(1);
    await expect(page.locator('.chat-user')).toContainText('qa-lead');
    // Folded under its name: the person sees what was called, the AI got the whole request; it also titles the conversation.
    const request = page.locator('.chat-user details.chat-request');
    await expect(request.locator('summary')).toHaveText(/^Request from Moki: /);
    await expect(request).not.toHaveAttribute('open', '');
    // The history icon lists the conversations by name and AI, the open one marked; none is named after the raw request.
    await page.getByRole('button', { name: 'Conversation history' }).click();
    const historyMenu = page.getByRole('menu', { name: 'Conversation history' });
    await expect(historyMenu.locator('[aria-current="true"] .chat-history-meta')).toContainText('Claude');
    await expect(historyMenu).not.toContainText('Follow AGENTS.md');
    if (process.env.QA_CHAT_INSPECTION) { const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('file:'))!.webContents.capturePage()).toPNG().toString('base64')); writeFileSync(join(realpathSync(process.env.QA_CHAT_INSPECTION), 'chat-history.png'), Buffer.from(png, 'base64')); }
    await page.keyboard.press('Escape');
    if (process.env.QA_CHAT_INSPECTION) { const png = await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith('file:'))!.webContents.capturePage()).toPNG().toString('base64')); writeFileSync(join(realpathSync(process.env.QA_CHAT_INSPECTION), 'chat-request.png'), Buffer.from(png, 'base64')); }
    await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('my draft');
    await expect(page.locator('.chat-view')).toHaveCount(1);
    expect(errors).toEqual([]);
  } finally {
    await app?.close();
    const rel = relative(base, realpathSync(root));
    expect(rel && !rel.startsWith('..') && !isAbsolute(rel)).toBeTruthy();
    rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); // Windows may still hold a file of the closed app
  }
});
