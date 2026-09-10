import { useState, useCallback } from 'react';
import { defaultStyle, type DocStyle } from './types';
import { useDebounce } from './hooks/useDebounce';
import { exportToPdf } from './utils/pdf';
import { exportToDocx } from './utils/docx';
import Toolbar from './components/Toolbar';
import Editor from './components/Editor';
import PagePreview from './components/PagePreview';
import StylePanel from './components/StylePanel';
import './styles/index.css';

const SAMPLE = `# Getting Started

Welcome to **MD → PDF / DOCX** — write Markdown on the left, see a page preview in the center, and export a clean PDF or Word document when you're done.

## What's supported

- **Bold**, *italic*, ~~strikethrough~~, and \`inline code\`
- Headings H1 – H6
- Ordered and unordered lists
- Tables, blockquotes, horizontal rules
- Fenced code blocks with syntax highlighting
- Images and links

## Code example

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet('world'));
\`\`\`

## Table example

| Feature        | Status |
| -------------- | ------ |
| Markdown       | ✅      |
| Syntax highlight | ✅    |
| PDF export     | ✅      |
| DOCX export    | ✅      |
| Style editor   | ✅      |

## Blockquote

> Use the **Style** button in the top bar to open the style panel — choose a theme preset or fine-tune font, colors, and page margins.

---

Start writing your document above, or clear this and paste your own markdown.
`;

export default function App() {
  const [markdown, setMarkdown] = useState(SAMPLE);
  const [docStyle, setDocStyle] = useState<DocStyle>(defaultStyle);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  const previewMarkdown = useDebounce(markdown, 700);
  const previewStyle = useDebounce(docStyle, 200);
  const isStale = markdown !== previewMarkdown;

  const handlePdfExport = useCallback(() => {
    exportToPdf(previewMarkdown, previewStyle);
  }, [previewMarkdown, previewStyle]);

  const handleDocxExport = useCallback(async () => {
    setIsExportingDocx(true);
    try {
      await exportToDocx(previewMarkdown, previewStyle);
    } catch (error) {
      console.error(error);
      alert('Could not create the DOCX file. Please try again.');
    } finally {
      setIsExportingDocx(false);
    }
  }, [previewMarkdown, previewStyle]);

  return (
    <div className="app">
      <Toolbar
        showStylePanel={showStylePanel}
        onToggleStyle={() => setShowStylePanel(v => !v)}
        onExportPdf={handlePdfExport}
        onExportDocx={handleDocxExport}
        isExportingDocx={isExportingDocx}
      />
      <div className="workspace">
        <Editor value={markdown} onChange={setMarkdown} />
        <PagePreview
          markdown={previewMarkdown}
          style={previewStyle}
          isStale={isStale}
        />
        {showStylePanel && (
          <StylePanel style={docStyle} onChange={setDocStyle} />
        )}
      </div>
    </div>
  );
}
