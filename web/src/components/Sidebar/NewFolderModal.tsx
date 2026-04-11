import { useState, useEffect, useRef } from 'react';
import styles from './NewProjectModal.module.css';

interface NewFolderModalProps {
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function NewFolderModal({ onConfirm, onCancel }: NewFolderModalProps) {
  const [name, setName] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>New Folder</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.body}>
            <div className={styles.field}>
              <label className={styles.label}>Name</label>
              <input
                ref={nameRef}
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Folder name"
                onKeyDown={(e) => e.key === 'Escape' && onCancel()}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          </div>
          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className={styles.createBtn} disabled={!name.trim()}>
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
