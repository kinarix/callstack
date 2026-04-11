import { useState, useCallback, useRef, useEffect } from 'react';
import { parsePostmanCollection } from '../../utils/postmanParser';
import type { ParsedCollection } from '../../utils/postmanParser';
import styles from './FilePickerModal.module.css';

interface FilePickerModalProps {
  title: string;
  confirmLabel: string;
  onParsed: (collection: ParsedCollection) => void;
  onCancel: () => void;
}

type Stage = 'idle' | 'dragging' | 'error' | 'preview';

function UploadIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M16 22V10M10 16L16 10L22 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 26h20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 14L12.5 17.5L19 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.8" />
      <path d="M14 9v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14" cy="19.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function FilePickerModal({ title, confirmLabel, onParsed, onCancel }: FilePickerModalProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [parsed, setParsed] = useState<ParsedCollection | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setStage('error');
      setErrorMessage('Please select a .json file');
      return;
    }
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const collection = parsePostmanCollection(json);
      setParsed(collection);
      setStage('preview');
    } catch (err) {
      setStage('error');
      setErrorMessage(err instanceof Error ? err.message : 'Not a valid Postman collection');
    }
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setStage('dragging');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setStage('idle');
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) processFile(file);
  }, [processFile]);

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleRetry = useCallback(() => {
    dragCounterRef.current = 0;
    setParsed(null);
    setErrorMessage('');
    setStage('idle');
  }, []);

  const handleConfirm = useCallback(() => {
    if (parsed) onParsed(parsed);
  }, [parsed, onParsed]);

  const isDragging = stage === 'dragging';

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button className={styles.closeBtn} onClick={onCancel} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {(stage === 'idle' || stage === 'dragging') && (
            <div
              className={`${styles.dropZone} ${isDragging ? styles.dropZoneDragging : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className={`${styles.dropIcon} ${isDragging ? styles.dropIconDragging : ''}`}>
                <UploadIcon />
              </div>
              <p className={styles.dropHint}>
                {isDragging ? 'Release to upload' : 'Drop your Postman collection JSON here'}
              </p>
              {!isDragging && (
                <>
                  <p className={styles.dropOr}>or</p>
                  <button className={styles.browseBtn} onClick={handleBrowse} type="button">
                    Browse file
                  </button>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
            </div>
          )}

          {stage === 'error' && (
            <div className={styles.feedbackBox}>
              <div className={`${styles.feedbackIcon} ${styles.errorIcon}`}>
                <ErrorIcon />
              </div>
              <p className={styles.feedbackTitle}>Invalid file</p>
              <p className={styles.feedbackMessage}>{errorMessage}</p>
              <button className={styles.retryBtn} onClick={handleRetry} type="button">
                Try another file
              </button>
            </div>
          )}

          {stage === 'preview' && parsed && (
            <div className={styles.feedbackBox}>
              <div className={`${styles.feedbackIcon} ${styles.successIcon}`}>
                <CheckIcon />
              </div>
              <p className={styles.feedbackTitle}>{parsed.name}</p>
              <p className={styles.feedbackMessage}>
                {parsed.requests.length === 0
                  ? 'No requests found in this collection'
                  : `${parsed.requests.length} request${parsed.requests.length === 1 ? '' : 's'} ready to import`}
              </p>
              <button className={styles.retryBtn} onClick={handleRetry} type="button">
                Choose a different file
              </button>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel} type="button">
            Cancel
          </button>
          <button
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={stage !== 'preview' || !parsed || parsed.requests.length === 0}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
