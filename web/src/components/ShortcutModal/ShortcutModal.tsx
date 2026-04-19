import { useState, useEffect } from 'react';
import type { Request } from '../../lib/types';
import styles from './ShortcutModal.module.css';

const F_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];

interface ShortcutModalProps {
  requestId: number;
  shortcuts: { [fkey: string]: number };
  requests: Request[];
  onAssign: (fkey: string) => void;
  onRemove: () => void;
  onClose: () => void;
}

export function ShortcutModal({ requestId, shortcuts, requests, onAssign, onRemove, onClose }: ShortcutModalProps) {
  const [conflictFkey, setConflictFkey] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleFkeyClick = (fkey: string) => {
    const ownerId = shortcuts[fkey];
    if (ownerId === requestId) {
      // Already assigned to this request — remove it
      onRemove();
    } else if (ownerId != null) {
      // Assigned to another request — show conflict
      setConflictFkey(fkey);
    } else {
      onAssign(fkey);
    }
  };

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const conflictRequestName = conflictFkey
    ? (requests.find((r) => r.id === shortcuts[conflictFkey])?.name ?? 'Unknown')
    : '';

  return (
    <div className={styles.overlay} onMouseDown={handleOverlay}>
      <div className={styles.modal}>
        {conflictFkey ? (
          <>
            <div className={styles.header}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.warnIcon} aria-hidden>
                <path d="M8 2L14.5 13.5H1.5L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
              </svg>
              <span className={styles.title}>Key already assigned</span>
            </div>
            <div className={styles.conflictBody}>
              <strong>{conflictFkey}</strong> is already assigned to <strong>{conflictRequestName}</strong>. Reassign it to this request?
            </div>
            <div className={styles.conflictFooter}>
              <button className={styles.cancelBtn} onClick={() => setConflictFkey(null)}>Cancel</button>
              <button className={styles.reassignBtn} onClick={() => { onAssign(conflictFkey); }}>Reassign</button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.header}>
              <span className={styles.title}>Assign F-key shortcut</span>
            </div>
            <div className={styles.grid}>
              {F_KEYS.map((fkey) => {
                const ownerId = shortcuts[fkey];
                const isSelf = ownerId === requestId;
                const isOther = ownerId != null && !isSelf;
                return (
                  <button
                    key={fkey}
                    className={`${styles.fkey} ${isSelf ? styles.fkeySelf : ''} ${isOther ? styles.fkeyOther : ''}`}
                    onClick={() => handleFkeyClick(fkey)}
                    title={isOther ? `Assigned to "${requests.find((r) => r.id === ownerId)?.name}"` : isSelf ? 'Currently assigned to this request' : ''}
                  >
                    {fkey}
                  </button>
                );
              })}
            </div>
            {Object.values(shortcuts).includes(requestId) && (
              <div className={styles.hint}>Click the highlighted key again to remove the shortcut.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
