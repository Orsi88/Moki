// pdf.js for the main process, with its worker module on this thread (no worker file to load).
// Loaded only when a PDF is read (desktop/pdf-local.ts, desktop/search.ts): pdf.js and its worker
// are most of the main bundle and take ~200 ms and ~20 MB to load, so the app does not pay for
// them at startup (scripts/build-desktop.mjs splits them into their own chunk).

import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';

(globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = pdfjsWorker;

import { getDocument, type PDFPageProxy, type PageViewport } from 'pdfjs-dist/legacy/build/pdf.mjs';

export { getDocument, type PDFPageProxy, type PageViewport };

// The text of a PDF, page by page, stopped at `limit` characters. Scanned pages come back empty:
// this reads the text the file already carries, without a recognition pass.
export async function pdfPlainText(data: Uint8Array, limit = Number.POSITIVE_INFINITY): Promise<string> {
  const task = getDocument({ data, useSystemFonts: false, verbosity: 0 });
  const doc = await task.promise;
  try {
    const pages: string[] = [];
    let used = 0;
    for (let n = 1; n <= doc.numPages && used < limit; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      const page = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
      pages.push(page);
      used += page.length + 1;
    }
    return pages.join('\n').slice(0, limit);
  } finally { await task.destroy(); }
}
