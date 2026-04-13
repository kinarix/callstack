import { useState, useEffect, lazy, Suspense } from 'react';
import type { Request, KeyValue, FileAttachment } from '../../lib/types';
import { KeyValueEditor } from './KeyValueEditor';
import { FileUpload } from './FileUpload';
import { ScriptEditor } from './ScriptEditor';
import styles from './TabPanel.module.css';

const BodyEditor = lazy(() => import('./BodyEditor').then(m => ({ default: m.BodyEditor })));

type TabName = 'params' | 'headers' | 'body' | 'files' | 'script';
type PinnableTab = 'params' | 'headers' | 'files';

const PINNABLE: PinnableTab[] = ['params', 'headers', 'files'];
const STORAGE_KEY_PREFIX = 'callstack.pinnedTabs.';

function loadPinned(requestId: number): Set<PinnableTab> {
  try {
    const key = STORAGE_KEY_PREFIX + requestId;
    const stored = localStorage.getItem(key);
    if (stored) {
      const arr = JSON.parse(stored) as string[];
      return new Set(arr.filter((t): t is PinnableTab => PINNABLE.includes(t as PinnableTab)));
    }
  } catch {}
  return new Set();
}

function savePinned(requestId: number, pinned: Set<PinnableTab>) {
  const key = STORAGE_KEY_PREFIX + requestId;
  localStorage.setItem(key, JSON.stringify([...pinned]));
}

function detectContentType(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '';
  try { JSON.parse(trimmed); return 'application/json'; } catch {}
  if (trimmed.startsWith('<')) return 'application/xml';
  if (/^[\w%+.-]+=/.test(trimmed) && !trimmed.includes('{') && !trimmed.includes('[')) {
    return 'application/x-www-form-urlencoded';
  }
  return 'text/plain';
}

function getContentType(headers: KeyValue[]): string {
  return headers.find(h => h.key.toLowerCase() === 'content-type')?.value ?? '';
}

function upsertContentType(headers: KeyValue[], value: string): KeyValue[] {
  const idx = headers.findIndex(h => h.key.toLowerCase() === 'content-type');
  if (value === '') {
    return idx >= 0 ? headers.filter((_, i) => i !== idx) : headers;
  }
  if (idx >= 0) {
    const next = [...headers];
    next[idx] = { ...next[idx], value };
    return next;
  }
  return [...headers, { key: 'Content-Type', value, enabled: true }];
}

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

interface TabPanelProps {
  request: Request | null;
  onRequestChange: (changes: Partial<Request>) => void;
  files: FileAttachment[];
  onFilesChange: (files: FileAttachment[]) => void;
  consoleLogs: string[];
  onClearLogs?: () => void;
  envVars?: KeyValue[];
  onScriptTest?: (script: string, isPost: boolean) => void;
}

export function TabPanel({ request, onRequestChange, files, onFilesChange, consoleLogs, onClearLogs, envVars, onScriptTest }: TabPanelProps) {
  const [pinned, setPinned] = useState<Set<PinnableTab>>(() => request ? loadPinned(request.id) : new Set());
  const [activeTab, setActiveTab] = useState<TabName>(() => {
    const p = request ? loadPinned(request.id) : new Set<PinnableTab>();
    return p.has('params') ? 'body' : 'params';
  });

  useEffect(() => {
    if (request) {
      const loaded = loadPinned(request.id);
      setPinned(loaded);
      setActiveTab(prev =>
        PINNABLE.includes(prev as PinnableTab) && loaded.has(prev as PinnableTab) ? 'body' : prev
      );
    }
  }, [request?.id]);

  if (!request) {
    return <div className={styles.empty}>Select a request to get started</div>;
  }

  const togglePin = (panel: PinnableTab) => {
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(panel)) {
        next.delete(panel);
      } else {
        next.add(panel);
        // If pinning the currently active tab, move to body
        if (activeTab === panel) setActiveTab('body');
      }
      savePinned(request.id, next);
      return next;
    });
  };

  const handleBodyChange = (body: string) => {
    const changes: Partial<Request> = { body };
    const currentCt = getContentType(request.headers);
    if (!currentCt) {
      const detected = detectContentType(body);
      if (detected) {
        changes.headers = upsertContentType(request.headers, detected);
      }
    }
    onRequestChange(changes);
  };

  const handleContentTypeChange = (value: string) => {
    onRequestChange({ headers: upsertContentType(request.headers, value) });
  };

  const currentContentType = getContentType(request.headers);

  const TABS: { name: TabName; label: string; count?: number }[] = [
    { name: 'params', label: 'Params', count: request.params.filter(p => p.key).length || undefined },
    { name: 'headers', label: 'Headers', count: request.headers.filter(h => h.key).length || undefined },
    { name: 'files', label: 'Files', count: files.length || undefined },
    { name: 'body', label: 'Body' },
    { name: 'script', label: 'Script' },
  ];

  function renderPinnedContent(p: PinnableTab) {
    if (p === 'params') {
      return <KeyValueEditor items={request!.params} onChange={(params) => onRequestChange({ params })} />;
    }
    if (p === 'headers') {
      return <KeyValueEditor items={request!.headers} onChange={(headers) => onRequestChange({ headers })} />;
    }
    return <FileUpload files={files} onChange={onFilesChange} />;
  }

  function renderTabLabel(p: PinnableTab): string {
    if (p === 'params') return 'Params';
    if (p === 'headers') return 'Headers';
    return 'Files';
  }

  return (
    <div className={styles.tabPanel}>
      <div className={styles.tabBar}>
        <span className={styles.sectionLabel}>Request</span>
        {TABS.map((tab) => {
          const isPinnable = PINNABLE.includes(tab.name as PinnableTab);
          const isPinned = pinned.has(tab.name as PinnableTab);
          return (
            <div key={tab.name} className={styles.tabGroup}>
              <button
                className={`${styles.tab} ${activeTab === tab.name ? styles.active : ''} ${isPinned ? styles.tabPinned : ''}`}
                onClick={() => !isPinned && setActiveTab(tab.name)}
                disabled={isPinned}
              >
                {tab.label}
                {tab.count != null && (
                  <span className={styles.count}>{tab.count}</span>
                )}
              </button>
              {isPinnable && (
                <button
                  className={`${styles.pinBtn} ${isPinned ? styles.pinActive : ''}`}
                  onClick={() => togglePin(tab.name as PinnableTab)}
                  title={isPinned ? `Unpin ${tab.label}` : `Pin ${tab.label} (always visible)`}
                >
                  <PinIcon pinned={isPinned} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Pinned panels — shown when pinned and a different tab is active */}
      {PINNABLE
        .filter(p => pinned.has(p) && activeTab !== p)
        .map(p => (
          <div key={p} className={styles.pinnedPanel}>
            <div className={styles.pinnedHeader}>
              <span>{renderTabLabel(p)}</span>
            </div>
            <div className={styles.pinnedContent}>
              {renderPinnedContent(p)}
            </div>
          </div>
        ))}

      {/* Active tab content */}
      <div className={styles.content}>
        {activeTab === 'params' && (
          <KeyValueEditor
            items={request.params}
            onChange={(params) => onRequestChange({ params })}
          />
        )}
        {activeTab === 'headers' && (
          <KeyValueEditor
            items={request.headers}
            onChange={(headers) => onRequestChange({ headers })}
          />
        )}
        {activeTab === 'body' && (
          <Suspense fallback={null}>
            <BodyEditor
              body={request.body}
              contentType={currentContentType}
              onChange={handleBodyChange}
              onContentTypeChange={handleContentTypeChange}
            />
          </Suspense>
        )}
        {activeTab === 'files' && (
          <FileUpload files={files} onChange={onFilesChange} />
        )}
        {activeTab === 'script' && (
          <ScriptEditor
            preScript={request.pre_script}
            postScript={request.post_script}
            onChange={onRequestChange}
            consoleLogs={consoleLogs}
            onClearLogs={onClearLogs}
            envVars={envVars}
            onTest={onScriptTest}
          />
        )}
      </div>
    </div>
  );
}
