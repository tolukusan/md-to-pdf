import { describe, expect, it } from 'vitest';
import { buildPrintHtml, cssString, scopeCustomCss } from '../utils/pdf';
import { decodeShare, encodeShare } from '../utils/storage';
import { defaultStyle, normalizeStyle } from '../types';

describe('buildPrintHtml', () => {
  it('sets page size, margins and colour printing', () => {
    const html = buildPrintHtml('<p>x</p>', { ...defaultStyle, pageSize: 'Letter', marginTopMm: 12 }, 'T');
    expect(html).toContain('size: Letter');
    expect(html).toContain('margin: 12mm');
    expect(html).toContain('print-color-adjust: exact');
  });

  it('adds margin boxes for header, footer and page numbers', () => {
    const html = buildPrintHtml('', { ...defaultStyle, headerText: 'Say "hi"', footerText: 'F', pageNumbers: true }, 'T');
    expect(html).toContain('@top-center { content: "Say \\"hi\\""');
    expect(html).toContain('counter(pages)');
  });

  it('escapes the title', () => {
    expect(buildPrintHtml('', defaultStyle, '</title><script>')).toContain('&lt;/title&gt;&lt;script&gt;');
  });

  it('scopes custom CSS and blocks closing the style tag', () => {
    expect(scopeCustomCss('h1{color:red}</style><script>')).toBe('.doc-content {\nh1{color:red}><script>\n}');
    expect(scopeCustomCss('  ')).toBe('');
    expect(cssString('a\nb\\')).toBe('"a b\\\\"');
  });
});

describe('share links', () => {
  it('round-trips a document and style', () => {
    const draft = { markdown: '# Hi\n\nÜnïcödé ✅', style: { ...defaultStyle, toc: true } };
    expect(decodeShare(encodeShare(draft))).toEqual(draft);
  });

  it('rejects garbage', () => {
    expect(decodeShare('not-valid')).toBeNull();
  });

  it('ignores unknown or wrongly typed style fields', () => {
    const style = normalizeStyle({ fontSize: 'big', toc: true, evil: 1, pageSize: 'Tabloid' });
    expect(style.fontSize).toBe(defaultStyle.fontSize);
    expect(style.toc).toBe(true);
    expect(style.pageSize).toBe('A4');
    expect('evil' in style).toBe(false);
  });
});
