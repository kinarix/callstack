import { useEffect, useState, useCallback, useRef } from 'react';
import { useDatabase } from '../../hooks/useDatabase';
import type { HistoryEntry } from '../../hooks/useDatabase';
import { getMethodColor, getStatusColor } from '../../lib/utils';
import styles from './HistoryPanel.module.css';

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 4.5V8L10.5 10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden
      style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s ease' }}
    >
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatTimestamp(ms: number): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface HistoryPanelProps {
  onSelectRequest: (requestId: number, responseId: number) => void;
  refreshSignal?: number;
}

export function HistoryPanel({ onSelectRequest, refreshSignal }: HistoryPanelProps) {
  const { getAllResponseHistory } = useDatabase();
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem('callstack.historyPanelOpen') !== 'false'; }
    catch { return true; }
  });
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [listHeight, setListHeight] = useState(() => {
    try {
      const v = localStorage.getItem('callstack.historyPanelHeight');
      return v ? Math.max(60, Math.min(600, parseInt(v, 10))) : 220;
    } catch { return 220; }
  });
  const listHeightRef = useRef(listHeight);
  listHeightRef.current = listHeight;

  const load = useCallback(async () => {
    try {
      const rows = await getAllResponseHistory();
      setEntries(rows);
    } catch { /* ignore */ }
  }, [getAllResponseHistory]);

  useEffect(() => {
    load();
  }, [load, refreshSignal]);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      localStorage.setItem('callstack.historyPanelOpen', String(next));
      return next;
    });
  };

  const handleDragMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = listHeightRef.current;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      const next = Math.max(60, Math.min(600, startHeight + delta));
      setListHeight(next);
    };

    const onMouseUp = () => {
      localStorage.setItem('callstack.historyPanelHeight', String(listHeightRef.current));
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className={styles.panel}>
      <div
        className={styles.dragHandle}
        onMouseDown={handleDragMouseDown}
        title="Drag to resize"
      />
      <button className={styles.header} onClick={handleToggle} aria-expanded={open}>
        <span className={styles.headerIcon}><ClockIcon /></span>
        <span className={styles.headerTitle}>History</span>
        {entries.length > 0 && (
          <span className={styles.count}>{entries.length}</span>
        )}
        <span className={styles.chevron}><ChevronIcon open={open} /></span>
      </button>
      <div className={styles.headerSeparator} />

      {open && (
        <>
          <div className={styles.list} style={{ maxHeight: listHeight }}>
          {entries.length === 0 ? (
            <div className={styles.empty}>No history yet</div>
          ) : (
            entries.map((entry) => (
              <button
                key={entry.id}
                className={styles.row}
                onClick={() => onSelectRequest(entry.requestId, entry.id)}
                title={`${entry.requestMethod} ${entry.requestUrl}`}
              >
                <span
                  className={styles.method}
                  style={{ color: getMethodColor(entry.requestMethod as any) }}
                >
                  {entry.requestMethod.length > 4
                    ? entry.requestMethod.slice(0, 3)
                    : entry.requestMethod}
                </span>
                <span className={styles.name}>{entry.requestName}</span>
                <span
                  className={styles.status}
                  style={{ color: getStatusColor(entry.status) }}
                >
                  {entry.status}
                </span>
                <span className={styles.time}>
                  {formatTimestamp(entry.timestampMs)}
                </span>
              </button>
            ))
          )}
          </div>
        </>
      )}
    </div>
  );
}
