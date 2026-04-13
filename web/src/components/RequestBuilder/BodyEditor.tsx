import { useState, useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { EditorView } from '@codemirror/view';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import styles from './BodyEditor.module.css';

function validateBodyContent(body: string, contentType: string): { valid: boolean; error?: string } {
  const trimmed = body.trim();
  if (!trimmed) return { valid: true };

  if (contentType.includes('json')) {
    try {
      JSON.parse(trimmed);
      return { valid: true };
    } catch (e) {
      const msg = e instanceof SyntaxError ? e.message : 'Invalid JSON';
      return { valid: false, error: msg };
    }
  }

  if (contentType.includes('xml') || contentType.includes('html')) {
    try {
      const result = new DOMParser().parseFromString(trimmed, contentType.includes('xml') ? 'application/xml' : 'text/html');
      const hasError = result.getElementsByTagName('parsererror').length > 0;
      if (hasError) {
        return { valid: false, error: 'Invalid XML/HTML' };
      }
      return { valid: true };
    } catch (e) {
      return { valid: false, error: 'Invalid XML/HTML' };
    }
  }

  return { valid: true };
}

function formatBodySize(body: string): string {
  const bytes = new TextEncoder().encode(body).length;
  if (bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const PRESETS = [
  'application/json',
  'application/xml',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'text/html',
];

function getLanguage(contentType: string) {
  if (contentType.includes('json')) return json();
  if (contentType.includes('xml') || contentType.includes('html')) return xml();
  return null;
}

const appEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  '.cm-content': {
    caretColor: 'var(--text-primary)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
    lineHeight: '1.6',
    padding: '8px 0',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-secondary)',
    border: 'none',
    borderRight: '1px solid var(--border-secondary)',
    color: 'var(--text-tertiary)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent-get)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--bg-hover, rgba(255,255,255,0.03))' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--bg-hover, rgba(255,255,255,0.03))' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-tertiary)',
  },
});

const appHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--syntax-key)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.integer, tags.float], color: 'var(--syntax-number)' },
  { tag: [tags.bool, tags.null], color: 'var(--syntax-bool)' },
  { tag: tags.keyword, color: 'var(--syntax-key)' },
]);

const appThemeExtension = [appEditorTheme, syntaxHighlighting(appHighlight)];

interface BodyEditorProps {
  body: string;
  contentType?: string;
  onChange: (body: string) => void;
  onContentTypeChange?: (ct: string) => void;
  readOnly?: boolean;
  copyFlash?: boolean;
}

export function BodyEditor({
  body,
  contentType = '',
  onChange,
  onContentTypeChange,
  readOnly = false,
  copyFlash = false,
}: BodyEditorProps) {
  const [validation, setValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });
  const isPreset = PRESETS.includes(contentType);
  const extensions = useMemo(() => {
    const lang = getLanguage(contentType);
    return lang ? [...appThemeExtension, lang] : appThemeExtension;
  }, [contentType]);

  useEffect(() => {
    setValidation(validateBodyContent(body, contentType));
  }, [body, contentType]);

  return (
    <div className={styles.editor}>
      <div className={styles.toolbarContainer}>
        {!readOnly && (
          <div className={styles.toolbar}>
            <span className={styles.ctLabel}>Content-Type</span>
            <select
              className={styles.ctSelect}
              value={isPreset ? contentType : '__custom__'}
              onChange={(e) => {
                if (e.target.value !== '__custom__') {
                  onContentTypeChange?.(e.target.value);
                }
              }}
            >
              <option value="">None</option>
              {PRESETS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
              <option value="__custom__">Custom…</option>
            </select>
            {!isPreset && contentType !== '' && (
              <input
                className={styles.ctInput}
                value={contentType}
                onChange={(e) => onContentTypeChange?.(e.target.value)}
                placeholder="e.g. application/json"
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            )}
          </div>
        )}
      </div>
      <div className={`${styles.editorWrap} ${!validation.valid ? styles.editorWrapInvalid : ''} ${copyFlash ? styles.flashCopy : ''}`}>
        <CodeMirror
          value={body}
          onChange={onChange}
          extensions={extensions}
          theme="none"
          readOnly={readOnly}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
          }}
          style={{ height: 'auto' }}
        />
        {copyFlash && <div className={styles.copyToast}>Copied to clipboard</div>}
      </div>
    </div>
  );
}
