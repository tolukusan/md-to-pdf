import { describe, expect, it } from 'vitest';
import { documentTitle, fileBaseName, renderMarkdown, slugify } from '../utils/markdown';

const parse = (html: string) => {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
};

describe('renderMarkdown', () => {
  it('strips script and event-handler attributes', () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)">\n\n<script>alert(2)</script>\n\n[x](javascript:alert(3))');
    expect(html).not.toMatch(/onerror|<script|javascript:/i);
  });

  it('escapes code in blocks with unknown or missing languages', () => {
    const html = renderMarkdown('```nosuchlang\n<b>hi</b>\n```\n\n```\n<i>x</i>\n```');
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;');
    expect(html).toContain('&lt;i&gt;x&lt;/i&gt;');
    expect(parse(html).querySelector('b, i')).toBeNull();
  });

  it('highlights known languages', () => {
    const html = renderMarkdown('```js\nconst a = 1;\n```');
    expect(html).toContain('class="hljs language-js"');
    expect(html).toContain('hljs-keyword');
  });

  it('gives headings unique ids', () => {
    const root = parse(renderMarkdown('# Intro\n\n## Intro\n\n## Café & Co'));
    expect(Array.from(root.querySelectorAll('h1,h2')).map(h => h.id)).toEqual(['intro', 'intro-1', 'cafe-co']);
  });

  it('builds a table of contents after the first H1', () => {
    const root = parse(renderMarkdown('# Title\n\n## One\n\n### Two\n\n#### Too deep', { toc: true }));
    const nav = root.querySelector('nav.toc');
    expect(nav?.previousElementSibling?.tagName).toBe('H1');
    expect(Array.from(nav!.querySelectorAll('a')).map(a => a.getAttribute('href'))).toEqual(['#title', '#one', '#two']);
  });

  it('turns \\pagebreak lines into page-break elements', () => {
    const root = parse(renderMarkdown('a\n\n\\pagebreak\n\nb\n\n\\newpage\n\nc'));
    expect(root.querySelectorAll('.page-break')).toHaveLength(2);
  });

  it('opens external links in a new tab but keeps in-page anchors', () => {
    const root = parse(renderMarkdown('[a](https://example.com) [b](#intro)'));
    const [external, anchor] = Array.from(root.querySelectorAll('a'));
    expect(external.getAttribute('target')).toBe('_blank');
    expect(external.getAttribute('rel')).toContain('noopener');
    expect(anchor.hasAttribute('target')).toBe(false);
  });

  it('renders task lists and math', () => {
    const root = parse(renderMarkdown('- [x] done\n- [ ] todo\n\n$x^2$'));
    expect(root.querySelector('ul.task-list li.task-item input[type="checkbox"]')).not.toBeNull();
    expect(root.querySelector('.katex')).not.toBeNull();
  });

  it('marks mermaid blocks for diagram rendering', () => {
    expect(renderMarkdown('```mermaid\ngraph TD; A-->B\n```')).toContain('class="mermaid-source"');
  });
});

describe('titles and file names', () => {
  it('uses the first H1', () => {
    expect(documentTitle('intro\n\n# My **Report**\n\n# Second')).toBe('My Report');
    expect(fileBaseName('# Q3 Plan: Draft/v2?')).toBe('q3-plan-draftv2');
    expect(fileBaseName('no heading')).toBe('document');
  });

  it('slugifies', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
    expect(slugify('???')).toBe('section');
  });
});
