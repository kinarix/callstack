import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { Request, KeyValue, WsStatus, WsMessage } from '../../lib/types';
import { useWebSocket } from '../../hooks/useWebSocket';
import { resolveTemplate } from '../../lib/template';
import { applySchemeIfMissing, getUrlScheme, stripScheme } from '../../lib/utils';
import styles from './WebSocketView.module.css';

interface WebSocketViewProps {
  request: Request;
  envVars?: KeyValue[];
  secrets?: KeyValue[];
}

interface StatusEvent {
  requestId: number;
  status: WsStatus;
  detail: string;
}

/** Wall-clock time of a frame, millisecond precision (e.g. 14:30:45.123). */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

/** Elapsed time since the previous frame, for reading round-trip latency. */
function formatDelta(ms: number): string {
  if (ms < 1000) return `+${ms}ms`;
  return `+${(ms / 1000).toFixed(2)}s`;
}

const STATUS_LABEL: Record<WsStatus, string> = {
  connecting: 'Connecting',
  open: 'Connected',
  closing: 'Closing',
  closed: 'Disconnected',
  error: 'Error',
  reconnecting: 'Reconnecting',
};

export function WebSocketView({ request, envVars = [], secrets = [] }: WebSocketViewProps) {
  const { wsConnect, wsSend, wsClose, wsListOpen } = useWebSocket();
  const requestId = request.id;

  const [status, setStatus] = useState<WsStatus>('closed');
  const [detail, setDetail] = useState('');
  const [messages, setMessages] = useState<(WsMessage & { _k: number })[]>([]);
  const [draft, setDraft] = useState('');
  const [showPing, setShowPing] = useState(false);
  const seq = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const vars = [...envVars, ...secrets];
  const isLive = status === 'open' || status === 'connecting' || status === 'reconnecting';
  const visibleMessages = showPing
    ? messages
    : messages.filter((m) => m.kind !== 'ping' && m.kind !== 'pong');

  // Seed status from the backend registry (covers navigating back to an open socket).
  useEffect(() => {
    let cancelled = false;
    wsListOpen().then((ids) => {
      if (!cancelled && ids.includes(requestId)) setStatus('open');
    });
    return () => { cancelled = true; };
  }, [requestId, wsListOpen]);

  useEffect(() => {
    const unlistens: Array<() => void> = [];
    let cancelled = false;

    listen<StatusEvent>('ws-status', (e) => {
      if (e.payload.requestId !== requestId) return;
      setStatus(e.payload.status);
      setDetail(e.payload.detail ?? '');
    }).then((fn) => { if (cancelled) fn(); else unlistens.push(fn); });

    listen<WsMessage>('ws-message', (e) => {
      if (e.payload.requestId !== requestId) return;
      const k = ++seq.current;
      setMessages((prev) => [...prev, { ...e.payload, _k: k }]);
    }).then((fn) => { if (cancelled) fn(); else unlistens.push(fn); });

    return () => {
      cancelled = true;
      unlistens.forEach((fn) => fn());
    };
  }, [requestId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, showPing]);

  const handleConnect = () => {
    const wsScheme = getUrlScheme(request.url) ?? 'wss';
    const url = applySchemeIfMissing(resolveTemplate(stripScheme(request.url), vars), wsScheme);
    const headers = request.headers.map((h) => ({ ...h, value: resolveTemplate(h.value, vars) }));
    wsConnect(requestId, url, headers).catch((err) => {
      setStatus('error');
      setDetail(String(err));
    });
  };

  const handleDisconnect = () => {
    wsClose(requestId).catch(() => {});
  };

  const handleSend = () => {
    if (!draft || !isLive) return;
    wsSend(requestId, draft).catch(() => {});
    setDraft('');
  };

  return (
    <div className={styles.view}>
      <div className={styles.toolbar}>
        <span className={`${styles.status} ${styles[`status_${status}`] ?? ''}`}>
          <span className={styles.dot} />
          {STATUS_LABEL[status]}
        </span>
        {detail && <span className={styles.detail} title={detail}>{detail}</span>}
        <div className={styles.spacer} />
        <label className={styles.pingToggle} title="Show ping/pong heartbeat frames">
          <input
            type="checkbox"
            checked={showPing}
            onChange={(e) => setShowPing(e.target.checked)}
          />
          <span>Show ping</span>
        </label>
        {isLive ? (
          <button className={`${styles.connBtn} ${styles.disconnect}`} onClick={handleDisconnect}>
            Disconnect
          </button>
        ) : (
          <button className={styles.connBtn} onClick={handleConnect} disabled={!request.url.trim()}>
            Connect
          </button>
        )}
      </div>

      <div className={styles.transcript} ref={scrollRef}>
        {visibleMessages.length === 0 ? (
          <div className={styles.empty}>
            {messages.length === 0
              ? 'No messages yet. Connect and send a frame.'
              : 'Only ping/pong frames so far. Enable “Show ping” to see them.'}
          </div>
        ) : (
          visibleMessages.map((m, i) => {
            const prev = visibleMessages[i - 1];
            return (
              <div key={m._k} className={`${styles.msg} ${styles[`dir_${m.direction}`] ?? ''}`}>
                <span className={styles.arrow}>
                  {m.direction === 'out' ? '↑' : m.direction === 'in' ? '↓' : '•'}
                </span>
                <span className={styles.kind}>{m.kind}</span>
                <span className={styles.data}>{m.data}</span>
                <span className={styles.time} title={new Date(m.ts).toLocaleString()}>
                  {formatTime(m.ts)}
                  {prev && <span className={styles.delta}>{formatDelta(m.ts - prev.ts)}</span>}
                </span>
                <span className={styles.meta}>{m.size}B</span>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.composer}>
        <textarea
          className={styles.input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={isLive ? 'Type a message — Enter to send, Shift+Enter for newline' : 'Connect to send messages'}
          disabled={!isLive}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button className={styles.sendBtn} onClick={handleSend} disabled={!isLive || !draft}>
          Send
        </button>
      </div>
    </div>
  );
}
