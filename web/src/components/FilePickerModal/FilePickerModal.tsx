import { useState, useCallback, useRef, useEffect } from 'react';
import { parsePostmanCollection } from '../../utils/postmanParser';
import type { ParsedCollection } from '../../utils/postmanParser';
import { previewArchive, detectFileFormat } from '../../utils/callstackArchive';
import type { ArchivePreview } from '../../lib/callstackSchema';
import styles from './FilePickerModal.module.css';

interface FilePickerModalProps {
  title: string;
  confirmLabel: string;
  onParsed: (collection: ParsedCollection) => void;
  onCallstackParsed?: (preview: ArchivePreview, file: File) => void;
  onCancel: () => void;
}

type Stage = 'idle' | 'dragging' | 'error' | 'preview';
type FileFormat = 'postman' | 'callstack';

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

export function FilePickerModal({ title, confirmLabel, onParsed, onCallstackParsed, onCancel }: FilePickerModalProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [parsed, setParsed] = useState<ParsedCollection | null>(null);
  const [callstackPreview, setCallstackPreview] = useState<ArchivePreview | null>(null);
  const [callstackFile, setCallstackFile] = useState<File | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<FileFormat>('postman');
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
    const isCallstack = file.name.endsWith('.callstack');
    const isJson = file.name.endsWith('.json') || file.type === 'application/json';

    if (!isCallstack && !isJson) {
      // Try auto-detecting from content
      const format = await detectFileFormat(file);
      if (format === 'callstack') {
        // fall through to callstack handling
      } else if (format !== 'postman') {
        setStage('error');
        setErrorMessage('Please select a .callstack or .json (Postman) file');
        return;
      }
    }

    const fmt = await detectFileFormat(file);

    if (fmt === 'callstack') {
      try {
        const preview = await previewArchive(file);
        setCallstackPreview(preview);
        setCallstackFile(file);
        setDetectedFormat('callstack');
        setStage('preview');
      } catch (err) {
        setStage('error');
        setErrorMessage(err instanceof Error ? err.message : 'Not a valid .callstack file');
      }
    } else {
      // Postman JSON
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        const collection = parsePostmanCollection(json);
        setParsed(collection);
        setDetectedFormat('postman');
        setStage('preview');
      } catch (err) {
        setStage('error');
        setErrorMessage(err instanceof Error ? err.message : 'Not a valid Postman collection');
      }
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
    setCallstackPreview(null);
    setCallstackFile(null);
    setErrorMessage('');
    setStage('idle');
  }, []);

  const handleConfirm = useCallback(() => {
    if (detectedFormat === 'callstack' && callstackPreview && callstackFile && onCallstackParsed) {
      onCallstackParsed(callstackPreview, callstackFile);
    } else if (detectedFormat === 'postman' && parsed) {
      onParsed(parsed);
    }
  }, [detectedFormat, callstackPreview, callstackFile, parsed, onParsed, onCallstackParsed]);

  const isDragging = stage === 'dragging';

  const isConfirmDisabled =
    stage !== 'preview' ||
    (detectedFormat === 'postman' && (!parsed || parsed.requests.length === 0)) ||
    (detectedFormat === 'callstack' && (!callstackPreview || !onCallstackParsed));

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
                {isDragging ? 'Release to upload' : 'Drop a .callstack, .callstack.json, or .json file here'}
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
                accept=".callstack,.callstack.json,.json,application/json"
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

          {stage === 'preview' && detectedFormat === 'postman' && parsed && (
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
              <p className={styles.formatBadge}>Postman Collection</p>
              <button className={styles.retryBtn} onClick={handleRetry} type="button">
                Choose a different file
              </button>
            </div>
          )}

          {stage === 'preview' && detectedFormat === 'callstack' && callstackPreview && (
            <div className={styles.feedbackBox}>
              <div className={`${styles.feedbackIcon} ${styles.successIcon}`}>
                <CheckIcon />
              </div>
              <p className={styles.feedbackTitle}>{callstackPreview.name}</p>
              {callstackPreview.description && (
                <p className={styles.feedbackDesc}>{callstackPreview.description}</p>
              )}
              <div className={styles.callstackStats}>
                <span>{callstackPreview.requestCount} request{callstackPreview.requestCount !== 1 ? 's' : ''}</span>
                {callstackPreview.folderCount > 0 && (
                  <span>{callstackPreview.folderCount} folder{callstackPreview.folderCount !== 1 ? 's' : ''}</span>
                )}
                {callstackPreview.environmentCount > 0 && (
                  <span>{callstackPreview.environmentCount} environment{callstackPreview.environmentCount !== 1 ? 's' : ''}</span>
                )}
                {callstackPreview.hasResponses && <span>responses included</span>}
              </div>
              <p className={styles.formatBadge}>
                {callstackFile?.name.endsWith('.callstack.json') ? 'Callstack Plain JSON' : 'Callstack Archive'}
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
            disabled={isConfirmDisabled}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
