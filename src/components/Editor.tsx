import { useRef, useCallback } from 'react';

interface EditorProps {
  value: string;
  onChange: (v: string) => void;
}

export default function Editor({ value, onChange }: EditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();

    const el = e.currentTarget;
    const { selectionStart: start, selectionEnd: end } = el;
    const spaces = '  ';

    const next = value.slice(0, start) + spaces + value.slice(end);
    onChange(next);

    requestAnimationFrame(() => {
      if (ref.current) {
        ref.current.selectionStart = start + spaces.length;
        ref.current.selectionEnd = start + spaces.length;
      }
    });
  }, [value, onChange]);

  return (
    <div className="editor-pane">
      <div className="pane-header">
        Markdown
        <div className="pane-header-right">
          <span className="char-count">{value.length.toLocaleString()} chars</span>
        </div>
      </div>
      <textarea
        ref={ref}
        className="editor-textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Write your markdown here…"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}
