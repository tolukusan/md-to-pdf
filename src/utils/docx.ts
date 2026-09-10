import {
  BorderStyle, Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph,
  Table, TableCell, TableRow, TextRun, WidthType,
  type FileChild, type ParagraphChild,
} from 'docx';
import { type DocStyle } from '../types';
import { renderMarkdown } from './markdown';

const mmToTwips = (mm: number) => Math.round(mm * 56.6929);
const color = (value: string) => value.replace('#', '').toUpperCase();
const fontName = (value: string) => value.split(',')[0].replace(/["']/g, '').trim();
type RunStyle = { bold?: boolean; italics?: boolean; strike?: boolean; code?: boolean };

function inlineChildren(node: Node, style: DocStyle, inherited: RunStyle = {}): ParagraphChild[] {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    return text ? [new TextRun({
      text, bold: inherited.bold, italics: inherited.italics, strike: inherited.strike,
      font: inherited.code ? fontName(style.codeFont) : fontName(style.fontFamily),
      color: color(style.textColor),
      shading: inherited.code ? { fill: color(style.codeBg) } : undefined,
    })] : [];
  }
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === 'BR') return [new TextRun({ break: 1 })];

  const next: RunStyle = {
    ...inherited,
    bold: inherited.bold || node.matches('strong,b'),
    italics: inherited.italics || node.matches('em,i'),
    strike: inherited.strike || node.matches('del,s'),
    code: inherited.code || node.matches('code'),
  };
  if (node.tagName === 'A') {
    return [new ExternalHyperlink({
      link: node.getAttribute('href') || '',
      children: [new TextRun({
        text: node.textContent || node.getAttribute('href') || '',
        color: color(style.linkColor), underline: {}, bold: next.bold, italics: next.italics,
      })],
    })];
  }
  if (node.tagName === 'IMG') {
    const alt = node.getAttribute('alt') || 'Image';
    const src = node.getAttribute('src') || '';
    return [new TextRun({ text: `${alt}${src ? ` (${src})` : ''}`, italics: true })];
  }
  return Array.from(node.childNodes).flatMap(child => inlineChildren(child, style, next));
}

function styledParagraph(element: HTMLElement, style: DocStyle, options: Record<string, unknown> = {}) {
  return new Paragraph({
    children: inlineChildren(element, style),
    spacing: { after: Math.round(style.fontSize * 12), line: Math.round(style.lineHeight * 240) },
    ...options,
  });
}

function listParagraphs(list: HTMLElement, style: DocStyle, level = 0): Paragraph[] {
  const ordered = list.tagName === 'OL';
  const start = Number(list.getAttribute('start') || 1);
  const output: Paragraph[] = [];
  Array.from(list.children).forEach((item, index) => {
    if (!(item instanceof HTMLElement) || item.tagName !== 'LI') return;
    const content = Array.from(item.childNodes).filter(
      node => !(node instanceof HTMLElement && (node.tagName === 'UL' || node.tagName === 'OL')),
    );
    output.push(new Paragraph({
      children: [
        new TextRun({ text: ordered ? `${start + index}. ` : '• ', bold: true }),
        ...content.flatMap(node => inlineChildren(node, style)),
      ],
      indent: { left: 360 + level * 360, hanging: 240 },
      spacing: { after: 80, line: Math.round(style.lineHeight * 240) },
    }));
    Array.from(item.children)
      .filter(child => child.tagName === 'UL' || child.tagName === 'OL')
      .forEach(child => output.push(...listParagraphs(child as HTMLElement, style, level + 1)));
  });
  return output;
}

function wordTable(element: HTMLTableElement, style: DocStyle): Table {
  const rows = Array.from(element.rows).map((row, rowIndex) => new TableRow({
    children: Array.from(row.cells).map(cell => new TableCell({
      shading: rowIndex === 0 ? { fill: 'EDEDED' } : undefined,
      children: [new Paragraph({ children: inlineChildren(cell, style) })],
    })),
  }));
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function blocks(root: HTMLElement, style: DocStyle): FileChild[] {
  const output: FileChild[] = [];
  for (const child of Array.from(root.children)) {
    const element = child as HTMLElement;
    const tag = element.tagName;
    if (/^H[1-6]$/.test(tag)) {
      const heading = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6][Number(tag[1]) - 1];
      output.push(styledParagraph(element, { ...style, textColor: style.headingColor }, {
        heading,
        spacing: { before: 280, after: 120 },
      }));
    } else if (tag === 'UL' || tag === 'OL') {
      output.push(...listParagraphs(element, style));
    } else if (tag === 'TABLE') {
      output.push(wordTable(element as HTMLTableElement, style), new Paragraph(''));
    } else if (tag === 'PRE') {
      output.push(new Paragraph({
        children: [new TextRun({ text: element.textContent || '', font: fontName(style.codeFont), shading: { fill: color(style.codeBg) } })],
        spacing: { before: 100, after: 180 },
      }));
    } else if (tag === 'BLOCKQUOTE') {
      output.push(styledParagraph(element, style, {
        indent: { left: 360 },
        border: { left: { color: color(style.linkColor), style: BorderStyle.SINGLE, size: 18, space: 10 } },
      }));
    } else if (tag === 'HR') {
      output.push(new Paragraph({
        border: { bottom: { color: 'BBBBBB', style: BorderStyle.SINGLE, size: 6, space: 1 } },
        spacing: { before: 160, after: 200 },
      }));
    } else if (tag === 'P') {
      output.push(styledParagraph(element, style));
    } else {
      output.push(...blocks(element, style));
    }
  }
  return output;
}

export async function exportToDocx(markdown: string, style: DocStyle): Promise<void> {
  const parsed = new DOMParser().parseFromString(renderMarkdown(markdown), 'text/html');
  const doc = new Document({
    styles: { default: { document: { run: {
      font: fontName(style.fontFamily), size: Math.round(style.fontSize * 1.5), color: color(style.textColor),
    } } } },
    sections: [{
      properties: { page: {
        size: { width: 11906, height: 16838 },
        margin: {
          top: mmToTwips(style.marginTopMm), right: mmToTwips(style.marginRightMm),
          bottom: mmToTwips(style.marginBottomMm), left: mmToTwips(style.marginLeftMm),
        },
      } },
      children: blocks(parsed.body, style),
    }],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = 'document.docx';
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
