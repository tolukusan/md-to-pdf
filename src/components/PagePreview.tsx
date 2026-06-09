import { useMemo } from 'react';
import { type DocStyle } from '../types';
import { renderMarkdown } from '../utils/markdown';
import '../styles/document.css';
import 'highlight.js/styles/github.css';

interface PagePreviewProps {
  markdown: string;
  style: DocStyle;
  isStale: boolean;
}

const MM_TO_PX = 3.7795;

export default function PagePreview({ markdown, style, isStale }: PagePreviewProps) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);

  const docVars = {
    '--doc-font': style.fontFamily,
    '--doc-size': `${style.fontSize}px`,
    '--doc-lh': `${style.lineHeight}`,
    '--doc-color': style.textColor,
    '--doc-bg': style.bgColor,
    '--doc-heading': style.headingColor,
    '--doc-link': style.linkColor,
    '--doc-code-font': style.codeFont,
    '--doc-code-bg': style.codeBg,
    '--doc-pad': [
      style.marginTopMm,
      style.marginRightMm,
      style.marginBottomMm,
      style.marginLeftMm,
    ].map(v => `${Math.round(v * MM_TO_PX)}px`).join(' '),
  } as React.CSSProperties;

  return (
    <div className="preview-pane">
      <div className="pane-header">
        Page Preview
        <div className="pane-header-right">
          {isStale && <span className="stale-dot" title="Preview is updating…" />}
        </div>
      </div>
      <div className="preview-scroll">
        <div className="page-container">
          <div
            className="doc-content"
            style={docVars}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}
