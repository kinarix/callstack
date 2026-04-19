import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useApp } from '../../context/AppContext';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { EditorView } from '@codemirror/view';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';


import type { Response, TestResult } from '../../lib/types';
import { getStatusColor, formatBytes } from '../../lib/utils';
import { formatBody, normalizeLineEndings } from '../../lib/formatBody';
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

export function ResponseViewer({ response, requestName, copyFlash, onClear, onCopy }: ResponseViewerProps) {
  const { dispatch } = useApp();
  const [tab, setTab] = useState<'body' | 'headers' | 'preview' | 'tests'>('body');
  const [headersPinned, setHeadersPinned] = useState(false);
  const [testsPinned, setTestsPinned] = useState(false);

  useEffect(() => {
    if (response) {
      const contentType = getContentType(response.headers);
      if (isPreviewable(contentType)) {
        setTab('preview');
      } else if (tab === 'preview') {
        setTab('body');
      } else if (!response.body.trim() && tab === 'body') {
        setTab('headers');
      } else {
        setTab('body');
      }
    }
  }, [response]);

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
    if (response?.body) {
      await navigator.clipboard.writeText(formattedBody);
      onCopy?.();
    }
  };

  const handleClear = () => {
    onClear?.();
  };

  const handleSave = async () => {
    if (!response?.body || !response.body.trim()) return;

    const contentType = response.headers
      ?.find((h) => h.key.toLowerCase() === 'content-type')?.value || 'text/plain';
    const ext = getFileExtension(contentType);
    const filename = `${requestName || 'response'}.${ext}`;

    try {
      await invoke('save_file', { filename, content: response.body });
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

  const statusColor = getStatusColor(response.status);
  const contentType = getContentType(response.headers ?? []);
  const formattedBody = formatBody(response.body, contentType);
  const label = getLabel(contentType);
  const bodyLanguage = getLanguage(contentType);
  const bodyExtensions = bodyLanguage ? [...responseViewerThemeExtension, bodyLanguage] : responseViewerThemeExtension;

  return (
    <div className={styles.viewer}>
      <div className={styles.header}>
        <span className={styles.sectionLabel}>Response</span>
        <div className={styles.status} style={{ backgroundColor: statusColor }}>
          {response.statusText || response.status}
        </div>
        <div className={styles.info}>
          <span className={styles.infoItem}>
            Time: <strong>{response.time}ms</strong>
          </span>
          <span className={styles.infoItem}>
            Size: <strong>{formatBytes(response.size)}</strong>
          </span>
          {response.timestamp != null && (
            <span className={styles.infoItem}>
              At: <strong>{formatTimestamp(response.timestamp)}</strong>
            </span>
          )}
        </div>
        <div className={styles.spacer} />
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
            {response.headers?.length > 0 && (
              <span className={styles.tabCount}>{response.headers.length}</span>
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
        {isPreviewable(getContentType(response.headers)) && (
          <button
            className={`${styles.tab} ${tab === 'preview' ? styles.tabActive : ''}`}
            onClick={() => setTab('preview')}
          >
            Preview
          </button>
        )}
        {response.testResults && response.testResults.length > 0 && (() => {
          const passed = response.testResults.filter(r => r.passed).length;
          const failed = response.testResults.length - passed;
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
                  {failed === 0 ? `${passed} passed` : passed === 0 ? `${failed} failed` : `${passed}/${response.testResults.length}`}
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
      </div>


      {headersPinned && tab === 'body' && (
        <div className={styles.pinnedPanel}>
          <div className={styles.pinnedHeader}>
            <span>Headers</span>
          </div>
          <div className={styles.pinnedContent}>
            {response.headers?.length > 0 ? (
              <div className={styles.headers}>
                {response.headers.map((header, i) => (
                  <div key={i} className={styles.headerRow}>
                    <span className={styles.headerKey}>{header.key}</span>
                    <span className={styles.headerValue}>{header.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.emptyMessage}>No headers</div>
            )}
          </div>
        </div>
      )}

      {testsPinned && tab === 'body' && response.testResults && (
        <div className={styles.pinnedPanel}>
          <div className={styles.pinnedHeader}>
            <span>Tests</span>
          </div>
          <div className={styles.pinnedContent}>
            <div className={styles.testsTable}>
              {response.testResults.map((r, i) => (
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
        </div>
      )}

      {tab === 'headers' && (
        <div className={styles.headerList}>
          <div className={styles.headersWrapper}>
            {response.headers?.length > 0 ? (
              <div className={styles.headers}>
                {response.headers.map((header, i) => (
                  <div key={i} className={styles.headerRow}>
                    <span className={styles.headerKey}>{header.key}</span>
                    <span className={styles.headerValue}>{header.value}</span>
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
            const ct = getContentType(response.headers);
            if (ct.includes('html')) {
              return (
                <iframe
                  srcDoc={response.body}
                  sandbox="allow-same-origin allow-scripts"
                  className={styles.previewFrame}
                />
              );
            }
            if (ct.includes('image/')) {
              return (
                <img
                  src={`data:${ct};base64,${response.body}`}
                  className={styles.previewImage}
                  alt="Preview"
                />
              );
            }
            if (ct.includes('video/')) {
              return (
                <video
                  src={`data:${ct};base64,${response.body}`}
                  controls
                  className={styles.previewMedia}
                />
              );
            }
            if (ct.includes('audio/')) {
              return (
                <audio
                  src={`data:${ct};base64,${response.body}`}
                  controls
                  className={styles.previewMedia}
                />
              );
            }
            return null;
          })()}
        </div>
      )}

      {tab === 'tests' && response.testResults && (
        <div className={styles.testsPane}>
          {(() => {
            const results = response.testResults;
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
    </div>
  );
}
