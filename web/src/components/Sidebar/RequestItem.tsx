import { useEffect, useRef, useState } from 'react';
import type { Request } from '../../lib/types';
import { getMethodColor, getMethodIcon } from '../../lib/utils';
import styles from './RequestItem.module.css';

function MethodIcon({ method }: { method: string }) {
  return (
    <span
      className={styles.fileIcon}
      style={{ color: getMethodColor(method as any) }}
      aria-hidden
    >
      {getMethodIcon(method as any)}
    </span>
  );
}

function PenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 8H2C1.72 8 1.5 7.78 1.5 7.5V2C1.5 1.72 1.72 1.5 2 1.5H7.5C7.78 1.5 8 1.72 8 2V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KeyboardIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <rect x="1" y="3" width="11" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 6.5h1M6 6.5h1M8.5 6.5h1M3.5 8.5h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ImportedIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-label="Imported"
      style={{ flexShrink: 0, color: 'var(--text-tertiary)', opacity: 0.7 }}
    >
      <title>Imported</title>
      <path d="M5 1v5M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 8h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

interface RequestItemProps {
  request: Request;
  isSelected: boolean;
  isEditing?: boolean;
  isExecuting?: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
  onRenameCommit?: (id: number, name: string) => void;
  onRenameCancel?: () => void;
  onRenameStart?: () => void;
  onDuplicate?: () => void;
  assignedShortcut?: string | null;
  onOpenShortcutModal?: () => void;
}

export function RequestItem({
  request,
  isSelected,
  isEditing,
  isExecuting,
  onSelect,
  onDelete,
  onRenameCommit,
  onRenameCancel,
  onRenameStart,
  onDuplicate,
  assignedShortcut,
  onOpenShortcutModal,
}: RequestItemProps) {
  const [draftName, setDraftName] = useState(request.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraftName(request.name);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, request.name]);

  const commit = () => {
    const trimmed = draftName.trim();
    onRenameCommit?.(request.id, trimmed || request.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onRenameCancel?.();
    }
  };

  return (
    <div
      className={`${styles.item} ${isSelected ? styles.selected : ''}`}
      onClick={() => !isEditing && onSelect(request.id)}
    >
      {isExecuting
        ? <span className={styles.executingDot} aria-label="Executing" />
        : <MethodIcon method={request.method} />}
      <div className={styles.content}>
        {isEditing ? (
          <input
            ref={inputRef}
            className={styles.nameInput}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        ) : (
          <div className={styles.name}>
            <span className={styles.nameText}>{request.name}</span>
            {request.imported && <ImportedIcon />}
            {request.files?.some(f => f.path === '') && (
              <span className={styles.missingBadge} title="Some attached files are missing — open request to re-attach">⚠</span>
            )}
            {assignedShortcut && <span className={styles.shortcutBadge}>{assignedShortcut}</span>}
          </div>
        )}
      </div>
      {!isEditing && (
        <>
          <button
            className={styles.keyboardBtn}
            onClick={(e) => { e.stopPropagation(); onOpenShortcutModal?.(); }}
            title="Assign shortcut"
          >
            <KeyboardIcon />
          </button>
          <button
            className={styles.editBtn}
            onClick={(e) => { e.stopPropagation(); onRenameStart?.(); }}
            title="Rename"
          >
            <PenIcon />
          </button>
          <button
            className={styles.copyBtn}
            onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
            title="Duplicate"
          >
            <CopyIcon />
          </button>
          <button
            className={styles.deleteBtn}
            onClick={(e) => onDelete(request.id, e)}
            title="Delete"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
              <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}
