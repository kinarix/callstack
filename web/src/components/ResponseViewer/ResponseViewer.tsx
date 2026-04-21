import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useApp } from '../../context/AppContext';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { EditorView } from '@codemirror/view';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { diffLines } from 'diff';

import type { Response, TestResult } from '../../lib/types';
import { getStatusColor, formatBytes } from '../../lib/utils';
import { formatBody, normalizeLineEndings } from '../../lib/formatBody';
import { isJwt, findJwtsInBody } from '../../lib/jwt';
import { JwtBadge } from '../JwtBadge/JwtBadge';
import { useDatabase } from '../../hooks/useDatabase';
import styles from './ResponseViewer.module.css';

function PinIcon({ pinned }: { pinned: boolean }) {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
      {pinned ? (
        <>
          <path d="M7 1.5L9.5 4L7 6.5H5L3 8.5V6.5H1L3.5 4V1.5H7Z" fill="currentColor" />
          <line x1="3" y1="8.5" x2="1.5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M7 1.5L9.5 4L7 6.5H5L3 8.5V6.5H1L3.5 4V1.5H7Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <line x1="3" y1="8.5" x2="1.5" y2="10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

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

interface ResponseViewerProps {
  response: Response | null;
  requestId?: number;
  requestName?: string;
  copyFlash?: boolean;
  onClear?: () => void;
  onCopy?: () => void;
}

function getContentType(headers: { key: string; value: string }[]): string {
  const ct = headers.find(h => h.key.toLowerCase() === 'content-type');
  return ct ? ct.value.toLowerCase() : '';
}

const responseViewerEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
  },
  '.cm-content': {
    caretColor: 'var(--text-primary)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '12px',
    lineHeight: '1.6',
    padding: '8px 0',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--bg-secondary)',
    border: 'none',
    borderRight: '1px solid var(--border-secondary)',
    color: 'var(--text-tertiary)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '11px',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent-get)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'rgba(59, 130, 246, 0.25)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--bg-hover, rgba(255,255,255,0.03))' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--bg-hover, rgba(255,255,255,0.03))' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-tertiary)',
  },
});

const responseViewerHighlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--syntax-keyword)' },
  { tag: tags.string, color: 'var(--syntax-string)' },
  { tag: [tags.number, tags.integer, tags.float], color: 'var(--syntax-number)' },
  { tag: [tags.bool, tags.null], color: 'var(--syntax-bool)' },
  { tag: tags.propertyName, color: 'var(--syntax-property)' },
  { tag: tags.comment, color: 'var(--syntax-comment)', fontStyle: 'italic' },
]);

const responseViewerThemeExtension = [responseViewerEditorTheme, syntaxHighlighting(responseViewerHighlight)];


interface ParsedSetCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite?: string;
}

function parseSetCookie(header: string): ParsedSetCookie {
  const parts = header.split(/;\s*/);
  const eqIdx = (parts[0] ?? '').indexOf('=');
  const name = eqIdx >= 0 ? parts[0].slice(0, eqIdx).trim() : parts[0].trim();
  const value = eqIdx >= 0 ? parts[0].slice(eqIdx + 1) : '';
  const cookie: ParsedSetCookie = { name, value, secure: false, httpOnly: false };
  for (const part of parts.slice(1)) {
    const lower = part.toLowerCase();
    if (lower === 'secure') cookie.secure = true;
    else if (lower === 'httponly') cookie.httpOnly = true;
    else if (lower.startsWith('domain=')) cookie.domain = part.slice(7);
    else if (lower.startsWith('path=')) cookie.path = part.slice(5);
    else if (lower.startsWith('expires=')) cookie.expires = part.slice(8);
    else if (lower.startsWith('max-age=')) cookie.expires = `${part.slice(8)}s`;
    else if (lower.startsWith('samesite=')) cookie.sameSite = part.slice(9);
  }
  return cookie;
}

function getLabel(contentType: string): string {
  if (contentType.includes('json')) {
    return 'JSON';
  }
  if (contentType.includes('html')) {
    return 'HTML';
  }
  if (contentType.includes('xml')) {
    return 'XML';
  }
  return contentType.split(';')[0].split('/')[1]?.toUpperCase() ?? 'Text';
}

function getLanguage(contentType: string) {
  if (contentType.includes('json')) {
    return json();
  }
  if (contentType.includes('xml') || contentType.includes('html')) {
    return xml();
  }
  return null;
}

function isPreviewable(contentType: string): boolean {
  return contentType.includes('html') || contentType.includes('image/') || contentType.includes('video/') || contentType.includes('audio/');
}

interface DiffViewProps {
  responseA: Response;
  responseB: Response;
  onExit: () => void;
}

function formatKV(kvs: import('../../lib/types').KeyValue[] | undefined): string {
  if (!kvs || kvs.length === 0) return '(none)';
  return kvs.filter(kv => kv.enabled !== false).map(kv => `${kv.key}: ${kv.value}`).join('\n');
}

function DiffSection({ label, textA, textB }: { label: string; textA: string; textB: string }) {
  const changes = diffLines(textA, textB);
  const hasChanges = changes.some(c => c.added || c.removed);
  return (
    <div className={styles.diffSection}>
      <div className={styles.diffSectionLabel}>{label}</div>
      {!hasChanges ? (
        <div className={styles.diffIdentical}>Identical</div>
      ) : (
        changes.map((change, i) => {
          const lines = change.value.split('\n');
          if (lines[lines.length - 1] === '') lines.pop();
          return lines.map((line, j) => (
            <div
              key={`${i}-${j}`}
              className={`${styles.diffLine} ${change.added ? styles.diffAdded : change.removed ? styles.diffRemoved : styles.diffUnchanged}`}
            >
              <span className={styles.diffPrefix}>{change.added ? '+' : change.removed ? '-' : ' '}</span>
              <span className={styles.diffLineText}>{line}</span>
            </div>
          ));
        })
      )}
    </div>
  );
}

function DiffView({ responseA, responseB, onExit }: DiffViewProps) {
  const ctA = getContentType(responseA.headers ?? []);
  const ctB = getContentType(responseB.headers ?? []);
  const bodyA = formatBody(responseA.body, ctA);
  const bodyB = formatBody(responseB.body, ctB);

  return (
    <div className={styles.diffView}>
      <div className={styles.diffHeader}>
        <div className={styles.diffSide}>
          <span className={styles.diffLabel}>A</span>
          <span style={{ color: getStatusColor(responseA.status) }}>{responseA.status} {responseA.statusText}</span>
          {responseA.timestamp != null && (
            <span className={styles.diffTs}>{formatTimestamp(responseA.timestamp)}</span>
          )}
        </div>
        <div className={`${styles.diffSide} ${styles.diffSideRight}`}>
          <span className={styles.diffLabel}>B</span>
          <span style={{ color: getStatusColor(responseB.status) }}>{responseB.status} {responseB.statusText}</span>
          {responseB.timestamp != null && (
            <span className={styles.diffTs}>{formatTimestamp(responseB.timestamp)}</span>
          )}
        </div>
      </div>
      <div className={styles.diffBody}>
        <DiffSection label="Request Params" textA={formatKV(responseA.requestParams)} textB={formatKV(responseB.requestParams)} />
        <DiffSection label="Request Headers" textA={formatKV(responseA.requestHeaders)} textB={formatKV(responseB.requestHeaders)} />
        <DiffSection label="Request Body" textA={responseA.requestBody || '(none)'} textB={responseB.requestBody || '(none)'} />
        <DiffSection label="Response Headers" textA={formatKV(responseA.headers)} textB={formatKV(responseB.headers)} />
        <DiffSection label="Response Body" textA={bodyA} textB={bodyB} />
      </div>
      <div className={styles.historyActions}>
        <button className={styles.compareBtn} onClick={onExit}>Exit diff</button>
      </div>
    </div>
  );
}

export function ResponseViewer({ response, requestId, requestName, copyFlash, onClear, onCopy }: ResponseViewerProps) {
  const { dispatch } = useApp();
  const { getResponseHistory } = useDatabase();
  const [tab, setTab] = useState<'body' | 'headers' | 'preview' | 'tests' | 'cookies' | 'history'>('body');
  const [headersPinned, setHeadersPinned] = useState(false);
  const [testsPinned, setTestsPinned] = useState(false);

  // History state
  const [history, setHistory] = useState<Response[]>([]);
  const [previewResponse, setPreviewResponse] = useState<Response | null>(null);
  const [diffA, setDiffA] = useState<number | null>(null);
  const [diffB, setDiffB] = useState<number | null>(null);
  const [diffMode, setDiffMode] = useState(false);

  const refreshHistory = useCallback(() => {
    if (requestId) {
      getResponseHistory(requestId).then(setHistory).catch(console.error);
    }
  }, [requestId, getResponseHistory]);

  // Refresh history whenever a new response arrives
  useEffect(() => {
    if (response) {
      setPreviewResponse(null);
      setDiffA(null);
      setDiffB(null);
      setDiffMode(false);
      refreshHistory();
    }
  }, [response?.timestamp]);

  // Load history when requestId changes
  useEffect(() => {
    refreshHistory();
  }, [requestId]);

  useEffect(() => {
    if (response) {
      const contentType = getContentType(response.headers);
      if (isPreviewable(contentType)) {
        setTab('preview');
      } else if (!response.body.trim()) {
        setTab('headers');
      } else {
        setTab('body');
      }
    }
  }, [response?.timestamp]);

  const getFileExtension = (contentType: string): string => {
    if (contentType.includes('json')) return 'json';
    if (contentType.includes('xml')) return 'xml';
    if (contentType.includes('html')) return 'html';
    if (contentType.includes('plain')) return 'txt';
    if (contentType.includes('csv')) return 'csv';
    if (contentType.includes('pdf')) return 'pdf';
    return 'txt';
  };

  const handleCopy = async () => {
    if (displayedResponse?.body) {
      await navigator.clipboard.writeText(formattedBody);
      onCopy?.();
    }
  };

  const handleClear = () => {
    onClear?.();
  };

  const handleSave = async () => {
    if (!displayedResponse?.body || !displayedResponse.body.trim()) return;

    const contentType = displayedResponse.headers
      ?.find((h) => h.key.toLowerCase() === 'content-type')?.value || 'text/plain';
    const ext = getFileExtension(contentType);
    const filename = `${requestName || 'response'}.${ext}`;

    try {
      await invoke('save_file', { filename, content: displayedResponse.body });
    } catch (err) {
      console.error('Failed to save response:', err);
      dispatch({ type: 'SHOW_ERROR', payload: { message: `Failed to save response: ${String(err)}`, showReset: true } });
    }
  };

  if (!response) {
    return (
      <div className={styles.viewerEmpty}>
        <div className={styles.sectionLabel}>Response</div>
        <div className={styles.emptyMessage}>Send a request to see the response</div>
      </div>
    );
  }

  const displayedResponse = previewResponse ?? response;

  const statusColor = getStatusColor(displayedResponse.status);
  const contentType = getContentType(displayedResponse.headers ?? []);
  const formattedBody = formatBody(displayedResponse.body, contentType);
  const label = getLabel(contentType);
  const bodyLanguage = getLanguage(contentType);
  const bodyExtensions = bodyLanguage ? [...responseViewerThemeExtension, bodyLanguage] : responseViewerThemeExtension;

  return (
    <div className={styles.viewer}>
      <div className={styles.header}>
        <span className={styles.sectionLabel}>Response</span>
        <div className={styles.status} style={{ backgroundColor: statusColor }}>
          {displayedResponse.statusText || displayedResponse.status}
        </div>
        <div className={styles.info}>
          <span className={styles.infoItem}>
            Time: <strong>{displayedResponse.time}ms</strong>
          </span>
          <span className={styles.infoItem}>
            Size: <strong>{formatBytes(displayedResponse.size)}</strong>
          </span>
          {displayedResponse.timestamp != null && (
            <span className={styles.infoItem}>
              At: <strong>{formatTimestamp(displayedResponse.timestamp)}</strong>
            </span>
          )}
        </div>
        <div className={styles.spacer} />
        {previewResponse && (
          <span className={styles.historyBadge}>history</span>
        )}
        {contentType && <span className={styles.typeBadge}>{label}</span>}
      </div>

      <div className={styles.tabs}>
        <div className={styles.tabGroup}>
          <button
            className={`${styles.tab} ${tab === 'headers' ? styles.tabActive : ''} ${headersPinned ? styles.tabDisabled : ''}`}
            onClick={() => !headersPinned && setTab('headers')}
            disabled={headersPinned}
          >
            Headers
            {displayedResponse.headers?.length > 0 && (
              <span className={styles.tabCount}>{displayedResponse.headers.length}</span>
            )}
          </button>
          <button
            className={`${styles.pinBtn} ${headersPinned ? styles.pinActive : ''}`}
            onClick={() => setHeadersPinned(p => { if (!p) setTab('body'); return !p; })}
            title={headersPinned ? 'Unpin Headers' : 'Pin Headers (always visible)'}
          >
            <PinIcon pinned={headersPinned} />
          </button>
        </div>
        <button
          className={`${styles.tab} ${tab === 'body' ? styles.tabActive : ''}`}
          onClick={() => setTab('body')}
        >
          Body
        </button>
        {isPreviewable(getContentType(displayedResponse.headers)) && (
          <button
            className={`${styles.tab} ${tab === 'preview' ? styles.tabActive : ''}`}
            onClick={() => setTab('preview')}
          >
            Preview
          </button>
        )}
        {displayedResponse.testResults && displayedResponse.testResults.length > 0 && (() => {
          const passed = displayedResponse.testResults!.filter(r => r.passed).length;
          const failed = displayedResponse.testResults!.length - passed;
          const statusColor = failed === 0 ? 'var(--accent-get)' : passed === 0 ? '#ef4444' : '#f59e0b';
          return (
            <div className={styles.tabGroup}>
              <button
                className={`${styles.tab} ${tab === 'tests' ? styles.tabActive : ''} ${testsPinned ? styles.tabDisabled : ''}`}
                onClick={() => !testsPinned && setTab('tests')}
                disabled={testsPinned}
                style={tab === 'tests' && !testsPinned ? { color: statusColor, borderBottomColor: statusColor } : {}}
              >
                Tests
                <span className={styles.tabCount} style={{ background: `${statusColor}22`, color: statusColor }}>
                  {failed === 0 ? `${passed} passed` : passed === 0 ? `${failed} failed` : `${passed}/${displayedResponse.testResults!.length}`}
                </span>
              </button>
              <button
                className={`${styles.pinBtn} ${testsPinned ? styles.pinActive : ''}`}
                onClick={() => setTestsPinned(p => { if (!p) setTab('body'); return !p; })}
                title={testsPinned ? 'Unpin Tests' : 'Pin Tests (always visible)'}
              >
                <PinIcon pinned={testsPinned} />
              </button>
            </div>
          );
        })()}
        {(() => {
          const setCookieHeaders = displayedResponse.headers?.filter(h => h.key.toLowerCase() === 'set-cookie') ?? [];
          if (setCookieHeaders.length === 0) return null;
          return (
            <button
              className={`${styles.tab} ${tab === 'cookies' ? styles.tabActive : ''}`}
              onClick={() => setTab('cookies')}
            >
              Cookies
              <span className={styles.tabCount}>{setCookieHeaders.length}</span>
            </button>
          );
        })()}
        {requestId != null && (
          <button
            className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`}
            onClick={() => setTab('history')}
          >
            History
            {history.length > 0 && (
              <span className={styles.tabCount}>{history.length}</span>
            )}
          </button>
        )}
      </div>


      {headersPinned && tab === 'body' && (
        <div className={styles.pinnedPanel}>
          <div className={styles.pinnedHeader}>
            <span>Headers</span>
          </div>
          <div className={styles.pinnedContent}>
            {displayedResponse.headers?.length > 0 ? (
              <div className={styles.headers}>
                {displayedResponse.headers.map((header, i) => (
                  <div key={i} className={styles.headerRow}>
                    <span className={styles.headerKey}>{header.key}</span>
                    <span className={styles.headerValue}>
                      {header.value}
                      {isJwt(header.value) && <JwtBadge token={header.value} popoverAlign="right" />}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyMessage}>No headers</div>
            )}
          </div>
        </div>
      )}

      {testsPinned && tab === 'body' && displayedResponse.testResults && (
        <div className={styles.pinnedPanel}>
          <div className={styles.pinnedHeader}>
            <span>Tests</span>
          </div>
          <div className={styles.pinnedContent}>
            <div className={styles.testsTable}>
              {displayedResponse.testResults.map((r, i) => (
                <div key={i} className={`${styles.testsRow} ${r.severity === 'warning' ? styles.testsRowWarn : r.passed ? styles.testsRowPass : styles.testsRowFail}`}>
                  <span className={styles.testsIcon}>{r.severity === 'warning' ? '⚠' : r.passed ? '✓' : '✗'}</span>
                  <div className={styles.testsDetail}>
                    <span className={styles.testsDesc} title={r.description}>{r.description}</span>
                    {r.passed && r.message && <span className={styles.testsSuccess} title={r.message}>{r.message}</span>}
                    {!r.passed && r.error && <span className={styles.testsError} title={r.error}>{r.error}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'body' && (
        <div className={styles.body}>
          <div className={`${styles.preWrapper}${copyFlash ? ` ${styles.flashCopy}` : ''}`}>
            <div className={styles.floatingButtons}>
              <button className={styles.floatingBtn} onClick={handleCopy} title="Copy response body">Copy</button>
              <button className={styles.floatingBtn} onClick={handleSave} title="Save response to file">Save</button>
              <button className={styles.floatingBtn} onClick={handleClear} title="Clear response">Clear</button>
            </div>
            <CodeMirror
              value={formattedBody}
              extensions={bodyExtensions}
              theme="none"
              readOnly={true}
              basicSetup={{
                lineNumbers: true,
                foldGutter: true,
                highlightSelectionMatches: false,
              }}
              className={styles.responseEditor}
            />
            {copyFlash && (
              <div className={styles.copyToast}>Copied to clipboard</div>
            )}
          </div>
          {(() => {
            const jwts = findJwtsInBody(displayedResponse.body);
            if (jwts.length === 0) return null;
            return (
              <div className={styles.jwtPanel}>
                <div className={styles.jwtPanelHeader}>JWT tokens in body</div>
                <div className={styles.jwtPanelContent}>
                  {jwts.map((found, i) => (
                    <div key={i} className={styles.jwtPanelRow}>
                      {found.path && <span className={styles.jwtPanelPath}>{found.path}</span>}
                      <JwtBadge token={found.value} popoverAlign="right" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {tab === 'headers' && (
        <div className={styles.headerList}>
          <div className={styles.headersWrapper}>
            {displayedResponse.headers?.length > 0 ? (
              <div className={styles.headers}>
                {displayedResponse.headers.map((header, i) => (
                  <div key={i} className={styles.headerRow}>
                    <span className={styles.headerKey}>{header.key}</span>
                    <span className={styles.headerValue}>
                      {header.value}
                      {isJwt(header.value) && <JwtBadge token={header.value} popoverAlign="right" />}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyMessage}>No headers</div>
            )}
          </div>
        </div>
      )}

      {tab === 'preview' && (
        <div className={styles.preview}>
          {(() => {
            const ct = getContentType(displayedResponse.headers);
            if (ct.includes('html')) {
              return (
                <iframe
                  srcDoc={displayedResponse.body}
                  sandbox="allow-same-origin allow-scripts"
                  className={styles.previewFrame}
                />
              );
            }
            if (ct.includes('image/')) {
              return (
                <img
                  src={`data:${ct};base64,${displayedResponse.body}`}
                  className={styles.previewImage}
                  alt="Preview"
                />
              );
            }
            if (ct.includes('video/')) {
              return (
                <video
                  src={`data:${ct};base64,${displayedResponse.body}`}
                  controls
                  className={styles.previewMedia}
                />
              );
            }
            if (ct.includes('audio/')) {
              return (
                <audio
                  src={`data:${ct};base64,${displayedResponse.body}`}
                  controls
                  className={styles.previewMedia}
                />
              );
            }
            return null;
          })()}
        </div>
      )}

      {tab === 'tests' && displayedResponse.testResults && (
        <div className={styles.testsPane}>
          {(() => {
            const results = displayedResponse.testResults!;
            const passed = results.filter(r => r.passed).length;
            const failed = results.length - passed;
            return (
              <>
                <div className={styles.testsSummary}>
                  {passed > 0 && <span className={styles.testsSummaryPass}>{passed} passed</span>}
                  {passed > 0 && failed > 0 && <span className={styles.testsSummarySep}>·</span>}
                  {failed > 0 && <span className={styles.testsSummaryFail}>{failed} failed</span>}
                  <span className={styles.testsSummaryTotal}>of {results.length}</span>
                </div>
                <div className={styles.testsTable}>
                  {results.map((r, i) => (
                    <div key={i} className={`${styles.testsRow} ${r.severity === 'warning' ? styles.testsRowWarn : r.passed ? styles.testsRowPass : styles.testsRowFail}`}>
                      <span className={styles.testsIcon}>{r.severity === 'warning' ? '⚠' : r.passed ? '✓' : '✗'}</span>
                      <div className={styles.testsDetail}>
                        <span className={styles.testsDesc} title={r.description}>{r.description}</span>
                        {r.passed && r.message && (
                          <span className={styles.testsSuccess} title={r.message}>{r.message}</span>
                        )}
                        {!r.passed && r.error && (
                          <span className={styles.testsError} title={r.error}>{r.error}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {tab === 'cookies' && (
        <div className={styles.cookiesPane}>
          {(() => {
            const setCookieHeaders = displayedResponse.headers?.filter(h => h.key.toLowerCase() === 'set-cookie') ?? [];
            const cookies = setCookieHeaders.map(h => parseSetCookie(h.value));
            return (
              <table className={styles.cookiesTable}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Value</th>
                    <th>Domain</th>
                    <th>Path</th>
                    <th>Expires</th>
                    <th>Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {cookies.map((c, i) => (
                    <tr key={i}>
                      <td className={styles.cookiesCell}>{c.name}</td>
                      <td className={`${styles.cookiesCell} ${styles.cookiesCellValue}`}>{c.value}</td>
                      <td className={styles.cookiesCell}>{c.domain ?? '—'}</td>
                      <td className={styles.cookiesCell}>{c.path ?? '/'}</td>
                      <td className={styles.cookiesCell}>{c.expires ?? 'Session'}</td>
                      <td className={styles.cookiesCell}>
                        {[c.secure && 'Secure', c.httpOnly && 'HttpOnly', c.sameSite && `SameSite=${c.sameSite}`]
                          .filter(Boolean).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          })()}
        </div>
      )}

      {tab === 'history' && (
        <div className={styles.historyPane}>
          {diffMode && diffA !== null && diffB !== null && (() => {
            const rA = history.find(r => r.id === diffA);
            const rB = history.find(r => r.id === diffB);
            if (!rA || !rB) return null;
            return <DiffView responseA={rA} responseB={rB} onExit={() => setDiffMode(false)} />;
          })()}
          {!diffMode && (
            <>
              {history.length === 0 ? (
                <div className={styles.emptyMessage}>No history yet</div>
              ) : (
                <div className={styles.historyList}>
                  {history.map((r, i) => (
                    <div
                      key={r.id}
                      className={`${styles.historyRow} ${previewResponse?.id === r.id ? styles.historyRowActive : ''}`}
                    >
                      <div className={styles.historySelectors}>
                        <button
                          className={`${styles.historySel} ${diffA === r.id ? styles.historySelActive : ''}`}
                          onClick={() => setDiffA(diffA === r.id ? null : r.id)}
                          title="Select as A for diff"
                        >A</button>
                        <button
                          className={`${styles.historySel} ${diffB === r.id ? styles.historySelActive : ''}`}
                          onClick={() => setDiffB(diffB === r.id ? null : r.id)}
                          title="Select as B for diff"
                        >B</button>
                      </div>
                      <span className={styles.historyIndex}>#{history.length - i}</span>
                      <span className={styles.historyTimestamp}>
                        {r.timestamp ? formatTimestamp(r.timestamp) : '—'}
                      </span>
                      <span className={styles.historyStatus} style={{ color: getStatusColor(r.status) }}>
                        {r.status}
                      </span>
                      <span className={styles.historyMeta}>{r.time}ms</span>
                      <span className={styles.historyMeta}>{formatBytes(r.size)}</span>
                      {i === 0 ? (
                        <button
                          className={styles.historyCurrentTag}
                          onClick={() => { setPreviewResponse(null); setTab('body'); }}
                          title="View current response"
                        >current</button>
                      ) : (
                      <button
                        className={`${styles.historyViewBtn} ${previewResponse?.id === r.id ? styles.historyViewBtnActive : ''}`}
                        onClick={() => {
                          const next = previewResponse?.id === r.id ? null : r;
                          setPreviewResponse(next);
                          if (next) setTab('body');
                        }}
                      >
                        {previewResponse?.id === r.id ? 'Hide' : 'View'}
                      </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {diffA !== null && diffB !== null && diffA !== diffB && (
                <div className={styles.historyActions}>
                  <button className={styles.compareBtn} onClick={() => setDiffMode(true)}>
                    Compare A vs B
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
