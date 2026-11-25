import { useEffect, useMemo, useState } from 'react';
import { renderMarkdown } from '../utils/markdown';
import { hasMermaid, renderMermaid } from '../utils/mermaid';

/** Sanitized document HTML; Mermaid diagrams are swapped in asynchronously once rendered. */
export function useRenderedHtml(markdown: string, toc: boolean): string {
  const html = useMemo(() => renderMarkdown(markdown, { toc }), [markdown, toc]);
  const [withDiagrams, setWithDiagrams] = useState<{ source: string; html: string } | null>(null);

  useEffect(() => {
    if (!hasMermaid(html)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      renderMermaid(html).then(result => {
        if (!cancelled) setWithDiagrams({ source: html, html: result });
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [html]);

  return withDiagrams?.source === html ? withDiagrams.html : html;
}
