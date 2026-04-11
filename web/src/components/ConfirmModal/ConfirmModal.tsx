import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, children, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmModalProps) {
  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onCancel();
  };

  return (
    <div className={styles.overlay} onMouseDown={handleOverlay}>
      <div className={styles.modal}>
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
          <button className={styles.confirmBtn} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
