import { useState, useEffect, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { EditorView, ViewPlugin, Decoration, DecorationSet } from '@codemirror/view';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { autocompletion } from '@codemirror/autocomplete';
import { tags } from '@lezer/highlight';
import { RangeSet } from '@codemirror/state';
import type { KeyValue } from '../../lib/types';
import { templateCompletion, resolveTemplate } from '../../lib/template';
import { FAKER_TOKENS } from '../../lib/templateTokens';
import styles from './BodyEditor.module.css';

// Custom decorations
const templateDecoration = Decoration.mark({ class: 'cm-template-token' });
const propertyNameDecoration = Decoration.mark({ class: 'cm-property-name-override' });

// Plugin to highlight template tokens and property names
const highlightPlugin = ViewPlugin.define(
  (view) => {
    let decorations = buildDecorations(view);

    return {
      decorations,
      update(update: any) {
        if (update.docChanged) {
          decorations = buildDecorations(update.view);
        }
      },
    };
  },
  {
    decorations: (v) => v.decorations,
  }
);

function buildDecorations(view: any): DecorationSet {
  const decorations: any[] = [];
  const text = view.state.doc.toString();

  // Highlight template tokens: {{...}}
  const templateRegex = /\{\{[\w.$-]+\}\}/g;
  let match;
  while ((match = templateRegex.exec(text)) !== null) {
    decorations.push(templateDecoration.range(match.index, match.index + match[0].length));
  }

  // Highlight property names: "..." followed by :
  // This ensures property names are highlighted even when JSON syntax is broken by unquoted templates
  const propertyRegex = /"([^"\\]|\\.)*"\s*:/g;
  while ((match = propertyRegex.exec(text)) !== null) {
    // Only highlight the quoted string part, not the colon
    const colonIndex = text.indexOf(':', match.index);
    decorations.push(propertyNameDecoration.range(match.index, colonIndex));
  }

  return decorations.length ? RangeSet.of(decorations) : Decoration.none;
}

function resolveTemplatesForValidation(body: string, envVars: KeyValue[]): string {
  // Create sample variables with actual env vars or placeholder values
  const sampleVars: KeyValue[] = [
    // Include actual env vars
    ...envVars.filter(v => v.enabled !== false),
    // Add sample values for faker tokens if not already defined as env vars
    ...FAKER_TOKENS.map(token => ({
      key: token.name,
      value: token.example || `sample-${token.name}`,
      enabled: true,
    })).filter(t => !envVars.some(v => v.key === t.key)),
  ];

  return resolveTemplate(body, sampleVars);
}

function validateBodyContent(body: string, contentType: string, envVars: KeyValue[] = []): { valid: boolean; error?: string } {
  const trimmed = body.trim();
  if (!trimmed) return { valid: true };

  // Resolve templates for validation
  const resolvedBody = resolveTemplatesForValidation(trimmed, envVars);

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

const CT_LABELS: Record<string, string> = {
  'application/json':                  'JSON',
  'application/xml':                   'XML',
  'application/x-www-form-urlencoded': 'Form URL',
  'multipart/form-data':               'Form Data',
  'text/plain':                        'Plain Text',
  'text/html':                         'HTML',
};

function ContentTypeSelector({
  value,
  onChange,
  onCustom,
}: {
  value: string;
  onChange: (ct: string) => void;
  onCustom: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isPreset = PRESETS.includes(value);
  const isCustom = !isPreset && value !== '';

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = isPreset ? CT_LABELS[value] : isCustom ? 'Custom' : 'None';

  return (
    <div ref={ref} className={styles.ctWrapper}>
      <button
        className={`${styles.ctPill} ${value ? styles.ctPillActive : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className={styles.ctDropdown}>
          <button
            className={`${styles.ctOption} ${value === '' ? styles.ctOptionActive : ''}`}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            None
          </button>
          {PRESETS.map((p) => (
            <button
              key={p}
              className={`${styles.ctOption} ${value === p ? styles.ctOptionActive : ''}`}
              onClick={() => { onChange(p); setOpen(false); }}
            >
              <span className={styles.ctOptionLabel}>{CT_LABELS[p]}</span>
              <span className={styles.ctOptionValue}>{p}</span>
            </button>
          ))}
          <button
            className={`${styles.ctOption} ${isCustom ? styles.ctOptionActive : ''}`}
            onClick={() => { onCustom(); setOpen(false); }}
          >
            Custom…
          </button>
        </div>
      )}
    </div>
  );
}

function getLanguage(contentType: string) {
  if (contentType.includes('json')) return json();
  if (contentType.includes('xml') || contentType.includes('html')) return xml();
  return null;
}

const appEditorTheme = EditorView.theme({
  '&': {
    color: 'var(--text-primary)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
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
  // Template token highlighting
  '.cm-template-token': {
    color: 'var(--syntax-function)',
    fontWeight: '500',
  },
  // Property name override (ensures consistent color even with broken JSON)
  '.cm-property-name-override': {
    color: 'var(--syntax-property)',
  },
  // Autocomplete dropdown
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
  { tag: [tags.bool, tags.null], color: 'var(--syntax-bool)' },
  { tag: tags.propertyName, color: 'var(--syntax-property)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
]);

const appThemeExtension = [appEditorTheme, syntaxHighlighting(appHighlight)];

interface BodyEditorProps {
  body: string;
  contentType?: string;
  onChange: (body: string) => void;
  onContentTypeChange?: (ct: string) => void;
  readOnly?: boolean;
  copyFlash?: boolean;
  envVars?: KeyValue[];
}

export function BodyEditor({
  body,
  contentType = '',
  onChange,
  onContentTypeChange,
  readOnly = false,
  copyFlash = false,
  envVars = [],
}: BodyEditorProps) {
  const [validation, setValidation] = useState<{ valid: boolean; error?: string }>({ valid: true });
  const [inCustomMode, setInCustomMode] = useState(() => !PRESETS.includes(contentType) && contentType !== '');
  const isPreset = PRESETS.includes(contentType);
  const showCustomInput = inCustomMode || (!isPreset && contentType !== '');
  const extensions = useMemo(() => {
    const lang = getLanguage(contentType);
    const envVarKeys = envVars.filter((v) => v.enabled !== false && v.key).map((v) => v.key);
    const baseExtensions = lang ? [...appThemeExtension, lang] : appThemeExtension;
    return [
      ...baseExtensions,
      highlightPlugin,
      autocompletion({ override: [templateCompletion(envVarKeys)], activateOnTyping: true }),
    ];
  }, [contentType, envVars]);

  useEffect(() => {
    setValidation(validateBodyContent(body, contentType, envVars));
  }, [body, contentType, envVars]);

  return (
    <div className={styles.editor}>
      <div className={styles.toolbarContainer}>
        {!readOnly && (
          <div className={styles.toolbar}>
            <span className={styles.ctLabel}>Content-Type</span>
            <ContentTypeSelector
              value={contentType}
              onChange={(ct) => { setInCustomMode(false); onContentTypeChange?.(ct); }}
              onCustom={() => setInCustomMode(true)}
            />
            {showCustomInput && (
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
          style={{ height: '100%' }}
        />
        {copyFlash && <div className={styles.copyToast}>Copied to clipboard</div>}
      </div>
    </div>
  );
}
