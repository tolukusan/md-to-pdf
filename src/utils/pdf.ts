import { type DocStyle, docCssVars } from '../types';
import { documentTitle, escapeHtml, renderMarkdown } from './markdown';
import { renderMermaid } from './mermaid';
import documentCss from '../styles/document.css?inline';
import hljsCss from 'highlight.js/styles/github.css?inline';

export const KATEX_CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css';
const FONTS_CSS_URL = 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=Inter:wght@400;600;700&display=swap';

/** Quote a string for use as a CSS `content` value. */
export function cssString(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]+/g, ' ')}"`;
}

/** User CSS is nested under .doc-content and may not close the <style> element. */
export function scopeCustomCss(css: string): string {
  const safe = css.replace(/<\/?style/gi, '');
  return safe.trim() ? `.doc-content {\n${safe}\n}` : '';
}

function marginBoxes(style: DocStyle): string {
  const boxStyle = `font: 9pt ${style.fontFamily}; color: #666;`;
  const boxes: string[] = [];
  if (style.headerText.trim()) {
    boxes.push(`@top-center { content: ${cssString(style.headerText)}; ${boxStyle} }`);
  }
  if (style.footerText.trim()) {
    boxes.push(`@bottom-left { content: ${cssString(style.footerText)}; ${boxStyle} }`);
  }
  if (style.pageNumbers) {
    boxes.push(`@bottom-right { content: "Page " counter(page) " of " counter(pages); ${boxStyle} }`);
  }
  return boxes.join('\n      ');
}

export function buildPrintHtml(bodyHtml: string, style: DocStyle, title: string): string {
  const vars = Object.entries(docCssVars(style)).map(([k, v]) => `${k}: ${v};`).join(' ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title || 'Document')}</title>
  <link rel="stylesheet" href="${FONTS_CSS_URL}">
  <link rel="stylesheet" href="${KATEX_CSS_URL}">
  <style>
    @page {
      size: ${style.pageSize};
      margin: ${style.marginTopMm}mm ${style.marginRightMm}mm ${style.marginBottomMm}mm ${style.marginLeftMm}mm;
      background: ${style.bgColor};
      ${marginBoxes(style)}
    }
    html, body {
      margin: 0;
      background: ${style.bgColor};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    ${documentCss}
    ${hljsCss}
    .doc-content { padding: 0 !important; }
    .doc-content .page-break { border: none; margin: 0; }
    .doc-content .page-break::after { content: none; }
  </style>
  <style>${scopeCustomCss(style.customCss)}</style>
</head>
<body><div class="doc-content" style="${escapeHtml(vars)}">${bodyHtml}</div></body>
</html>`;
}

async function waitForAssets(doc: Document): Promise<void> {
  const images = Array.from(doc.images).map(img =>
    img.complete ? Promise.resolve() : new Promise<void>(resolve => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    }),
  );
  const timeout = new Promise<void>(resolve => setTimeout(resolve, 10000));
  await Promise.race([Promise.all([...images, doc.fonts?.ready]), timeout]);
}

export async function exportToPdf(markdown: string, style: DocStyle): Promise<void> {
  const html = await renderMermaid(renderMarkdown(markdown, { toc: style.toc }));
  const title = documentTitle(markdown) || 'Document';

  const iframe = document.createElement('iframe');
  // No allow-scripts: nothing in the document can execute, even if it slipped past sanitising.
  iframe.setAttribute('sandbox', 'allow-same-origin allow-modals');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';

  await new Promise<void>((resolve, reject) => {
    iframe.onload = () => resolve();
    iframe.onerror = () => reject(new Error('Could not prepare the print view.'));
    iframe.srcdoc = buildPrintHtml(html, style, title);
    document.body.appendChild(iframe);
  });

  const win = iframe.contentWindow;
  if (!win) {
    iframe.remove();
    throw new Error('Could not prepare the print view.');
  }
  await waitForAssets(win.document);

  // Browsers name the saved PDF after the top-level page title.
  const previousTitle = document.title;
  document.title = title;
  const cleanup = () => {
    document.title = previousTitle;
    iframe.remove();
  };
  win.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, 60000);
  win.focus();
  win.print();
}
