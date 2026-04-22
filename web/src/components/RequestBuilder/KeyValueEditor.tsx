import { useRef, useEffect, useState } from 'react';
import type { KeyValue } from '../../lib/types';
import { BinIcon } from '../Sidebar/SidebarIcons';
import { TemplateInput } from './TemplateInput';
import { isJwt } from '../../lib/jwt';
import { JwtBadge } from '../JwtBadge/JwtBadge';
import { resolveTemplate } from '../../lib/template';
import styles from './KeyValueEditor.module.css';

interface KeyValueEditorProps {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  readOnly?: boolean;
  hideActions?: boolean;
  markedKeys?: Set<string>;
  disabledKeys?: Set<string>;
  envVars?: KeyValue[];
  secrets?: KeyValue[];
  naturalHeight?: boolean;
}

export function KeyValueEditor({
  items,
  onChange,
  readOnly = false,
  hideActions = false,
  markedKeys,
  disabledKeys,
  envVars = [],
  secrets = [],
  naturalHeight = false,
}: KeyValueEditorProps) {
  const handleKeyChange = (index: number, key: string) =>
    onChange(items.map((item, i) => (i === index ? { ...item, key } : item)));

  const handleValueChange = (index: number, value: string) =>
    onChange(items.map((item, i) => (i === index ? { ...item, value } : item)));

  const handleEnabledToggle = (index: number) =>
    onChange(items.map((item, i) => (i === index ? { ...item, enabled: !(item.enabled ?? true) } : item)));

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

  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    setConfirmIndex(null);
  };

  if (readOnly && items.length === 0) {
    return <div className={styles.empty}>No items</div>;
  }

  return (
    <div className={naturalHeight ? styles.wrapNatural : styles.wrap}>
      <div className={naturalHeight ? styles.editorNatural : styles.editor}>
        <div className={styles.rows}>
          {items.map((item, index) => {
            const lKey = item.key.toLowerCase();
            const isDisabled = !!(disabledKeys?.has(lKey));
            const isMarked = !isDisabled && !!(markedKeys?.has(lKey));
            return (
              <div key={index} className={`${styles.row} ${isMarked ? styles.rowMarked : ''} ${isDisabled ? styles.rowDisabled : ''}`}>
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
                <TemplateInput
                  value={item.value}
                  onChange={(value) => handleValueChange(index, value)}
                  placeholder="Value"
                  envVars={envVars}
                  secrets={secrets}
                  disabled={readOnly}
                />
                {(() => { const resolved = resolveTemplate(item.value, [...envVars, ...secrets]); return isJwt(resolved) && <JwtBadge token={resolved} />; })()}
                {!readOnly && !hideActions && (
                  confirmIndex === index ? (
                    <span className={styles.confirm}>
                      <button
                        className={styles.confirmYes}
                        onClick={() => handleRemove(index)}
                        title="Confirm delete"
                      >
                        Yes
                      </button>
                      <button
                        className={styles.confirmNo}
                        onClick={() => setConfirmIndex(null)}
                        title="Cancel"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => setConfirmIndex(index)}
                      title="Delete"
                      tabIndex={-1}
                    >
                      <BinIcon />
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
        {!readOnly && !hideActions && (
          <div className={styles.addRow}>
            <button className={styles.addBtn} onClick={handleAdd}>
              + Add
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
