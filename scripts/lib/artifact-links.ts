// Which links of a project chat answer are Claude artifacts (claude.ai/artifact/{id}, claude.ai/code/artifact/{uuid}):
// the chat tab opens those in its artifact viewer (desktop/artifact-viewer-host.ts) and any other link as before.
// Shared by the window (app/src/components/ChatView.tsx) and the main process (desktop/artifact-viewer.ts).

export function isArtifactUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'claude.ai' && !url.username && !url.password && (!url.port || url.port === '443')
      && /^\/(?:code\/)?artifacts?\/[\w-]+/.test(url.pathname);
  } catch { return false; }
}
