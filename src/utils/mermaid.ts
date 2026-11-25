import DOMPurify from 'dompurify';

// Mermaid is ~2 MB, so it is fetched from a CDN only when a document contains a diagram.
const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs';

interface MermaidApi {
  initialize(config: Record<string, unknown>): void;
  render(id: string, text: string): Promise<{ svg: string }>;
}

let mermaidPromise: Promise<MermaidApi> | null = null;

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = import(/* @vite-ignore */ MERMAID_URL)
      .then((mod: { default: MermaidApi }) => {
        const mermaid = mod.default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: 'neutral',
          // Plain SVG text (no <foreignObject>) so diagrams can be rasterised for DOCX.
          htmlLabels: false,
          flowchart: { htmlLabels: false },
        });
        return mermaid;
      })
      .catch(error => {
        mermaidPromise = null;
        throw error;
      });
  }
  return mermaidPromise;
}

const cache = new Map<string, string>();
let counter = 0;

export function hasMermaid(html: string): boolean {
  return html.includes('class="mermaid-source"');
}

/** Replace every `<pre class="mermaid-source">` in the HTML with a rendered SVG diagram. */
export async function renderMermaid(html: string): Promise<string> {
  if (!hasMermaid(html)) return html;
  const root = document.createElement('div');
  root.innerHTML = html;
  const blocks = Array.from(root.querySelectorAll('pre.mermaid-source'));

  let mermaid: MermaidApi;
  try {
    mermaid = await loadMermaid();
  } catch {
    blocks.forEach(block => block.setAttribute('data-error', 'Could not load the diagram renderer (offline?)'));
    return root.innerHTML;
  }

  for (const block of blocks) {
    const source = block.textContent || '';
    let svg = cache.get(source);
    if (!svg) {
      try {
        const result = await mermaid.render(`mermaid-${++counter}`, source);
        svg = DOMPurify.sanitize(result.svg, { USE_PROFILES: { svg: true, svgFilters: true } });
        cache.set(source, svg);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        block.setAttribute('data-error', message.split('\n')[0]);
        document.getElementById(`dmermaid-${counter}`)?.remove();
        continue;
      }
    }
    const figure = document.createElement('div');
    figure.className = 'mermaid-diagram';
    figure.innerHTML = svg;
    block.replaceWith(figure);
  }
  return root.innerHTML;
}
