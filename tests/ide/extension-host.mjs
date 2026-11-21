// Runs inside an isolated VS Code Extension Development Host. No real AI is contacted.
import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createIdeChatIntegration } from '../../ide/vscode/chat-integrations.ts';

export async function run() {
  const extension = vscode.extensions.getExtension('orsi88.moki');
  assert.ok(extension, 'the built Moki extension is installed in the test host');
  await extension.activate();
  await vscode.commands.executeCommand('workbench.view.extension.moki');
  const commands = await vscode.commands.getCommands(true);
  for (const id of ['moki.chooseProject', 'moki.refresh', 'moki.createProject', 'moki.startFromEditor']) assert.ok(commands.includes(id), id);
  const native = commands.filter((id) => /^workbench\.action\.chat\.openNewSessionEditor\./.test(id));
  const old = vscode.window.createWebviewPanel('moki.test.existing', 'Existing conversation', vscode.ViewColumn.One, {});
  old.webview.html = '<html><body><p>Existing history</p><textarea>Unsent draft</textarea></body></html>';
  const before = old.webview.html;
  let created;
  const requests = [];
  const command = 'workbench.action.chat.openNewSessionEditor.openai-codex';
  assert.ok(!commands.includes(command), 'the isolated profile has no external AI extension');
  const registration = vscode.commands.registerCommand(command, (options) => {
    requests.push(options.prompt);
    created = vscode.window.createWebviewPanel('moki.test.new', 'New AI conversation', vscode.ViewColumn.Beside, {});
    created.webview.html = '<html><body>New conversation</body></html>';
    return vscode.Uri.parse('openai-codex:/new-fixture-session');
  });
  try {
    const integration = createIdeChatIntegration({ version: vscode.version, commands: async () => vscode.commands.getCommands(true),
      execute: async (id, options) => vscode.commands.executeCommand(id, options), current: () => true });
    const result = await integration.start({ project: 'fixture', folder: process.env.QA_WORKSPACE, ai: 'codex', prompt: 'Synthetic test request', requestId: 'a'.repeat(32) });
    assert.deepEqual(requests, ['Synthetic test request']);
    assert.equal(result.session, 'openai-codex:/new-fixture-session');
    assert.equal(old.webview.html, before);
    // Editor tabs are published asynchronously over the extension-host RPC bridge.
    await new Promise((done, fail) => {
      const titles = () => vscode.window.tabGroups.all.flatMap((group) => group.tabs.map((tab) => tab.label));
      const inspect = () => {
        const current = titles();
        if (current.includes('Existing conversation') && current.includes('New AI conversation')) { clearTimeout(timer); subscription.dispose(); done(); }
      };
      const timer = setTimeout(() => { subscription.dispose(); fail(new Error(`Missing test tabs: ${titles().join(', ')}`)); }, 5000);
      const subscription = vscode.window.tabGroups.onDidChangeTabs(inspect);
      inspect();
    });
    writeFileSync(process.env.MOKI_IDE_TEST_RESULT, JSON.stringify({ ok: true, version: vscode.version, nativeCommands: native,
      assertions: ['extension activated', 'panel opened', 'commands registered', 'new-tab dispatch over VS Code RPC', 'previous tab and draft preserved'],
      provider: 'synthetic; no model or external MCP called' }));
  } finally { registration.dispose(); created?.dispose(); old.dispose(); }
}
