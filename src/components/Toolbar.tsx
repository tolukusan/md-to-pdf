interface ToolbarProps {
  showStylePanel: boolean;
  onToggleStyle: () => void;
  onExportPdf: () => void;
  onExportDocx: () => void;
  isExportingDocx: boolean;
}

export default function Toolbar({ showStylePanel, onToggleStyle, onExportPdf, onExportDocx, isExportingDocx }: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-brand">
        MD<span>→</span>PDF / DOCX
      </div>

      <button
        className={`toolbar-btn ${showStylePanel ? 'active' : ''}`}
        onClick={onToggleStyle}
        title="Toggle style panel"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        </svg>
        Style
      </button>

      <button className="export-btn export-docx" onClick={onExportDocx} disabled={isExportingDocx} title="Download as a Word document">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 3v13m0 0l-4-4m4 4l4-4" />
          <path d="M3 19h18" />
        </svg>
        {isExportingDocx ? 'Creating…' : 'Export DOCX'}
      </button>

      <button className="export-btn" onClick={onExportPdf} title="Export as PDF">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 3v13m0 0l-4-4m4 4l4-4" />
          <path d="M3 19h18" />
        </svg>
        Export PDF
      </button>
    </header>
  );
}
