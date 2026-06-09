import { marked } from 'marked';
import hljs from 'highlight.js';

marked.use({
  gfm: true,
  breaks: false,
  renderer: {
    code(code: string, lang: string | undefined): string {
      const language = hljs.getLanguage(lang || '') ? (lang || 'plaintext') : 'plaintext';
      try {
        const highlighted = hljs.highlight(code, { language }).value;
        return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`;
      } catch {
        return `<pre><code class="hljs">${code}</code></pre>\n`;
      }
    },
  },
});

export function renderMarkdown(md: string): string {
  return marked.parse(md) as string;
}
