import { useEffect, useRef, useState } from 'react';
import type { HTTPMethod, Request, Environment, KeyValue } from '../../lib/types';
import { getMethodColor, getMethodIcon, getProtocol, getUrlScheme, stripScheme, type UrlScheme } from '../../lib/utils';
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
  onMethodChange: (method: string) => void;
  onSchemeChange: (scheme: UrlScheme) => void;
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

const METHODS: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
const SCHEMES: UrlScheme[] = ['http', 'https', 'ws', 'wss'];

/** Live URL validity for enabling Send. Templated URLs are validated at send time,
 *  and a missing scheme is fine (it defaults to https), so only structural errors fail. */
function isUrlValid(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes('{{')) return true;
  try { new URL(getUrlScheme(trimmed) ? trimmed : `https://${trimmed}`); return true; } catch { return false; }
}

/** Build the stored (full) URL from the visible remainder + selected scheme.
 *  A pasted full URL lifts its scheme into the dropdown rather than being double-prefixed. */
function combineRemainder(remainder: string, scheme: UrlScheme): string {
  if (getUrlScheme(remainder)) return remainder;
  return `${scheme}://${remainder}`;
}

function schemeColor(scheme: UrlScheme | null): string {
  switch (scheme) {
    case 'https': return 'var(--accent-get)';
    case 'http': return 'var(--accent-options)';
    case 'ws':
    case 'wss': return getMethodColor('WS');
    default: return 'var(--text-tertiary)';
  }
}

function MethodSelector({ method, onChange, disabled }: { method: HTTPMethod; onChange: (m: string) => void; disabled?: boolean }) {
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
        disabled={disabled}
        title={disabled ? 'WebSocket connections always use a GET handshake' : undefined}
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

function SchemeSelector({ value, onChange }: { value: UrlScheme; onChange: (s: UrlScheme) => void }) {
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

  const color = schemeColor(value);

  return (
    <div ref={ref} className={styles.schemeWrapper}>
      <button
        className={styles.schemePill}
        style={{ color, borderColor: color }}
        onClick={() => setOpen((o) => !o)}
        title="URL scheme"
      >
        <span>{value}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden className={styles.methodChevron}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className={styles.schemeDropdown}>
          {SCHEMES.map((s) => (
            <button
              key={s}
              className={`${styles.schemeOption} ${s === value ? styles.schemeOptionActive : ''}`}
              style={{ '--scheme-color': schemeColor(s) } as React.CSSProperties}
              onClick={() => { onChange(s); setOpen(false); }}
            >
              {s}
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
  onSchemeChange,
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

  const method = request?.method ?? 'GET';
  const url = request?.url ?? '';
  const isWs = getProtocol(url) === 'ws';

  // The stored URL carries the scheme; the dropdown owns it and the text box shows only
  // the remainder. The full URL is reconstructed on every change/selection.
  const scheme: UrlScheme = getUrlScheme(url) ?? 'https';
  const remainder = stripScheme(url);

  const handleUrlBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (onUrlBlur) {
      onUrlBlur(combineRemainder(e.target.value, scheme));
    }
  };

  // Validation offsets come from the full URL; shift them into the scheme-less remainder.
  const prefixLen = url.length - remainder.length;
  const overlayError: UrlError | null =
    urlError && urlError.start !== undefined && urlError.end !== undefined
      ? { ...urlError, start: Math.max(0, urlError.start - prefixLen), end: Math.max(0, urlError.end - prefixLen) }
      : urlError ?? null;
  const sendBlockedByUrl = !isUrlValid(url);
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
      <MethodSelector method={method} onChange={onMethodChange} disabled={isWs} />
      <SchemeSelector value={scheme} onChange={onSchemeChange} />
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
        {overlayError && remainder && (
          <div className={styles.urlOverlay} aria-hidden>
            {renderUrlSegments(remainder, overlayError)}
          </div>
        )}
        <TemplateInput
          key={request?.id ?? 'none'}
          value={remainder}
          onChange={(r) => onUrlChange(combineRemainder(r, scheme))}
          placeholder="api.example.com/endpoint"
          envVars={envVars}
          secrets={secrets}
          showTitle
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (isWs) return; // WS connect/disconnect is owned by the WebSocket view
              if (isBlocked) { setBlockedToastKey(Date.now()); return; }
              if (sendBlockedByUrl) return;
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
      {!isWs && (
        <button
          className={(isLoading || isBlocked) ? `${styles.sendBtn} ${styles.sendBtnCancel}` : styles.sendBtn}
          onClick={isLoading ? onCancel : onSend}
          disabled={isBlocked || (!isLoading && sendBlockedByUrl)}
          title={
            isLoading ? 'Cancel request'
            : isBlocked ? 'Another request is in progress'
            : !isUrlValid(url) ? 'Invalid URL'
            : 'Send request (Enter)'
          }
        >
          {(isLoading || isBlocked) ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            '→'
          )}
        </button>
      )}
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
