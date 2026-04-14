import { useRef, useEffect } from 'react';
import type { KeyValue } from '../../lib/types';
import { BinIcon } from '../Sidebar/SidebarIcons';
import styles from './KeyValueEditor.module.css';

interface KeyValueEditorProps {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  readOnly?: boolean;
}

export function KeyValueEditor({
  items,
  onChange,
  readOnly = false,
}: KeyValueEditorProps) {
  const handleKeyChange = (index: number, key: string) => {
    const updated = [...items];
    updated[index].key = key;
    onChange(updated);
  };

  const handleValueChange = (index: number, value: string) => {
    const updated = [...items];
    updated[index].value = value;
    onChange(updated);
  };

  const handleEnabledToggle = (index: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], enabled: !(updated[index].enabled ?? true) };
    onChange(updated);
  };

  const newKeyRef = useRef<HTMLInputElement | null>(null);
  const prevLengthRef = useRef(items.length);

  useEffect(() => {
    if (items.length > prevLengthRef.current) {
      newKeyRef.current?.focus();
    }
    prevLengthRef.current = items.length;
  }, [items.length]);

  const handleAdd = () => {
    onChange([...items, { key: '', value: '', enabled: true }]);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  if (readOnly && items.length === 0) {
    return <div className={styles.empty}>No items</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.editor}>
        <div className={styles.rows}>
          {items.map((item, index) => (
            <div key={index} className={styles.row}>
              {!readOnly && (
                <button
                  className={`${styles.checkbox} ${item.enabled ?? true ? styles.checked : ''}`}
                  onClick={() => handleEnabledToggle(index)}
                  title="Toggle item"
                  tabIndex={-1}
                >
                  ✓
                </button>
              )}
              <input
                type="text"
                className={styles.input}
                placeholder="Key"
                value={item.key}
                onChange={(e) => handleKeyChange(index, e.target.value)}
                disabled={readOnly}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                ref={index === items.length - 1 ? newKeyRef : null}
              />
              <input
                type="text"
                className={styles.input}
                placeholder="Value"
                value={item.value}
                onChange={(e) => handleValueChange(index, e.target.value)}
                disabled={readOnly}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
              {!readOnly && (
                <button
                  className={styles.deleteBtn}
                  onClick={() => handleRemove(index)}
                  title="Delete"
                  tabIndex={-1}
                >
                  <BinIcon />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
      {!readOnly && (
        <div className={styles.addRow}>
          <button className={styles.addBtn} onClick={handleAdd}>
            + Add
          </button>
        </div>
      )}
    </div>
  );
}
