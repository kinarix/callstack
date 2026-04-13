import { useEffect, useState, useCallback } from 'react';
import type { ActionShortcuts, Settings } from '../../hooks/useSettings';
import { formatShortcut } from '../../hooks/useSettings';
import styles from './SettingsModal.module.css';

const ZOOM_OPTIONS: { label: string; value: number }[] = [
  { label: 'Default (100%)', value: 1 },
  { label: 'Large (110%)', value: 1.1 },
  { label: 'Larger (125%)', value: 1.25 },
  { label: 'Huge (150%)', value: 1.5 },
];

const ACTION_LABELS: { key: keyof ActionShortcuts; label: string }[] = [
  { key: 'execute',      label: 'Execute request' },
  { key: 'rename',       label: 'Rename request' },
  { key: 'newRequest',   label: 'New request' },
  { key: 'copyResponse', label: 'Copy response' },
  { key: 'cloneRequest', label: 'Clone request' },
  { key: 'saveResponse', label: 'Save response' },
];

const BLOCKED_KEYS = new Set([
  'Escape', 'Tab', 'CapsLock', 'Meta', 'Control', 'Shift', 'Alt',
  'OS', 'AltGraph', 'ContextMenu',
]);

function captureShortcut(e: React.KeyboardEvent): string | null {
  if (BLOCKED_KEYS.has(e.key) || e.key.startsWith('F')) return null;
  const parts: string[] = [];
  if (e.metaKey) parts.push('Meta');
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.shiftKey) parts.push('Shift');
  if (e.altKey) parts.push('Alt');
  parts.push(e.key.toLowerCase());
  return parts.join('+');
}

interface SettingsModalProps {
  settings: Settings;
  onSetZoom: (zoom: number) => void;
  onSetShortcut: (action: keyof ActionShortcuts, value: string) => void;
  onReset?: () => void;
  onResetAll?: () => Promise<void>;
  onClose: () => void;
}

export function SettingsModal({ settings, onSetZoom, onSetShortcut, onReset, onResetAll, onClose }: SettingsModalProps) {
  const [recording, setRecording] = useState<keyof ActionShortcuts | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleResetAllClick = useCallback(() => {
    setConfirmingReset(true);
  }, []);

  const handleResetAllConfirm = useCallback(async () => {
    if (!onResetAll) return;
    setResetting(true);
    try {
      await onResetAll();
    } catch {
      setResetting(false);
      setConfirmingReset(false);
    }
  }, [onResetAll]);

  // Global capture-phase listener — intercepts keystrokes before App.tsx shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (recording) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') {
          setRecording(null);
          return;
        }
        const shortcut = captureShortcut(e as unknown as React.KeyboardEvent);
        if (shortcut) {
          onSetShortcut(recording, shortcut);
          setRecording(null);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording, onSetShortcut, onClose]);

  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className={styles.overlay} onMouseDown={handleOverlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Settings</span>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {/* ── Keyboard Shortcuts ─────────────────── */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Keyboard Shortcuts</div>
            <div className={styles.sectionDesc}>
              Shortcuts for the currently selected request.
            </div>
            <div className={styles.shortcutList}>
              {ACTION_LABELS.map(({ key, label }) => {
                const isRecording = recording === key;
                const current = settings.shortcuts[key];
                return (
                  <div key={key} className={styles.shortcutRow}>
                    <span className={styles.shortcutLabel}>{label}</span>
                    <button
                      className={`${styles.shortcutCapture} ${isRecording ? styles.isRecording : ''}`}
                      onClick={() => setRecording(key)}
                      title="Click and press a key combination to record"
                    >
                      {isRecording ? (
                        <span className={styles.recordingHint}>Press keys…</span>
                      ) : (
                        formatShortcut(current).split('+').map((part, i) => (
                          <kbd key={i} className={styles.kbdBadge}>{part}</kbd>
                        ))
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            {onReset && (
              <div className={styles.resetRow}>
                <button className={styles.resetBtn} onClick={onReset}>
                  Reset all to defaults
                </button>
              </div>
            )}
          </section>

          {/* ── Zoom ───────────────────────────────── */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Zoom</div>
            <div className={styles.sectionDesc}>
              Scale the entire UI for better readability.
            </div>
            <div className={styles.zoomOptions}>
              {ZOOM_OPTIONS.map(({ label, value }) => (
                <label key={value} className={`${styles.zoomOption} ${settings.zoom === value ? styles.zoomSelected : ''}`}>
                  <input
                    type="radio"
                    name="zoom"
                    value={value}
                    checked={settings.zoom === value}
                    onChange={() => onSetZoom(value)}
                    className={styles.zoomRadio}
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          {/* ── Danger Zone ──────────────────────────── */}
          {onResetAll && (
            <section className={styles.section}>
              <div className={styles.sectionTitle}>Danger Zone</div>
              {!confirmingReset ? (
                <div className={styles.dangerRow}>
                  <div className={styles.dangerInfo}>
                    <span className={styles.dangerLabel}>Reset all data</span>
                    <span className={styles.dangerDesc}>Permanently deletes all projects, requests, environments, and responses. The app will restart.</span>
                  </div>
                  <button className={styles.dangerBtn} onClick={handleResetAllClick}>
                    Reset
                  </button>
                </div>
              ) : (
                <div className={styles.dangerConfirm}>
                  <span className={styles.dangerConfirmText}>This cannot be undone. Are you sure?</span>
                  <div className={styles.dangerConfirmActions}>
                    <button
                      className={styles.dangerCancelBtn}
                      onClick={() => setConfirmingReset(false)}
                      disabled={resetting}
                    >
                      Cancel
                    </button>
                    <button
                      className={styles.dangerConfirmBtn}
                      onClick={handleResetAllConfirm}
                      disabled={resetting}
                    >
                      {resetting ? 'Resetting…' : 'Yes, reset everything'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
