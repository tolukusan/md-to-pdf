import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState, EditorSelection, type StateCommand } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { basicSetup } from 'codemirror';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export interface EditorHandle {
  /** Replace the whole document as one undoable change. */
  replaceAll(text: string): void;
  focus(): void;
}

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onScrollRatio?: (ratio: number) => void;
  onOpenFile?: (file: File) => void;
}

/** Wrap the selection in `before`/`after`, or unwrap it if it is already wrapped. */
function toggleWrap(before: string, after = before): StateCommand {
  return ({ state, dispatch }) => {
    const changes = state.changeByRange(range => {
      const outerFrom = range.from - before.length;
      const outerTo = range.to + after.length;
      const wrapped = outerFrom >= 0 && outerTo <= state.doc.length
        && state.sliceDoc(outerFrom, range.from) === before
        && state.sliceDoc(range.to, outerTo) === after;
      if (wrapped) {
        return {
          changes: [{ from: outerFrom, to: range.from }, { from: range.to, to: outerTo }],
          range: EditorSelection.range(outerFrom, range.to - before.length),
        };
      }
      return {
        changes: [{ from: range.from, insert: before }, { from: range.to, insert: after }],
        range: EditorSelection.range(range.from + before.length, range.to + before.length),
      };
    });
    dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input' }));
    return true;
  };
}

const insertLink: StateCommand = ({ state, dispatch }) => {
  const changes = state.changeByRange(range => {
    const text = state.sliceDoc(range.from, range.to) || 'link text';
    const insert = `[${text}](https://)`;
    const urlStart = range.from + text.length + 3;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.range(urlStart, urlStart + 8),
    };
  });
  dispatch(state.update(changes, { scrollIntoView: true, userEvent: 'input' }));
  return true;
};

const markdownHighlight = HighlightStyle.define([
  { tag: tags.heading, color: '#c8f04a', fontWeight: '600' },
  { tag: tags.strong, fontWeight: '700', color: '#f0f0ec' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: '#7cb3ff' },
  { tag: tags.url, color: '#7cb3ff', textDecoration: 'underline' },
  { tag: tags.monospace, color: '#f5b971' },
  { tag: tags.quote, color: '#a5a5b5', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.meta, tags.contentSeparator], color: '#7a7a88' },
]);

const editorTheme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--bg)', color: 'var(--text)', fontSize: '13px' },
  '.cm-scroller': { fontFamily: "'DM Mono', monospace", lineHeight: '1.75' },
  '.cm-content': { padding: '1rem 0', caretColor: 'var(--accent)' },
  '.cm-gutters': { backgroundColor: 'var(--bg)', color: '#4a4a56', border: 'none' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--muted)' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.025)' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(200, 240, 74, 0.18) !important' },
  '.cm-placeholder': { color: 'var(--muted)' },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--text)' },
  '.cm-searchMatch': { backgroundColor: 'rgba(200, 240, 74, 0.25)' },
}, { dark: true });

const MARKDOWN_FILE = /\.(md|markdown|mdown|txt)$/i;

const Editor = forwardRef<EditorHandle, EditorProps>(function Editor({ value, onChange, onScrollRatio, onOpenFile }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const callbacks = useRef({ onChange, onScrollRatio, onOpenFile });
  useLayoutEffect(() => {
    callbacks.current = { onChange, onScrollRatio, onOpenFile };
  });

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          markdown(),
          syntaxHighlighting(markdownHighlight),
          EditorView.lineWrapping,
          editorTheme,
          placeholder('Write your markdown here…'),
          EditorView.contentAttributes.of({ 'aria-label': 'Markdown editor', spellcheck: 'true' }),
          keymap.of([
            { key: 'Mod-b', run: toggleWrap('**') },
            { key: 'Mod-i', run: toggleWrap('*') },
            { key: 'Mod-k', run: insertLink },
            { key: 'Mod-Shift-x', run: toggleWrap('~~') },
            { key: 'Mod-e', run: toggleWrap('`') },
            // Tab indents; press Esc then Tab to move focus out of the editor.
            indentWithTab,
          ]),
          EditorView.updateListener.of(update => {
            if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          }),
          EditorView.domEventHandlers({
            scroll(_event, v) {
              const el = v.scrollDOM;
              const max = el.scrollHeight - el.clientHeight;
              callbacks.current.onScrollRatio?.(max > 0 ? el.scrollTop / max : 0);
            },
            drop(event) {
              const file = Array.from(event.dataTransfer?.files ?? []).find(f => MARKDOWN_FILE.test(f.name) || f.type.startsWith('text/'));
              if (!file || !callbacks.current.onOpenFile) return false;
              event.preventDefault();
              callbacks.current.onOpenFile(file);
              return true;
            },
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor owns its document after mount; external changes go through replaceAll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    replaceAll(text: string) {
      const editor = view.current;
      if (!editor) return;
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: text },
        selection: { anchor: 0 },
        scrollIntoView: true,
        userEvent: 'input.replace',
      });
    },
    focus() {
      view.current?.focus();
    },
  }), []);

  return (
    <div className="editor-pane">
      <div className="pane-header">
        Markdown
        <div className="pane-header-right">
          <span className="char-count">
            {value.trim() ? value.trim().split(/\s+/).length.toLocaleString() : 0} words · {value.length.toLocaleString()} chars
          </span>
        </div>
      </div>
      <div className="editor-host" ref={host} />
    </div>
  );
});

export default Editor;
