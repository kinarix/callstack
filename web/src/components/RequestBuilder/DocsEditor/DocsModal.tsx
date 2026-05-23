import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentationFields, KeyValue, Request, Response as AppResponse } from '../../../lib/types';
import { getMethodColor } from '../../../lib/utils';
import DocsEditor from './DocsEditor';
import styles from './DocsModal.module.css';

interface Props {
  request: Request;
  response: AppResponse | null;
  envVars?: KeyValue[];
  onSave: (next: DocumentationFields) => void;
  onClose: () => void;
}

function docsEqual(a: DocumentationFields, b: DocumentationFields): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const saveLabel = isMac ? '⌘S' : 'Ctrl+S';

export default function DocsModal({ request, response, envVars, onSave, onClose }: Props) {
  const [savedSnapshot, setSavedSnapshot] = useState<DocumentationFields>(request.documentation || {});
  const [draft, setDraft] = useState<DocumentationFields>(request.documentation || {});
  const [savedFlash, setSavedFlash] = useState(false);

  const dirty = useMemo(() => !docsEqual(draft, savedSnapshot), [draft, savedSnapshot]);

  const requestForEditor = useMemo<Request>(
    () => ({ ...request, documentation: draft }),
    [request, draft]
  );

  const commitSave = useCallback(() => {
    if (!dirty) return;
    onSave(draft);
    setSavedSnapshot(draft);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  }, [dirty, draft, onSave]);

  const requestClose = useCallback(() => {
    if (dirty) {
      const ok = window.confirm('You have unsaved documentation changes. Discard them?');
      if (!ok) return;
    }
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        commitSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        requestClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [commitSave, requestClose]);

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) requestClose();
  };

  const methodColor = getMethodColor(request.method);

  return (
    <div className={styles.overlay} onMouseDown={handleOverlay}>
      <div
        className={styles.modal}
        data-docs-modal
        style={{ ['--docs-accent' as string]: methodColor } as React.CSSProperties}
      >
        <div className={styles.header}>
          <span className={styles.docsIcon} aria-hidden>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 2.5h7.5L13 5v8.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
                fill="none"
              />
              <path d="M10 2.5V5h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
              <path d="M4.5 8h6M4.5 10.5h6M4.5 13h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </span>
          <span
            className={styles.title}
            title={`Documentation - ${request.method} ${request.name || 'Untitled request'}`}
          >
            <span className={styles.titleLabel}>Documentation</span>
            <span className={styles.titleSep}>-</span>
            <span className={styles.titleMethod} style={{ color: methodColor }}>
              {request.method}
            </span>
            <span className={styles.titleName}>
              {request.name || 'Untitled request'}
            </span>
          </span>
          {dirty && <span className={styles.unsavedBadge} aria-label="Unsaved changes">Not Saved</span>}
          {!dirty && savedFlash && <span className={styles.savedBadge}>Saved</span>}
          <button
            type="button"
            className={`${styles.headerBtn} ${styles.saveBtn}`}
            onClick={commitSave}
            disabled={!dirty}
            title={`Save (${saveLabel})`}
          >
            Save <span className={styles.kbd}>{saveLabel}</span>
          </button>
          <button
            type="button"
            className={styles.headerBtn}
            onClick={requestClose}
            title="Close (Esc)"
          >
            Close <span className={styles.kbd}>Esc</span>
          </button>
        </div>
        <div className={styles.body}>
          <DocsEditor
            request={requestForEditor}
            response={response}
            docs={draft}
            envVars={envVars}
            onChange={setDraft}
          />
        </div>
      </div>
    </div>
  );
}
