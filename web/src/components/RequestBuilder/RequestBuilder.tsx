import { useRef, useCallback, useState, useEffect } from 'react';
import type { Request, KeyValue, LogEntry, FileAttachment, Environment } from '../../lib/types';
import { UrlBar } from './UrlBar';
import { TabPanel } from './TabPanel';
import { ResponseViewer } from '../ResponseViewer/ResponseViewer';
import styles from './RequestBuilder.module.css';
import { useApp } from '../../context/AppContext';
import { useHttpClient } from '../../hooks/useHttpClient';
import { useDatabase } from '../../hooks/useDatabase';
import { resolveTemplate } from '../../lib/template';

interface RequestBuilderProps {
  request: Request | null;
  showExpandBtn?: boolean;
  onExpand?: () => void;
}

interface UrlError {
  message: string;
  start?: number;
  end?: number;
}

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    // URL constructor lowercases scheme and hostname automatically
    return new URL(trimmed).toString();
  } catch {
    return trimmed.toLowerCase();
  }
}

function validateUrl(url: string): UrlError | null {
  if (!url.trim()) return null;

  const schemeMatch = url.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\//);
  if (!schemeMatch) {
    const colonSlash = url.indexOf('://');
    if (colonSlash > -1) {
      return { message: 'Invalid scheme', start: 0, end: colonSlash };
    }
    return { message: 'URL must start with http:// or https://', start: 0, end: url.length };
  }

  const scheme = schemeMatch[1].toLowerCase();
  if (scheme !== 'http' && scheme !== 'https') {
    return {
      message: `Unsupported scheme "${scheme}". Use http or https.`,
      start: 0,
      end: schemeMatch[1].length,
    };
  }

  try {
    new URL(url);
    return null;
  } catch {
    const afterScheme = schemeMatch[0].length;
    const rest = url.slice(afterScheme);

    if (!rest || rest === '/') {
      return { message: 'Missing hostname', start: afterScheme, end: url.length };
    }

    const pathStart = rest.search(/[/?#]/);
    const host = pathStart >= 0 ? rest.slice(0, pathStart) : rest;
    const portColon = host.lastIndexOf(':');

    if (portColon >= 0) {
      const portStr = host.slice(portColon + 1);
      const port = Number(portStr);
      if (portStr === '' || isNaN(port) || port < 1 || port > 65535) {
        const portStart = afterScheme + portColon;
        return {
          message: `Invalid port "${portStr}"`,
          start: portStart,
          end: portStart + 1 + portStr.length,
        };
      }
    }

    return { message: 'Invalid URL', start: 0, end: url.length };
  }
}

function getContentType(headers: KeyValue[]): string {
  return headers.find(h => h.key.toLowerCase() === 'content-type')?.value ?? '';
}

let logIdCounter = 0;

function buildCurl(method: string, url: string, headers: KeyValue[], body: string): string {
  const parts = [`curl -X ${method}`];
  const activeHeaders = headers.filter(h => h.enabled !== false && h.key.trim());
  for (const h of activeHeaders) {
    parts.push(`-H ${JSON.stringify(`${h.key}: ${h.value}`)}`);
  }
  const ct = activeHeaders.find(h => h.key.toLowerCase() === 'content-type')?.value ?? '';
  if (body.trim() && ['POST', 'PUT', 'PATCH'].includes(method)) {
    if (ct.includes('json') || ct.includes('xml') || ct.includes('plain') || ct.includes('html')) {
      parts.push(`--data ${JSON.stringify(body.trim())}`);
    } else {
      parts.push(`--data ${JSON.stringify(body.trim())}`);
    }
  }
  parts.push(JSON.stringify(url));
  return parts.join(' \\\n  ');
}

function upsertContentType(headers: KeyValue[], value: string): KeyValue[] {
  const idx = headers.findIndex(h => h.key.toLowerCase() === 'content-type');
  if (idx >= 0) {
    const next = [...headers];
    next[idx] = { ...next[idx], value };
    return next;
  }
  return [...headers, { key: 'Content-Type', value, enabled: true }];
}

function validateBody(body: string, contentType: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  if (contentType.includes('json')) {
    try {
      JSON.parse(trimmed);
    } catch (e) {
      return `Invalid JSON: ${(e as SyntaxError).message}`;
    }
  }

  if (contentType.includes('xml') || contentType.includes('html')) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, 'application/xml');
    const err = doc.querySelector('parsererror');
    if (err) {
      const msg = err.textContent?.split('\n')[0] ?? 'Invalid XML';
      return `Invalid XML: ${msg}`;
    }
  }

  return null;
}

function getActiveEnvKey(projectId: number | null) {
  return projectId ? `callstack.activeEnv.${projectId}` : null;
}

export function RequestBuilder({ request, showExpandBtn, onExpand }: RequestBuilderProps) {
  const { state, dispatch } = useApp();
  const { send } = useHttpClient();
  const { updateRequest, saveResponse } = useDatabase();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<UrlError | null>(null);
  const [followRedirects, setFollowRedirects] = useState(true);
  const [files, setFiles] = useState<FileAttachment[]>(() => request?.files ?? []);
  const [activeEnvId, setActiveEnvId] = useState<number | null>(() => {
    const key = getActiveEnvKey(request?.project_id ?? null);
    if (!key) return null;
    const v = localStorage.getItem(key);
    return v ? parseInt(v, 10) : null;
  });
  // Reload active env from localStorage when project changes
  useEffect(() => {
    const key = getActiveEnvKey(request?.project_id ?? null);
    if (!key) { setActiveEnvId(null); return; }
    const v = localStorage.getItem(key);
    setActiveEnvId(v ? parseInt(v, 10) : null);
  }, [request?.project_id]);

  useEffect(() => {
    setFiles(request?.files ?? []);
  }, [request?.id]);
  const [splitPct, setSplitPct] = useState(() => {
    const v = localStorage.getItem('callstack.splitPct');
    return v ? parseFloat(v) : 50;
  });

  const startPanelResize = useCallback((e: React.MouseEvent) => {
    const container = (e.currentTarget as HTMLElement).parentElement!;
    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = Math.max(25, Math.min(75, ((ev.clientX - rect.left) / rect.width) * 100));
      setSplitPct(pct);
      localStorage.setItem('callstack.splitPct', pct.toFixed(1));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  // Debounced save to DB (300ms after last change)
  const saveToDb = useCallback(
    (id: number, changes: Partial<Request>) => {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const fields: Record<string, string> = {};
        if (changes.name !== undefined) fields.name = changes.name;
        if (changes.method !== undefined) fields.method = changes.method;
        if (changes.url !== undefined) fields.url = changes.url;
        if (changes.params !== undefined) fields.params = JSON.stringify(changes.params);
        if (changes.headers !== undefined) fields.headers = JSON.stringify(changes.headers);
        if (changes.body !== undefined) fields.body = changes.body;
        if (changes.files !== undefined) fields.attachments = JSON.stringify(changes.files);
        updateRequest(id, fields);
      }, 300);
    },
    [updateRequest]
  );

  const handleFilesChange = useCallback(
    (newFiles: FileAttachment[]) => {
      setFiles(newFiles);
      if (request) {
        saveToDb(request.id, { files: newFiles });
      }
    },
    [request, saveToDb]
  );

  const handleMethodChange = (method: string) => {
    if (!request) return;
    const changes: Partial<Request> = { method: method as Request['method'] };

    // When switching to a body method (POST/PUT/PATCH), default Content-Type to JSON
    if (BODY_METHODS.has(method) && !getContentType(request.headers)) {
      changes.headers = upsertContentType(request.headers, 'application/json');
    }

    dispatch({ type: 'UPDATE_REQUEST', payload: { ...request, ...changes } });
    saveToDb(request.id, changes);
  };

  const handleUrlChange = (url: string) => {
    if (request) {
      if (urlError) setUrlError(null);
      dispatch({ type: 'UPDATE_REQUEST', payload: { ...request, url } });
      saveToDb(request.id, { url });
    }
  };

  const handleRequestChange = (changes: Partial<Request>) => {
    if (request) {
      setBodyError(null);
      dispatch({ type: 'UPDATE_REQUEST', payload: { ...request, ...changes } });
      saveToDb(request.id, changes);
    }
  };

  const handleEnvSelect = (env: Environment) => {
    const key = getActiveEnvKey(request?.project_id ?? null);
    if (key) localStorage.setItem(key, String(env.id));
    setActiveEnvId(env.id);
  };

  const projectEnvironments = state.environments.filter(
    (e) => e.project_id === (request?.project_id ?? -1)
  );

  const activeEnv = projectEnvironments.find((e) => e.id === activeEnvId) ?? null;
  const envVars = activeEnv?.variables ?? [];

  const handleSend = async () => {
    if (!request || !request.url) return;

    // Apply template resolution using active env variables
    const resolvedUrl = resolveTemplate(request.url, envVars);
    const resolvedBody = resolveTemplate(request.body, envVars);
    const resolvedParams = request.params.map((p) => ({
      ...p,
      value: resolveTemplate(p.value, envVars),
    }));
    const resolvedHeaders = request.headers.map((h) => ({
      ...h,
      value: resolveTemplate(h.value, envVars),
    }));

    // Normalize URL (lowercase scheme + host) — only write back if the original URL
    // itself changed, not because template variables were resolved.
    const normalizedUrl = normalizeUrl(resolvedUrl);
    const normalizedOriginal = normalizeUrl(request.url);
    if (normalizedOriginal !== request.url) {
      dispatch({ type: 'UPDATE_REQUEST', payload: { ...request, url: normalizedOriginal } });
      saveToDb(request.id, { url: normalizedOriginal });
    }

    // Validate URL
    const urlErr = validateUrl(normalizedUrl);
    if (urlErr) {
      setUrlError(urlErr);
      return;
    }
    setUrlError(null);

    // Validate body before sending
    const contentType = getContentType(request.headers);
    const error = validateBody(resolvedBody, contentType);
    if (error) {
      setBodyError(error);
      return;
    }
    setBodyError(null);

    dispatch({ type: 'SET_LOADING', payload: true });
    const sentAt = Date.now();
    const curl = buildCurl(request.method, normalizedUrl, resolvedHeaders, resolvedBody);

    try {
      const result = await send({
        method: request.method,
        url: normalizedUrl,
        params: resolvedParams,
        headers: resolvedHeaders,
        body: resolvedBody,
        followRedirects,
        attachments: files,
      });

      dispatch({
        type: 'SET_RESPONSE',
        payload: {
          id: 0,
          request_id: request.id,
          status: result.status,
          statusText: result.statusText,
          headers: result.headers,
          body: result.body,
          time: result.timeMs,
          size: result.size,
          timestamp: sentAt,
        },
      });

      saveResponse(
        request.id,
        result.status,
        result.statusText,
        result.headers,
        result.body,
        result.timeMs,
        result.size,
        sentAt,
      ).catch(console.error);

      const log: LogEntry = {
        id: ++logIdCounter,
        timestamp: sentAt,
        method: request.method,
        url: normalizedUrl,
        curl,
        status: result.status,
        statusText: result.statusText,
        time: result.timeMs,
        size: result.size,
      };
      dispatch({ type: 'ADD_LOG', payload: log });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      dispatch({
        type: 'SET_RESPONSE',
        payload: {
          id: 0,
          request_id: request.id,
          status: 0,
          statusText: '',
          headers: [],
          body: errMsg,
          time: 0,
          size: 0,
          timestamp: sentAt,
        },
      });

      const log: LogEntry = {
        id: ++logIdCounter,
        timestamp: sentAt,
        method: request.method,
        url: normalizedUrl,
        curl,
        error: errMsg,
      };
      dispatch({ type: 'ADD_LOG', payload: log });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return (
    <div className={styles.builder}>
      <UrlBar
        request={request}
        isLoading={state.isLoading}
        urlError={urlError}
        showExpandBtn={showExpandBtn}
        onExpand={onExpand}
        onMethodChange={handleMethodChange}
        onUrlChange={handleUrlChange}
        onNameChange={(name) => handleRequestChange({ name })}
        onSend={handleSend}
        followRedirects={followRedirects}
        onFollowRedirectsChange={setFollowRedirects}
        environments={projectEnvironments}
        activeEnvId={activeEnvId}
        onEnvSelect={handleEnvSelect}
      />
      {urlError && (
        <div className={styles.bodyError}>
          <span className={styles.bodyErrorIcon}>⚠</span>
          {urlError.message}
        </div>
      )}
      {bodyError && (
        <div className={styles.bodyError}>
          <span className={styles.bodyErrorIcon}>⚠</span>
          {bodyError}
        </div>
      )}
      <div
        className={styles.panes}
        style={{ gridTemplateColumns: `${splitPct}fr 4px ${100 - splitPct}fr` }}
      >
        <div className={styles.requestPane}>
          <TabPanel
            request={request}
            onRequestChange={handleRequestChange}
            files={files}
            onFilesChange={handleFilesChange}
          />
        </div>
        <div className={styles.splitHandle} onMouseDown={startPanelResize} />
        <div className={styles.responsePane}>
          <ResponseViewer
            response={state.currentResponse}
            requestName={request?.name}
            onClear={() => dispatch({ type: 'SET_RESPONSE', payload: null })}
          />
        </div>
      </div>
    </div>
  );
}
