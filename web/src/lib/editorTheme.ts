import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const appEditorTheme = EditorView.theme({
  '&': {
    color: 'var(--text-primary)',
    backgroundColor: 'transparent',
  },
  '.cm-content': {
    caretColor: 'var(--text-primary)',
    color: 'var(--text-primary)',
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: '1.6',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent-get)' },
  '.cm-selectionBackground': {
    background: 'color-mix(in srgb, var(--accent-post) 28%, transparent) !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    background: 'color-mix(in srgb, var(--accent-post) 28%, transparent) !important',
  },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--text-primary) 4%, transparent)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-secondary)',
    color: 'var(--text-tertiary)',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-tertiary)',
  },
});

export const appHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.integer, tags.float], color: 'var(--syntax-number)' },
  { tag: [tags.bool, tags.null, tags.atom], color: 'var(--syntax-bool)' },
  { tag: tags.propertyName, color: 'var(--syntax-property)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: tags.meta, color: 'var(--syntax-keyword)' },
  { tag: tags.heading, color: 'var(--syntax-property)', fontWeight: '600' },
  { tag: tags.link, color: 'var(--accent-options)' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '600' },
]);

export const appEditorExtensions = [appEditorTheme, syntaxHighlighting(appHighlight)];
