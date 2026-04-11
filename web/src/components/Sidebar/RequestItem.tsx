import { useEffect, useRef, useState } from 'react';
import type { Request } from '../../lib/types';
import { MethodBadge } from '../MethodBadge/MethodBadge';
import styles from './RequestItem.module.css';

function MethodIcon({ method }: { method: string }) {
  const baseProps = { width: '11', height: '13', viewBox: '0 0 11 13', fill: 'none', className: styles.fileIcon, 'aria-hidden': true };

  switch (method) {
    case 'GET':
      return (
        <svg {...baseProps}>
          <path d="M1.5 6.5L5 10L9.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.5 5.5V1.5H1.5V11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'POST':
      return (
        <svg {...baseProps}>
          <path d="M5.5 2V10M2 5.5H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="1.5" y="1.5" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case 'PUT':
      return (
        <svg {...baseProps}>
          <path d="M2 3.5H9M2 6.5H9M2 9.5H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <rect x="1.5" y="1.5" width="8" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case 'DELETE':
      return (
        <svg {...baseProps}>
          <path d="M3.5 4.5L7.5 8.5M7.5 4.5L3.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="5.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      );
    case 'PATCH':
      return (
        <svg {...baseProps}>
          <circle cx="5.5" cy="6.5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.5 4.5V8.5M3.5 6.5H7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...baseProps}>
          <path d="M2 1.5H6.5L9 4V11.5C9 11.78 8.78 12 8.5 12H2C1.72 12 1.5 11.78 1.5 11.5V2C1.5 1.72 1.72 1.5 2 1.5Z" stroke="currentColor" strokeWidth="1.2" />
          <path d="M6.5 1.5V4H9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
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

interface RequestItemProps {
  request: Request;
  isSelected: boolean;
  isEditing?: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number, e: React.MouseEvent) => void;
  onRenameCommit?: (id: number, name: string) => void;
  onRenameCancel?: () => void;
  onRenameStart?: () => void;
  onDuplicate?: () => void;
}

export function RequestItem({
  request,
  isSelected,
  isEditing,
  onSelect,
  onDelete,
  onRenameCommit,
  onRenameCancel,
  onRenameStart,
  onDuplicate,
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
      <MethodIcon method={request.method} />
      <MethodBadge method={request.method as any} />
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
          <div className={styles.name}>{request.name}</div>
        )}
      </div>
      {!isEditing && (
        <>
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
