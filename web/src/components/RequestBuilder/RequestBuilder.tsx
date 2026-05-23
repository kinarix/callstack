import { useRef, useCallback, useState, useEffect } from 'react';
import type { EditorView } from '@codemirror/view';
import { ExternalChange } from '@uiw/react-codemirror';
import type { Request, KeyValue, LogEntry, FileAttachment, Environment, DocumentationFields } from '../../lib/types';
import { UrlBar } from './UrlBar';
import { TabPanel } from './TabPanel';
import { ResponseViewer } from '../ResponseViewer/ResponseViewer';
import DocsModal from './DocsEditor/DocsModal';
import styles from './RequestBuilder.module.css';
import { useApp } from '../../context/AppContext';
import { useHttpClient } from '../../hooks/useHttpClient';
import { useDatabase } from '../../hooks/useDatabase';
import { resolveTemplate, replaceTokensForValidation } from '../../lib/template';
import FormatWorker from '../../workers/formatBody.worker.ts?worker';

function formatBodyAsync(body: string, contentType: string): Promise<string> {
  return new Promise((resolve) => {
    const worker = new FormatWorker();
    worker.onmessage = (e: MessageEvent<string>) => { resolve(e.data); worker.terminate(); };
    worker.onerror = () => { resolve(body); worker.terminate(); };
    worker.postMessage({ body, contentType });
  });
}
import { getImplicitHeaders } from '../../lib/utils';
import { runScript } from '../../hooks/useScriptRunner';
import type { EnvMutations } from '../../hooks/useScriptRunner';
import type { Settings } from '../../hooks/useSettings';
import type { CurlImport } from '../../lib/parseCurl';

interface RequestBuilderProps {
  request: Request | null;
  showExpandBtn?: boolean;
  onExpand?: () => void;
  executeRef?: React.MutableRefObject<(() => void) | null>;
  copyFlashPane?: 'request' | 'response' | null;
  onCopyResponse?: () => void;
  onRequestFocus?: () => void;
  onResponseFocus?: () => void;
  httpTimeout?: number;
  settings: Settings;
  onNew?: (initialUrl?: string) => void;
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
    // Return as-is — do NOT lowercase. If the URL contains template variables
    // like {{baseUrl}}, lowercasing would corrupt the variable names.
    return trimmed;
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

function buildCurl(method: string, url: string, params: KeyValue[], headers: KeyValue[], body: string): string {
  const parts = [`curl -X ${method}`];
  const activeHeaders = headers.filter(h => h.enabled !== false && h.key.trim());
  const ct = activeHeaders.find(h => h.key.toLowerCase() === 'content-type')?.value ?? '';
  let bodyStr = '';
  if (body.trim() && ['POST', 'PUT', 'PATCH'].includes(method)) {
    bodyStr = body.trim().replace(/\r/g, '');
    if (ct.includes('json')) {
      try { bodyStr = JSON.stringify(JSON.parse(bodyStr)); } catch {}
    } else {
      bodyStr = bodyStr.replace(/\n/g, ' ').replace(/\s+/g, ' ');
    }
  }
  const bodyLength = bodyStr ? new TextEncoder().encode(bodyStr).length : 0;
  const allHeaders = [...activeHeaders, ...getImplicitHeaders(url, activeHeaders, bodyLength, headers)];
  for (const h of allHeaders) {
    parts.push(`-H ${JSON.stringify(`${h.key}: ${h.value}`)}`);
  }
  if (bodyStr) {
    parts.push(`--data ${JSON.stringify(bodyStr)}`);
  }
  const activeParams = params.filter(p => p.enabled !== false && p.key.trim());
  if (activeParams.length > 0) {
    const baseUrl = url.includes('?') ? url.slice(0, url.indexOf('?')) : url;
    const qs = activeParams.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    url = `${baseUrl}?${qs}`;
  }
  parts.push(JSON.stringify(url));
  return parts.join(' ');
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


export function RequestBuilder({ request, showExpandBtn, onExpand, executeRef, copyFlashPane, onCopyResponse, onRequestFocus, onResponseFocus, httpTimeout, settings, onNew }: RequestBuilderProps) {
  const { state, dispatch } = useApp();
  const { send, cancelRequest } = useHttpClient();
  const { updateRequest, saveResponse, updateEnvironment, updateEnvironmentSecrets } = useDatabase();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const bodyEditorViewRef = useRef<EditorView | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<UrlError | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [docsOpen, setDocsOpen] = useState(false);
  const followRedirects = request?.follow_redirects ?? true;
  const useCookieJar = request?.use_cookie_jar ?? true;
  const [files, setFiles] = useState<FileAttachment[]>(() => request?.files ?? []);
  const [activeEnvId, setActiveEnvId] = useState<number | null>(request?.env_id ?? null);

  useEffect(() => {
    setActiveEnvId(request?.env_id ?? null);
  }, [request?.id]);

  useEffect(() => {
    setFiles(request?.files ?? []);
  }, [request?.id]);
  const [splitPct, setSplitPct] = useState(() => {
    const v = localStorage.getItem('callstack.splitPct');
    return v ? parseFloat(v) : 50;
  });

  const startPanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = (e.currentTarget as HTMLElement).parentElement!;
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const zoom = parseFloat(getComputedStyle(container).getPropertyValue('--app-zoom')) || 1;
      const pct = Math.max(25, Math.min(75, ((ev.clientX / zoom - rect.left) / rect.width) * 100));
      setSplitPct(pct);
      localStorage.setItem('callstack.splitPct', pct.toFixed(1));
    };
    const onUp = () => {
      document.body.style.userSelect = '';
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
        const fields: Record<string, string | boolean> = {};
        if (changes.name !== undefined) fields.name = changes.name;
        if (changes.method !== undefined) fields.method = changes.method;
        if (changes.url !== undefined) fields.url = changes.url;
        if (changes.params !== undefined) fields.params = JSON.stringify(changes.params);
        if (changes.headers !== undefined) fields.headers = JSON.stringify(changes.headers);
        if (changes.body !== undefined) fields.body = changes.body;
        if (changes.files !== undefined) fields.attachments = JSON.stringify(changes.files);
        if (changes.pre_script !== undefined) fields.pre_script = changes.pre_script;
        if (changes.post_script !== undefined) fields.post_script = changes.post_script;
        if (changes.follow_redirects !== undefined) fields.follow_redirects = changes.follow_redirects;
        if (changes.use_cookie_jar !== undefined) fields.use_cookie_jar = changes.use_cookie_jar;
        if (changes.pre_chain !== undefined) fields.pre_chain = JSON.stringify(changes.pre_chain);
        if (changes.documentation !== undefined) fields.documentation = JSON.stringify(changes.documentation);
        updateRequest(id, fields);
      }, 300);
    },
    [updateRequest]
  );

  const handleFilesChange = useCallback(
    (newFiles: FileAttachment[]) => {
      setFiles(newFiles);
      if (request) {
        dispatch({ type: 'UPDATE_REQUEST', payload: { ...request, files: newFiles } });
        saveToDb(request.id, { files: newFiles });
      }
    },
    [request, saveToDb, dispatch]
  );

  const handleCurlImport = useCallback((data: CurlImport) => {
    if (!request) return;
    const changes: Partial<Request> = {
      method: data.method as Request['method'],
      url: data.url,
      headers: data.headers.length ? data.headers : request.headers,
      params: data.params.length ? data.params : request.params,
      body: data.body,
    };
    if (BODY_METHODS.has(data.method) && !getContentType(changes.headers!)) {
      changes.headers = upsertContentType(changes.headers!, 'application/json');
    }
    dispatch({ type: 'UPDATE_REQUEST', payload: { ...request, ...changes } });
    saveToDb(request.id, changes);
  }, [request, dispatch, saveToDb]);

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

      // Extract and sync params from URL on every keystroke if URL contains valid query string
      let updatedChanges: Partial<Request> = { url };
      const questionMarkIndex = url.indexOf('?');

      if (questionMarkIndex !== -1) {
        const queryString = url.substring(questionMarkIndex + 1);
        // Only extract if query string looks complete (doesn't end with = or &, meaning they're still typing)
        if (queryString && !queryString.endsWith('=') && !queryString.endsWith('&')) {
          try {
            const extractedParams: KeyValue[] = [];
            const params = new URLSearchParams(queryString);
            params.forEach((value, key) => {
              // Only add params that have both key and value
              if (key && value) {
                extractedParams.push({ key, value, enabled: true });
              }
            });

            // Only update if we extracted at least one valid param
            if (extractedParams.length > 0) {
              // Merge extracted params with existing ones (avoid duplicates)
              const newParams = [
                ...request.params.filter(p => !extractedParams.some(ep => ep.key === p.key)),
                ...extractedParams,
              ];
              updatedChanges.params = newParams;
            }
          } catch {
            // Invalid query string, just update URL without params
          }
        }
      }

      dispatch({ type: 'UPDATE_REQUEST', payload: { ...request, ...updatedChanges } });
      saveToDb(request.id, updatedChanges);
    }
  };

  const buildUrlWithParams = (baseUrl: string, params: KeyValue[]): string => {
    const questionMarkIndex = baseUrl.indexOf('?');
    const urlWithoutQuery = questionMarkIndex !== -1 ? baseUrl.substring(0, questionMarkIndex) : baseUrl;

    const enabledParams = params.filter(p => p.enabled !== false && p.key);
    if (enabledParams.length === 0) {
      return urlWithoutQuery;
    }

    const queryString = enabledParams
      .map(p => `${p.key}=${p.value}`)
      .join('&');

    return `${urlWithoutQuery}?${queryString}`;
  };

  const handleUrlBlur = (url: string) => {
    if (request) {
      // Extract query parameters from URL if present (only on blur)
      let extractedParams: KeyValue[] = [];

      const questionMarkIndex = url.indexOf('?');
      if (questionMarkIndex !== -1) {
        // URL has query string, extract it
        const queryString = url.substring(questionMarkIndex + 1);

        // Parse query string manually
        if (queryString) {
          const params = new URLSearchParams(queryString);
          params.forEach((value, key) => {
            extractedParams.push({
              key,
              value,
              enabled: true,
            });
          });
        }
      }

      // Merge extracted params with existing params (avoid duplicates - extracted params take precedence)
      const newParams = [
        ...request.params.filter(p => !extractedParams.some(ep => ep.key === p.key)),
        ...extractedParams,
      ];

      // Keep the URL as-is (with query string), just update params to avoid duplicates
      dispatch({ type: 'UPDATE_REQUEST', payload: { ...request, url, params: newParams } });
      saveToDb(request.id, { url, params: newParams });
    }
  };

  const handleRequestChange = (changes: Partial<Request>) => {
    if (request) {
      setBodyError(null);

      // If params are being updated, rebuild the URL with the new query string
      if (changes.params && changes.url === undefined) {
        const baseUrl = request.url;
        const updatedUrl = buildUrlWithParams(baseUrl, changes.params);
        const finalChanges = { ...changes, url: updatedUrl };
        dispatch({ type: 'UPDATE_REQUEST', payload: { ...request, ...finalChanges } });
        saveToDb(request.id, finalChanges);
      } else {
        dispatch({ type: 'UPDATE_REQUEST', payload: { ...request, ...changes } });
        saveToDb(request.id, changes);
      }
    }
  };

  const setFollowRedirects = (v: boolean) => handleRequestChange({ follow_redirects: v });
  const setUseCookieJar = (v: boolean) => handleRequestChange({ use_cookie_jar: v });

  const handleEnvSelect = (env: Environment | null) => {
    if (!request) return;
    const envId = env?.id ?? null;
    setActiveEnvId(envId);
    updateRequest(request.id, { env_id: envId }).then((updated) => {
      dispatch({ type: 'UPDATE_REQUEST', payload: updated });
    });
  };

  const isScratchRequest = state.scratchProjectId != null && request?.project_id === state.scratchProjectId;
  const projectEnvironments = state.environments.filter(
    (e) => e.project_id === (request?.project_id ?? -1)
  );

  const activeEnv = projectEnvironments.find((e) => e.id === activeEnvId) ?? null;
  const envVars = activeEnv?.variables ?? [];
  const secrets = activeEnv?.secrets ?? [];

  const applyEnvMutations = useCallback(async (mutations: { set: Record<string, string>; unset: string[] }) => {
    if (!activeEnv || (Object.keys(mutations.set).length === 0 && mutations.unset.length === 0)) return;
    const updatedVars = activeEnv.variables
      .filter((v) => !mutations.unset.includes(v.key))
      .map((v) => mutations.set[v.key] !== undefined ? { ...v, value: mutations.set[v.key] } : v);
    for (const [key, value] of Object.entries(mutations.set)) {
      if (!updatedVars.find((v) => v.key === key)) {
        updatedVars.push({ key, value, enabled: true });
      }
    }
    const updated = await updateEnvironment(activeEnv.id, activeEnv.name, updatedVars);
    dispatch({ type: 'UPDATE_ENVIRONMENT', payload: updated });
  }, [activeEnv, updateEnvironment, dispatch]);

  const applySecretMutations = useCallback(async (mutations: EnvMutations) => {
    if (!activeEnv || (Object.keys(mutations.set).length === 0 && mutations.unset.length === 0)) return;
    let current = [...activeEnv.secrets];
    current = current.filter((s) => !mutations.unset.includes(s.key));
    current = current.map((s) => mutations.set[s.key] !== undefined ? { ...s, value: mutations.set[s.key] } : s);
    for (const [key, value] of Object.entries(mutations.set)) {
      if (!current.find((s) => s.key === key)) {
        current.push({ key, value, enabled: true });
      }
    }
    const filtered = current.filter((s) => s.key);
    dispatch({ type: 'UPDATE_ENVIRONMENT', payload: { ...activeEnv, secrets: filtered } });
    await updateEnvironmentSecrets(activeEnv.id, filtered);
  }, [activeEnv, updateEnvironmentSecrets, dispatch]);

  const handleScriptTest = useCallback((script: string, isPost: boolean) => {
    if (!script.trim()) return;
    setConsoleLogs([]);
    const result = runScript(script, {
      request: request ?? undefined,
      response: isPost ? (state.currentResponse ?? undefined) : undefined,
      envVars,
      secrets,
    });

    if (result.secretMutations) applySecretMutations(result.secretMutations);

    // Append test result summaries to console output
    const testLines: string[] = [];
    if (result.testResults.length > 0) {
      testLines.push('');
      for (const r of result.testResults) {
        const icon = r.passed ? '✓' : '✗';
        const detail = r.passed ? (r.message ? ` — ${r.message}` : '') : (r.error ? ` — ${r.error}` : '');
        testLines.push(`${icon} ${r.description}${detail}`);
      }
      const passed = result.testResults.filter(r => r.passed).length;
      testLines.push(`\n${passed}/${result.testResults.length} passed`);
    }
    setConsoleLogs([...result.logs, ...testLines]);

    if (isPost && result.envMutations) applyEnvMutations(result.envMutations);

    // Update response panel with test results if a real response exists
    if (isPost && state.currentResponse) {
      let testResults: import('../../lib/types').TestResult[] | undefined;
      let testStatus: import('../../lib/types').TestStatus | undefined;

      if (result.testResults.length > 0) {
        testResults = result.testResults;
        const passed = testResults.filter((t) => t.passed).length;
        testStatus = passed === testResults.length ? 'PASS' : passed === 0 ? 'FAIL' : 'PARTIAL';
      }

      dispatch({
        type: 'SET_RESPONSE',
        payload: {
          ...state.currentResponse,
          testResults,
          testStatus,
        },
      });
    }
  }, [request, state.currentResponse, envVars, applyEnvMutations, dispatch]);

  const handleSend = async () => {
    if (!request || !request.url) return;
    if (state.isLoading) return;

    // Clear console on each send
    setConsoleLogs([]);

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_EXECUTING_REQUEST', payload: request.id });

    // ── Pre-chain ─────────────────────────────────────────────────────────────
    // Locally-mutable env/secrets so each step (and the main request) sees env
    // updates from earlier steps without waiting for the React state to settle.
    let chainEnv = envVars;
    let chainSecrets = secrets;
    const aggEnv: EnvMutations = { set: {}, unset: [] };
    const aggSecrets: EnvMutations = { set: {}, unset: [] };
    const appendLog = (line: string) => setConsoleLogs(prev => [...prev, line]);

    const mergeMutations = (which: 'env' | 'secret', mut: EnvMutations | undefined) => {
      if (!mut) return;
      const agg = which === 'env' ? aggEnv : aggSecrets;
      const apply = (val: KeyValue[]): KeyValue[] => {
        let next = val;
        for (const [k, v] of Object.entries(mut.set)) {
          agg.set[k] = v;
          const idx = next.findIndex(x => x.key === k);
          next = idx >= 0
            ? next.map((x, i) => i === idx ? { ...x, value: v, enabled: true } : x)
            : [...next, { key: k, value: v, enabled: true }];
        }
        for (const k of mut.unset) {
          if (!agg.unset.includes(k)) agg.unset.push(k);
          next = next.filter(x => x.key !== k);
        }
        return next;
      };
      if (which === 'env') chainEnv = apply(chainEnv);
      else chainSecrets = apply(chainSecrets);
    };

    if (request.pre_chain?.length) {
      appendLog(`[pre-chain] running ${request.pre_chain.length} setup step${request.pre_chain.length === 1 ? '' : 's'}…`);
      const requestsById = new Map<number, Request>(
        state.requests.filter(r => r.project_id === request.project_id).map(r => [r.id, r])
      );

      const runChainStep = async (req: Request, visited: Set<number>): Promise<{ ok: true } | { ok: false; error: string }> => {
        // Recurse into nested chain first (with cycle guard)
        if (req.pre_chain?.length) {
          for (let i = 0; i < req.pre_chain.length; i++) {
            const sub = req.pre_chain[i];
            const subReq = requestsById.get(sub.requestId);
            if (!subReq) {
              appendLog(`[pre-chain] nested step #${i + 1} of "${req.name}": request not found`);
              if (!sub.continueOnError) return { ok: false, error: `Nested pre-step #${sub.requestId} not found` };
              continue;
            }
            if (visited.has(subReq.id)) {
              appendLog(`[pre-chain] cycle detected on "${subReq.name}", skipping`);
              continue;
            }
            const sr = await runChainStep(subReq, new Set([...visited, subReq.id]));
            if (!sr.ok && !sub.continueOnError) return sr;
          }
        }

        // Execute this step silently
        const stepStart = Date.now();
        const allLive = [...chainEnv, ...chainSecrets];
        let url = resolveTemplate(req.url, allLive);
        let body = resolveTemplate(req.body, allLive);
        body = body.replace(/(?<!")\{\{#[\w.$-]+\}\}(?!")/g, '"$&"');
        let params = req.params.map(p => ({ ...p, value: resolveTemplate(p.value, allLive) }));
        let headers = req.headers.map(h => ({ ...h, value: resolveTemplate(h.value, allLive) }));

        if (req.pre_script?.trim()) {
          const pr = runScript(req.pre_script, {
            request: { method: req.method, url, headers, params, body },
            envVars: chainEnv, secrets: chainSecrets,
          });
          pr.logs.forEach(l => appendLog(l));
          mergeMutations('env', pr.envMutations);
          mergeMutations('secret', pr.secretMutations);
          if (pr.mutatedRequest) {
            url = pr.mutatedRequest.url;
            body = pr.mutatedRequest.body;
            params = pr.mutatedRequest.params;
            headers = pr.mutatedRequest.headers;
          }
        }

        const normalizedStepUrl = normalizeUrl(url);
        const stepCurl = buildCurl(req.method, normalizedStepUrl, params, headers, body);
        try {
          const result = await send({
            method: req.method, url, params, headers, body,
            followRedirects: req.follow_redirects ?? true,
            attachments: req.files ?? [],
            projectId: state.currentProjectId,
            useCookieJar: req.use_cookie_jar ?? true,
            timeoutSecs: httpTimeout ?? settings.httpTimeout,
          });
          const ms = Date.now() - stepStart;
          appendLog(`[pre-chain] ${req.method} ${url} → ${result.status} (${ms}ms)`);
          dispatch({
            type: 'ADD_LOG',
            payload: {
              id: ++logIdCounter,
              timestamp: stepStart,
              method: req.method,
              url: normalizedStepUrl,
              curl: stepCurl,
              status: result.status,
              statusText: result.statusText,
              time: result.timeMs,
              size: result.size,
            },
          });

          if (req.post_script?.trim()) {
            const pr = runScript(req.post_script, {
              request: { method: req.method, url, headers, params, body },
              response: { status: result.status, statusText: result.statusText, headers: result.headers, body: result.body, time: result.timeMs },
              envVars: chainEnv, secrets: chainSecrets,
            });
            pr.logs.forEach(l => appendLog(l));
            mergeMutations('env', pr.envMutations);
            mergeMutations('secret', pr.secretMutations);
          }

          if (result.status >= 400) {
            return { ok: false, error: `${req.method} ${req.name} → ${result.status}` };
          }
          return { ok: true };
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          appendLog(`[pre-chain] ${req.method} ${req.name} → error: ${msg}`);
          dispatch({
            type: 'ADD_LOG',
            payload: {
              id: ++logIdCounter,
              timestamp: stepStart,
              method: req.method,
              url: normalizedStepUrl,
              curl: stepCurl,
              error: msg,
            },
          });
          return { ok: false, error: msg };
        }
      };

      for (let i = 0; i < request.pre_chain.length; i++) {
        const step = request.pre_chain[i];
        const target = requestsById.get(step.requestId);
        if (!target) {
          appendLog(`[pre-chain] step #${i + 1}: request not found`);
          if (!step.continueOnError) {
            dispatch({ type: 'SET_LOADING', payload: false });
            dispatch({ type: 'SET_EXECUTING_REQUEST', payload: null });
            dispatch({ type: 'SET_RESPONSE', payload: { status: 0, statusText: 'Pre-chain failed', headers: [], body: `Pre-step #${step.requestId} not found`, time: 0, size: 0, id: 0, request_id: request.id } });
            return;
          }
          continue;
        }
        if (target.id === request.id) {
          appendLog(`[pre-chain] cycle detected on "${target.name}", skipping`);
          continue;
        }
        const sr = await runChainStep(target, new Set([request.id, target.id]));
        if (!sr.ok && !step.continueOnError) {
          dispatch({ type: 'SET_LOADING', payload: false });
          dispatch({ type: 'SET_EXECUTING_REQUEST', payload: null });
          dispatch({ type: 'SET_RESPONSE', payload: { status: 0, statusText: 'Pre-chain failed', headers: [], body: sr.error, time: 0, size: 0, id: 0, request_id: request.id } });
          return;
        }
      }

      // Commit aggregated mutations to the real env state so subsequent runs see them
      if (Object.keys(aggEnv.set).length || aggEnv.unset.length) await applyEnvMutations(aggEnv);
      if (Object.keys(aggSecrets.set).length || aggSecrets.unset.length) applySecretMutations(aggSecrets);
    }
    // ── End pre-chain ─────────────────────────────────────────────────────────

    // Format body before sending if the setting is enabled
    const sendContentType = getContentType(request.headers);
    const isFormattable = sendContentType.includes('json') || sendContentType.includes('xml') || sendContentType.includes('html');
    let rawBody = request.body;
    if (settings.formatOnSend && isFormattable && rawBody.trim()) {
      const formatted = await formatBodyAsync(rawBody, sendContentType);
      if (formatted !== rawBody) {
        rawBody = formatted;
        dispatch({ type: 'UPDATE_REQUEST', payload: { ...request, body: formatted } });
        saveToDb(request.id, { body: formatted });
        // Bypass the typing latch — update the CodeMirror view directly so the
        // formatted body renders before the response arrives.
        const view = bodyEditorViewRef.current;
        if (view) {
          const cursorPos = view.state.selection.main.head;
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: formatted },
            selection: { anchor: Math.min(cursorPos, formatted.length) },
            annotations: [ExternalChange.of(true)],
          });
        }
      }
    }

    // Apply template resolution using active env variables + secrets
    // (chainEnv/chainSecrets reflect any mutations from the pre-chain above)
    const allVars = [...chainEnv, ...chainSecrets];
    let resolvedUrl = resolveTemplate(request.url, allVars);
    let resolvedBody = resolveTemplate(rawBody, allVars);
    // Quote any unresolved {{#...}} data-file vars so the JSON body stays valid
    resolvedBody = resolvedBody.replace(/(?<!")\{\{#[\w.$-]+\}\}(?!")/g, '"$&"');
    let resolvedParams = request.params.map((p) => ({
      ...p,
      value: resolveTemplate(p.value, allVars),
    }));
    let resolvedHeaders = request.headers.map((h) => ({
      ...h,
      value: resolveTemplate(h.value, allVars),
    }));

    // Run pre-request script
    let testResults: import('../../lib/types').TestResult[] | undefined;
    let testStatus: import('../../lib/types').TestStatus | undefined;
    if (request.pre_script?.trim()) {
      const preResult = runScript(request.pre_script, {
        request: {
          method: request.method,
          url: resolvedUrl,
          headers: resolvedHeaders,
          params: resolvedParams,
          body: resolvedBody,
        },
        envVars: chainEnv,
        secrets: chainSecrets,
      });
      setConsoleLogs(prev => [...prev, ...preResult.logs]);
      if (preResult.envMutations) await applyEnvMutations(preResult.envMutations);
      if (preResult.secretMutations) applySecretMutations(preResult.secretMutations);
      if (preResult.mutatedRequest) {
        resolvedUrl = preResult.mutatedRequest.url;
        resolvedBody = preResult.mutatedRequest.body;
        resolvedParams = preResult.mutatedRequest.params;
        resolvedHeaders = preResult.mutatedRequest.headers;
      }
      if (preResult.testResults.length > 0) {
        testResults = preResult.testResults;
      }
    }

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
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    setUrlError(null);

    // Validate body before sending
    const contentType = getContentType(request.headers);
    const error = validateBody(replaceTokensForValidation(resolvedBody, contentType), contentType);
    if (error) {
      setBodyError(error);
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    setBodyError(null);

    const sentAt = Date.now();
    const curl = buildCurl(request.method, normalizedUrl, resolvedParams, resolvedHeaders, resolvedBody);

    try {
      const result = await send({
        method: request.method,
        url: normalizedUrl,
        params: resolvedParams,
        headers: resolvedHeaders,
        body: resolvedBody,
        followRedirects,
        attachments: files,
        projectId: state.currentProjectId,
        useCookieJar,
        timeoutSecs: httpTimeout ?? settings.httpTimeout,
      });

      // Run post-request script
      if (request.post_script?.trim()) {
        const postResult = runScript(request.post_script, {
          request: { method: request.method, url: normalizedUrl, headers: resolvedHeaders, params: resolvedParams, body: resolvedBody },
          response: { status: result.status, statusText: result.statusText, headers: result.headers, body: result.body, time: result.timeMs },
          envVars: chainEnv,
          secrets: chainSecrets,
        });
        setConsoleLogs((prev) => [...prev, ...postResult.logs]);
        if (postResult.envMutations) await applyEnvMutations(postResult.envMutations);
        if (postResult.secretMutations) applySecretMutations(postResult.secretMutations);
        if (postResult.testResults.length > 0) {
          testResults = [...(testResults ?? []), ...postResult.testResults];
        }
      }
      if (testResults && testResults.length > 0) {
        const passed = testResults.filter((t) => t.passed).length;
        testStatus = passed === testResults.length ? 'PASS' : passed === 0 ? 'FAIL' : 'PARTIAL';
      }

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
          transferSize: result.transferSize,
          timestamp: sentAt,
          testResults: testResults && testResults.length > 0 ? testResults : undefined,
          testStatus: testStatus || undefined,
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
        settings.responseHistoryLimit,
        resolvedHeaders,
        resolvedParams,
        resolvedBody,
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
    dispatch({ type: 'SET_EXECUTING_REQUEST', payload: null });
    }
  };

  // Keep executeRef current so App.tsx keyboard shortcut can trigger send
  if (executeRef) executeRef.current = handleSend;

  return (
    <div className={styles.builder}>
      <UrlBar
        request={request}
        isLoading={state.isLoading && state.executingRequestId === request?.id}
        isBlocked={state.isLoading && state.executingRequestId !== request?.id}
        urlError={urlError}
        showExpandBtn={showExpandBtn}
        onExpand={onExpand}
        onMethodChange={handleMethodChange}
        onUrlChange={handleUrlChange}
        onUrlBlur={handleUrlBlur}
        onNameChange={(name) => handleRequestChange({ name })}
        onSend={handleSend}
        onCancel={cancelRequest}
        followRedirects={followRedirects}
        onFollowRedirectsChange={setFollowRedirects}
        environments={projectEnvironments}
        activeEnvId={activeEnvId}
        onEnvSelect={handleEnvSelect}
        envVars={envVars}
        secrets={secrets}
        canNavigateBack={state.navHistoryIndex > 0}
        canNavigateForward={state.navHistoryIndex < state.requestNavHistory.length - 1}
        onNavigateBack={() => dispatch({ type: 'HISTORY_BACK' })}
        onNavigateForward={() => dispatch({ type: 'HISTORY_FORWARD' })}
        onNew={onNew}
        envDisabled={isScratchRequest}
        onCurlImport={handleCurlImport}
        onOpenDocs={request ? () => setDocsOpen(true) : undefined}
        hasDocs={!!request && hasDocumentation(request.documentation)}
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
        <div className={styles.requestPane} onFocus={onRequestFocus}>
          <TabPanel
            request={request}
            onRequestChange={handleRequestChange}
            files={files}
            onFilesChange={handleFilesChange}
            consoleLogs={consoleLogs}
            onClearLogs={() => setConsoleLogs([])}
            envVars={envVars}
            secrets={secrets}
            onScriptTest={handleScriptTest}
            copyFlash={copyFlashPane === 'request'}
            useCookieJar={useCookieJar}
            onUseCookieJarChange={setUseCookieJar}
            projectId={state.currentProjectId}
            bodyEditorViewRef={bodyEditorViewRef}
            siblingRequests={state.requests.filter(r => r.project_id === request?.project_id)}
          />
        </div>
        <div className={styles.splitHandle} onMouseDown={startPanelResize} />
        <div className={styles.responsePane} onFocus={onResponseFocus}>
          <ResponseViewer
            response={state.currentResponse}
            requestId={request?.id}
            requestName={request?.name}
            copyFlash={copyFlashPane === 'response'}
            onClear={() => dispatch({ type: 'SET_RESPONSE', payload: null })}
            onCopy={onCopyResponse}
            onOpenUrlInNewRequest={onNew ? (url) => onNew(url) : undefined}
          />
        </div>
      </div>
      {docsOpen && request && (
        <DocsModal
          request={request}
          response={state.currentResponse}
          envVars={envVars}
          onSave={(docs: DocumentationFields) => handleRequestChange({ documentation: docs })}
          onClose={() => setDocsOpen(false)}
        />
      )}
    </div>
  );
}

function hasDocumentation(docs: DocumentationFields | undefined | null): boolean {
  if (!docs) return false;
  return Boolean(
    docs.summary ||
    docs.description ||
    (docs.tags && docs.tags.length > 0) ||
    docs.externalDocsUrl ||
    docs.externalDocsDescription ||
    docs.operationId ||
    docs.sampleRequestBody ||
    docs.sampleResponseBody ||
    docs.sampleResponseStatus ||
    docs.yamlOverride ||
    docs.deprecated
  );
}
