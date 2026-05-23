import { useEffect, useMemo, useRef, useState } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import type { KeyValue } from '../../../lib/types';
import { appEditorExtensions } from '../../../lib/editorTheme';
import { getLanguageExtension } from '../../../lib/openapi/cmLanguage';
import { formatBody } from '../../../lib/formatBody';
import { parseFormUrl, serializeFormUrl } from '../../../lib/formUrlBody';
import { useWrapToggle } from '../../../hooks/useWrapBody';
import { KeyValueEditor } from '../KeyValueEditor';
import { FormatIcon, WrapIcon } from '../editorIcons';
import styles from './DocsEditor.module.css';

interface Props {
  value: string;
  contentType: string;
  envVars?: KeyValue[];
  secrets?: KeyValue[];
  wrapKey?: string;
  onChange: (next: string) => void;
}

function classify(contentType: string): 'json' | 'xml' | 'form-url' | 'text' {
  const ct = contentType.toLowerCase();
  if (ct.includes('x-www-form-urlencoded')) return 'form-url';
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml') || ct.includes('html')) return 'xml';
  return 'text';
}

export default function SampleBodyEditor({ value, contentType, envVars, secrets, wrapKey, onChange }: Props) {
  const kind = classify(contentType);
  const cmRef = useRef<ReactCodeMirrorRef | null>(null);
  const [wrap, setWrap] = useWrapToggle(wrapKey || 'callstack.wrapBody.docsSample');

  // Auto-format JSON / XML once on mount if the content is unformatted.
  const initialValue = useMemo(() => {
    if (!value) return value;
    if (kind === 'json' || kind === 'xml') {
      try {
        const formatted = formatBody(value, contentType);
        return formatted || value;
      } catch {
        return value;
      }
    }
    return value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  useEffect(() => {
    if (initialValue !== value) onChange(initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue]);

  const extensions = useMemo(() => {
    const base = [...getLanguageExtension(contentType), ...appEditorExtensions];
    return wrap ? [...base, EditorView.lineWrapping] : base;
  }, [contentType, wrap]);

  if (kind === 'form-url') {
    return <FormUrlSample value={value} envVars={envVars} secrets={secrets} onChange={onChange} />;
  }

  const handleFormat = () => {
    if (kind !== 'json' && kind !== 'xml') return;
    try {
      const next = formatBody(value, contentType);
      if (next && next !== value) onChange(next);
    } catch {
      /* leave as-is */
    }
  };

  const canFormat = kind === 'json' || kind === 'xml';

  return (
    <div className={styles.sampleBodyWrap}>
      <div className={styles.sampleToolbar}>
        {canFormat && (
          <button
            type="button"
            className={`${styles.floatingIconBtn} ${styles.iconBtnFormat}`}
            onClick={handleFormat}
            title="Format body"
            aria-label="Format body"
          >
            <FormatIcon />
          </button>
        )}
        <button
          type="button"
          className={`${styles.floatingIconBtn} ${styles.iconBtnWrap} ${wrap ? styles.wrapIconOn : ''}`}
          onClick={() => setWrap(!wrap)}
          title={wrap ? 'Wrap ON — click to disable' : 'Wrap OFF — click to enable'}
          aria-label={wrap ? 'Wrap on' : 'Wrap off'}
        >
          <WrapIcon />
        </button>
      </div>
      <div className={styles.sampleEditor}>
        <CodeMirror
          ref={cmRef}
          value={value}
          onChange={(v) => onChange(v)}
          extensions={extensions}
          theme="none"
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: false,
            bracketMatching: true,
            closeBrackets: true,
          }}
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}

interface FormUrlProps {
  value: string;
  envVars?: KeyValue[];
  secrets?: KeyValue[];
  onChange: (next: string) => void;
}

function FormUrlSample({ value, envVars, secrets, onChange }: FormUrlProps) {
  const [items, setItems] = useState<KeyValue[]>(() => parseFormUrl(value));
  const prevSerialized = useRef(value);

  useEffect(() => {
    if (value !== prevSerialized.current) {
      setItems(parseFormUrl(value));
      prevSerialized.current = value;
    }
  }, [value]);

  const handleChange = (next: KeyValue[]) => {
    setItems(next);
    const serialized = serializeFormUrl(next);
    prevSerialized.current = serialized;
    onChange(serialized);
  };

  return (
    <div className={styles.sampleFormUrlWrap}>
      <KeyValueEditor items={items} onChange={handleChange} envVars={envVars} secrets={secrets} />
    </div>
  );
}
