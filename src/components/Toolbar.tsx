import { useRef } from 'react';

interface ToolbarProps {
  showStylePanel: boolean;
  onToggleStyle: () => void;
  onOpenFile: (file: File) => void;
  onSaveMarkdown: () => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  busy: 'pdf' | 'docx' | null;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl+';

const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d="M12 3v13m0 0l-4-4m4 4l4-4" />
    <path d="M3 19h18" />
  </svg>
);

export default function Toolbar(props: ToolbarProps) {
  const { showStylePanel, onToggleStyle, onOpenFile, onSaveMarkdown, onExportPdf, onExportDocx, busy } = props;
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        MD<span>→</span>PDF / DOCX
      </div>

      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={() => fileInput.current?.click()} title={`Open a Markdown file (${mod}O)`}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
          Open
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain"
          hidden
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) onOpenFile(file);
            e.target.value = '';
          }}
        />

        <button className="toolbar-btn" onClick={onSaveMarkdown} title={`Download the Markdown source (${mod}S)`}>
          <DownloadIcon />
          .md
        </button>

        <button
          className={`toolbar-btn ${showStylePanel ? 'active' : ''}`}
          onClick={onToggleStyle}
          aria-pressed={showStylePanel}
          title="Toggle style panel"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
          </svg>
          Style
        </button>
      </div>

      <div className="toolbar-group">
        <button className="export-btn export-docx" onClick={onExportDocx} disabled={busy !== null} title="Download as a Word document">
          <DownloadIcon />
          {busy === 'docx' ? 'Creating…' : 'DOCX'}
        </button>

        <button className="export-btn" onClick={onExportPdf} disabled={busy !== null} title={`Print or save as PDF (${mod}P)`}>
          <DownloadIcon />
          {busy === 'pdf' ? 'Preparing…' : 'PDF'}
        </button>
      </div>
    </header>
  );
}
