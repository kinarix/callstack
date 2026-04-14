import { invoke } from '@tauri-apps/api/core';
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
  const handleAddFiles = async () => {
    const picked = await invoke<FileAttachment[] | null>('pick_attachment_files');
    if (picked) onChange([...files, ...picked]);
  };

  const handleReattach = async (index: number) => {
    const picked = await invoke<FileAttachment[] | null>('pick_attachment_files');
    if (!picked || picked.length === 0) return;
    const updated = [...files];
    updated[index] = picked[0];
    if (picked.length > 1) updated.splice(index + 1, 0, ...picked.slice(1));
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <button className={styles.addBtn} onClick={handleAddFiles}>
          + Add Files
        </button>
        {files.length > 0 && (
          <button className={styles.clearBtn} onClick={() => onChange([])}>
            Clear all
          </button>
        )}
      </div>
      {files.length === 0 ? (
        <div className={styles.empty}>No files attached. Click "Add Files" to attach.</div>
      ) : (
        <div className={styles.list}>
          {files.map((f, i) => (
            <div key={i} className={`${styles.item}${f.path === '' ? ` ${styles.missing}` : ''}`}>
              <span className={styles.fileName}>{f.name}</span>
              {f.path === '' ? (
                <button className={styles.reattachBtn} onClick={() => handleReattach(i)}>
                  ⚠ File missing — click to re-attach
                </button>
              ) : (
                <span className={styles.fileMeta}>{f.mime} · {formatBytes(f.size)}</span>
              )}
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
