import { type DocStyle, type ThemeName, themes } from '../types';

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
  ["'Inter', 'Helvetica Neue', sans-serif", 'Inter / Helvetica'],
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

function isActiveTheme(style: DocStyle): ThemeName | null {
  for (const [key, theme] of Object.entries(themes) as [ThemeName, DocStyle][]) {
    if (JSON.stringify(style) === JSON.stringify(theme)) return key;
  }
  return null;
}

export default function StylePanel({ style, onChange }: StylePanelProps) {
  const activeTheme = isActiveTheme(style);

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
                className={`theme-btn ${activeTheme === key ? 'active' : ''}`}
                onClick={() => onChange({ ...themes[key] })}
              >
                {THEME_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Typography */}
        <div className="style-section">
          <div className="style-section-title">Typography</div>

          <div className="style-row">
            <label>Font Family</label>
            <select
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
      </div>
    </aside>
  );
}
