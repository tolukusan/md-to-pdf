import { type DocStyle, type PageSize, type ThemeName, PAGE_SIZES, activeTheme as findActiveTheme, themes } from '../types';

interface StylePanelProps {
  style: DocStyle;
  onChange: (s: DocStyle) => void;
}

function set<K extends keyof DocStyle>(style: DocStyle, key: K, value: DocStyle[K]): DocStyle {
  return { ...style, [key]: value };
}

const FONT_OPTIONS: [string, string][] = [
  ['Georgia, serif', 'Georgia'],
  ["'Times New Roman', Times, serif", 'Times New Roman'],
  ["'Palatino Linotype', Palatino, serif", 'Palatino'],
  ["'Garamond', serif", 'Garamond'],
  ["'Inter', 'Helvetica Neue', sans-serif", 'Inter'],
  ["'Helvetica Neue', Arial, sans-serif", 'Helvetica Neue'],
  ["'Arial', sans-serif", 'Arial'],
  ["'Trebuchet MS', sans-serif", 'Trebuchet MS'],
  ["'Courier New', Courier, monospace", 'Courier New'],
];

const THEME_LABELS: Record<ThemeName, string> = {
  default: 'Default',
  academic: 'Academic',
  minimal: 'Minimal',
  technical: 'Technical',
};

export default function StylePanel({ style, onChange }: StylePanelProps) {
  const activeTheme = findActiveTheme(style);

  return (
    <aside className="style-panel">
      <div className="pane-header">Style</div>

      <div className="style-panel-body">
        {/* Themes */}
        <div className="style-section">
          <div className="style-section-title">Themes</div>
          <div className="theme-grid">
            {(Object.keys(themes) as ThemeName[]).map(key => (
              <button
                key={key}
                aria-pressed={activeTheme === key}
                className={`theme-btn ${activeTheme === key ? 'active' : ''}`}
                onClick={() => onChange({ ...style, ...themes[key] })}
              >
                {THEME_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Page setup */}
        <div className="style-section">
          <div className="style-section-title">Page Setup</div>

          <div className="style-row">
            <label htmlFor="page-size">Page Size</label>
            <select
              id="page-size"
              value={style.pageSize}
              onChange={e => onChange(set(style, 'pageSize', e.target.value as PageSize))}
            >
              {(Object.keys(PAGE_SIZES) as PageSize[]).map(size => (
                <option key={size} value={size}>{PAGE_SIZES[size].label}</option>
              ))}
            </select>
          </div>

          <div className="style-row">
            <label htmlFor="header-text">Header Text</label>
            <input
              id="header-text" type="text" placeholder="e.g. Quarterly Report"
              value={style.headerText}
              onChange={e => onChange(set(style, 'headerText', e.target.value))}
            />
          </div>

          <div className="style-row">
            <label htmlFor="footer-text">Footer Text</label>
            <input
              id="footer-text" type="text" placeholder="e.g. Confidential"
              value={style.footerText}
              onChange={e => onChange(set(style, 'footerText', e.target.value))}
            />
          </div>

          <label className="check-row">
            <input
              type="checkbox" checked={style.pageNumbers}
              onChange={e => onChange(set(style, 'pageNumbers', e.target.checked))}
            />
            Page numbers
          </label>

          <label className="check-row">
            <input
              type="checkbox" checked={style.toc}
              onChange={e => onChange(set(style, 'toc', e.target.checked))}
            />
            Table of contents
          </label>

          <p className="style-hint">Put <code>\pagebreak</code> on its own line to start a new page.</p>
        </div>

        {/* Typography */}
        <div className="style-section">
          <div className="style-section-title">Typography</div>

          <div className="style-row">
            <label htmlFor="font-family">Font Family</label>
            <select
              id="font-family"
              value={style.fontFamily}
              onChange={e => onChange(set(style, 'fontFamily', e.target.value))}
            >
              {FONT_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div className="style-row">
            <label>
              Font Size <span>{style.fontSize}px</span>
            </label>
            <input
              type="range" min={11} max={22} step={1}
              value={style.fontSize}
              onChange={e => onChange(set(style, 'fontSize', Number(e.target.value)))}
            />
          </div>

          <div className="style-row">
            <label>
              Line Height <span>{style.lineHeight.toFixed(2)}</span>
            </label>
            <input
              type="range" min={1.2} max={2.2} step={0.05}
              value={style.lineHeight}
              onChange={e => onChange(set(style, 'lineHeight', Number(e.target.value)))}
            />
          </div>
        </div>

        {/* Colors */}
        <div className="style-section">
          <div className="style-section-title">Colors</div>

          {(
            [
              ['textColor', 'Body Text'],
              ['headingColor', 'Headings'],
              ['linkColor', 'Links'],
              ['bgColor', 'Page Background'],
              ['codeBg', 'Code Background'],
            ] as [keyof DocStyle, string][]
          ).map(([key, label]) => (
            <div className="style-row" key={key}>
              <label>{label}</label>
              <div className="color-row">
                <input
                  type="color"
                  value={style[key] as string}
                  onChange={e => onChange(set(style, key, e.target.value))}
                />
                <span className="color-hex">{style[key] as string}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Page Margins */}
        <div className="style-section">
          <div className="style-section-title">Page Margins (mm)</div>

          {(
            [
              ['marginTopMm', 'Top'],
              ['marginBottomMm', 'Bottom'],
              ['marginLeftMm', 'Left'],
              ['marginRightMm', 'Right'],
            ] as [keyof DocStyle, string][]
          ).map(([key, label]) => (
            <div className="style-row" key={key}>
              <label>
                {label} <span>{style[key] as number}mm</span>
              </label>
              <input
                type="range" min={5} max={50} step={1}
                value={style[key] as number}
                onChange={e => onChange(set(style, key, Number(e.target.value)))}
              />
            </div>
          ))}
        </div>

        {/* Custom CSS */}
        <div className="style-section">
          <div className="style-section-title">Custom CSS</div>
          <textarea
            className="css-input"
            aria-label="Custom CSS"
            spellCheck={false}
            placeholder={'h1 { letter-spacing: -0.02em; }\ntable { font-size: 0.8em; }'}
            value={style.customCss}
            onChange={e => onChange(set(style, 'customCss', e.target.value))}
          />
          <p className="style-hint">Applies to the preview and PDF only, scoped to the document.</p>
        </div>
      </div>
    </aside>
  );
}
