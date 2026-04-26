import { useRef, useCallback, useState } from 'react';
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const editRowRef = useRef<HTMLDivElement>(null);

  // Pills for all non-readonly cases; hideActions suppresses edit/delete within pills
  const usePills = !readOnly;

  const handleKeyChange = (index: number, key: string) =>
    onChange(items.map((item, i) => (i === index ? { ...item, key } : item)));

  const handleValueChange = (index: number, value: string) =>
    onChange(items.map((item, i) => (i === index ? { ...item, value } : item)));

  const handleEnabledToggle = (index: number) =>
    onChange(items.map((item, i) => (i === index ? { ...item, enabled: !(item.enabled ?? true) } : item)));

  const handleAdd = () => {
    const newIndex = items.length;
    onChange([...items, { key: '', value: '', enabled: true }]);
    setEditingIndex(newIndex);
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    setConfirmIndex(null);
    if (editingIndex === index) setEditingIndex(null);
    else if (editingIndex !== null && editingIndex > index) setEditingIndex(editingIndex - 1);
  };

  const handleDeleteClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setEditingIndex(null);
    setConfirmIndex(index);
  };

  const handleEditBlur = useCallback(() => {
    setTimeout(() => {
      if (editRowRef.current && !editRowRef.current.contains(document.activeElement)) {
        setEditingIndex(null);
      }
    }, 0);
  }, []);

  // For rows mode: auto-focus key input of newly added row
  const newKeyRef = useRef<HTMLInputElement | null>(null);
  const prevLengthRef = useRef(items.length);
  // Sync ref after each render (not a hook call, just sync)
  if (items.length !== prevLengthRef.current) {
    if (items.length > prevLengthRef.current && !usePills) {
      // focus handled by newKeyRef
    }
    prevLengthRef.current = items.length;
  }

  if (readOnly && items.length === 0) {
    return <div className={styles.empty}>No items</div>;
  }

  return (
    <div className={naturalHeight ? styles.wrapNatural : styles.wrap}>
      <div className={naturalHeight ? styles.editorNatural : styles.editor}>
        <div className={usePills ? styles.pills : styles.rows}>
          {items.map((item, index) => {
            const lKey = item.key.toLowerCase();
            const isDisabled = !!(disabledKeys?.has(lKey));
            const isMarked = !isDisabled && !!(markedKeys?.has(lKey));
            const isEnabled = item.enabled ?? true;

            if (usePills && editingIndex !== index) {
              // Confirm-delete state
              if (!hideActions && confirmIndex === index) {
                return (
                  <div
                    key={index}
                    className={[styles.pill, styles.pillConfirm].join(' ')}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className={styles.pillConfirmLabel}>
                      Delete <strong>{item.key || 'this item'}</strong>?
                    </span>
                    <button
                      className={styles.pillConfirmYes}
                      onClick={() => handleRemove(index)}
                      autoFocus
                    >
                      Delete
                    </button>
                    <button
                      className={styles.pillConfirmNo}
                      onClick={() => setConfirmIndex(null)}
                    >
                      Cancel
                    </button>
                  </div>
                );
              }

              // Pill display mode
              const resolved = resolveTemplate(item.value, [...envVars, ...secrets]);
              const hasJwt = isJwt(resolved);
              return (
                <div
                  key={index}
                  className={[
                    styles.pill,
                    !isEnabled ? styles.pillOff : '',
                    isMarked ? styles.pillMarked : '',
                    isDisabled ? styles.pillDisabled : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => { if (!hideActions) { setConfirmIndex(null); setEditingIndex(index); } }}
                >
                  <button
                    className={`${styles.pillToggle} ${isEnabled ? styles.pillToggleOn : ''} ${hideActions ? styles.pillToggleReadOnly : ''}`}
                    onClick={!hideActions ? (e) => { e.stopPropagation(); handleEnabledToggle(index); } : (e) => e.stopPropagation()}
                    title={hideActions ? undefined : (isEnabled ? 'Disable' : 'Enable')}
                    tabIndex={-1}
                  />
                  <span className={styles.pillKey}>
                    {item.key || <em className={styles.pillPlaceholder}>key</em>}
                  </span>
                  <span className={styles.pillSep}>:</span>
                  <span className={styles.pillValue}>
                    {item.value || <em className={styles.pillPlaceholder}>empty</em>}
                  </span>
                  {hasJwt && <JwtBadge token={resolved} />}
                  {!hideActions && (
                    <button
                      className={styles.pillDelete}
                      onClick={(e) => handleDeleteClick(e, index)}
                      title="Delete"
                      tabIndex={-1}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            }

            // Edit row (rows mode, or pill currently being edited)
            const resolved = resolveTemplate(item.value, [...envVars, ...secrets]);
            return (
              <div
                key={index}
                ref={usePills && editingIndex === index ? editRowRef : null}
                className={[
                  usePills ? styles.editRow : styles.row,
                  isMarked ? styles.rowMarked : '',
                  isDisabled ? styles.rowDisabled : '',
                ].filter(Boolean).join(' ')}
                onBlur={usePills ? handleEditBlur : undefined}
              >
                {!readOnly && (
                  <button
                    className={`${styles.checkbox} ${isEnabled ? styles.checked : ''}`}
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
                  autoFocus={usePills && editingIndex === index}
                  ref={!usePills && index === items.length - 1 ? newKeyRef : null}
                  onKeyDown={(e) => {
                    if (usePills && e.key === 'Escape') setEditingIndex(null);
                  }}
                />
                <TemplateInput
                  value={item.value}
                  onChange={(value) => handleValueChange(index, value)}
                  placeholder="Value"
                  envVars={envVars}
                  secrets={secrets}
                  disabled={readOnly}
                />
                {isJwt(resolved) && <JwtBadge token={resolved} />}
                {!readOnly && !hideActions && (
                  <button
                    className={styles.deleteBtn}
                    onClick={(e) => handleDeleteClick(e, index)}
                    title="Delete"
                    tabIndex={-1}
                  >
                    <BinIcon />
                  </button>
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
