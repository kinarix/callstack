import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import type { KeyValue } from '../../lib/types';
import { BinIcon } from '../Sidebar/SidebarIcons';
import { TemplateInput } from './TemplateInput';
import { isJwt } from '../../lib/jwt';
import { JwtBadge } from '../JwtBadge/JwtBadge';
import { resolveTemplate } from '../../lib/template';
import styles from './KeyValueEditor.module.css';

const USER_AGENT_PRESETS = [
  { label: 'Callstack', value: 'Callstack/1.0' },
  { label: 'Chrome (macOS)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  { label: 'Chrome (Windows)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  { label: 'Safari (macOS)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15' },
  { label: 'Firefox', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0' },
  { label: 'Edge', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0' },
  { label: 'curl', value: 'curl/8.7.1' },
  { label: 'Python requests', value: 'python-requests/2.31.0' },
  { label: 'Postman', value: 'PostmanRuntime/7.37.0' },
];

interface KeyValueEditorProps {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  readOnly?: boolean;
  hideActions?: boolean;
  hideAdd?: boolean;
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
  hideAdd = false,
  markedKeys,
  disabledKeys,
  envVars = [],
  secrets = [],
  naturalHeight = false,
}: KeyValueEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [uaPresetsOpen, setUaPresetsOpen] = useState(false);
  const editRowRef = useRef<HTMLDivElement>(null);
  const uaDropdownRef = useRef<HTMLDivElement>(null);
  const allVars = useMemo(() => [...envVars, ...secrets], [envVars, secrets]);

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
        setUaPresetsOpen(false);
      }
    }, 0);
  }, []);

  useEffect(() => {
    if (!uaPresetsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (uaDropdownRef.current && !uaDropdownRef.current.contains(e.target as Node)) {
        setUaPresetsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [uaPresetsOpen]);

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
              const resolved = resolveTemplate(item.value, allVars);
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
            const resolved = resolveTemplate(item.value, allVars);
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
                  ref={!usePills && index === items.length - 1 ? newKeyRef : null}
                  onKeyDown={(e) => {
                    if (!usePills) return;
                    if (e.key === 'Escape' || e.key === 'Enter') {
                      setEditingIndex(null);
                    } else if (e.key === 'Tab' && e.shiftKey && index > 0) {
                      e.preventDefault();
                      setEditingIndex(index - 1);
                    }
                  }}
                />
                <TemplateInput
                  value={item.value}
                  onChange={(value) => handleValueChange(index, value)}
                  placeholder="Value"
                  envVars={envVars}
                  secrets={secrets}
                  disabled={readOnly}
                  autoFocus={usePills && editingIndex === index}
                  onKeyDown={(e) => {
                    if (!usePills) return;
                    if (e.key === 'Escape' || e.key === 'Enter') {
                      setEditingIndex(null);
                    } else if (e.key === 'Tab' && !e.shiftKey) {
                      e.preventDefault();
                      if (index + 1 < items.length) {
                        setEditingIndex(index + 1);
                      } else {
                        handleAdd();
                      }
                    }
                  }}
                />
                {usePills && editingIndex === index && item.key.toLowerCase() === 'user-agent' && (
                  <div className={styles.presetWrap} ref={uaDropdownRef}>
                    <button
                      className={`${styles.presetBtn} ${uaPresetsOpen ? styles.presetBtnOpen : ''}`}
                      onClick={() => setUaPresetsOpen(v => !v)}
                      title="User-Agent presets"
                      tabIndex={-1}
                      type="button"
                    >
                      Presets
                    </button>
                    {uaPresetsOpen && (
                      <div className={styles.presetDropdown}>
                        {USER_AGENT_PRESETS.map((p) => (
                          <button
                            key={p.label}
                            className={styles.presetOption}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleValueChange(index, p.value);
                              setUaPresetsOpen(false);
                            }}
                            type="button"
                          >
                            <span className={styles.presetLabel}>{p.label}</span>
                            <span className={styles.presetValue}>{p.value}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
        {!readOnly && !hideActions && !hideAdd && (
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
