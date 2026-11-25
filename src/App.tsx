import { type RefObject, useCallback, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { defaultStyle, type DocStyle } from './types';
import { exportToPdf } from './utils/pdf';
import { downloadBlob, exportToDocx } from './utils/docx';
import { fileBaseName } from './utils/markdown';
import {
  type Draft, backupDraft, clearBackup, loadBackup, loadDraft, readShareFromHash, saveDraft, shareUrl,
} from './utils/storage';
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

interface Initial {
  draft: Draft;
  fromShare: boolean;
}

function initialState(): Initial {
  const shared = readShareFromHash();
  const saved = loadDraft();
  if (shared) {
    if (saved && saved.markdown !== shared.markdown) backupDraft(saved);
    return { draft: shared, fromShare: true };
  }
  return { draft: saved ?? { markdown: SAMPLE, style: defaultStyle }, fromShare: false };
}

// Module-level so the toast's restore action (created during the first render) can reach the editor.
const editorHandle: { current: EditorHandle | null } = { current: null };
let restoreStyle: (style: DocStyle) => void = () => {};

/** If a shared link replaced the user's draft, offer to bring it back. */
function sharedToast(initial: Initial): ToastMessage | null {
  if (!initial.fromShare) return null;
  const backup = loadBackup();
  if (!backup) return { id: 1, text: 'Opened a shared document.' };
  return {
    id: 1,
    text: 'Opened a shared document. Your previous draft was replaced.',
    action: {
      label: 'Restore my draft',
      run: () => {
        editorHandle.current?.replaceAll(backup.markdown);
        restoreStyle(backup.style);
        clearBackup();
      },
    },
  };
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export default function App() {
  const [initial] = useState(initialState);
  const [markdown, setMarkdown] = useState(initial.draft.markdown);
  const [docStyle, setDocStyle] = useState<DocStyle>(initial.draft.style);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [busy, setBusy] = useState<'pdf' | 'docx' | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(() => sharedToast(initial));

  const preview = useRef<PreviewHandle>(null);
  useEffect(() => { restoreStyle = setDocStyle; }, []);

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

  // Drop the (possibly huge) share hash so a refresh loads the autosaved copy instead.
  useEffect(() => {
    if (initial.fromShare) history.replaceState(null, '', location.pathname + location.search);
  }, [initial.fromShare]);

  const openFile = useCallback(async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      notify('That file is larger than 5 MB.', { tone: 'error' });
      return;
    }
    const text = await file.text();
    editorHandle.current?.replaceAll(text);
    notify(`Opened ${file.name}. Press Ctrl+Z to undo.`);
  }, [notify]);

  const saveMarkdown = useCallback(() => {
    downloadBlob(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }), `${fileBaseName(markdown)}.md`);
  }, [markdown]);

  const share = useCallback(async () => {
    const url = shareUrl({ markdown, style: docStyle });
    try {
      await navigator.clipboard.writeText(url);
      notify(url.length > 8000
        ? 'Link copied. It is long, so some apps may cut it off.'
        : 'Link copied. Anyone with it can open this document.');
    } catch {
      notify('Could not copy to the clipboard.', { tone: 'error' });
    }
  }, [markdown, docStyle, notify]);

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
        onShare={() => void share()}
        onExportPdf={() => void exportPdf()}
        onExportDocx={() => void exportDocx()}
        busy={busy}
      />
      <div className={`workspace ${showStylePanel ? 'with-style-panel' : ''}`}>
        <Editor
          ref={editorHandle as RefObject<EditorHandle>}
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
