import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { EditorView } from '@codemirror/view';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { useApp } from '../../context/AppContext';
import { useDatabase } from '../../hooks/useDatabase';
import { useReplayServer } from '../../hooks/useReplayServer';
import { useReplayControls } from '../../hooks/useReplayControls';
import { useSettings } from '../../hooks/useSettings';
import type { ReplayHit, PausedRequest } from '../../lib/types';
import { formatBody } from '../../lib/formatBody';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import { CopyIcon } from '../Sidebar/SidebarIcons';
import styles from './ReplayView.module.css';

const replayHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.integer, tags.float], color: 'var(--syntax-number)' },
  { tag: [tags.bool, tags.null], color: 'var(--syntax-bool)' },
  { tag: tags.propertyName, color: 'var(--syntax-property)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
]);

const replayEditorTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', fontSize: '12px' },
  '.cm-content': { fontFamily: "'JetBrains Mono', monospace" },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--text-tertiary)' },
  '&.cm-focused': { outline: 'none' },
});

const replayBodyExtensions = [replayEditorTheme, syntaxHighlighting(replayHighlight), EditorView.lineWrapping];
const replayJsonExtensions = [json(), ...replayBodyExtensions];

function OpenRequestIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M8 2h4v4M12 2L6.5 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 8.5V11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  replayId: number;
  showExpandBtn?: boolean;
  onExpand?: () => void;
}

/** Path (+ query) portion of a request URL, tolerant of {{template}} hosts. */
function derivePath(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname || '/') + u.search;
  } catch {
    const s = url.trim();
    const proto = s.indexOf('://');
    const rest = proto >= 0 ? s.slice(proto + 3) : s;
    const slash = rest.indexOf('/');
    return slash >= 0 ? rest.slice(slash) : '/';
  }
}

function extractCookies(headers: [string, string][]): [string, string][] {
  const cookieHeader = headers.find(([k]) => k.toLowerCase() === 'cookie');
  if (!cookieHeader) return [];
  return cookieHeader[1]
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const eq = p.indexOf('=');
      return eq >= 0 ? [p.slice(0, eq), p.slice(eq + 1)] : [p, ''];
    });
}

export default function ReplayView({ replayId, showExpandBtn, onExpand }: Props) {
  const { state, dispatch } = useApp();
  const { updateReplay, createRequest, updateRequest, listReplayHits, clearReplayHits } = useDatabase();
  const { startReplay, stopReplay, setReplayPaused, resumeReplay } = useReplayServer();
  const { startAll } = useReplayControls();
  const { settings } = useSettings();
  const hitLimit = settings.replayHitLimit;

  const replay = state.replays.find((r) => r.id === replayId);
  const request = replay ? state.requests.find((r) => r.id === replay.requestId) : undefined;
  const running = replay ? state.runningReplayIds.has(replay.id) : false;

  const [portInput, setPortInput] = useState(String(replay?.port ?? 9090));
  const [hits, setHits] = useState<(ReplayHit & { _k: number })[]>([]);
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const hitSeq = useRef(0);
  const selectNextHitRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const pauseMode = replay ? state.pausedReplayIds.has(replay.id) : false;
  const currentPause = replay ? (state.activePauses[replay.id] ?? null) : null;

  useEffect(() => {
    setPortInput(String(replay?.port ?? 9090));
  }, [replay?.id, replay?.port]);

  useEffect(() => {
    let cancelled = false;
    setHits([]);
    setSelectedKey(null);
    listReplayHits(replayId)
      .then((rows) => {
        if (cancelled) return;
        setHits(rows.map((h) => ({ ...h, _k: ++hitSeq.current })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [replayId, listReplayHits]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    listen<ReplayHit>('replay-hit', (e) => {
      if (e.payload.replayId !== replayId) return;
      const k = ++hitSeq.current;
      setHits((prev) => [{ ...e.payload, _k: k }, ...prev].slice(0, hitLimit > 0 ? hitLimit : 1000));
      if (selectNextHitRef.current) {
        setSelectedKey(k);
        selectNextHitRef.current = false;
      }
    }).then((fn) => {
      // If the effect was already cleaned up before the listener registered
      // (e.g. React StrictMode double-invoke), detach immediately to avoid a
      // duplicate listener that would double-count every hit.
      if (cancelled) fn();
      else unlisten = fn;
    });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [replayId, hitLimit]);

  // Capture pause/resume for the open replay directly (App also listens for
  // cross-view auto-open; dispatching the same global action is idempotent).
  useEffect(() => {
    const unlistens: Array<() => void> = [];
    let cancelled = false;
    listen<PausedRequest>('replay-paused', (e) => {
      if (e.payload.replayId !== replayId) return;
      dispatch({ type: 'SET_ACTIVE_PAUSE', payload: { replayId, pause: e.payload } });
    }).then((fn) => { if (cancelled) fn(); else unlistens.push(fn); });
    listen<{ replayId: number; pauseId: number }>('replay-resumed', (e) => {
      if (e.payload.replayId !== replayId) return;
      dispatch({ type: 'SET_ACTIVE_PAUSE', payload: { replayId, pause: null } });
    }).then((fn) => { if (cancelled) fn(); else unlistens.push(fn); });
    return () => { cancelled = true; unlistens.forEach((u) => u()); };
  }, [replayId, dispatch]);

  if (!replay) return null;

  const path = request ? derivePath(request.url) : '/';
  const method = request?.method ?? 'GET';
  const localUrl = `http://127.0.0.1:${replay.port}${path}`;
  const selected = hits.find((h) => h._k === selectedKey) ?? null;

  const persistPort = async () => {
    const p = parseInt(portInput, 10);
    if (!Number.isFinite(p) || p < 1 || p > 65535) {
      setPortInput(String(replay.port));
      return;
    }
    if (p === replay.port) return;
    const updated = await updateReplay(replay.id, replay.name, p);
    dispatch({ type: 'UPDATE_REPLAY', payload: updated });
    if (running) {
      setErr(null);
      await stopReplay(replay.id).catch(() => {});
      try {
        await startReplay(replay.id, replay.requestId, p, hitLimit);
      } catch (e) {
        dispatch({ type: 'SET_REPLAY_RUNNING', payload: { id: replay.id, running: false } });
        setErr(String(e));
      }
    }
  };

  const start = async () => {
    setErr(null);
    setBusy(true);
    try {
      await startAll();
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(localUrl).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const openAsRequest = async () => {
    if (!request) return;
    const created = await createRequest(replay.projectId, null, `${replay.name} (replay)`, null);
    const updated = await updateRequest(created.id, { method, url: localUrl });
    dispatch({ type: 'ADD_REQUEST', payload: updated });
    dispatch({ type: 'SET_CURRENT_REQUEST', payload: updated.id });
    dispatch({ type: 'SET_VIEW', payload: 'request' });
  };

  const togglePause = async () => {
    const next = !pauseMode;
    dispatch({ type: 'SET_REPLAY_PAUSED', payload: { id: replay.id, paused: next } });
    await setReplayPaused(replay.id, next).catch(() => {});
  };

  const step = async () => {
    if (!currentPause) return;
    // Select the resulting hit (it arrives via replay-hit) so its full
    // request/response shows once stepped.
    selectNextHitRef.current = true;
    await resumeReplay(currentPause.pauseId).catch(() => {});
    dispatch({ type: 'SET_ACTIVE_PAUSE', payload: { replayId: replay.id, pause: null } });
  };

  // A live paused request takes precedence in the detail pane over a clicked hit.
  const detail = currentPause ? { ...currentPause, matched: true } : selected;

  const cookies = detail ? extractCookies(detail.requestHeaders) : [];
  const queryParams: [string, string][] = detail
    ? [...new URLSearchParams(detail.path.split('?')[1] ?? '')]
    : [];
  const selectedContentType = detail
    ? (detail.requestHeaders.find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '')
    : '';
  const rawReqBody = detail?.requestBody ?? '';
  const bodyIsJson = selectedContentType.includes('json') || /^\s*[[{]/.test(rawReqBody.trimStart());
  const formattedBody = rawReqBody ? formatBody(rawReqBody, bodyIsJson ? 'application/json' : selectedContentType) : '';
  const rawRespBody = detail?.responseBody ?? '';
  const responseIsJson = /^\s*[[{]/.test(rawRespBody.trimStart());
  const formattedResponseBody = rawRespBody ? formatBody(rawRespBody, responseIsJson ? 'application/json' : '') : '';

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        {showExpandBtn && (
          <button className={styles.expandBtn} onClick={onExpand} title="Show sidebar">»</button>
        )}
        <span className={`${styles.statusDot} ${running ? styles.dotRunning : styles.dotStopped}`} />
        <h2 className={styles.title}>{replay.name}</h2>
        <span className={styles.bound}>{method} {path}</span>
        <div className={styles.spacer} />
        <label className={styles.portLabel}>
          Port
          <input
            className={styles.portInput}
            value={portInput}
            onChange={(e) => setPortInput(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={persistPort}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            inputMode="numeric"
          />
        </label>
        {running ? (
          <span className={styles.runningTag}>Running</span>
        ) : (
          <button
            className={`${styles.toggleBtn} ${styles.startBtn}`}
            onClick={start}
            disabled={busy}
          >
            Start all
          </button>
        )}
      </header>

      {err && <div className={styles.error}>{err}</div>}

      <div className={styles.urlBar}>
        <span className={styles.urlLabel}>Serving on</span>
        <code className={styles.url}>{localUrl}</code>
        <button className={styles.urlIconBtn} onClick={copyUrl} title={copied ? 'Copied!' : 'Copy URL'}>
          <CopyIcon />
        </button>
        <button className={styles.urlIconBtn} onClick={openAsRequest} title="Open as new request in Callstack">
          <OpenRequestIcon />
        </button>
      </div>

      <div className={styles.body}>
        {/* Left: request → response debug flow with a Pause/Step breakpoint */}
        <div className={styles.flow}>
          <button
            className={`${styles.pauseToggle} ${pauseMode ? styles.pauseOn : ''}`}
            onClick={togglePause}
            disabled={!running}
            title="When on, incoming matched requests pause for inspection until you Step. Resets when the replay is restarted."
          >
            {pauseMode ? 'Debug On' : 'Debug Off'}
          </button>

          <div className={`${styles.node} ${currentPause ? styles.nodePaused : ''}`}>
            <div className={styles.nodeBadge} style={{ color: 'var(--accent-post)' }}>↑</div>
            <div className={styles.nodeLabel}>
              <div className={styles.nodeTitle}>Request in</div>
              <div className={styles.nodeSub}>{method} {path}</div>
            </div>
          </div>

          <div className={styles.connector}>
            {currentPause ? (
              <button className={styles.stepBtn} onClick={step} title="Send the response and continue">
                Step ▶
              </button>
            ) : (
              <div className={`${styles.connectorLine} ${pauseMode && running ? styles.connectorArmed : ''}`} />
            )}
          </div>

          <div className={styles.node}>
            <div className={styles.nodeBadge} style={{ color: 'var(--accent-get)' }}>↓</div>
            <div className={styles.nodeLabel}>
              <div className={styles.nodeTitle}>Response out</div>
              <div className={styles.nodeSub}>{currentPause ? `paused — status ${currentPause.status}` : 'latest captured response'}</div>
            </div>
          </div>

          <div className={styles.hitList}>
            <div className={styles.hitListHeader}>
              <span>Hits ({hits.length})</span>
              {hits.length > 0 && (
                <button
                  className={styles.clearHitsBtn}
                  onClick={() => setConfirmClear(true)}
                  title="Clear hit history"
                >
                  Clear
                </button>
              )}
            </div>
            {hits.length === 0 ? (
              <div className={styles.hitEmpty}>
                {running ? 'Waiting for incoming requests…' : 'Server stopped.'}
              </div>
            ) : (
              hits.map((h) => (
                <button
                  key={h._k}
                  className={`${styles.hitRow} ${selectedKey === h._k ? styles.hitSelected : ''}`}
                  onClick={() => setSelectedKey(h._k)}
                >
                  <span className={`${styles.hitStatus} ${h.matched ? styles.hitOk : styles.hitMiss}`}>{h.status}</span>
                  <span className={styles.hitMethod}>{h.method}</span>
                  <span className={styles.hitPath}>{h.path}</span>
                  <span className={styles.hitTime}>{new Date(h.ts).toLocaleTimeString()}</span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: introspection of the selected incoming request */}
        <div className={styles.detail}>
          {!detail ? (
            <div className={styles.detailEmpty}>Select a hit to inspect the incoming request.</div>
          ) : (
            <>
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Request line</h3>
                <div className={styles.tbl}>
                  <div className={styles.tblRow}><span className={styles.tblKey}>Method</span><span className={styles.tblVal}>{detail.method}</span></div>
                  <div className={styles.tblRow}><span className={styles.tblKey}>Path</span><span className={styles.tblVal}>{detail.path}</span></div>
                  <div className={styles.tblRow}><span className={styles.tblKey}>Matched</span><span className={styles.tblVal}>{detail.matched ? 'yes' : 'no'}</span></div>
                  <div className={styles.tblRow}><span className={styles.tblKey}>Served status</span><span className={styles.tblVal}>{detail.status}</span></div>
                </div>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Query params ({queryParams.length})</h3>
                {queryParams.length === 0 ? (
                  <div className={styles.muted}>No query params.</div>
                ) : (
                  <div className={styles.tbl}>
                    {queryParams.map(([k, v], i) => (
                      <div key={i} className={styles.tblRow}><span className={styles.tblKey}>{k}</span><span className={styles.tblVal}>{v}</span></div>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Headers ({detail.requestHeaders.length})</h3>
                <div className={styles.tbl}>
                  {detail.requestHeaders.map(([k, v], i) => (
                    <div key={i} className={styles.tblRow}><span className={styles.tblKey}>{k}</span><span className={styles.tblVal}>{v}</span></div>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Cookies ({cookies.length})</h3>
                {cookies.length === 0 ? (
                  <div className={styles.muted}>No cookies sent.</div>
                ) : (
                  <div className={styles.tbl}>
                    {cookies.map(([k, v], i) => (
                      <div key={i} className={styles.tblRow}><span className={styles.tblKey}>{k}</span><span className={styles.tblVal}>{v}</span></div>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>Request body</h3>
                {detail.requestBody ? (
                  <div className={styles.bodyEditor}>
                    <CodeMirror
                      value={formattedBody}
                      extensions={bodyIsJson ? replayJsonExtensions : replayBodyExtensions}
                      theme="none"
                      readOnly
                      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false, highlightSelectionMatches: false }}
                    />
                  </div>
                ) : (
                  <div className={styles.muted}>Empty body.</div>
                )}
              </section>

              {currentPause ? (
                <div className={styles.pendingResponse}>Response is held — click <strong>Step ▶</strong> to send it.</div>
              ) : (
                <>
                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Response headers ({detail.responseHeaders.length})</h3>
                    {detail.responseHeaders.length === 0 ? (
                      <div className={styles.muted}>No response headers.</div>
                    ) : (
                      <div className={styles.tbl}>
                        {detail.responseHeaders.map(([k, v], i) => (
                          <div key={i} className={styles.tblRow}><span className={styles.tblKey}>{k}</span><span className={styles.tblVal}>{v}</span></div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className={styles.section}>
                    <h3 className={styles.sectionTitle}>Response body (served, status {detail.status})</h3>
                    {detail.responseBody ? (
                      <div className={styles.bodyEditor}>
                        <CodeMirror
                          value={formattedResponseBody}
                          extensions={responseIsJson ? replayJsonExtensions : replayBodyExtensions}
                          theme="none"
                          readOnly
                          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: false, highlightSelectionMatches: false }}
                        />
                      </div>
                    ) : (
                      <div className={styles.muted}>Empty response body.</div>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {confirmClear && (
        <ConfirmModal
          title="Clear hit history"
          confirmLabel="Clear"
          onConfirm={async () => {
            await clearReplayHits(replay.id).catch(() => {});
            setHits([]);
            setSelectedKey(null);
            setConfirmClear(false);
          }}
          onCancel={() => setConfirmClear(false)}
        >
          <p>Permanently delete all recorded hits for <strong>{replay.name}</strong>? This cannot be undone.</p>
        </ConfirmModal>
      )}
    </div>
  );
}
