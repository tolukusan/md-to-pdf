import { describe, expect, it } from 'vitest';
import { buildPrintHtml, cssString, scopeCustomCss } from '../utils/pdf';
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
    expect(scopeCustomCss('h1{color:red}</style><script>')).toBe('.doc-content {\nh1{color:red}/style>script>\n}');
    expect(scopeCustomCss('<</stylestyle>')).not.toContain('<');
    expect(scopeCustomCss('  ')).toBe('');
    expect(cssString('a\nb\\')).toBe('"a b\\\\"');
  });
});

describe('normalizeStyle', () => {
  it('ignores unknown or wrongly typed fields', () => {
    const style = normalizeStyle({ fontSize: 'big', toc: true, evil: 1, pageSize: 'Tabloid' });
    expect(style.fontSize).toBe(defaultStyle.fontSize);
    expect(style.toc).toBe(true);
    expect(style.pageSize).toBe('A4');
    expect('evil' in style).toBe(false);
  });

  it('rejects colours and fonts that could break out of CSS', () => {
    const style = normalizeStyle({ bgColor: 'red; } body { display:none', fontFamily: 'x</style><script>', linkColor: '#abc' });
    expect(style.bgColor).toBe(defaultStyle.bgColor);
    expect(style.fontFamily).toBe(defaultStyle.fontFamily);
    expect(style.linkColor).toBe('#abc');
  });
});
