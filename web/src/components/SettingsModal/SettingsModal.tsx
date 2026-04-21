import { useEffect, useState, useCallback } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';

declare const __APP_VERSION__: string;
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

interface DbStats {
  projects: number;
  requests: number;
  responses: number;
  folders: number;
  environments: number;
  automations: number;
  automation_runs: number;
  data_files: number;
  dbPath: string;
  dbSizeBytes: number;
  tableSizes: { name: string; sizeBytes: number }[];
}

interface LsEntry {
  key: string;
  size: number;
  value: string;
}

function readCallstackLocalStorage(): { entries: LsEntry[]; totalBytes: number } {
  const entries: LsEntry[] = [];
  let totalBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('callstack')) continue;
    const value = localStorage.getItem(key) ?? '';
    const size = new Blob([key + value]).size;
    entries.push({ key, size, value });
    totalBytes += size;
  }
  entries.sort((a, b) => a.key.localeCompare(b.key));
  return { entries, totalBytes };
}

type Tab = 'general' | 'data';

const HISTORY_LIMIT_OPTIONS: { label: string; value: number }[] = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: 'Unlimited', value: 0 },
];

interface SettingsModalProps {
  settings: Settings;
  onSetZoom: (zoom: number) => void;
  onSetShortcut: (action: keyof ActionShortcuts, value: string) => void;
  onSetResponseHistoryLimit: (limit: number) => void;
  onReset?: () => void;
  onResetAll?: () => Promise<void>;
  onClose: () => void;
}

export function SettingsModal({ settings, onSetZoom, onSetShortcut, onSetResponseHistoryLimit, onReset, onResetAll, onClose }: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('general');
  const [recording, setRecording] = useState<keyof ActionShortcuts | null>(null);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmClearUi, setConfirmClearUi] = useState(false);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [dbStatsError, setDbStatsError] = useState<string | null>(null);
  const [lsInfo, setLsInfo] = useState<{ entries: LsEntry[]; totalBytes: number }>(() => readCallstackLocalStorage());
  const [expandedLsKey, setExpandedLsKey] = useState<string | null>(null);
  const [copiedSnapshot, setCopiedSnapshot] = useState(false);
  const [copiedFullSnapshot, setCopiedFullSnapshot] = useState(false);
  const [copyingFull, setCopyingFull] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [compactDone, setCompactDone] = useState(false);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [historyCleared, setHistoryCleared] = useState(false);
  const [appVersion, setAppVersion] = useState<string>(() => {
    try { return (window as any).__APP_VERSION__ ?? __APP_VERSION__; } catch { return __APP_VERSION__; }
  });

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  // Load DB stats when opening the Data tab (and refresh each time)
  useEffect(() => {
    if (tab !== 'data') return;
    setDbStatsError(null);
    invoke<DbStats>('get_db_stats')
      .then(setDbStats)
      .catch((e) => setDbStatsError(String(e)));
    setLsInfo(readCallstackLocalStorage());
  }, [tab]);

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

  const handleCopySnapshot = useCallback(async () => {
    const snapshot: Record<string, unknown> = {
      capturedAt: new Date().toISOString(),
      appVersion,
      dbStats,
      localStorage: {} as Record<string, unknown>,
    };
    const ls = snapshot.localStorage as Record<string, unknown>;
    for (const entry of lsInfo.entries) {
      // Try to JSON-parse so the result is legible, fall back to raw string.
      try { ls[entry.key] = JSON.parse(entry.value); }
      catch { ls[entry.key] = entry.value; }
    }
    const json = JSON.stringify(snapshot, null, 2);
    try {
      await navigator.clipboard.writeText(json);
    } catch {
      try { await invoke('write_clipboard', { text: json }); } catch {}
    }
    setCopiedSnapshot(true);
    setTimeout(() => setCopiedSnapshot(false), 1500);
  }, [appVersion, dbStats, lsInfo]);

  const handleCopyFullSnapshot = useCallback(async () => {
    setCopyingFull(true);
    try {
      const dbDump = await invoke<Record<string, unknown>>('get_full_snapshot');
      const ls: Record<string, unknown> = {};
      for (const entry of lsInfo.entries) {
        try { ls[entry.key] = JSON.parse(entry.value); }
        catch { ls[entry.key] = entry.value; }
      }
      const snapshot = {
        capturedAt: new Date().toISOString(),
        appVersion,
        dbStats,
        localStorage: ls,
        db: dbDump,
      };
      const json = JSON.stringify(snapshot, null, 2);
      try { await navigator.clipboard.writeText(json); }
      catch { try { await invoke('write_clipboard', { text: json }); } catch {} }
      setCopiedFullSnapshot(true);
      setTimeout(() => setCopiedFullSnapshot(false), 1500);
    } catch {
      // swallow — button stays available for retry
    } finally {
      setCopyingFull(false);
    }
  }, [appVersion, dbStats, lsInfo]);

  const handleCompact = useCallback(async () => {
    setCompacting(true);
    setCompactDone(false);
    try {
      await invoke('compact_database');
      setCompactDone(true);
      setTimeout(() => setCompactDone(false), 2000);
      // Refresh stats to show updated sizes
      invoke<DbStats>('get_db_stats').then(setDbStats).catch(() => {});
    } catch {
      // swallow — button stays available for retry
    } finally {
      setCompacting(false);
    }
  }, []);

  const handleClearHistory = useCallback(async () => {
    setClearingHistory(true);
    try {
      await invoke('clear_response_history');
      setHistoryCleared(true);
      setConfirmClearHistory(false);
      setTimeout(() => setHistoryCleared(false), 2000);
      invoke<DbStats>('get_db_stats').then(setDbStats).catch(() => {});
    } catch {
      // swallow
    } finally {
      setClearingHistory(false);
    }
  }, []);

  const handleClearUiState = useCallback(() => {
    // Remove every localStorage key under the callstack namespace.
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('callstack')) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    setLsInfo(readCallstackLocalStorage());
    setConfirmClearUi(false);
    // Reload so AppContext reinitializes with the cleared state.
    window.location.reload();
  }, []);

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

        <div className={styles.tabBar}>
          <button
            className={`${styles.tab} ${tab === 'general' ? styles.tabActive : ''}`}
            onClick={() => setTab('general')}
          >
            General
          </button>
          <button
            className={`${styles.tab} ${tab === 'data' ? styles.tabActive : ''}`}
            onClick={() => setTab('data')}
          >
            Data
          </button>
        </div>

        <div className={styles.body}>
          {tab === 'general' && (
            <>
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

            </>
          )}

          {tab === 'data' && (
            <>
              <section className={styles.section}>
                <div className={styles.sectionTitle}>Response History</div>
                <div className={styles.sectionDesc}>
                  Number of responses to keep per request. Older entries are automatically removed when a new response is saved.
                </div>
                <div className={styles.historyLimitRow}>
                  <select
                    className={styles.historySelect}
                    value={settings.responseHistoryLimit}
                    onChange={(e) => onSetResponseHistoryLimit(Number(e.target.value))}
                  >
                    {HISTORY_LIMIT_OPTIONS.map(({ label, value }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <div className={styles.resetRow}>
                    {!confirmClearHistory ? (
                      <button
                        className={styles.resetBtn}
                        onClick={() => setConfirmClearHistory(true)}
                        disabled={historyCleared}
                      >
                        {historyCleared ? 'Cleared ✓' : 'Clear all history'}
                      </button>
                    ) : (
                      <div className={styles.dangerConfirmActions}>
                        <span className={styles.mutedText}>Deletes all saved responses.</span>
                        <button className={styles.dangerCancelBtn} onClick={() => setConfirmClearHistory(false)}>Cancel</button>
                        <button className={styles.dangerConfirmBtn} onClick={handleClearHistory} disabled={clearingHistory}>
                          {clearingHistory ? 'Clearing…' : 'Yes, clear'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionTitle}>Database</div>
                <div className={styles.sectionDesc}>
                  Contents of your local SQLite database.
                </div>
                {dbStatsError ? (
                  <div className={styles.errorText}>Failed to load: {dbStatsError}</div>
                ) : !dbStats ? (
                  <div className={styles.mutedText}>Loading…</div>
                ) : (
                  <>
                    <div className={styles.statsGrid}>
                      <div className={styles.statCell}><span className={styles.statLabel}>Projects</span><span className={styles.statValue}>{dbStats.projects}</span></div>
                      <div className={styles.statCell}><span className={styles.statLabel}>Folders</span><span className={styles.statValue}>{dbStats.folders}</span></div>
                      <div className={styles.statCell}><span className={styles.statLabel}>Requests</span><span className={styles.statValue}>{dbStats.requests}</span></div>
                      <div className={styles.statCell}><span className={styles.statLabel}>Responses</span><span className={styles.statValue}>{dbStats.responses}</span></div>
                      <div className={styles.statCell}><span className={styles.statLabel}>Environments</span><span className={styles.statValue}>{dbStats.environments}</span></div>
                      <div className={styles.statCell}><span className={styles.statLabel}>Data files</span><span className={styles.statValue}>{dbStats.data_files}</span></div>
                      <div className={styles.statCell}><span className={styles.statLabel}>Automations</span><span className={styles.statValue}>{dbStats.automations}</span></div>
                      <div className={styles.statCell}><span className={styles.statLabel}>Automation runs</span><span className={styles.statValue}>{dbStats.automation_runs}</span></div>
                      <div className={styles.statCell}><span className={styles.statLabel}>DB size</span><span className={styles.statValue}>{formatBytes(dbStats.dbSizeBytes)}</span></div>
                    </div>
                    {dbStats.tableSizes.length > 0 && (
                      <div className={styles.tableSizes}>
                        <div className={styles.tableSizesTitle}>Table sizes</div>
                        {dbStats.tableSizes.map((t) => (
                          <div key={t.name} className={styles.tableSizeRow}>
                            <span className={styles.tableSizeName}>{t.name}</span>
                            <span className={styles.tableSizeVal}>{formatBytes(t.sizeBytes)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className={styles.compactRow}>
                      <button className={styles.compactBtn} onClick={handleCompact} disabled={compacting}>
                        {compacting ? 'Compacting…' : compactDone ? 'Done' : 'Compact database'}
                      </button>
                      <span className={styles.compactDesc}>Runs VACUUM to reclaim space from deleted records</span>
                    </div>
                    <div className={styles.dbPathRow} title={dbStats.dbPath}>{dbStats.dbPath}</div>
                  </>
                )}
              </section>

              <section className={styles.section}>
                <div className={styles.sectionTitle}>UI State ({lsInfo.entries.length} keys, {formatBytes(lsInfo.totalBytes)})</div>
                <div className={styles.sectionDesc}>
                  Per-user interface state stored in localStorage (tabs, panel sizes, last-selected items, etc.).
                </div>
                <div className={styles.lsList}>
                  {lsInfo.entries.map((e) => (
                    <div key={e.key} className={styles.lsRow}>
                      <button
                        className={styles.lsRowHead}
                        onClick={() => setExpandedLsKey(expandedLsKey === e.key ? null : e.key)}
                      >
                        <span className={styles.lsKey}>{e.key}</span>
                        <span className={styles.lsSize}>{formatBytes(e.size)}</span>
                      </button>
                      {expandedLsKey === e.key && (
                        <pre className={styles.lsValue}>{e.value.length > 500 ? e.value.slice(0, 500) + '…' : e.value}</pre>
                      )}
                    </div>
                  ))}
                  {lsInfo.entries.length === 0 && (
                    <div className={styles.mutedText}>No UI state stored.</div>
                  )}
                </div>
                <div className={styles.resetRow}>
                  {!confirmClearUi ? (
                    <button className={styles.resetBtn} onClick={() => setConfirmClearUi(true)}>
                      Clear UI state
                    </button>
                  ) : (
                    <div className={styles.dangerConfirmActions}>
                      <span className={styles.mutedText}>Clears all UI state and reloads. Data is not affected.</span>
                      <button className={styles.dangerCancelBtn} onClick={() => setConfirmClearUi(false)}>Cancel</button>
                      <button className={styles.dangerConfirmBtn} onClick={handleClearUiState}>Yes, clear</button>
                    </div>
                  )}
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.debugHeader}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className={styles.debugIcon}>
                    <path d="M8 1v2M8 13v2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M1 8h2M13 8h2M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    <rect x="5" y="5" width="6" height="7" rx="2" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                    <path d="M7 8h2M7 10h2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                  </svg>
                  <div className={styles.sectionTitle}>Debug</div>
                </div>
                <div className={styles.sectionDesc}>
                  For debugging purposes only. Share the snapshot with support or paste it when reporting state-related issues.
                </div>
                <div className={styles.debugBtnRow}>
                  <button
                    className={styles.resetBtn}
                    onClick={handleCopySnapshot}
                    title="Copy DB stats and all UI state as JSON (small, safe to share)"
                  >
                    {copiedSnapshot ? 'Copied ✓' : 'Copy UI snapshot'}
                  </button>
                  <button
                    className={styles.resetBtn}
                    onClick={handleCopyFullSnapshot}
                    disabled={copyingFull}
                    title="Copy everything including full database contents (may be large)"
                  >
                    {copiedFullSnapshot ? 'Copied ✓' : copyingFull ? 'Copying…' : 'Copy full snapshot (with DB)'}
                  </button>
                </div>
              </section>

              {onResetAll && (
                <section className={styles.section}>
                  <div className={styles.sectionTitle}>Danger Zone</div>
                  {!confirmingReset ? (
                    <div className={styles.dangerRow}>
                      <div className={styles.dangerInfo}>
                        <span className={styles.dangerLabel}>Reset all data</span>
                        <span className={styles.dangerDesc}>Permanently deletes all projects, requests, environments, automations and responses. The app will restart.</span>
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
            </>
          )}

        </div>

        <div className={styles.footer}>v{appVersion}</div>
      </div>
    </div>
  );
}
