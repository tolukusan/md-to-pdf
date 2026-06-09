import { type DocStyle } from '../types';
import { renderMarkdown } from './markdown';
import hljsCss from 'highlight.js/styles/github.css?inline';

function buildDocCss(s: DocStyle): string {
  return `
    body {
      font-family: ${s.fontFamily};
      font-size: ${s.fontSize}px;
      line-height: ${s.lineHeight};
      color: ${s.textColor};
      background: ${s.bgColor};
      margin: 0;
      word-break: break-word;
    }
    h1, h2, h3, h4, h5, h6 {
      color: ${s.headingColor};
      margin-top: 1.5em;
      margin-bottom: 0.4em;
      line-height: 1.2;
      font-weight: 700;
    }
    h1 { font-size: 2em; border-bottom: 2px solid #eee; padding-bottom: 0.3em; margin-top: 0; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.2em; }
    h3 { font-size: 1.25em; }
    h4 { font-size: 1.1em; }
    p { margin: 0 0 1em; }
    a { color: ${s.linkColor}; text-decoration: underline; }
    code {
      font-family: ${s.codeFont};
      background: ${s.codeBg};
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.875em;
    }
    pre {
      background: ${s.codeBg};
      padding: 1em 1.25em;
      border-radius: 6px;
      overflow: hidden;
      margin: 0 0 1em;
    }
    pre code { background: none; padding: 0; border-radius: 0; font-size: 0.875em; }
    blockquote {
      border-left: 4px solid ${s.linkColor};
      margin: 0 0 1em;
      padding: 0.5em 1em;
      color: #555;
    }
    blockquote > p:last-child { margin-bottom: 0; }
    table { border-collapse: collapse; width: 100%; margin: 0 0 1em; font-size: 0.9em; }
    th, td { border: 1px solid #ddd; padding: 0.5em 0.75em; text-align: left; }
    th { background: rgba(0,0,0,0.04); font-weight: 600; }
    tr:nth-child(even) td { background: rgba(0,0,0,0.02); }
    ul, ol { margin: 0 0 1em; padding-left: 1.75em; }
    li { margin-bottom: 0.3em; }
    li > ul, li > ol { margin-top: 0.3em; margin-bottom: 0; }
    img { max-width: 100%; }
    hr { border: none; border-top: 1px solid #eee; margin: 2em 0; }
  `;
}

export function exportToPdf(markdown: string, style: DocStyle): void {
  const html = renderMarkdown(markdown);
  const docCss = buildDocCss(style);

  const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Document</title>
  <style>
    @page {
      size: A4;
      margin: ${style.marginTopMm}mm ${style.marginRightMm}mm ${style.marginBottomMm}mm ${style.marginLeftMm}mm;
    }
    ${docCss}
    ${hljsCss}
  </style>
</head>
<body>${html}</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Please allow pop-ups to export PDF.');
    return;
  }
  win.document.write(pageHtml);
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
  }, 400);
}
