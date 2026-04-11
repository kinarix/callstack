import { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
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

function resolveTheme(): 'dark' | 'light' {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark') return 'dark';
  if (attr === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function useResolvedTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>(resolveTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(resolveTheme()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

interface BodyEditorProps {
  body: string;
  contentType?: string;
  onChange: (body: string) => void;
  onContentTypeChange?: (ct: string) => void;
  readOnly?: boolean;
}

export function BodyEditor({
  body,
  contentType = '',
  onChange,
  onContentTypeChange,
  readOnly = false,
}: BodyEditorProps) {
  const [validation, setValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });
  const isPreset = PRESETS.includes(contentType);
  const theme = useResolvedTheme();
  const lang = getLanguage(contentType);

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
        <div className={`${styles.validationTag} ${validation.valid ? styles.validationTagValid : styles.validationTagInvalid}`} title={validation.error}>
          {validation.valid ? '✓ Valid' : `✗ ${validation.error || 'Invalid'}`}
        </div>
      </div>
      <div className={`${styles.editorWrap} ${!validation.valid ? styles.editorWrapInvalid : ''}`}>
        <CodeMirror
          value={body}
          onChange={onChange}
          extensions={lang ? [lang] : []}
          theme={theme}
          height="100%"
          readOnly={readOnly}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
          }}
        />
      </div>
    </div>
  );
}
