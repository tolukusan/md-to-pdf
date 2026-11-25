export type PageSize = 'A4' | 'Letter';

export interface DocStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  marginTopMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  textColor: string;
  bgColor: string;
  headingColor: string;
  linkColor: string;
  codeFont: string;
  codeBg: string;
  pageSize: PageSize;
  headerText: string;
  footerText: string;
  pageNumbers: boolean;
  toc: boolean;
  customCss: string;
}

export const PAGE_SIZES: Record<PageSize, { widthMm: number; heightMm: number; label: string }> = {
  A4: { widthMm: 210, heightMm: 297, label: 'A4 (210 × 297 mm)' },
  Letter: { widthMm: 215.9, heightMm: 279.4, label: 'US Letter (8.5 × 11 in)' },
};

export const MM_TO_PX = 96 / 25.4;

export const defaultStyle: DocStyle = {
  fontFamily: 'Georgia, serif',
  fontSize: 16,
  lineHeight: 1.7,
  marginTopMm: 20,
  marginBottomMm: 20,
  marginLeftMm: 25,
  marginRightMm: 25,
  textColor: '#1a1a1a',
  bgColor: '#ffffff',
  headingColor: '#111111',
  linkColor: '#2563eb',
  codeFont: "'Fira Code', 'Courier New', monospace",
  codeBg: '#f4f4f5',
  pageSize: 'A4',
  headerText: '',
  footerText: '',
  pageNumbers: false,
  toc: false,
  customCss: '',
};

export type ThemeName = 'default' | 'academic' | 'minimal' | 'technical';

/** The keys a theme controls. Page setup, header/footer, TOC and custom CSS are left alone. */
export const THEME_KEYS = [
  'fontFamily', 'fontSize', 'lineHeight',
  'marginTopMm', 'marginBottomMm', 'marginLeftMm', 'marginRightMm',
  'textColor', 'bgColor', 'headingColor', 'linkColor', 'codeFont', 'codeBg',
] as const satisfies readonly (keyof DocStyle)[];

export type ThemeStyle = Pick<DocStyle, (typeof THEME_KEYS)[number]>;

const baseTheme: ThemeStyle = Object.fromEntries(
  THEME_KEYS.map(key => [key, defaultStyle[key]]),
) as ThemeStyle;

export const themes: Record<ThemeName, ThemeStyle> = {
  default: { ...baseTheme },
  academic: {
    ...baseTheme,
    fontFamily: "'Times New Roman', Times, serif",
    fontSize: 12,
    lineHeight: 2.0,
    marginTopMm: 25,
    marginBottomMm: 25,
    marginLeftMm: 30,
    marginRightMm: 30,
    headingColor: '#000000',
  },
  minimal: {
    ...baseTheme,
    fontFamily: "'Helvetica Neue', Arial, sans-serif",
    fontSize: 15,
    lineHeight: 1.6,
    textColor: '#333333',
    headingColor: '#000000',
    linkColor: '#111111',
    marginTopMm: 15,
    marginBottomMm: 15,
    marginLeftMm: 20,
    marginRightMm: 20,
    codeBg: '#eeeeee',
  },
  technical: {
    ...baseTheme,
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 13,
    lineHeight: 1.6,
    textColor: '#1e1e2e',
    headingColor: '#003366',
    linkColor: '#0055cc',
    codeBg: '#e0e0e8',
  },
};

export function activeTheme(style: DocStyle): ThemeName | null {
  for (const [name, theme] of Object.entries(themes) as [ThemeName, ThemeStyle][]) {
    if (THEME_KEYS.every(key => style[key] === theme[key])) return name;
  }
  return null;
}

/** Merge untrusted / older saved style data over the defaults, keeping only known keys of the right type. */
export function normalizeStyle(input: unknown): DocStyle {
  const result: DocStyle = { ...defaultStyle };
  if (!input || typeof input !== 'object') return result;
  const source = input as Record<string, unknown>;
  for (const key of Object.keys(defaultStyle) as (keyof DocStyle)[]) {
    const value = source[key];
    if (typeof value === typeof defaultStyle[key]) {
      (result as unknown as Record<string, unknown>)[key] = value;
    }
  }
  if (!(result.pageSize in PAGE_SIZES)) result.pageSize = 'A4';
  // These values are written into CSS, so only accept plain colours and font lists.
  for (const key of ['textColor', 'bgColor', 'headingColor', 'linkColor', 'codeBg'] as const) {
    if (!/^#[0-9a-f]{3,8}$/i.test(result[key])) result[key] = defaultStyle[key];
  }
  for (const key of ['fontFamily', 'codeFont'] as const) {
    if (!/^[\w\s'",.-]+$/.test(result[key])) result[key] = defaultStyle[key];
  }
  for (const key of ['fontSize', 'lineHeight', 'marginTopMm', 'marginBottomMm', 'marginLeftMm', 'marginRightMm'] as const) {
    if (!Number.isFinite(result[key])) result[key] = defaultStyle[key];
  }
  return result;
}

/** CSS custom properties consumed by document.css. */
export function docCssVars(style: DocStyle): Record<string, string> {
  return {
    '--doc-font': style.fontFamily,
    '--doc-size': `${style.fontSize}px`,
    '--doc-lh': `${style.lineHeight}`,
    '--doc-color': style.textColor,
    '--doc-bg': style.bgColor,
    '--doc-heading': style.headingColor,
    '--doc-link': style.linkColor,
    '--doc-code-font': style.codeFont,
    '--doc-code-bg': style.codeBg,
  };
}
