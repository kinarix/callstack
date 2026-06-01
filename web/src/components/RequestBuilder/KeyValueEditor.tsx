import { useRef, useCallback, useState, useEffect, useMemo } from 'react';
import type { KeyValue } from '../../lib/types';
import { BinIcon } from '../Sidebar/SidebarIcons';
import { TemplateInput } from './TemplateInput';
import { TemplateText } from './TemplateText';
import { isJwt } from '../../lib/jwt';
import { JwtBadge } from '../JwtBadge/JwtBadge';
import { resolveTemplate } from '../../lib/template';
import { getHeaderPresets } from '../../lib/headerPresets';
import styles from './KeyValueEditor.module.css';

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
  keySuggestions?: string[];
  disallowDuplicateKeys?: boolean;
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
  keySuggestions,
  disallowDuplicateKeys = false,
}: KeyValueEditorProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [justAddedIndex, setJustAddedIndex] = useState<number | null>(null);
  const editRowRef = useRef<HTMLDivElement>(null);
  const presetDropdownRef = useRef<HTMLDivElement>(null);
  const newKeyInputRef = useRef<HTMLInputElement | null>(null);
  const allVars = useMemo(() => [...envVars, ...secrets], [envVars, secrets]);
  const datalistId = useMemo(
    () => keySuggestions && keySuggestions.length > 0 ? `kv-key-suggest-${Math.random().toString(36).slice(2, 9)}` : undefined,
    [keySuggestions],
  );
  const dupKeys = useMemo(() => {
    if (!disallowDuplicateKeys) return new Set<string>();
    const seen = new Map<string, number>();
    for (const it of items) {
      const k = it.key.trim().toLowerCase();
      if (!k) continue;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k));
  }, [items, disallowDuplicateKeys]);

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
    setJustAddedIndex(newIndex);
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
        setPresetsOpen(false);
      }
    }, 0);
  }, []);

  useEffect(() => {
    if (!presetsOpen) return;
    const onDown = (e: MouseEvent) => {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(e.target as Node)) {
        setPresetsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [presetsOpen]);

  useEffect(() => {
    setPresetsOpen(false);
  }, [editingIndex]);

  useEffect(() => {
    if (justAddedIndex !== null) {
      newKeyInputRef.current?.focus();
      setJustAddedIndex(null);
    }
  }, [justAddedIndex]);

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
            const isDup = !isDisabled && dupKeys.has(item.key.trim().toLowerCase());
            const isMarked = !isDup && !isDisabled && !!(markedKeys?.has(lKey));
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
                    isDup ? styles.pillDup : '',
                  ].filter(Boolean).join(' ')}
                  title={isDup ? `Duplicate key — "${item.key}" is already defined` : undefined}
                  onClick={() => { if (!hideActions) { setConfirmIndex(null); setEditingIndex(index); } }}
                >
                  <button
                    className={`${styles.pillToggle} ${isEnabled ? styles.pillToggleOn : ''} ${hideActions ? styles.pillToggleReadOnly : ''}`}
                    onClick={!hideActions ? (e) => { e.stopPropagation(); handleEnabledToggle(index); } : (e) => e.stopPropagation()}
                    title={hideActions ? undefined : (isEnabled ? 'Disable' : 'Enable')}
                    tabIndex={-1}
                  />
                  <span className={styles.pillKey} title={item.key || undefined}>
                    {item.key || <em className={styles.pillPlaceholder}>key</em>}
                  </span>
                  <span className={styles.pillSep}>:</span>
                  {item.value ? (
                    <TemplateText
                      value={item.value}
                      envVars={envVars}
                      secrets={secrets}
                      className={styles.pillValue}
                    />
                  ) : (
                    <span className={styles.pillValue}>
                      <em className={styles.pillPlaceholder}>empty</em>
                    </span>
                  )}
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
                  isDup ? styles.rowDup : '',
                ].filter(Boolean).join(' ')}
                title={isDup ? `Duplicate key — "${item.key}" is already defined` : undefined}
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
                  title={item.key || undefined}
                  onChange={(e) => handleKeyChange(index, e.target.value)}
                  onFocus={(e) => {
                    const el = e.currentTarget;
                    setTimeout(() => el.select(), 0);
                  }}
                  disabled={readOnly}
                  list={datalistId}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  ref={(el) => {
                    if (index === justAddedIndex) newKeyInputRef.current = el;
                    if (!usePills && index === items.length - 1) newKeyRef.current = el;
                  }}
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
                  selectOnFocus
                  showTitle
                  autoFocus={usePills && editingIndex === index && justAddedIndex !== index}
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
                {usePills && editingIndex === index && (() => {
                  const presets = getHeaderPresets(item.key);
                  if (!presets) return null;
                  return (
                    <div className={styles.presetWrap} ref={presetDropdownRef}>
                      <button
                        className={`${styles.presetBtn} ${presetsOpen ? styles.presetBtnOpen : ''}`}
                        onClick={() => setPresetsOpen(v => !v)}
                        title={`${item.key} presets`}
                        tabIndex={-1}
                        type="button"
                      >
                        Presets
                      </button>
                      {presetsOpen && (
                        <div className={styles.presetDropdown}>
                          {presets.map((p) => (
                            <button
                              key={p.label}
                              className={styles.presetOption}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleValueChange(index, p.value);
                                setPresetsOpen(false);
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
                  );
                })()}
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
        {disallowDuplicateKeys && dupKeys.size > 0 && (
          <div className={styles.dupNotice}>
            Duplicate keys not allowed: {[...dupKeys].join(', ')}
          </div>
        )}
        {!readOnly && !hideActions && !hideAdd && (
          <div className={styles.addRow}>
            <button className={styles.addBtn} onClick={handleAdd}>
              + Add
            </button>
          </div>
        )}
        {datalistId && (
          <datalist id={datalistId}>
            {keySuggestions!.map((name) => <option key={name} value={name} />)}
          </datalist>
        )}
      </div>
    </div>
  );
}
