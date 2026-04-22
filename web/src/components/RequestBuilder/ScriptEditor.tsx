import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { KeyValue } from '../../lib/types';
import CodeMirror from '@uiw/react-codemirror';
import { javascript, localCompletionSource } from '@codemirror/lang-javascript';
import { EditorView, keymap, showTooltip, type Tooltip } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { StateField } from '@codemirror/state';
import * as prettier from 'prettier/standalone';
import * as parserBabel from 'prettier/plugins/babel';
import * as pluginEstree from 'prettier/plugins/estree';
import { tags } from '@lezer/highlight';
import {
  autocompletion,
  CompletionContext,
  type CompletionResult,
  snippetCompletion,
} from '@codemirror/autocomplete';
import { ScriptExamples } from './ScriptExamples';
import styles from './ScriptEditor.module.css';

type ScriptTab = 'pre' | 'post' | 'examples';

// ── Syntax highlighting ───────────────────────────────────────────────────────

const jsHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: tags.number, color: 'var(--syntax-number)' },
  { tag: tags.bool, color: 'var(--syntax-bool)' },
  { tag: tags.null, color: 'var(--syntax-null)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
  { tag: tags.function(tags.variableName), color: 'var(--syntax-function)' },
  { tag: tags.variableName, color: 'var(--text-primary)' },
  { tag: tags.propertyName, color: 'var(--syntax-property)' },
  { tag: tags.operator, color: 'var(--text-secondary)' },
  { tag: tags.punctuation, color: 'var(--text-secondary)' },
]);

const editorTheme = EditorView.theme({
  '&': {
    color: 'var(--text-primary)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  '.cm-content': {
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
  '.cm-completionInfo': {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    padding: '8px 12px',
    fontSize: '11px',
    color: 'var(--text-secondary)',
    fontFamily: "'Outfit', sans-serif",
    maxWidth: '300px',
  },
  '.cm-completionMatchedText': {
    textDecoration: 'none',
    fontWeight: '700',
    color: '#82aaff',
  },
  // Signature help tooltip
  '.cm-sig-help': {
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '6px',
    padding: '5px 10px',
    fontSize: '11px',
    fontFamily: "'JetBrains Mono', monospace",
    color: 'var(--text-secondary)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
  '.cm-sig-name': { color: '#82aaff' },
  '.cm-sig-active': { color: 'var(--text-primary)', fontWeight: '700' },
  '.cm-sig-doc': {
    display: 'block',
    marginTop: '3px',
    color: 'var(--text-tertiary)',
    fontFamily: "'Outfit', sans-serif",
    fontSize: '11px',
  },
});

// ── Completion data ──────────────────────────────────────────────────────────

interface MemberDef {
  label: string;
  detail: string;
  info?: string;
  type: 'function' | 'property';
  snippet?: string;
}

const REQUEST_MEMBERS: MemberDef[] = [
  { label: 'method', detail: 'string', info: 'HTTP method, e.g. "GET", "POST".', type: 'property' },
  { label: 'url', detail: 'string', info: 'Full request URL.', type: 'property' },
  { label: 'headers', detail: 'KeyValue[]', info: 'Array of { key, value } header pairs. Push to add new headers.', type: 'property' },
  { label: 'params', detail: 'KeyValue[]', info: 'Array of { key, value } query parameter pairs.', type: 'property' },
  { label: 'body', detail: 'string', info: 'Request body as a string.', type: 'property' },
  { label: 'json', detail: 'object | null', info: 'Request body parsed as JSON. Use dot notation to access nested values: request.json.token. Returns null if the body is empty or not valid JSON.', type: 'property' },
];

const RESPONSE_MEMBERS: MemberDef[] = [
  { label: 'status', detail: 'number', info: 'HTTP response status code, e.g. 200, 404.', type: 'property' },
  { label: 'statusText', detail: 'string', info: 'HTTP status text, e.g. "OK", "Not Found".', type: 'property' },
  { label: 'headers', detail: 'KeyValue[]', info: 'Array of { key, value } response header pairs.', type: 'property' },
  { label: 'body', detail: 'string', info: 'Response body as a string.', type: 'property' },
  { label: 'time', detail: 'number', info: 'Response time in milliseconds.', type: 'property' },
  { label: 'json', detail: 'object | null', info: 'Response body parsed as JSON. Use dot notation to access nested values: response.json.data.id. Returns null if the body is empty or not valid JSON.', type: 'property' },
];

const ENV_MEMBERS: MemberDef[] = [
  {
    label: 'get', detail: '(key: string) → string | undefined',
    info: 'Get the current value of an environment variable.',
    type: 'function', snippet: 'get(${1:key})',
  },
  {
    label: 'set', detail: '(key: string, value: string) → void',
    info: 'Set an environment variable. The new value is available immediately within the script and persisted to the active environment after it runs.',
    type: 'function', snippet: 'set(${1:key}, ${2:value})',
  },
  {
    label: 'unset', detail: '(key: string) → void',
    info: 'Remove an environment variable.',
    type: 'function', snippet: 'unset(${1:key})',
  },
  {
    label: 'secret', detail: 'object',
    info: 'Secret store (local only, never exported). Methods: get(key), set(key, value), unset(key).',
    type: 'property',
  },
];

const SECRET_MEMBERS: MemberDef[] = [
  {
    label: 'get', detail: '(key: string) → string | undefined',
    info: 'Get the value of a secret (never exported).',
    type: 'function', snippet: 'get(${1:key})',
  },
  {
    label: 'set', detail: '(key: string, value: string) → void',
    info: 'Set a secret value. Local only — never included in exports.',
    type: 'function', snippet: 'set(${1:key}, ${2:value})',
  },
  {
    label: 'unset', detail: '(key: string) → void',
    info: 'Remove a secret.',
    type: 'function', snippet: 'unset(${1:key})',
  },
];

const CONSOLE_MEMBERS: MemberDef[] = [
  {
    label: 'log', detail: '(...args) → void',
    info: 'Print values to the console panel.', type: 'function', snippet: 'log(${1})',
  },
  {
    label: 'warn', detail: '(...args) → void',
    info: 'Print a warning to the console panel.', type: 'function', snippet: 'warn(${1})',
  },
  {
    label: 'error', detail: '(...args) → void',
    info: 'Print an error to the console panel.', type: 'function', snippet: 'error(${1})',
  },
];

const MEMBER_MAP: Record<string, MemberDef[]> = {
  request: REQUEST_MEMBERS,
  response: RESPONSE_MEMBERS,
  env: ENV_MEMBERS,
  console: CONSOLE_MEMBERS,
};

// ── Signature help data ──────────────────────────────────────────────────────

interface SigDef {
  sig: string; // display string, marks active param with «»
  params: string[];
  doc: string;
}

const SIGNATURES: Record<string, SigDef> = {
  test: {
    sig: 'test(description, fn)',
    params: ['description: string', 'fn: () => void'],
    doc: 'Run a test. Throw inside fn to fail.',
  },
  'env.get': {
    sig: 'env.get(key)',
    params: ['key: string'],
    doc: 'Get the value of an environment variable.',
  },
  'env.set': {
    sig: 'env.set(key, value)',
    params: ['key: string', 'value: string'],
    doc: 'Set an environment variable.',
  },
  'env.unset': {
    sig: 'env.unset(key)',
    params: ['key: string'],
    doc: 'Remove an environment variable.',
  },
  'env.secret.get': {
    sig: 'env.secret.get(key)',
    params: ['key: string'],
    doc: 'Get the value of a secret (local only, never exported).',
  },
  'env.secret.set': {
    sig: 'env.secret.set(key, value)',
    params: ['key: string', 'value: string'],
    doc: 'Set a secret. Local only — never included in exports.',
  },
  'env.secret.unset': {
    sig: 'env.secret.unset(key)',
    params: ['key: string'],
    doc: 'Remove a secret.',
  },
  'console.log': {
    sig: 'console.log(...args)',
    params: ['...args: any[]'],
    doc: 'Print to the console panel.',
  },
  'console.warn': {
    sig: 'console.warn(...args)',
    params: ['...args: any[]'],
    doc: 'Print a warning to the console panel.',
  },
  'console.error': {
    sig: 'console.error(...args)',
    params: ['...args: any[]'],
    doc: 'Print an error to the console panel.',
  },
  'JSON.parse': {
    sig: 'JSON.parse(text)',
    params: ['text: string'],
    doc: 'Parse a JSON string into a value.',
  },
  'JSON.stringify': {
    sig: 'JSON.stringify(value, replacer?, space?)',
    params: ['value: any', 'replacer?: null | Function', 'space?: number | string'],
    doc: 'Serialize a value to a JSON string.',
  },
  emit: {
    sig: 'emit(key, value)',
    params: ['key: string', 'value: any'],
    doc: 'Emit a short-lived run-scoped value for use in automation branch conditions.',
  },
};

// ── Signature help state field ────────────────────────────────────────────────

function detectSigHelp(text: string, pos: number): { name: string; paramIndex: number } | null {
  let depth = 0;
  let parenPos = -1;
  for (let i = pos - 1; i >= 0; i--) {
    const c = text[i];
    if (c === ')') { depth++; }
    else if (c === '(') {
      if (depth === 0) { parenPos = i; break; }
      depth--;
    }
  }
  if (parenPos < 0) return null;

  // Count commas at depth 0 between parenPos and pos to get param index
  let paramIndex = 0;
  let innerDepth = 0;
  for (let i = parenPos + 1; i < pos; i++) {
    const c = text[i];
    if (c === '(' || c === '[' || c === '{') innerDepth++;
    else if (c === ')' || c === ']' || c === '}') innerDepth--;
    else if (c === ',' && innerDepth === 0) paramIndex++;
  }

  // Extract function name before '('
  const before = text.slice(0, parenPos).trimEnd();
  const match = before.match(/([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*)$/);
  if (!match) return null;
  return { name: match[1], paramIndex };
}

function buildSigTooltip(pos: number, sig: SigDef, paramIndex: number): Tooltip {
  return {
    pos,
    above: true,
    strictSide: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'cm-sig-help';

      // Build signature with active param highlighted
      const sigSpan = document.createElement('span');

      // Parse sig into tokens: name, '(', params..., ')'
      const openParen = sig.sig.indexOf('(');
      const closeParen = sig.sig.lastIndexOf(')');
      const fnName = sig.sig.slice(0, openParen);
      const paramsStr = sig.sig.slice(openParen + 1, closeParen).split(/,\s*/);

      const nameEl = document.createElement('span');
      nameEl.className = 'cm-sig-name';
      nameEl.textContent = fnName + '(';
      sigSpan.appendChild(nameEl);

      paramsStr.forEach((p, i) => {
        if (i > 0) {
          const sep = document.createElement('span');
          sep.textContent = ', ';
          sigSpan.appendChild(sep);
        }
        const paramEl = document.createElement('span');
        paramEl.className = i === Math.min(paramIndex, paramsStr.length - 1) ? 'cm-sig-active' : '';
        paramEl.textContent = p;
        sigSpan.appendChild(paramEl);
      });

      const closeEl = document.createElement('span');
      closeEl.className = 'cm-sig-name';
      closeEl.textContent = ')';
      sigSpan.appendChild(closeEl);

      dom.appendChild(sigSpan);

      const docEl = document.createElement('span');
      docEl.className = 'cm-sig-doc';
      docEl.textContent = sig.doc;
      dom.appendChild(docEl);

      return { dom };
    },
  };
}

const sigHelpField = StateField.define<readonly Tooltip[]>({
  create: () => [],
  update(tooltips, tr) {
    if (tr.docChanged) return [];
    if (tr.startState.selection.main.head === tr.state.selection.main.head) return tooltips;
    const pos = tr.state.selection.main.head;
    const text = tr.state.doc.sliceString(0, pos);
    const hit = detectSigHelp(text, pos);
    if (!hit) return [];
    const sig = SIGNATURES[hit.name];
    if (!sig) return [];
    return [buildSigTooltip(pos, sig, hit.paramIndex)];
  },
  provide: (f) => showTooltip.computeN([f], (state) => state.field(f)),
});

// ── Completion source ─────────────────────────────────────────────────────────

function makeCompletionSource(isPost: boolean, envVarKeys: string[] = [], secretKeys: string[] = []) {
  return function scriptCompletions(ctx: CompletionContext): CompletionResult | null {
    // env.secret.get/set/unset('...') string key completions
    const secretKeyMatch = ctx.matchBefore(/env\.secret\.(get|set|unset)\(['"]([^'"]*)/);
    if (secretKeyMatch && secretKeys.length > 0) {
      const quoteIdx = secretKeyMatch.text.search(/['"]/);
      const partial = secretKeyMatch.text.slice(quoteIdx + 1);
      return {
        from: secretKeyMatch.from + quoteIdx + 1,
        options: secretKeys
          .filter((k) => k.startsWith(partial))
          .map((k) => ({ label: k, type: 'constant', detail: 'secret' })),
        validFor: /^[^'"]*$/,
      };
    }

    // env.get('...') / env.set('...') string key completions
    const envKeyMatch = ctx.matchBefore(/env\.(get|set|unset)\(['"]([^'"]*)/);
    if (envKeyMatch && envVarKeys.length > 0) {
      const quoteIdx = envKeyMatch.text.search(/['"]/);
      const partial = envKeyMatch.text.slice(quoteIdx + 1);
      return {
        from: envKeyMatch.from + quoteIdx + 1,
        options: envVarKeys
          .filter((k) => k.startsWith(partial))
          .map((k) => ({ label: k, type: 'constant', detail: 'env var' })),
        validFor: /^[^'"]*$/,
      };
    }

    // Two-level: env.secret.
    const subMemberMatch = ctx.matchBefore(/env\.secret\.([a-zA-Z_$][a-zA-Z0-9_$]*)?/);
    if (subMemberMatch) {
      const lastDotIdx = subMemberMatch.text.lastIndexOf('.');
      return {
        from: subMemberMatch.from + lastDotIdx + 1,
        options: SECRET_MEMBERS.map((m) =>
          m.snippet
            ? snippetCompletion(`${m.label}(${m.snippet.slice(m.label.length + 1, -1)})`, {
                label: m.label, detail: m.detail, info: m.info, type: m.type,
              })
            : { label: m.label, detail: m.detail, info: m.info, type: m.type }
        ),
        validFor: /^[a-zA-Z_$][a-zA-Z0-9_$]*$/,
      };
    }

    // Member access: `something.`
    const memberMatch = ctx.matchBefore(/([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)?/);
    if (memberMatch) {
      const dotIdx = memberMatch.text.indexOf('.');
      const obj = memberMatch.text.slice(0, dotIdx);
      const members = MEMBER_MAP[obj];
      if (!members) return null;
      const filtered = obj === 'response' && !isPost ? [] : members;
      return {
        from: memberMatch.from + dotIdx + 1,
        options: filtered.map((m) =>
          m.snippet
            ? snippetCompletion(`${m.label}(${m.snippet.slice(m.label.length + 1, -1)})`, {
                label: m.label,
                detail: m.detail,
                info: m.info,
                type: m.type,
              })
            : { label: m.label, detail: m.detail, info: m.info, type: m.type }
        ),
        validFor: /^[a-zA-Z_$][a-zA-Z0-9_$]*$/,
      };
    }

    // Top-level identifiers
    const word = ctx.matchBefore(/[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (!word && !ctx.explicit) return null;
    const from = word ? word.from : ctx.pos;

    const topLevel = [
      snippetCompletion('request', {
        label: 'request',
        detail: 'object',
        info: 'The outgoing request. Properties: method, url, headers, params, body.',
        type: 'variable',
      }),
      snippetCompletion('env', {
        label: 'env',
        detail: 'object',
        info: 'Environment variable store. Methods: get(key), set(key, value), unset(key).',
        type: 'variable',
      }),
      snippetCompletion('console', {
        label: 'console',
        detail: 'object',
        info: 'Script console. Methods: log(), warn(), error().',
        type: 'variable',
      }),
      snippetCompletion('test(${1:description}, () => {\n  ${2}\n})', {
        label: 'test',
        detail: '(description, fn)',
        info: 'Define a test assertion. Throw inside fn to mark as failed.',
        type: 'function',
      }),
      snippetCompletion('JSON.parse(${1})', {
        label: 'JSON.parse',
        detail: '(text: string) → any',
        info: 'Parse a JSON string.',
        type: 'function',
      }),
      snippetCompletion('JSON.stringify(${1})', {
        label: 'JSON.stringify',
        detail: '(value: any) → string',
        info: 'Serialize a value to JSON.',
        type: 'function',
      }),
      snippetCompletion('emit(${1:key}, ${2:value})', {
        label: 'emit',
        detail: '(key, value)',
        info: 'Emit a short-lived run-scoped value for use in automation branch conditions.',
        type: 'function',
      }),
    ];

    if (isPost) {
      topLevel.splice(1, 0,
        snippetCompletion('response', {
          label: 'response',
          detail: 'object',
          info: 'The received response. Properties: status, statusText, headers, body, time.',
          type: 'variable',
        })
      );
    }

    return { from, options: topLevel, validFor: /^[a-zA-Z_$][a-zA-Z0-9_$]*$/ };
  };
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ScriptEditorProps {
  requestId?: number;
  preScript: string;
  postScript: string;
  onChange: (changes: { pre_script?: string; post_script?: string }) => void;
  consoleLogs: string[];
  onClearLogs?: () => void;
  envVars?: KeyValue[];
  secrets?: KeyValue[];
  onTest?: (script: string, isPost: boolean) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const VALID_SCRIPT_TABS: ScriptTab[] = ['pre', 'post', 'examples'];

function loadScriptTab(requestId?: number): ScriptTab {
  if (requestId == null) return 'pre';
  const stored = localStorage.getItem('callstack.scriptTab.' + requestId);
  if (stored && (VALID_SCRIPT_TABS as string[]).includes(stored)) {
    return stored as ScriptTab;
  }
  return 'pre';
}

async function prettify(source: string): Promise<string> {
  return prettier.format(source, {
    parser: 'babel',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [parserBabel as any, pluginEstree as any],
    tabWidth: 2,
    singleQuote: true,
    semi: true,
    printWidth: 100,
  });
}

export function ScriptEditor({ requestId, preScript, postScript, onChange, consoleLogs, onClearLogs, envVars = [], secrets = [], onTest }: ScriptEditorProps) {
  const [activeTab, setActiveTab] = useState<ScriptTab>(() => loadScriptTab(requestId));
  const [formatError, setFormatError] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(loadScriptTab(requestId));
  }, [requestId]);

  useEffect(() => {
    if (requestId != null) {
      localStorage.setItem('callstack.scriptTab.' + requestId, activeTab);
    }
  }, [activeTab, requestId]);
  const [envOpen, setEnvOpen] = useState(false);
  const [envHeight, setEnvHeight] = useState(110);
  const [consoleHeight, setConsoleHeight] = useState(120);
  const isPost = activeTab === 'post';
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const focusEditorOnMount = useRef(false);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  const startDrag = (
    e: React.MouseEvent,
    current: number,
    setter: (h: number) => void,
    min: number,
    max: number,
  ) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = current;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      setter(Math.max(min, Math.min(max, startH + delta)));
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const activeEnvVars = envVars.filter((v) => v.enabled !== false && v.key);
  const envVarKeys = useMemo(() => activeEnvVars.map((v) => v.key), [activeEnvVars]);
  const secretKeys = useMemo(
    () => secrets.filter((s) => s.enabled !== false && s.key).map((s) => s.key),
    [secrets]
  );

  const currentScript = isPost ? postScript : preScript;

  const handleChange = (value: string) => {
    if (!isPost) {
      onChange({ pre_script: value });
    } else {
      onChange({ post_script: value });
    }
  };

  const runFormat = useCallback(async () => {
    if (activeTab === 'examples') return;
    const source = isPost ? postScript : preScript;
    if (!source.trim()) return;
    try {
      const formatted = await prettify(source);
      if (formatted === source) return;
      onChange(isPost ? { post_script: formatted } : { pre_script: formatted });
      setFormatError(null);
    } catch (e) {
      setFormatError(e instanceof Error ? e.message.split('\n')[0] : 'Format failed');
      setTimeout(() => setFormatError(null), 3000);
    }
  }, [activeTab, isPost, postScript, preScript, onChange]);

  const formatKeymap = useMemo(
    () => keymap.of([
      { key: 'Shift-Alt-f', preventDefault: true, run: () => { runFormat(); return true; } },
    ]),
    [runFormat],
  );

  const extensions = useMemo(() => [
    javascript(),
    editorTheme,
    syntaxHighlighting(jsHighlight),
    formatKeymap,
    keymap.of([indentWithTab]),
    autocompletion({
      override: [makeCompletionSource(isPost, envVarKeys, secretKeys), localCompletionSource],
      activateOnTyping: true,
      maxRenderedOptions: 20,
    }),
    sigHelpField,
  ], [isPost, envVarKeys, secretKeys, formatKeymap]);

  return (
    <div className={styles.scriptEditor}>
      <div className={styles.subTabs}>
        <span className={styles.sectionLabel}>Scripts</span>
        <button
          className={`${styles.subTab} ${styles.subTabPre} ${!isPost ? styles.subTabActive : ''}`}
          onClick={() => setActiveTab('pre')}
        >
          Pre-request
        </button>
        <button
          className={`${styles.subTab} ${styles.subTabPost} ${isPost ? styles.subTabActive : ''}`}
          onClick={() => setActiveTab('post')}
        >
          Post-request
        </button>
        <button
          className={`${styles.subTab} ${styles.subTabExamples} ${activeTab === 'examples' ? styles.subTabActive : ''}`}
          onClick={() => setActiveTab('examples')}
        >
          Examples
        </button>
        <div className={styles.hint}>
          {activeTab === 'examples'
            ? 'Copy code examples to pre or post-request scripts.'
            : !isPost
            ? 'Runs before the request is sent. Mutate request, headers, params.'
            : 'Runs after the response. Use test() to assert, env.set() to store values.'}
        </div>
        {activeTab !== 'examples' && (
          <button
            className={styles.formatBtn}
            onClick={runFormat}
            title={formatError ?? 'Format script (Shift+Alt+F)'}
          >
            {formatError ? 'Format failed' : 'Format'}
          </button>
        )}
        {onTest && activeTab !== 'examples' && (
          <button
            className={styles.testBtn}
            onClick={() => onTest(currentScript, isPost)}
            title={isPost ? 'Run post-request script against the last response' : 'Run pre-request script against the current request'}
          >
            <span className={styles.testBtnIcon}>▶</span>
            Test
          </button>
        )}
      </div>

      <div className={styles.editorWrap}>
        {activeTab === 'examples' ? (
          <ScriptExamples
            onCopy={(code, target) => {
              if (target === 'pre') {
                const existing = preScript.trim();
                onChange({ pre_script: existing ? `${existing}\n\n${code}` : code });
              } else {
                const existing = postScript.trim();
                onChange({ post_script: existing ? `${existing}\n\n${code}` : code });
              }
              focusEditorOnMount.current = true;
              setActiveTab(target);
            }}
          />
        ) : (
          <CodeMirror
            key={activeTab}
            value={currentScript}
            onChange={handleChange}
            extensions={extensions}
            theme="none"
            basicSetup={{
              lineNumbers: true,
              foldGutter: false,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: false, // we provide our own
              highlightSelectionMatches: false,
              indentOnInput: true,
              tabSize: 2,
            }}
            style={{ height: '100%' }}
            onCreateEditor={(view) => {
              if (focusEditorOnMount.current) {
                focusEditorOnMount.current = false;
                view.focus();
              }
            }}
          />
        )}
      </div>

      {/* Environment panel */}
      {(activeEnvVars.length > 0 || secretKeys.length > 0) && (
        <div className={styles.envPanel}>
          {envOpen && (
            <div
              className={styles.resizeHandle}
              onMouseDown={(e) => startDrag(e, envHeight, setEnvHeight, 60, 300)}
            />
          )}
          <button className={styles.envToggle} onClick={() => setEnvOpen((o) => !o)}>
            <span className={styles.envToggleArrow} style={{ transform: envOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            <span>Environment</span>
            <span className={styles.envCount}>{activeEnvVars.length + secretKeys.length}</span>
          </button>
          {envOpen && (
            <div className={styles.envList} style={{ height: envHeight }}>
              {activeEnvVars.map((v, i) => (
                <div key={i} className={styles.envRow}>
                  <span className={styles.envRowIcon}>
                    <svg width="10" height="10" viewBox="0 0 11 11" fill="none" aria-hidden>
                      <rect x="1" y="1" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M3 5.5h5M3 3.5h3M3 7.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <span className={styles.envKey}>{v.key}</span>
                  <span className={styles.envEq}>=</span>
                  <span className={styles.envVal}>{v.value || <em className={styles.envEmpty}>empty</em>}</span>
                </div>
              ))}
              {secrets.filter((s) => s.enabled !== false && s.key).map((s, i) => (
                <div key={`secret-${i}`} className={styles.envRow}>
                  <span className={`${styles.envRowIcon} ${styles.envRowIconSecret}`}>
                    <svg width="10" height="10" viewBox="0 0 11 11" fill="none" aria-hidden>
                      <rect x="2" y="5" width="7" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M3.5 5V3.5a2 2 0 1 1 4 0V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <span className={`${styles.envKey} ${styles.envSecretKey}`}>{s.key}</span>
                  <span className={styles.envEq}>=</span>
                  <span className={styles.envSecretVal}>••••••••</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className={styles.console} style={{ height: consoleHeight }}>
        <div
          className={styles.resizeHandle}
          onMouseDown={(e) => startDrag(e, consoleHeight, setConsoleHeight, 60, 400)}
        />
        <div className={styles.consoleHeader}>
          <span className={styles.consoleLabel}>Console</span>
          {consoleLogs.length === 0
            ? <span className={styles.consoleEmpty}>No output</span>
            : onClearLogs && (
              <button className={styles.clearBtn} onClick={onClearLogs} title="Clear console">
                Clear
              </button>
            )
          }
        </div>
        <div className={styles.consoleLogs}>
          {consoleLogs.map((line, i) => {
            let className = styles.consoleLine;
            if (line.startsWith('[debug]')) className += ` ${styles.consoleDebug}`;
            else if (line.startsWith('[info]')) className += ` ${styles.consoleInfo}`;
            else if (line.startsWith('[warn]')) className += ` ${styles.consoleWarn}`;
            else if (line.startsWith('[error]')) className += ` ${styles.consoleError}`;
            else if (line.startsWith('✓')) className += ` ${styles.consolePass}`;
            else if (line.startsWith('✗')) className += ` ${styles.consoleFail}`;

            return (
              <div key={i} className={className}>
                <span className={styles.consolePrompt}>&gt;</span>
                {line}
              </div>
            );
          })}
          <div ref={consoleEndRef} />
        </div>
      </div>
    </div>
  );
}
