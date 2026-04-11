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
  urlError?: UrlError | null;
  showExpandBtn?: boolean;
  onExpand?: () => void;
  onMethodChange: (method: HTTPMethod) => void;
  onUrlChange: (url: string) => void;
  onNameChange: (name: string) => void;
  onSend: () => void;
  followRedirects: boolean;
  onFollowRedirectsChange: (value: boolean) => void;
  environments: Environment[];
  activeEnvId: number | null;
  onEnvSelect: (env: Environment) => void;
}

const METHODS: HTTPMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

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
  urlError,
  showExpandBtn,
  onExpand,
  onMethodChange,
  onUrlChange,
  onNameChange,
  onSend,
  followRedirects,
  onFollowRedirectsChange,
  environments,
  activeEnvId,
  onEnvSelect,
}: UrlBarProps) {
  const method = request?.method ?? 'GET';
  const url = request?.url ?? '';
  const methodColor = getMethodColor(method);

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
      <select
        className={styles.methodSelect}
        value={method}
        onChange={(e) => onMethodChange(e.target.value as HTTPMethod)}
        style={{ backgroundColor: methodColor }}
      >
        {METHODS.map((m) => (
          <option key={m} value={m}>
            {getMethodIcon(m)} {m}
          </option>
        ))}
      </select>
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
        className={styles.sendBtn}
        onClick={onSend}
        disabled={isLoading || !url}
        title="Send request (Enter)"
      >
        {isLoading ? '⟳' : '→'}
      </button>
    </div>
  );
}
