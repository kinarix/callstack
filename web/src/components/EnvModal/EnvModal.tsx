import { useState, useEffect, useRef } from 'react';
import type { Environment, KeyValue } from '../../lib/types';
import { KeyValueEditor } from '../RequestBuilder/KeyValueEditor';
import styles from './EnvModal.module.css';

interface EnvModalProps {
  env: Environment;
  onSave: (id: number, name: string, variables: KeyValue[]) => void;
  onDelete?: (id: number) => void;
  onClose: () => void;
}

export function EnvModal({ env, onSave, onClose }: EnvModalProps) {
  const [name, setName] = useState(env.name);
  const [variables, setVariables] = useState<KeyValue[]>(env.variables);
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(env.name);
    setVariables(env.variables);
  }, [env.id]);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  const handleSave = () => {
    const trimmed = name.trim() || env.name;
    onSave(env.id, trimmed, variables);
    onClose();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleSave();
    }
  };

  const handleNameCommit = () => {
    setEditingName(false);
    if (!name.trim()) setName(env.name);
  };

  return (
    <div className={styles.overlay} onMouseDown={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.titleRow}>
            {editingName ? (
              <input
                ref={nameInputRef}
                className={styles.nameInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleNameCommit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameCommit();
                  if (e.key === 'Escape') { setName(env.name); setEditingName(false); }
                }}
              />
            ) : (
              <button className={styles.nameBtn} onClick={() => setEditingName(true)} title="Rename">
                {name}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                  <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className={styles.body}>
          <KeyValueEditor items={variables} onChange={setVariables} />
        </div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.saveBtn} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
