import { useEffect, useRef, useState } from 'react';
import type { HTTPMethod, Request, Environment } from '../../lib/types';
import { getMethodColor, getMethodIcon } from '../../lib/utils';
import { EnvSelector } from './EnvSelector';
import styles from './UrlBar.module.css';

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
  onNameChange: (name: string) => void;
  onSend: () => void;
  onCancel?: () => void;
  followRedirects: boolean;
  onFollowRedirectsChange: (value: boolean) => void;
  environments: Environment[];
  activeEnvId: number | null;
  onEnvSelect: (env: Environment) => void;
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
  onNameChange,
  onSend,
  onCancel,
  followRedirects,
  onFollowRedirectsChange,
  environments,
  activeEnvId,
  onEnvSelect,
}: UrlBarProps) {
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
      <EnvSelector
        environments={environments}
        activeEnvId={activeEnvId}
        onSelect={onEnvSelect}
      />
      <MethodSelector method={method} onChange={onMethodChange} />
      <div className={styles.urlInputWrapper}>
        {urlError && url && (
          <div className={styles.urlOverlay} aria-hidden>
            {renderUrlSegments(url, urlError)}
          </div>
        )}
        <input
          key={request?.id ?? 'none'}
          type="text"
          className={styles.urlInput}
          placeholder="https://api.example.com/endpoint"
          defaultValue={url}
          onChange={(e) => onUrlChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
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
        className={isLoading ? `${styles.sendBtn} ${styles.sendBtnCancel}` : styles.sendBtn}
        onClick={isLoading ? onCancel : onSend}
        disabled={isBlocked || (!isLoading && !url)}
        title={isLoading ? 'Cancel request' : isBlocked ? 'Another request is in progress' : 'Send request (Enter)'}
      >
        {isLoading ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          '→'
        )}
      </button>
    </div>
  );
}
