import { Marked, type Tokens } from 'marked';
import markedKatex from 'marked-katex-extension';
import hljs from 'highlight.js/lib/common';
import DOMPurify from 'dompurify';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const marked = new Marked({ gfm: true, breaks: false });

marked.use(markedKatex({ throwOnError: false, nonStandard: true }));

marked.use({
  renderer: {
    code({ text, lang }: Tokens.Code): string {
      const language = (lang || '').trim().split(/\s+/)[0].toLowerCase();
      if (language === 'mermaid') {
        return `<pre class="mermaid-source">${escapeHtml(text)}</pre>\n`;
      }
      if (language && hljs.getLanguage(language)) {
        try {
          const highlighted = hljs.highlight(text, { language }).value;
          return `<pre><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>\n`;
        } catch {
          // fall through to plain, escaped output
        }
      }
      return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>\n`;
    },
  },
});

/** Lines that force a page break in PDF and DOCX output. */
const PAGE_BREAK_MARKERS = new Set(['\\pagebreak', '\\newpage']);

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
  return slug || 'section';
}

export interface RenderOptions {
  toc?: boolean;
}

/** Markdown → sanitized HTML, with heading ids, page breaks, task lists and an optional table of contents. */
export function renderMarkdown(md: string, options: RenderOptions = {}): string {
  const raw = marked.parse(md, { async: false });
  const fragment = DOMPurify.sanitize(raw, {
    RETURN_DOM_FRAGMENT: true,
    FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select'],
    // KaTeX's MathML keeps the TeX source in <semantics><annotation encoding="application/x-tex">.
    ADD_TAGS: ['semantics', 'annotation'],
    ADD_ATTR: ['encoding'],
  });
  const root = document.createElement('div');
  root.appendChild(fragment);

  // Page breaks
  root.querySelectorAll('p').forEach(p => {
    if (PAGE_BREAK_MARKERS.has((p.textContent || '').trim())) {
      const br = document.createElement('div');
      br.className = 'page-break';
      p.replaceWith(br);
    }
  });

  // Unique heading ids
  const used = new Map<string, number>();
  const headings = Array.from(root.querySelectorAll<HTMLHeadingElement>('h1,h2,h3,h4,h5,h6'));
  for (const heading of headings) {
    const base = slugify(heading.textContent || '');
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    heading.id = count ? `${base}-${count}` : base;
  }

  // Links: external links open in a new tab so the editor is never navigated away
  root.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href.startsWith('#')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });

  // Task lists
  root.querySelectorAll('li > input[type="checkbox"]').forEach(box => {
    box.parentElement?.classList.add('task-item');
    box.parentElement?.parentElement?.classList.add('task-list');
  });

  if (options.toc) {
    const tocHeadings = headings.filter(h => Number(h.tagName[1]) <= 3);
    if (tocHeadings.length) {
      const nav = document.createElement('nav');
      nav.className = 'toc';
      const title = document.createElement('p');
      title.className = 'toc-title';
      title.textContent = 'Contents';
      const list = document.createElement('ul');
      for (const heading of tocHeadings) {
        const li = document.createElement('li');
        li.className = `toc-level-${heading.tagName[1]}`;
        const link = document.createElement('a');
        link.href = `#${heading.id}`;
        link.textContent = heading.textContent || '';
        li.appendChild(link);
        list.appendChild(li);
      }
      nav.append(title, list);
      const first = root.firstElementChild;
      if (first?.tagName === 'H1') first.after(nav);
      else root.prepend(nav);
    }
  }

  return root.innerHTML;
}

/** Plain text of the first H1, used for document titles and file names. */
export function documentTitle(md: string): string {
  const match = /^#\s+(.+?)\s*#*\s*$/m.exec(md);
  return match ? match[1].replace(/[*_`~[\]]/g, '').trim() : '';
}

export function fileBaseName(md: string): string {
  const title = documentTitle(md);
  const name = title
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80)
    .toLowerCase();
  return name || 'document';
}
