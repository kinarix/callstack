import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import type { Request, KeyValue, FileAttachment } from '../../lib/types';
import { KeyValueEditor } from './KeyValueEditor';
import { FileUpload } from './FileUpload';
import { ScriptEditor } from './ScriptEditor';
import { ContentTypeSelector } from './ContentTypeSelector';
import { resolveTemplate, replaceTokensForValidation } from '../../lib/template';
import { getImplicitDefaults } from '../../lib/utils';
import { FAKER_TOKENS } from '../../lib/templateTokens';
import styles from './TabPanel.module.css';

const BodyEditor = lazy(() => import('./BodyEditor').then(m => ({ default: m.BodyEditor })));

function formatBodySize(body: string): string {
  const bytes = new TextEncoder().encode(body).length;
  if (bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function resolveTemplatesForValidation(body: string, envVars: KeyValue[]): string {
  // Create sample variables with actual env vars or placeholder values
  const sampleVars: KeyValue[] = [
    // Include actual env vars
    ...envVars.filter(v => v.enabled !== false),
    // Add sample values for faker tokens if not already defined as env vars
    ...FAKER_TOKENS.map(token => ({
      key: token.name,
      value: token.example || `sample-${token.name}`,
      enabled: true,
    })).filter(t => !envVars.some(v => v.key === t.key)),
  ];

  return resolveTemplate(body, sampleVars);
}

function validateBody(body: string, contentType: string, envVars: KeyValue[] = []): { valid: boolean; error?: string } {
  const trimmed = body.trim();
  if (!trimmed) return { valid: true };

  // Resolve templates for validation
  const resolvedBody = replaceTokensForValidation(trimmed, contentType);

  if (contentType.includes('json')) {
    try { JSON.parse(resolvedBody); return { valid: true }; }
    catch (e) { return { valid: false, error: e instanceof SyntaxError ? e.message : 'Invalid JSON' }; }
  }
  if (contentType.includes('xml') || contentType.includes('html')) {
    const doc = new DOMParser().parseFromString(resolvedBody, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return { valid: false, error: 'Invalid XML/HTML' };
  }
  return { valid: true };
}

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

const VALID_TABS: TabName[] = ['params', 'headers', 'body', 'files', 'script'];

function loadActiveTab(requestId: number, pinned: Set<PinnableTab>): TabName {
  const stored = localStorage.getItem('callstack.activeTab.' + requestId);
  if (stored && (VALID_TABS as string[]).includes(stored)) {
    const tab = stored as TabName;
    if (!PINNABLE.includes(tab as PinnableTab) || !pinned.has(tab as PinnableTab)) {
      return tab;
    }
  }
  return pinned.has('params') ? 'body' : 'params';
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
  secrets?: KeyValue[];
  onScriptTest?: (script: string, isPost: boolean) => void;
  copyFlash?: boolean;
  useCookieJar?: boolean;
  onUseCookieJarChange?: (value: boolean) => void;
  projectId?: number | null;
}

export function TabPanel({ request, onRequestChange, files, onFilesChange, consoleLogs, onClearLogs, envVars, secrets, onScriptTest, copyFlash, useCookieJar = true, onUseCookieJarChange, projectId = null }: TabPanelProps) {
  const [pinned, setPinned] = useState<Set<PinnableTab>>(() => request ? loadPinned(request.id) : new Set());
  const [implicitExpanded, setImplicitExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<TabName>(() => {
    if (!request) return 'params';
    const p = loadPinned(request.id);
    return loadActiveTab(request.id, p);
  });

  useEffect(() => {
    if (request) {
      const loaded = loadPinned(request.id);
      setPinned(loaded);
      setActiveTab(loadActiveTab(request.id, loaded));
    }
  }, [request?.id]);

  useEffect(() => {
    if (request) {
      localStorage.setItem('callstack.activeTab.' + request.id, activeTab);
    }
  }, [activeTab, request?.id]);

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
  const bodySize = useMemo(() => formatBodySize(request.body), [request.body]);
  const bodyValidation = useMemo(() => validateBody(request.body, currentContentType, envVars), [request.body, currentContentType, envVars]);
  const implicitItems = useMemo(() => {
    const bodyLen = new TextEncoder().encode(request.body).length || undefined;
    const defaults = getImplicitDefaults(request.url, bodyLen);
    return defaults.map(def => {
      const override = request.headers.find(h => h.key.toLowerCase() === def.key.toLowerCase());
      return override ? { ...def, value: override.value, enabled: override.enabled ?? true } : def;
    });
  }, [request.url, request.headers, request.body]);

  const implicitDisabledKeys = useMemo(
    () => new Set(request.headers.filter(h => h.key && h.enabled === false).map(h => h.key.toLowerCase())),
    [request.headers]
  );

  const implicitChangedKeys = useMemo(() => {
    const bodyLen = new TextEncoder().encode(request.body).length || undefined;
    const defaults = getImplicitDefaults(request.url, bodyLen);
    const defaultMap = new Map(defaults.map(d => [d.key.toLowerCase(), d.value]));
    return new Set(
      request.headers
        .filter(h => h.key && (h.enabled ?? true) && h.value !== defaultMap.get(h.key.toLowerCase()))
        .map(h => h.key.toLowerCase())
    );
  }, [request.headers, request.url, request.body]);

  const implicitKeys = useMemo(() => {
    const bodyLen = new TextEncoder().encode(request.body).length || undefined;
    return new Set(getImplicitDefaults(request.url, bodyLen).map(d => d.key.toLowerCase()));
  }, [request.url, request.body]);

  const userHeaders = useMemo(
    () => request.headers.filter(h => !implicitKeys.has(h.key.toLowerCase())),
    [request.headers, implicitKeys]
  );

  const handleUserHeadersChange = (newHeaders: KeyValue[]) => {
    const implicitOverrides = request.headers.filter(h => implicitKeys.has(h.key.toLowerCase()));
    onRequestChange({ headers: [...implicitOverrides, ...newHeaders] });
  };

  const handleImplicitChange = (newItems: KeyValue[]) => {
    const bodyLen = new TextEncoder().encode(request.body).length || undefined;
    const defaults = getImplicitDefaults(request.url, bodyLen);
    const defaultMap = new Map(defaults.map(d => [d.key.toLowerCase(), d.value]));
    let updated = [...request.headers];
    for (const item of newItems) {
      if (!item.key) continue;
      const lKey = item.key.toLowerCase();
      const idx = updated.findIndex(h => h.key.toLowerCase() === lKey);
      const isDefault = item.value === defaultMap.get(lKey);
      const isEnabled = item.enabled ?? true;
      if (isDefault && isEnabled) {
        // Reverted to default and enabled — remove any stored override
        if (idx >= 0) updated = updated.filter((_, i) => i !== idx);
      } else {
        // Value changed or disabled — store in headers
        if (idx >= 0) updated[idx] = { ...updated[idx], value: item.value, enabled: isEnabled };
        else updated.push({ key: item.key, value: item.value, enabled: isEnabled });
      }
    }
    onRequestChange({ headers: updated });
  };

  const hasMissingFiles = files.some(f => f.path === '');
  const TABS: { name: TabName; label: string; count?: number; warn?: boolean }[] = [
    { name: 'params', label: 'Params', count: request.params.filter(p => p.key).length || undefined },
    { name: 'headers', label: 'Headers', count: userHeaders.filter(h => h.key).length || undefined },
    { name: 'files', label: 'Files', count: files.length || undefined, warn: hasMissingFiles || undefined },
    { name: 'body', label: 'Body' },
    { name: 'script', label: 'Scripting' },
  ];

  function renderImplicitSection() {
    return (
      <div className={styles.implicitSection}>
        <button className={styles.implicitToggle} onClick={() => setImplicitExpanded(e => !e)}>
          <span className={`${styles.implicitChevron} ${implicitExpanded ? styles.implicitChevronOpen : ''}`}>▶</span>
          Sent automatically
          <span className={styles.implicitCount}>{implicitItems.length}</span>
        </button>
        {implicitExpanded && (
          <div className={styles.implicitContent}>
            <KeyValueEditor
              items={implicitItems}
              onChange={handleImplicitChange}
              hideActions
              markedKeys={implicitChangedKeys}
              disabledKeys={implicitDisabledKeys}
            />
          </div>
        )}
      </div>
    );
  }

  function renderPinnedContent(p: PinnableTab) {
    if (p === 'params') {
      return <KeyValueEditor items={request!.params} onChange={(params) => onRequestChange({ params })} envVars={envVars} secrets={secrets} naturalHeight />;
    }
    if (p === 'headers') {
      return (
        <div className={styles.headersContent}>
          {renderImplicitSection()}
          <KeyValueEditor items={userHeaders} onChange={handleUserHeadersChange} envVars={envVars} secrets={secrets} naturalHeight />
        </div>
      );
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
      <div className={styles.header}>
        <span className={styles.sectionLabel}>Request</span>
        <ContentTypeSelector value={currentContentType} onChange={handleContentTypeChange} />
        <div className={styles.spacer} />
        {bodySize && <span className={styles.sizeTag}>{bodySize}</span>}
        {request.body.trim() && (
          <div
            className={`${styles.validationTag} ${bodyValidation.valid ? styles.validationTagValid : styles.validationTagInvalid}`}
            title={bodyValidation.error}
          >
            {bodyValidation.valid ? '✓ Valid' : `✗ ${bodyValidation.error || 'Invalid'}`}
          </div>
        )}
      </div>
      <div className={styles.tabBar}>
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
                {tab.warn && (
                  <span className={styles.warn}>⚠</span>
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
        <label className={styles.cookieToggle} title="Automatically send and store cookies">
          <input
            type="checkbox"
            checked={useCookieJar}
            onChange={(e) => onUseCookieJarChange?.(e.target.checked)}
          />
          <span>Cookies</span>
        </label>
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
            envVars={envVars}
            secrets={secrets}
          />
        )}
        {activeTab === 'headers' && (
          <div className={styles.headersContent}>
            {renderImplicitSection()}
            <KeyValueEditor
              items={userHeaders}
              onChange={handleUserHeadersChange}
              envVars={envVars}
              secrets={secrets}
            />
          </div>
        )}
        {activeTab === 'body' && (
          <Suspense fallback={null}>
            <BodyEditor
              body={request.body}
              contentType={currentContentType}
              onChange={handleBodyChange}
              copyFlash={copyFlash}
              envVars={envVars}
              secrets={secrets}
            />
          </Suspense>
        )}
        {activeTab === 'files' && (
          <FileUpload files={files} onChange={onFilesChange} />
        )}
        {activeTab === 'script' && (
          <ScriptEditor
            requestId={request.id}
            preScript={request.pre_script}
            postScript={request.post_script}
            onChange={onRequestChange}
            consoleLogs={consoleLogs}
            onClearLogs={onClearLogs}
            envVars={envVars}
            secrets={secrets}
            onTest={onScriptTest}
          />
        )}
      </div>
    </div>
  );
}
