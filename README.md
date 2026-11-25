# MD → PDF / DOCX

Write Markdown, see it as a page, and export a clean PDF or Word document. Everything runs in the browser. Nothing is uploaded.

Live: https://md-to-pdf-opal.vercel.app/

## Features

- **Editor**: CodeMirror with Markdown highlighting, line numbers, search (Ctrl+F) and undo history
- **Page preview**: shows A4 or US Letter width, your margins, and dashed lines where pages are likely to break
- **PDF export**: uses the browser's print engine, with optional header, footer and "Page X of Y" numbers
- **DOCX export**: real Word headings, numbered and bulleted lists, tables, code blocks, embedded images and diagrams, a linked table of contents, headers, footers and page numbers
- **Styling**: four themes plus font, size, line height, colours, margins and custom CSS
- **Extras**: KaTeX math (`$x^2$`, `$$...$$`), Mermaid diagrams (` ```mermaid `), task lists, and `\pagebreak` on its own line for a manual page break
- **Files and sharing**: open or drag in a `.md` file, save as `.md`, or copy a share link (the whole document is compressed into the URL)
- **Autosave**: your document and settings are kept in this browser's local storage

### Shortcuts

| Keys | Action |
| --- | --- |
| Ctrl/⌘ + B / I / E | Bold / italic / inline code |
| Ctrl/⌘ + K | Insert link |
| Ctrl/⌘ + Shift + X | Strikethrough |
| Ctrl/⌘ + S | Save `.md` |
| Ctrl/⌘ + O | Open file |
| Ctrl/⌘ + P | Export PDF |
| Tab | Indent. Press Esc then Tab to move focus out of the editor |

## Limits

- The preview's page breaks are an estimate. The browser's print engine decides the final breaks.
- In DOCX, math is written as its TeX source, and code blocks are not syntax-coloured.
- Mermaid loads from the jsDelivr CDN the first time a document contains a diagram. The KaTeX stylesheet and the Inter and Fira Code fonts also come from CDNs. Without internet access, diagrams show their source code instead.
- Images on other websites can only go into the DOCX if that site allows cross-origin requests (CORS). Otherwise the DOCX shows the image's alt text.

## Development

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # Vitest unit tests (Markdown pipeline, DOCX output, print HTML, share links)
pnpm lint       # ESLint
pnpm build      # type-check, then build a single self-contained dist/index.html
```

All rendered HTML goes through DOMPurify before it reaches the preview, the print view or the DOCX builder. The print view also runs in a sandboxed iframe where scripts are blocked.

## Project layout

```
src/
  App.tsx                 state, autosave, shortcuts, share links
  components/             Toolbar, Editor (CodeMirror), PagePreview, StylePanel, Toast
  hooks/useRenderedHtml   Markdown → HTML for the preview, with async Mermaid rendering
  utils/markdown.ts       marked + highlight.js + KaTeX, sanitising, heading ids, TOC, page breaks
  utils/mermaid.ts        loads Mermaid on demand and renders diagrams to SVG
  utils/pdf.ts            print HTML (@page rules, margin boxes) and the hidden-iframe print
  utils/docx.ts           HTML → Word document
  utils/storage.ts        autosave and share-link encoding
  styles/document.css     document styles shared by the preview and the PDF
```
