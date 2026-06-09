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
}

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
};

export type ThemeName = 'default' | 'academic' | 'minimal' | 'technical';

export const themes: Record<ThemeName, DocStyle> = {
  default: { ...defaultStyle },
  academic: {
    ...defaultStyle,
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
    ...defaultStyle,
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
    ...defaultStyle,
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: 13,
    lineHeight: 1.6,
    textColor: '#1e1e2e',
    headingColor: '#003366',
    linkColor: '#0055cc',
    codeBg: '#e0e0e8',
  },
};
