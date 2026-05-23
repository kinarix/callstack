import { useRef } from 'react';
import type { EditorView } from '@codemirror/view';
import styles from './DocsEditor.module.css';

interface Props {
  viewRef: React.MutableRefObject<EditorView | null>;
}

type Action =
  | { kind: 'wrap'; before: string; after: string; placeholder: string }
  | { kind: 'linePrefix'; prefix: string }
  | { kind: 'link' }
  | { kind: 'block'; before: string; after: string; placeholder: string };

function applyAction(view: EditorView, action: Action) {
  const { state } = view;
  const sel = state.selection.main;
  const selectedText = state.sliceDoc(sel.from, sel.to);

  if (action.kind === 'wrap') {
    const text = selectedText || action.placeholder;
    const insert = `${action.before}${text}${action.after}`;
    const cursorFrom = sel.from + action.before.length;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor: cursorFrom, head: cursorFrom + text.length },
    });
  } else if (action.kind === 'block') {
    const text = selectedText || action.placeholder;
    const needsLeadingNewline = sel.from > 0 && state.sliceDoc(sel.from - 1, sel.from) !== '\n';
    const lead = needsLeadingNewline ? '\n' : '';
    const insert = `${lead}${action.before}${text}${action.after}`;
    const cursorAt = sel.from + lead.length + action.before.length;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor: cursorAt, head: cursorAt + text.length },
    });
  } else if (action.kind === 'linePrefix') {
    const startLine = state.doc.lineAt(sel.from);
    const endLine = state.doc.lineAt(sel.to);
    const changes = [];
    for (let n = startLine.number; n <= endLine.number; n++) {
      const line = state.doc.line(n);
      if (line.text.startsWith(action.prefix)) continue;
      changes.push({ from: line.from, insert: action.prefix });
    }
    if (changes.length) view.dispatch({ changes });
  } else if (action.kind === 'link') {
    const text = selectedText || 'link text';
    const insert = `[${text}](https://)`;
    const urlStart = sel.from + 1 + text.length + 2;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert },
      selection: { anchor: urlStart, head: urlStart + 'https://'.length },
    });
  }
  view.focus();
}

interface BtnProps {
  label: string;
  title: string;
  onClick: () => void;
  monospace?: boolean;
}

function ToolBtn({ label, title, onClick, monospace }: BtnProps) {
  return (
    <button
      type="button"
      className={`${styles.mdToolBtn} ${monospace ? styles.mdToolBtnMono : ''}`}
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export default function MarkdownToolbar({ viewRef }: Props) {
  const lastApply = useRef<((a: Action) => void) | null>(null);
  lastApply.current = (a: Action) => {
    if (viewRef.current) applyAction(viewRef.current, a);
  };
  const a = (action: Action) => () => lastApply.current?.(action);

  return (
    <div className={styles.mdToolbar} role="toolbar" aria-label="Markdown formatting">
      <ToolBtn label="B" title="Bold (Ctrl/Cmd-B)" onClick={a({ kind: 'wrap', before: '**', after: '**', placeholder: 'bold' })} />
      <ToolBtn label="I" title="Italic (Ctrl/Cmd-I)" onClick={a({ kind: 'wrap', before: '_', after: '_', placeholder: 'italic' })} />
      <ToolBtn label="S" title="Strikethrough" onClick={a({ kind: 'wrap', before: '~~', after: '~~', placeholder: 'strike' })} />
      <span className={styles.mdToolSep} aria-hidden />
      <ToolBtn label="H1" title="Heading 1" onClick={a({ kind: 'linePrefix', prefix: '# ' })} />
      <ToolBtn label="H2" title="Heading 2" onClick={a({ kind: 'linePrefix', prefix: '## ' })} />
      <ToolBtn label="H3" title="Heading 3" onClick={a({ kind: 'linePrefix', prefix: '### ' })} />
      <span className={styles.mdToolSep} aria-hidden />
      <ToolBtn label="• List" title="Bullet list" onClick={a({ kind: 'linePrefix', prefix: '- ' })} />
      <ToolBtn label="1. List" title="Numbered list" onClick={a({ kind: 'linePrefix', prefix: '1. ' })} />
      <ToolBtn label="❝" title="Block quote" onClick={a({ kind: 'linePrefix', prefix: '> ' })} />
      <span className={styles.mdToolSep} aria-hidden />
      <ToolBtn label="</>" title="Inline code" monospace onClick={a({ kind: 'wrap', before: '`', after: '`', placeholder: 'code' })} />
      <ToolBtn label="```" title="Code block" monospace onClick={a({ kind: 'block', before: '```\n', after: '\n```\n', placeholder: 'code' })} />
      <ToolBtn label="🔗" title="Link" onClick={a({ kind: 'link' })} />
    </div>
  );
}
