import { useState, useRef, useCallback, useEffect } from 'react';
import type { LogEntry } from '../../lib/types';
import { useApp } from '../../context/AppContext';
import { getStatusColor, formatBytes } from '../../lib/utils';
import styles from './Footer.module.css';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd} ${h}:${m}:${s}`;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: select text
    }
  };

  return (
    <button className={styles.copyBtn} onClick={handleCopy} title="Copy curl command">
      {copied ? '✓' : 'Copy'}
    </button>
  );
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false);

  if (entry.kind === 'automation') {
    const [label, ...rest] = (entry.message ?? '').split('\n');
    const body = rest.join('\n').trim();
    return (
      <div className={`${styles.logRow} ${styles.logRowAutomation}`}>
        <div className={styles.logSummary} onClick={() => body ? setExpanded(e => !e) : undefined}>
          {body ? <span className={styles.logChevron}>{expanded ? '▾' : '▸'}</span> : <span className={styles.logChevronSpacer} />}
          <span className={styles.logTime}>{formatTimestamp(entry.timestamp)}</span>
          <span className={styles.logAutomationBadge}>automation</span>
          <span className={styles.logAutomationLabel}>{label}</span>
        </div>
        {expanded && body && (
          <div className={styles.logDetail}>
            <pre className={styles.curlPre}>{body}</pre>
          </div>
        )}
      </div>
    );
  }

  const statusColor = entry.status ? getStatusColor(entry.status) : '#6b7280';

  return (
    <div className={`${styles.logRow} ${entry.error ? styles.logRowError : ''}`}>
      <div className={styles.logSummary} onClick={() => setExpanded(e => !e)}>
        <span className={styles.logChevron}>{expanded ? '▾' : '▸'}</span>
        <span className={styles.logTime}>{formatTimestamp(entry.timestamp)}</span>
        <span className={`${styles.logMethod} ${styles[`method${entry.method}`]}`}>{entry.method}</span>
        <span className={styles.logUrl}>{entry.url}</span>
        {entry.error ? (
          <span className={styles.logError}>{entry.error}</span>
        ) : (
          <>
            <span className={styles.logStatus} style={{ backgroundColor: statusColor }}>
              {entry.status} {entry.statusText}
            </span>
            {entry.time != null && (
              <span className={styles.logMeta}>{entry.time}ms</span>
            )}
            {entry.size != null && (
              <span className={styles.logMeta}>{formatBytes(entry.size)}</span>
            )}
          </>
        )}
      </div>
      {expanded && (
        <div className={styles.logDetail}>
          <div className={styles.curlHeader}>
            <span className={styles.curlLabel}>curl</span>
            <CopyButton text={entry.curl ?? ''} />
          </div>
          <pre className={styles.curlPre}>{entry.curl}</pre>
        </div>
      )}
    </div>
  );
}

const MIN_HEIGHT = 80;
const MAX_HEIGHT = 500;
const DEFAULT_HEIGHT = 180;

export function Footer() {
  const { state, dispatch } = useApp();
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(() => {
    const v = localStorage.getItem('callstack.footerHeight');
    return v ? parseInt(v, 10) : DEFAULT_HEIGHT;
  });
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLogCount = useRef(state.logs.length);

  // Auto-scroll to bottom when new log arrives
  useEffect(() => {
    if (state.logs.length > prevLogCount.current && open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLogCount.current = state.logs.length;
  }, [state.logs.length, open]);


  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH - (ev.clientY - startY)));
      setHeight(h);
      localStorage.setItem('callstack.footerHeight', String(h));
    };
    const onUp = () => {
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [height]);

  return (
    <div className={styles.footer}>
      <div className={styles.footerHandle} onMouseDown={open ? startResize : undefined} />
      <div className={styles.footerBar} onClick={() => setOpen(o => !o)}>
        <span className={styles.footerTitle}>Logs</span>
        {state.logs.length > 0 && (
          <span className={styles.logCount}>{state.logs.length}</span>
        )}
        {!open && state.logs.length > 0 && (() => {
          const last = state.logs[state.logs.length - 1];
          if (last.kind === 'automation') {
            const label = (last.message ?? '').split('\n')[0];
            return (
              <span className={styles.lastRequestSummary}>
                <span className={styles.lastAutomationBadge}>automation</span>
                <span className={styles.lastUrl}>{label}</span>
              </span>
            );
          }
          return (
            <span className={styles.lastRequestSummary}>
              <span className={styles.lastMethod} style={{ color: `var(--accent-${(last.method ?? '').toLowerCase()}, var(--accent))` }}>{last.method}</span>
              <span className={styles.lastUrl}>{last.url}</span>
              {last.status != null && (
                <span className={styles.lastStatus} data-ok={last.status < 400}>{last.status}</span>
              )}
              {last.time != null && (
                <span className={styles.lastTime}>{last.time}ms</span>
              )}
            </span>
          );
        })()}
        <div className={styles.footerBarSpacer} />
        {open && state.logs.length > 0 && (
          <button
            className={styles.clearBtn}
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CLEAR_LOGS' }); }}
          >
            Clear
          </button>
        )}
        <button
          className={styles.expandCollapseBtn}
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
          title={open ? 'Collapse logs' : 'Expand logs'}
        >
          <svg
            className={`${styles.expandChevron} ${open ? styles.expandChevronOpen : ''}`}
            width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden
          >
            <path d="M2.5 7.5L6 4L9.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {open && (
        <div className={styles.logList} style={{ height }}>
          {state.logs.length === 0 ? (
            <div className={styles.emptyLogs}>No requests yet</div>
          ) : (
            <>
              {state.logs.map(entry => (
                <LogRow key={entry.id} entry={entry} />
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
