import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { type DocStyle, MM_TO_PX, PAGE_SIZES, docCssVars } from '../types';
import { useRenderedHtml } from '../hooks/useRenderedHtml';
import { scopeCustomCss } from '../utils/pdf';
import '../styles/document.css';
import 'highlight.js/styles/github.css';

export interface PreviewHandle {
  scrollToRatio(ratio: number): void;
}

interface PagePreviewProps {
  markdown: string;
  style: DocStyle;
  isStale: boolean;
}

const PagePreview = forwardRef<PreviewHandle, PagePreviewProps>(function PagePreview({ markdown, style, isStale }, ref) {
  const html = useRenderedHtml(markdown, style.toc);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useImperativeHandle(ref, () => ({
    scrollToRatio(ratio: number) {
      const el = scroller.current;
      if (el) el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
    },
  }), []);

  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setContentHeight(el.scrollHeight));
    observer.observe(el);
    setContentHeight(el.scrollHeight);
    return () => observer.disconnect();
  }, []);

  const page = PAGE_SIZES[style.pageSize];
  const px = (mm: number) => Math.round(mm * MM_TO_PX);
  const pageWidth = px(page.widthMm);
  const pageHeight = px(page.heightMm);
  const top = px(style.marginTopMm);
  const bottom = px(style.marginBottomMm);
  const usable = Math.max(50, pageHeight - top - bottom);
  const body = Math.max(0, contentHeight - top - bottom);
  const pages = Math.max(1, Math.ceil(body / usable));
  const guides = Array.from({ length: pages - 1 }, (_, i) => top + usable * (i + 1));

  const vars = {
    ...docCssVars(style),
    '--doc-pad': [style.marginTopMm, style.marginRightMm, style.marginBottomMm, style.marginLeftMm]
      .map(v => `${px(v)}px`).join(' '),
    minHeight: `${pageHeight}px`,
  } as React.CSSProperties;

  const footerParts = [style.footerText.trim(), style.pageNumbers ? `Page 1 of ${pages}` : ''].filter(Boolean);

  return (
    <div className="preview-pane">
      <div className="pane-header">
        Page Preview
        <div className="pane-header-right">
          <span className="char-count" title="Estimated from the page height; the browser's print engine decides the final breaks.">
            ≈ {pages} {pages === 1 ? 'page' : 'pages'} · {style.pageSize}
          </span>
          {isStale && <span className="stale-dot" title="Preview is updating…" />}
        </div>
      </div>
      <div className="preview-scroll" ref={scroller}>
        <div className="page-container" style={{ width: pageWidth, maxWidth: '100%' }}>
          {style.headerText.trim() && (
            <div className="page-margin-note page-header" style={{ height: top }}>{style.headerText}</div>
          )}
          <style>{scopeCustomCss(style.customCss)}</style>
          <div
            ref={content}
            className="doc-content"
            style={vars}
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {guides.map((y, i) => (
            <div key={i} className="page-guide" style={{ top: y }} aria-hidden="true">
              <span>Page {i + 2}</span>
            </div>
          ))}
          {footerParts.length > 0 && (
            <div className="page-margin-note page-footer" style={{ height: Math.min(bottom, pageHeight) , top: pageHeight - bottom }}>
              {footerParts.join('   ·   ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default PagePreview;
