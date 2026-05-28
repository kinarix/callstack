import { useEffect, useRef } from 'react';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  tone?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, children, confirmLabel = 'Delete', tone = 'danger', onConfirm, onCancel }: ConfirmModalProps) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
    };
    window.addEventListener('keydown', handler, true);
    confirmBtnRef.current?.focus();
    return () => window.removeEventListener('keydown', handler, true);
  }, [onCancel, onConfirm]);

  return (
    <div className={styles.overlay} onMouseDown={handleOverlay}>
      <div className={`${styles.modal} ${tone === 'warning' ? styles.warningTone : ''}`}>
        <div className={styles.header}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={styles.warnIcon} aria-hidden>
            <path d="M8 2L14.5 13.5H1.5L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.6" fill="currentColor" />
          </svg>
          <span className={styles.title}>{title}</span>
        </div>
        <div className={styles.body}>{children}</div>
        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button ref={confirmBtnRef} className={styles.confirmBtn} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
