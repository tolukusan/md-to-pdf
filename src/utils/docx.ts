import {
  AlignmentType, Bookmark, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel,
  ImageRun, InternalHyperlink, LevelFormat, Packer, PageBreak, PageNumber, Paragraph, ShadingType,
  Table, TableCell, TableRow, TabStopType, TextRun, WidthType,
  type FileChild, type ILevelsOptions, type IParagraphOptions, type ParagraphChild,
} from 'docx';
import { type DocStyle, MM_TO_PX, PAGE_SIZES } from '../types';
import { fileBaseName, renderMarkdown } from './markdown';
import { renderMermaid } from './mermaid';

const mmToTwips = (mm: number) => Math.round(mm * 56.6929);
const color = (value: string) => value.replace('#', '').toUpperCase();
const fontName = (value: string) => value.split(',')[0].replace(/["']/g, '').trim();
/** CSS px → Word half-points (1px = 0.75pt). */
const halfPoints = (px: number) => Math.round(px * 1.5);

const HEADING_SCALE = [2, 1.5, 1.25, 1.1, 1, 0.9];
const HEADING_LEVELS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

/** Word bookmark names: start with a letter, letters/digits/underscores, max 40 chars. */
export const bookmarkName = (id: string) => `h_${id.replace(/[^A-Za-z0-9]/g, '_')}`.slice(0, 40);

export interface EmbeddedImage { data: Uint8Array; width: number; height: number }
/** Images fetched ahead of time (DOCX building is synchronous). Keyed by the element. */
export type ImageAssets = Map<Element, EmbeddedImage>;

type RunStyle = { bold?: boolean; italics?: boolean; strike?: boolean; underline?: boolean; code?: boolean; color?: string; size?: number };

interface Context {
  style: DocStyle;
  images: ImageAssets;
  numbering: { reference: string; levels: ILevelsOptions[] }[];
  quote: number;
}

function inlineChildren(node: Node, ctx: Context, inherited: RunStyle = {}, pre = false): ParagraphChild[] {
  const { style } = ctx;
  if (node.nodeType === Node.TEXT_NODE) {
    let text = node.textContent || '';
    if (!pre) text = text.replace(/\s+/g, ' ');
    if (!text) return [];
    return [new TextRun({
      text,
      bold: inherited.bold, italics: inherited.italics, strike: inherited.strike,
      font: inherited.code ? fontName(style.codeFont) : undefined,
      color: inherited.color,
      underline: inherited.underline ? {} : undefined,
      size: inherited.size ?? (inherited.code ? halfPoints(style.fontSize * 0.875) : undefined),
      shading: inherited.code ? { type: ShadingType.CLEAR, fill: color(style.codeBg), color: 'auto' } : undefined,
    })];
  }
  if (!(node instanceof Element)) return [];
  const tag = node.tagName;
  if (tag === 'BR') return [new TextRun({ break: 1 })];

  if (node.classList.contains('katex')) {
    const tex = node.querySelector('annotation[encoding="application/x-tex"]')?.textContent
      ?? node.textContent ?? '';
    return [new TextRun({ text: tex, italics: true, font: 'Cambria Math', color: inherited.color })];
  }

  if (tag === 'INPUT' && node.getAttribute('type') === 'checkbox') {
    return [new TextRun({ text: node.hasAttribute('checked') ? '☑ ' : '☐ ', font: 'Segoe UI Symbol' })];
  }

  if (tag === 'IMG' || node.classList.contains('mermaid-diagram')) {
    const image = ctx.images.get(node);
    if (image) {
      return [new ImageRun({
        type: 'png',
        data: image.data,
        transformation: { width: image.width, height: image.height },
        altText: { name: 'image', title: node.getAttribute('alt') || '', description: node.getAttribute('alt') || '' },
      })];
    }
    if (tag === 'IMG') {
      const alt = node.getAttribute('alt') || 'Image';
      const src = node.getAttribute('src') || '';
      return [new TextRun({ text: `[${alt}]${src && !src.startsWith('data:') ? ` (${src})` : ''}`, italics: true })];
    }
    return [new TextRun({ text: '[diagram]', italics: true })];
  }

  const next: RunStyle = {
    ...inherited,
    bold: inherited.bold || node.matches('strong,b,th'),
    italics: inherited.italics || node.matches('em,i'),
    strike: inherited.strike || node.matches('del,s'),
    code: inherited.code || node.matches('code'),
  };

  if (tag === 'A') {
    const href = node.getAttribute('href') || '';
    const linkStyle: RunStyle = { ...next, color: color(style.linkColor), underline: true };
    const children = Array.from(node.childNodes).flatMap(child => inlineChildren(child, ctx, linkStyle, pre));
    const runs = children.length ? children : [new TextRun({ text: href, color: color(style.linkColor), underline: {} })];
    if (href.startsWith('#')) {
      return [new InternalHyperlink({ anchor: bookmarkName(href.slice(1)), children: runs })];
    }
    if (!/^(https?:|mailto:)/i.test(href)) return runs;
    return [new ExternalHyperlink({ link: href, children: runs })];
  }

  return Array.from(node.childNodes).flatMap(child => inlineChildren(child, ctx, next, pre));
}

function spacing(style: DocStyle, extra: { before?: number; after?: number } = {}) {
  return { before: extra.before ?? 0, after: extra.after ?? Math.round(style.fontSize * 12), line: Math.round(style.lineHeight * 240) };
}

function quoteOptions(ctx: Context): Partial<IParagraphOptions> {
  if (!ctx.quote) return {};
  return {
    indent: { left: 360 * ctx.quote },
    border: { left: { color: color(ctx.style.linkColor), style: BorderStyle.SINGLE, size: 18, space: 10 } },
  };
}

function paragraphFrom(element: Element, ctx: Context, options: Partial<IParagraphOptions> = {}, runStyle: RunStyle = {}) {
  const quote = quoteOptions(ctx);
  return new Paragraph({
    children: inlineChildren(element, ctx, ctx.quote ? { ...runStyle, color: '555555' } : runStyle),
    spacing: spacing(ctx.style),
    ...quote,
    ...options,
  });
}

const BULLETS = ['•', '◦', '▪', '•', '◦', '▪', '•', '◦', '▪'];
const ORDERED_FORMATS = [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN];

function listLevels(ordered: boolean, start: number): ILevelsOptions[] {
  return Array.from({ length: 9 }, (_, level) => ({
    level,
    format: ordered ? ORDERED_FORMATS[level % 3] : LevelFormat.BULLET,
    text: ordered ? `%${level + 1}.` : BULLETS[level],
    start: level === 0 ? start : 1,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
  }));
}

function listParagraphs(list: Element, ctx: Context, level = 0): FileChild[] {
  const ordered = list.tagName === 'OL';
  const isTaskList = list.classList.contains('task-list');
  const reference = `list-${ctx.numbering.length}`;
  ctx.numbering.push({ reference, levels: listLevels(ordered, Number(list.getAttribute('start') || 1)) });

  const output: FileChild[] = [];
  for (const item of Array.from(list.children)) {
    if (item.tagName !== 'LI') continue;
    const inline: Node[] = [];
    const flush = (first: boolean) => {
      if (!inline.length) return;
      const children = inline.flatMap(node => inlineChildren(node, ctx));
      inline.length = 0;
      if (!children.length) return;
      output.push(new Paragraph({
        children,
        ...quoteOptions(ctx),
        ...(isTaskList || !first
          ? { indent: { left: 720 + level * 360 + (ctx.quote ? 360 * ctx.quote : 0) } }
          : { numbering: { reference, level } }),
        spacing: { after: 80, line: Math.round(ctx.style.lineHeight * 240) },
      }));
    };
    let first = true;
    for (const child of Array.from(item.childNodes)) {
      if (child instanceof Element && (child.tagName === 'UL' || child.tagName === 'OL')) {
        flush(first); first = false;
        output.push(...listParagraphs(child, ctx, level + 1));
      } else if (child instanceof Element && child.tagName === 'P') {
        // "loose" list items wrap content in <p>
        if (inline.length) { flush(first); first = false; }
        inline.push(child);
        flush(first); first = false;
      } else if (child instanceof Element && /^(PRE|BLOCKQUOTE|TABLE|DIV)$/.test(child.tagName)) {
        flush(first); first = false;
        output.push(...blocks(wrap(child), ctx));
      } else {
        inline.push(child);
      }
    }
    flush(first);
  }
  return output;
}

function wrap(element: Element): Element {
  const holder = element.ownerDocument.createElement('div');
  holder.appendChild(element.cloneNode(true));
  return holder;
}

function wordTable(element: HTMLTableElement, ctx: Context): Table {
  const rows = Array.from(element.rows).map(row => new TableRow({
    tableHeader: row.parentElement?.tagName === 'THEAD',
    children: Array.from(row.cells).map(cell => new TableCell({
      shading: cell.tagName === 'TH' ? { type: ShadingType.CLEAR, fill: 'EDEDED', color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [new Paragraph({
        children: inlineChildren(cell, ctx, { size: halfPoints(ctx.style.fontSize * 0.9) }),
        alignment: cell.style.textAlign === 'center' ? AlignmentType.CENTER
          : cell.style.textAlign === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
      })],
    })),
  }));
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function codeBlock(element: Element, ctx: Context): Paragraph {
  const lines = (element.textContent || '').replace(/\n$/, '').split('\n');
  const { style } = ctx;
  return new Paragraph({
    children: lines.map((line, index) => new TextRun({
      text: line,
      break: index > 0 ? 1 : undefined,
      font: fontName(style.codeFont),
      size: halfPoints(style.fontSize * 0.8),
    })),
    shading: { type: ShadingType.CLEAR, fill: color(style.codeBg), color: 'auto' },
    border: {
      top: { style: BorderStyle.SINGLE, size: 1, color: color(style.codeBg), space: 6 },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: color(style.codeBg), space: 6 },
      left: { style: BorderStyle.SINGLE, size: 1, color: color(style.codeBg), space: 6 },
      right: { style: BorderStyle.SINGLE, size: 1, color: color(style.codeBg), space: 6 },
    },
    spacing: { before: 100, after: 240, line: 276 },
    ...quoteOptions(ctx),
  });
}

function tocParagraphs(nav: Element, ctx: Context): Paragraph[] {
  const output = [new Paragraph({
    children: [new TextRun({ text: 'Contents', bold: true, color: color(ctx.style.headingColor) })],
    spacing: { after: 120 },
  })];
  nav.querySelectorAll('li').forEach(li => {
    const link = li.querySelector('a');
    const level = Number(/toc-level-(\d)/.exec(li.className)?.[1] || 1);
    if (!link) return;
    output.push(new Paragraph({
      children: [new InternalHyperlink({
        anchor: bookmarkName((link.getAttribute('href') || '').slice(1)),
        children: [new TextRun({ text: link.textContent || '', color: color(ctx.style.linkColor) })],
      })],
      indent: { left: (level - 1) * 360 },
      spacing: { after: 40 },
    }));
  });
  output.push(new Paragraph({ children: [], spacing: { after: 200 } }));
  return output;
}

function blocks(root: Element, ctx: Context): FileChild[] {
  const { style } = ctx;
  const output: FileChild[] = [];
  for (const element of Array.from(root.children)) {
    const tag = element.tagName;
    if (/^H[1-6]$/.test(tag)) {
      const level = Number(tag[1]) - 1;
      output.push(new Paragraph({
        heading: HEADING_LEVELS[level],
        children: [new Bookmark({ id: bookmarkName(element.id), children: inlineChildren(element, ctx) })],
        ...quoteOptions(ctx),
      }));
    } else if (tag === 'UL' || tag === 'OL') {
      output.push(...listParagraphs(element, ctx));
    } else if (tag === 'TABLE') {
      output.push(wordTable(element as HTMLTableElement, ctx), new Paragraph({ children: [] }));
    } else if (tag === 'PRE') {
      output.push(codeBlock(element, ctx));
    } else if (tag === 'BLOCKQUOTE') {
      output.push(...blocks(element, { ...ctx, quote: ctx.quote + 1 }));
    } else if (tag === 'HR') {
      output.push(new Paragraph({
        border: { bottom: { color: 'BBBBBB', style: BorderStyle.SINGLE, size: 6, space: 1 } },
        spacing: { before: 160, after: 200 },
      }));
    } else if (tag === 'NAV' && element.classList.contains('toc')) {
      output.push(...tocParagraphs(element, ctx));
    } else if (element.classList.contains('page-break')) {
      output.push(new Paragraph({ children: [new PageBreak()] }));
    } else if (element.classList.contains('mermaid-diagram')) {
      output.push(new Paragraph({ children: inlineChildren(element, ctx), alignment: AlignmentType.CENTER, spacing: spacing(style) }));
    } else if (tag === 'P') {
      const onlyDisplayMath = element.children.length === 1 && element.firstElementChild?.classList.contains('katex-display')
        && !(element.textContent || '').replace(element.firstElementChild.textContent || '', '').trim();
      output.push(paragraphFrom(element, ctx, onlyDisplayMath ? { alignment: AlignmentType.CENTER } : {}));
    } else if (element.classList.contains('katex-display') || element.classList.contains('katex')) {
      output.push(paragraphFrom(element, ctx, { alignment: AlignmentType.CENTER }));
    } else if (element.children.length) {
      output.push(...blocks(element, ctx));
    } else if ((element.textContent || '').trim()) {
      output.push(paragraphFrom(element, ctx));
    }
  }
  return output;
}

function headingStyles(style: DocStyle) {
  return HEADING_SCALE.map((scale, index) => ({
    id: `Heading${index + 1}`,
    name: `Heading ${index + 1}`,
    basedOn: 'Normal',
    next: 'Normal',
    quickFormat: true,
    run: {
      font: fontName(style.fontFamily),
      size: halfPoints(style.fontSize * scale),
      bold: true,
      color: color(style.headingColor),
    },
    paragraph: {
      spacing: { before: index === 0 ? 0 : 320, after: 120, line: 288 },
      keepNext: true,
      ...(index < 2 ? { border: { bottom: { color: 'EEEEEE', style: BorderStyle.SINGLE, size: index === 0 ? 12 : 6, space: 4 } } } : {}),
    },
  }));
}

function headerFooter(style: DocStyle) {
  const small = { size: 18, color: '666666', font: fontName(style.fontFamily) };
  const header = style.headerText.trim()
    ? { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: style.headerText, ...small })] })] }) }
    : undefined;
  const hasFooter = style.footerText.trim() || style.pageNumbers;
  const footer = hasFooter
    ? {
      default: new Footer({
        children: [new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: 9000 }],
          children: [
            new TextRun({ text: style.footerText, ...small }),
            ...(style.pageNumbers
              ? [new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], ...small })]
              : []),
          ],
        })],
      }),
    }
    : undefined;
  return { headers: header, footers: footer };
}

export function parseHtml(html: string): Element {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
}

/** Build the Word document from rendered HTML (or its parsed tree). Pure (no network), so it can be unit tested. */
export function buildDocx(source: string | Element, style: DocStyle, images: ImageAssets = new Map()): Document {
  const root = typeof source === 'string' ? parseHtml(source) : source;
  const ctx: Context = { style, images, numbering: [], quote: 0 };
  const children = blocks(root, ctx);
  const page = PAGE_SIZES[style.pageSize];

  return new Document({
    styles: {
      default: {
        document: { run: { font: fontName(style.fontFamily), size: halfPoints(style.fontSize), color: color(style.textColor) } },
      },
      paragraphStyles: headingStyles(style),
    },
    numbering: { config: ctx.numbering.length ? ctx.numbering : [{ reference: 'unused', levels: listLevels(false, 1) }] },
    background: style.bgColor.toLowerCase() !== '#ffffff' ? { color: color(style.bgColor) } : undefined,
    features: { updateFields: false },
    sections: [{
      properties: {
        page: {
          size: { width: mmToTwips(page.widthMm), height: mmToTwips(page.heightMm) },
          margin: {
            top: mmToTwips(style.marginTopMm), right: mmToTwips(style.marginRightMm),
            bottom: mmToTwips(style.marginBottomMm), left: mmToTwips(style.marginLeftMm),
          },
        },
      },
      ...headerFooter(style),
      children,
    }],
  });
}

async function toPng(source: Blob | string, maxWidthPx: number): Promise<EmbeddedImage | null> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    let width = img.naturalWidth || 600;
    let height = img.naturalHeight || 400;
    if (width > maxWidthPx) {
      height = Math.round(height * (maxWidthPx / width));
      width = Math.round(maxWidthPx);
    }
    const scale = 2; // crisper output
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return null;
    return { data: new Uint8Array(await blob.arrayBuffer()), width, height };
  } catch {
    return null;
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}

async function collectImages(root: Element, style: DocStyle): Promise<ImageAssets> {
  const page = PAGE_SIZES[style.pageSize];
  const maxWidth = (page.widthMm - style.marginLeftMm - style.marginRightMm) * MM_TO_PX;
  const assets: ImageAssets = new Map();
  const jobs: Promise<void>[] = [];

  root.querySelectorAll('img').forEach(img => {
    const src = img.getAttribute('src');
    if (!src) return;
    jobs.push((async () => {
      try {
        const response = await fetch(src, { mode: 'cors' });
        if (!response.ok) return;
        const result = await toPng(await response.blob(), maxWidth);
        if (result) assets.set(img, result);
      } catch {
        // Cross-origin images without CORS headers fall back to alt text.
      }
    })());
  });

  root.querySelectorAll('.mermaid-diagram').forEach(figure => {
    const svg = figure.querySelector('svg');
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const box = svg.viewBox?.baseVal;
    if (box?.width) {
      clone.setAttribute('width', String(box.width));
      clone.setAttribute('height', String(box.height));
    }
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
    jobs.push(toPng(blob, maxWidth).then(result => { if (result) assets.set(figure, result); }));
  });

  await Promise.all(jobs);
  return assets;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportToDocx(markdown: string, style: DocStyle): Promise<void> {
  const html = await renderMermaid(renderMarkdown(markdown, { toc: style.toc }));
  const root = parseHtml(html);
  const images = await collectImages(root, style);
  const doc = buildDocx(root, style, images);
  downloadBlob(await Packer.toBlob(doc), `${fileBaseName(markdown)}.docx`);
}
