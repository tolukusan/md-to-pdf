import { describe, expect, it } from 'vitest';
import { Packer } from 'docx';
import JSZip from 'jszip';
import { buildDocx } from '../utils/docx';
import { renderMarkdown } from '../utils/markdown';
import { defaultStyle, type DocStyle } from '../types';

async function docxParts(markdown: string, style: Partial<DocStyle> = {}) {
  const merged = { ...defaultStyle, ...style };
  const doc = buildDocx(renderMarkdown(markdown, { toc: merged.toc }), merged);
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  const names = Object.keys(zip.files);
  const read = async (name?: string) => (name ? (await zip.file(name)?.async('string')) ?? '' : '');
  return {
    document: await read('word/document.xml'),
    numbering: await read('word/numbering.xml'),
    styles: await read('word/styles.xml'),
    header: await read(names.find(f => f.startsWith('word/header'))),
    footer: await read(names.find(f => f.startsWith('word/footer'))),
  };
}

const count = (text: string, needle: string) => text.split(needle).length - 1;

describe('buildDocx', () => {
  it('keeps line breaks in code blocks', async () => {
    const { document } = await docxParts('```\nline one\nline two\nline three\n```');
    expect(count(document, '<w:br/>')).toBe(2);
    expect(document).toContain('line three');
  });

  it('keeps each blockquote paragraph separate', async () => {
    const { document } = await docxParts('> first paragraph\n>\n> second paragraph');
    const paragraphs = document.split('<w:p>').filter(p => p.includes(' paragraph'));
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs.every(p => p.includes('<w:ind w:left="360"'))).toBe(true);
  });

  it('uses real Word numbering for lists, restarting per list', async () => {
    const { document, numbering } = await docxParts('1. a\n2. b\n\ntext\n\n1. c\n\n- x\n  - nested');
    expect(document).toContain('<w:numPr>');
    expect(document).not.toContain('• ');
    expect(count(numbering, '<w:abstractNum ')).toBeGreaterThanOrEqual(4);
    expect(document).toMatch(/<w:ilvl w:val="1"\/>/);
  });

  it('renders task list checkboxes', async () => {
    const { document } = await docxParts('- [x] done\n- [ ] todo');
    expect(document).toContain('☑');
    expect(document).toContain('☐');
  });

  it('sizes headings from the style settings', async () => {
    const { styles } = await docxParts('# Big', { fontSize: 20 });
    // H1 = 2em of 20px = 40px = 30pt = 60 half-points
    expect(styles).toMatch(/w:styleId="Heading1"[\s\S]*?<w:sz w:val="60"\/>/);
  });

  it('adds headers, footers and page numbers only when enabled', async () => {
    const without = await docxParts('text');
    expect(without.header + without.footer).toBe('');
    const withThem = await docxParts('text', { headerText: 'Top', footerText: 'Bottom', pageNumbers: true });
    expect(withThem.header).toContain('Top');
    expect(withThem.footer).toContain('Bottom');
    expect(withThem.footer).toContain('PAGE');
  });

  it('links the table of contents to heading bookmarks', async () => {
    const { document } = await docxParts('# Title\n\n## Part one', { toc: true });
    expect(document).toContain('w:anchor="h_part_one"');
    expect(document).toContain('w:name="h_part_one"');
  });

  it('inserts page breaks and uses the chosen page size', async () => {
    const { document } = await docxParts('a\n\n\\pagebreak\n\nb', { pageSize: 'Letter' });
    expect(document).toContain('w:type="page"');
    expect(document).toMatch(/<w:pgSz w:w="12240" w:h="15840"/);
  });

  it('writes math as TeX source, once', async () => {
    const { document } = await docxParts('$a+b$');
    expect(document).toContain('a+b');
    expect(count(document, 'Cambria Math')).toBeGreaterThanOrEqual(1);
    expect(count(document, 'a+b')).toBe(1);
  });
});
