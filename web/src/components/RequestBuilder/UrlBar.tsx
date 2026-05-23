import { useEffect, useRef, useState } from 'react';
import type { HTTPMethod, Request, Environment, KeyValue } from '../../lib/types';
import { getMethodColor, getMethodIcon } from '../../lib/utils';
import { EnvSelector } from './EnvSelector';
import { TemplateInput } from './TemplateInput';
import styles from './UrlBar.module.css';
import { parseCurl, type CurlImport } from '../../lib/parseCurl';

interface UrlError {
  message: string;
  start?: number;
  end?: number;
}

interface UrlBarProps {
  request: Request | null;
  isLoading: boolean;
  isBlocked?: boolean;
  urlError?: UrlError | null;
  showExpandBtn?: boolean;
  onExpand?: () => void;
  onMethodChange: (method: HTTPMethod) => void;
  onUrlChange: (url: string) => void;
  onUrlBlur?: (url: string) => void;
  onNameChange: (name: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  followRedirects: boolean;
  onFollowRedirectsChange: (value: boolean) => void;
  environments: Environment[];
  activeEnvId: number | null;
  onEnvSelect: (env: Environment | null) => void;
  envVars?: KeyValue[];
  secrets?: KeyValue[];
  canNavigateBack?: boolean;
  canNavigateForward?: boolean;
  onNavigateBack?: () => void;
  onNavigateForward?: () => void;
  onNew?: () => void;
  envDisabled?: boolean;
  onCurlImport?: (data: CurlImport) => void;
  onOpenDocs?: () => void;
  hasDocs?: boolean;
}

const METHODS: HTTPMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

function MethodSelector({ method, onChange }: { method: HTTPMethod; onChange: (m: HTTPMethod) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className={styles.methodWrapper}>
      <button
        className={styles.methodPill}
        style={{ color: getMethodColor(method), borderColor: getMethodColor(method) }}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.methodPillIcon}>{getMethodIcon(method)}</span>
        <span>{method}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden className={styles.methodChevron}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className={styles.methodDropdown}>
          {METHODS.map((m) => (
            <button
              key={m}
              className={`${styles.methodOption} ${m === method ? styles.methodOptionActive : ''}`}
              style={{ '--method-color': getMethodColor(m) } as React.CSSProperties}
              onClick={() => { onChange(m); setOpen(false); }}
            >
              <span className={styles.methodOptionIcon}>{getMethodIcon(m)}</span>
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function renderUrlSegments(url: string, error: UrlError) {
  const { start, end } = error;
  if (start === undefined || end === undefined || start >= end || start < 0 || end > url.length) {
    return <span className={styles.urlErrorSpan}>{url}</span>;
  }
  return (
    <>
      {start > 0 && <span>{url.slice(0, start)}</span>}
      <span className={styles.urlErrorSpan}>{url.slice(start, end)}</span>
      {end < url.length && <span>{url.slice(end)}</span>}
    </>
  );
}

export function UrlBar({
  request,
  isLoading,
  isBlocked,
  urlError,
  showExpandBtn,
  onExpand,
  onMethodChange,
  onUrlChange,
  onUrlBlur,
  onNameChange,
  onSend,
  onCancel,
  followRedirects,
  onFollowRedirectsChange,
  environments,
  activeEnvId,
  onEnvSelect,
  envVars = [],
  secrets = [],
  canNavigateBack,
  canNavigateForward,
  onNavigateBack,
  onNavigateForward,
  onNew,
  envDisabled,
  onCurlImport,
  onOpenDocs,
  hasDocs,
}: UrlBarProps) {
  const [blockedToastKey, setBlockedToastKey] = useState<number | null>(null);
  const [curlToastKey, setCurlToastKey] = useState<number | null>(null);

  const handleUrlBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const url = e.target.value;
    if (onUrlBlur) {
      onUrlBlur(url);
    }
  };
  const method = request?.method ?? 'GET';
  const url = request?.url ?? '';
  return (
    <div className={styles.urlBar}>
      {showExpandBtn && (
        <button className={styles.expandBtn} onClick={onExpand} title="Show navigator">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M5.5 3.5L9 7L5.5 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
      {onNew && (
        <button className={styles.newBtn} onClick={onNew} title="New request (Cmd+N)">
          +
        </button>
      )}
      <div className={styles.navButtons}>
        <button
          className={styles.navBtn}
          onClick={onNavigateBack}
          disabled={!canNavigateBack}
          title="Back (Cmd+[)"
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden>
            <path d="M7.5 2L2.5 8L7.5 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          className={styles.navBtn}
          onClick={onNavigateForward}
          disabled={!canNavigateForward}
          title="Forward (Cmd+])"
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="none" aria-hidden>
            <path d="M2.5 2L7.5 8L2.5 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <input
        type="text"
        className={styles.nameInput}
        placeholder="Request name"
        value={request?.name ?? ''}
        title={request?.name ?? ''}
        onChange={(e) => onNameChange(e.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {onOpenDocs && (
        <button
          type="button"
          className={`${styles.docsBtn} ${hasDocs ? styles.docsBtnActive : ''}`}
          onClick={onOpenDocs}
          title={hasDocs ? 'Edit OpenAPI documentation' : 'Add OpenAPI documentation'}
          aria-label="Open documentation"
          style={{ color: getMethodColor(method) }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M3 2.5h7.5L13 5v8.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
              fill="none"
            />
            <path d="M10 2.5V5h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
            <path d="M4.5 8h6M4.5 10.5h6M4.5 13h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {hasDocs && <span className={styles.docsDot} style={{ background: getMethodColor(method) }} />}
        </button>
      )}
      <EnvSelector
        environments={environments}
        activeEnvId={activeEnvId}
        onSelect={onEnvSelect}
        disabled={envDisabled}
      />
      <MethodSelector method={method} onChange={onMethodChange} />
      <div
        className={styles.urlInputWrapper}
        onPaste={(e) => {
          const text = e.clipboardData.getData('text');
          if (text.trimStart().toLowerCase().startsWith('curl ') && onCurlImport) {
            const parsed = parseCurl(text);
            if (parsed) {
              e.preventDefault();
              onCurlImport(parsed);
              setCurlToastKey(Date.now());
            }
          }
        }}
      >
        {urlError && url && (
          <div className={styles.urlOverlay} aria-hidden>
            {renderUrlSegments(url, urlError)}
          </div>
        )}
        <TemplateInput
          key={request?.id ?? 'none'}
          value={url}
          onChange={onUrlChange}
          placeholder="https://api.example.com/endpoint"
          envVars={envVars}
          secrets={secrets}
          showTitle
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (isBlocked) { setBlockedToastKey(Date.now()); return; }
              if (!isLoading) onSend();
            }
          }}
          onBlur={handleUrlBlur}
        />
        <label className={styles.redirectToggle} title="Follow 3xx redirects automatically">
          <input
            type="checkbox"
            checked={followRedirects}
            onChange={(e) => onFollowRedirectsChange(e.target.checked)}
          />
          <span>3xx Redirects</span>
        </label>
      </div>
      <button
        className={(isLoading || isBlocked) ? `${styles.sendBtn} ${styles.sendBtnCancel}` : styles.sendBtn}
        onClick={isLoading ? onCancel : onSend}
        disabled={isBlocked || (!isLoading && !url)}
        title={isLoading ? 'Cancel request' : isBlocked ? 'Another request is in progress' : 'Send request (Enter)'}
      >
        {(isLoading || isBlocked) ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          '→'
        )}
      </button>
      {blockedToastKey !== null && (
        <div key={blockedToastKey} className={styles.blockedToast}>
          A request is already in progress
        </div>
      )}
      {curlToastKey !== null && (
        <div key={curlToastKey} className={styles.blockedToast}>
          Imported from cURL
        </div>
      )}
    </div>
  );
}
