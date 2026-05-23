import { useMemo, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { yaml as cmYaml } from '@codemirror/lang-yaml';
import { EditorView } from '@codemirror/view';
import { invoke } from '@tauri-apps/api/core';
import { parse as yamlParse } from 'yaml';
import { appEditorExtensions } from '../../../lib/editorTheme';
import { toYAML } from '../../../lib/openapi/stringify';
import { useWrapToggle } from '../../../hooks/useWrapBody';
import { WrapIcon, FormatIcon, SaveIcon } from '../editorIcons';
import { CopyIcon } from '../../Sidebar/SidebarIcons';
import styles from './DocsEditor.module.css';

interface Props {
  yamlText: string;
  filenameStem: string;
  edited: boolean;
  onChange: (next: string) => void;
  onReset: () => void;
}

export default function DocsEditorPreview({ yamlText, filenameStem, edited, onChange, onReset }: Props) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [wrap, setWrap] = useWrapToggle('callstack.wrapBody.docsYaml');

  const extensions = useMemo(() => {
    const base = [cmYaml(), ...appEditorExtensions];
    return wrap ? [...base, EditorView.lineWrapping] : base;
  }, [wrap]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yamlText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked */
    }
  };

  const handleExport = async () => {
    try {
      const safe = (filenameStem || 'operation').replace(/[^A-Za-z0-9_.-]+/g, '_');
      const ok = await invoke<boolean>('save_file', {
        filename: `${safe}.openapi.yaml`,
        content: yamlText,
      });
      if (ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1800);
      }
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = yamlParse(yamlText);
      if (parsed == null) return;
      const next = toYAML(parsed);
      if (next !== yamlText) onChange(next);
    } catch {
      /* invalid yaml — leave as-is */
    }
  };

  return (
    <div className={styles.docsPreview}>
      <div className={styles.previewHeader}>
        <span className={styles.previewTitle}>
          OpenAPI 3.1 (YAML){edited ? ' — manual override' : ''}
        </span>
        {edited && (
          <button type="button" className={styles.actionBtn} onClick={onReset} title="Discard your edits and regenerate from request/response">
            Reset to auto
          </button>
        )}
        <button
          type="button"
          className={`${styles.floatingIconBtn} ${styles.iconBtnFormat}`}
          onClick={handleFormat}
          title="Format / canonicalize YAML"
          aria-label="Format YAML"
        >
          <FormatIcon />
        </button>
        <button
          type="button"
          className={`${styles.floatingIconBtn} ${styles.iconBtnWrap} ${wrap ? styles.wrapIconOn : ''}`}
          onClick={() => setWrap(!wrap)}
          title={wrap ? 'Wrap ON — click to disable' : 'Wrap OFF — click to enable'}
          aria-label={wrap ? 'Wrap on' : 'Wrap off'}
        >
          <WrapIcon />
        </button>
        <button
          type="button"
          className={`${styles.floatingIconBtn} ${styles.iconBtnCopy} ${copied ? styles.iconBtnFlash : ''}`}
          onClick={handleCopy}
          title={copied ? 'Copied' : 'Copy YAML to clipboard'}
          aria-label="Copy YAML"
        >
          <CopyIcon />
        </button>
        <button
          type="button"
          className={`${styles.floatingIconBtn} ${styles.iconBtnSave} ${saved ? styles.iconBtnFlash : ''}`}
          onClick={handleExport}
          title={saved ? 'Saved' : 'Export YAML to file'}
          aria-label="Export YAML"
        >
          <SaveIcon />
        </button>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewEditor}>
          <CodeMirror
            value={yamlText}
            onChange={(v) => onChange(v)}
            extensions={extensions}
            theme="none"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: false,
              highlightActiveLineGutter: false,
            }}
            style={{ height: '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
