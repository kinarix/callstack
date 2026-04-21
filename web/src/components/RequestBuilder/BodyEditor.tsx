import { useState, useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { xml } from '@codemirror/lang-xml';
import { EditorView } from '@codemirror/view';
import { StreamLanguage, syntaxHighlighting, HighlightStyle, StringStream } from '@codemirror/language';
import { autocompletion } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import type { KeyValue } from '../../lib/types';
import { templateCompletion, replaceTokensForValidation } from '../../lib/template';
import styles from './BodyEditor.module.css';

interface JsonTemplateState {
  inTemplateString: boolean;
  depth: number;
}

const jsonTemplateMode: StreamLanguage<JsonTemplateState> = StreamLanguage.define({
  startState: () => ({ inTemplateString: false, depth: 0 }),
  token(stream: StringStream, state: JsonTemplateState): string | null {
    if (stream.eatSpace()) return null;

    // Inside a "{{...}}" string — waiting for closing " after }}
    if (state.inTemplateString) {
      if (stream.peek() === '"') {
        stream.next();
        state.inTemplateString = false;
        return 'string';
      }
      // Template token inside the string
      if (stream.match(/\{\{\s*\$[\w.-]+\s*\}\}/)) return 'meta';
      if (stream.match(/\{\{\s*#[\w.-]+\s*\}\}/)) return 'keyword';
      if (stream.match(/\{\{\s*[\w.-]+\s*\}\}/)) return 'variableName.definition';
      // Consume any other chars in the string before/after template
      stream.next();
      return 'string';
    }

    // Unquoted template tokens
    if (stream.match(/\{\{\s*\$[\w.-]+\s*\}\}/)) return 'meta';
    if (stream.match(/\{\{\s*#[\w.-]+\s*\}\}/)) return 'keyword';
    if (stream.match(/\{\{\s*[\w.-]+\s*\}\}/)) return 'variableName.definition';

    // Strings
    if (stream.peek() === '"') {
      // Check if this string contains a template token: "...{{...}}..."
      if (stream.match(/"[^"]*\{\{/, false)) {
        stream.next(); // consume opening "
        state.inTemplateString = true;
        return 'string';
      }
      // Normal string — consume until closing "
      stream.next();
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === '\\') { stream.next(); continue; }
        if (ch === '"') break;
      }
      if (stream.match(/\s*:/, false)) return 'propertyName';
      return 'string';
    }

    // Numbers
    if (stream.match(/-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)) return 'number';

    // Keywords
    if (stream.match('true') || stream.match('false')) return 'atom';
    if (stream.match('null')) return 'atom';

    // Punctuation
    const ch = stream.next();
    if (ch === ':') return 'punctuation';
    if (ch === '{' || ch === '[') { state.depth++; return 'punctuation'; }
    if (ch === '}' || ch === ']') { state.depth = Math.max(0, state.depth - 1); return 'punctuation'; }
    if (ch === ',') return 'punctuation';

    return null;
  },
  indent(state: JsonTemplateState, textAfter: string, context) {
    const unit = context.unit;
    const closing = /^\s*[}\]]/.test(textAfter);
    const depth = closing ? Math.max(0, state.depth - 1) : state.depth;
    return depth * unit;
  },
});

function validateBodyContent(body: string, contentType: string): { valid: boolean; error?: string } {
  const trimmed = body.trim();
  if (!trimmed) return { valid: true };

  const resolvedBody = replaceTokensForValidation(trimmed, contentType);

  if (contentType.includes('json')) {
    try {
      JSON.parse(resolvedBody);
      return { valid: true };
    } catch (e) {
      const msg = e instanceof SyntaxError ? e.message : 'Invalid JSON';
      return { valid: false, error: msg };
    }
  }

  if (contentType.includes('xml') || contentType.includes('html')) {
    try {
      const result = new DOMParser().parseFromString(resolvedBody, contentType.includes('xml') ? 'application/xml' : 'text/html');
      if (result.getElementsByTagName('parsererror').length > 0) {
        return { valid: false, error: 'Invalid XML/HTML' };
      }
      return { valid: true };
    } catch {
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

function getLanguage(contentType: string) {
  if (contentType.includes('json')) return jsonTemplateMode;
  if (contentType.includes('xml') || contentType.includes('html')) return xml();
  return null;
}

const appEditorTheme = EditorView.theme({
  '&': {
    color: 'var(--text-primary)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  '.cm-content': {
    caretColor: 'var(--text-primary)',
    lineHeight: '1.6',
    padding: '8px 0',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent-get)' },
  '.cm-selectionBackground': { backgroundColor: 'rgba(59, 130, 246, 0.3) !important' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'rgba(59, 130, 246, 0.3) !important' },
  '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.03)' },
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
  '.cm-tooltip': {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  '.cm-tooltip-autocomplete > ul': {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
  },
  '.cm-tooltip-autocomplete > ul > li': {
    padding: '3px 10px',
    color: 'var(--text-primary)',
  },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
    backgroundColor: 'rgba(59,130,246,0.2)',
    color: 'var(--text-primary)',
  },
  '.cm-completionLabel': { color: 'var(--text-primary)' },
  '.cm-completionDetail': {
    color: 'var(--text-tertiary)',
    fontStyle: 'italic',
    marginLeft: '8px',
    fontSize: '11px',
  },
});

const appHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.integer, tags.float], color: 'var(--syntax-number)' },
  { tag: [tags.bool, tags.null, tags.atom], color: 'var(--syntax-bool)' },
  { tag: tags.propertyName, color: 'var(--syntax-property)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: tags.meta, color: '#a855f7' },
  { tag: tags.keyword, color: '#f59e0b' },
  { tag: tags.definition(tags.variableName), color: '#10b981' },
]);

const appThemeExtension = [appEditorTheme, syntaxHighlighting(appHighlight)];

interface BodyEditorProps {
  body: string;
  contentType?: string;
  onChange: (body: string) => void;
  readOnly?: boolean;
  copyFlash?: boolean;
  envVars?: KeyValue[];
  secrets?: KeyValue[];
}

export function BodyEditor({
  body,
  contentType = '',
  onChange,
  readOnly = false,
  copyFlash = false,
  envVars = [],
  secrets = [],
}: BodyEditorProps) {
  const [validation, setValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });
  const hasCsvTokens = /\{\{\s*#[\w.-]+\s*\}\}/.test(body);
  const extensions = useMemo(() => {
    const lang = getLanguage(contentType);
    const envVarKeys = envVars.filter((v) => v.enabled !== false && v.key).map((v) => v.key);
    const secretKeys = secrets.filter((s) => s.enabled !== false && s.key).map((s) => s.key);
    const baseExtensions = lang ? [...appThemeExtension, lang] : appThemeExtension;
    return [
      ...baseExtensions,
      autocompletion({ override: [templateCompletion(envVarKeys, secretKeys)], activateOnTyping: true }),
    ];
  }, [contentType, envVars, secrets]);

  useEffect(() => {
    setValidation(validateBodyContent(body, contentType));
  }, [body, contentType]);

  return (
    <div className={styles.editor}>
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
          style={{ height: '100%' }}
        />
        {copyFlash && <div className={styles.copyToast}>Copied to clipboard</div>}
      </div>
      {hasCsvTokens && (
        <div className={styles.csvInfo}>
          # variables will be resolved during CSV iteration
        </div>
      )}
    </div>
  );
}
