import { useRef } from 'react';
import type { FileAttachment } from '../../lib/types';
import styles from './FileUpload.module.css';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileUploadProps {
  files: FileAttachment[];
  onChange: (files: FileAttachment[]) => void;
}

export function FileUpload({ files, onChange }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (!selected.length) return;

    const attachments = selected.map((file): FileAttachment => {
      const tauriFile = file as any;
      const path = tauriFile.path || '';
      return {
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        path,
      };
    });

    onChange([...files, ...attachments]);
    e.target.value = '';
  };

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.container}>
      <input
        ref={inputRef}
        type="file"
        multiple
        className={styles.hiddenInput}
        onChange={handleFileSelect}
      />
      <div className={styles.toolbar}>
        <button className={styles.addBtn} onClick={() => inputRef.current?.click()}>
          + Add Files
        </button>
        {files.length > 0 && (
          <button className={styles.clearBtn} onClick={() => onChange([])}>
            Clear all
          </button>
        )}
      </div>
      {files.length === 0 ? (
        <div className={styles.empty}>No files attached. Click "Add Files" to upload.</div>
      ) : (
        <div className={styles.list}>
          {files.map((f, i) => (
            <div key={i} className={styles.item}>
              <span className={styles.fileName}>{f.name}</span>
              <span className={styles.fileMeta}>{f.mime} · {formatBytes(f.size)}</span>
              <button
                className={styles.removeBtn}
                onClick={() => handleRemove(i)}
                title="Remove file"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
