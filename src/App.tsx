import { useCallback, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { defaultStyle, type DocStyle } from './types';
import { exportToPdf } from './utils/pdf';
import { downloadBlob, exportToDocx } from './utils/docx';
import { fileBaseName } from './utils/markdown';
import { type Draft, loadDraft, saveDraft } from './utils/storage';
import Toolbar from './components/Toolbar';
import Editor, { type EditorHandle } from './components/Editor';
import PagePreview, { type PreviewHandle } from './components/PagePreview';
import StylePanel from './components/StylePanel';
import Toast, { type ToastMessage } from './components/Toast';
import './styles/index.css';

const SAMPLE = `# Getting Started

Welcome to **MD → PDF / DOCX**. Write Markdown on the left, check the page preview in the middle, and export a clean PDF or Word document when you're done. Your work is saved in this browser automatically.

## What's supported

- **Bold**, *italic*, ~~strikethrough~~, and \`inline code\`
- Headings, lists, tables, blockquotes and horizontal rules
- Fenced code blocks with syntax highlighting
- Images, links and task lists
- Math with KaTeX and diagrams with Mermaid

## Code example

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet('world'));
\`\`\`

## Table example

| Feature          | PDF | DOCX |
| ---------------- | :-: | :--: |
| Syntax highlight | ✅  | –    |
| Math             | ✅  | as TeX |
| Diagrams         | ✅  | ✅   |

## Math

Inline: $E = mc^2$. Display:

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

## Diagram

\`\`\`mermaid
flowchart LR
  A[Write Markdown] --> B[Preview]
  B --> C{Export}
  C --> D[PDF]
  C --> E[DOCX]
\`\`\`

## Checklist

- [x] Write a draft
- [ ] Pick a theme in **Style**
- [ ] Export

> Open **Style** to choose a theme, page size, header, footer, page numbers or a table of contents. Put \`\\pagebreak\` on its own line to start a new page.

---

Shortcuts: **Ctrl+B** bold, **Ctrl+I** italic, **Ctrl+K** link, **Ctrl+S** save .md, **Ctrl+O** open, **Ctrl+P** export PDF.
`;

function initialDraft(): Draft {
  return loadDraft() ?? { markdown: SAMPLE, style: defaultStyle };
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export default function App() {
  const [initial] = useState(initialDraft);
  const [markdown, setMarkdown] = useState(initial.markdown);
  const [docStyle, setDocStyle] = useState<DocStyle>(initial.style);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'docx' | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const editor = useRef<EditorHandle>(null);
  const preview = useRef<PreviewHandle>(null);

  const previewMarkdown = useDeferredValue(markdown);
  const previewStyle = useDeferredValue(docStyle);
  const isStale = markdown !== previewMarkdown;

  const notify = useCallback((text: string, extra: Omit<ToastMessage, 'id' | 'text'> = {}) => {
    setToast({ id: Date.now(), text, ...extra });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(current => (current?.id === toast.id ? null : current)), toast.action ? 10000 : 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Autosave
  useEffect(() => {
    const timer = setTimeout(() => saveDraft({ markdown, style: docStyle }), 400);
    return () => clearTimeout(timer);
  }, [markdown, docStyle]);

  const openFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      notify('That file is larger than 5 MB.', { tone: 'error' });
      return;
    }
    const text = await file.text();
    editor.current?.replaceAll(text);
    notify(`Opened ${file.name}. Press Ctrl+Z to undo.`);
  }, [notify]);

  const saveMarkdown = useCallback(() => {
    downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${fileBaseName(markdown)}.md`);
  }, [markdown]);

  const exportPdf = useCallback(async () => {
    if (busy) return;
    setBusy('pdf');
    try {
      await exportToPdf(markdown, docStyle);
    } catch (error) {
      console.error(error);
      notify('Could not prepare the PDF. Please try again.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  }, [busy, markdown, docStyle, notify]);

  const exportDocx = useCallback(async () => {
    if (busy) return;
    setBusy('docx');
    try {
      await exportToDocx(markdown, docStyle);
    } catch (error) {
      console.error(error);
      notify('Could not create the DOCX file. Please try again.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  }, [busy, markdown, docStyle, notify]);

  // Global shortcuts (refs keep the listener stable while seeing the latest handlers)
  const shortcuts = useRef({ saveMarkdown, exportPdf, openFile });
  useLayoutEffect(() => {
    shortcuts.current = { saveMarkdown, exportPdf, openFile };
  });
  useEffect(() => {
    const pickFile = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.markdown,.mdown,.txt,text/markdown,text/plain';
      input.onchange = () => { if (input.files?.[0]) void shortcuts.current.openFile(input.files[0]); };
      input.click();
    };
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === 's') { event.preventDefault(); shortcuts.current.saveMarkdown(); }
      else if (key === 'p') { event.preventDefault(); void shortcuts.current.exportPdf(); }
      else if (key === 'o') { event.preventDefault(); pickFile(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return (
    <div className="app">
      <Toolbar
        showStylePanel={showStylePanel}
        onToggleStyle={() => setShowStylePanel(v => !v)}
        onOpenFile={file => void openFile(file)}
        onSaveMarkdown={saveMarkdown}
        onExportPdf={() => void exportPdf()}
        onExportDocx={() => void exportDocx()}
        busy={busy}
      />
      <div className={`workspace ${showStylePanel ? 'with-style-panel' : ''}`}>
        <Editor
          ref={editor}
          value={markdown}
          onChange={setMarkdown}
          onOpenFile={file => void openFile(file)}
          onScrollRatio={ratio => preview.current?.scrollToRatio(ratio)}
        />
        <PagePreview
          ref={preview}
          markdown={previewMarkdown}
          style={previewStyle}
          isStale={isStale}
        />
        {showStylePanel && (
          <StylePanel style={docStyle} onChange={setDocStyle} />
        )}
      </div>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
