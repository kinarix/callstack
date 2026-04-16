import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Request, KeyValue, AutomationRequestResult, TestStatus, AutomationStep, BranchCondition, LogEntry, DataFile } from '../lib/types';
import { parseCsv } from '../lib/parseCsv';
import { resolveTemplate } from '../lib/template';
import { runScript } from './useScriptRunner';
import { loadSecrets } from '../lib/secrets';
export type RunnerStatus = 'idle' | 'running' | 'done' | 'cancelled';

export interface AutomationRunState {
  status: RunnerStatus;
  results: AutomationRequestResult[];
  currentIndex: number;
  totalCount: number;
  startedAt: number | null;
  durationMs: number | null;
  overallStatus: TestStatus | 'ERROR' | null;
}

function buildCurlCmd(method: string, url: string, params: KeyValue[], headers: KeyValue[], body: string): string {
  const parts = [`curl -X ${method}`];
  const activeHeaders = headers.filter((h) => h.enabled !== false && h.key.trim());
  for (const h of activeHeaders) parts.push(`-H ${JSON.stringify(`${h.key}: ${h.value}`)}`);
  const activeParams = params.filter((p) => p.enabled !== false && p.key.trim());
  if (activeParams.length) {
    const qs = activeParams.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    url = url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
  }
  if (body.trim() && ['POST', 'PUT', 'PATCH'].includes(method)) {
    parts.push(`-d ${JSON.stringify(body.trim())}`);
  }
  parts.push(`"${url}"`);
  return parts.join(' \\\n  ');
}

function computeOverallStatus(results: AutomationRequestResult[]): TestStatus | 'ERROR' {
  if (results.some((r) => r.error && !r.status)) return 'ERROR';
  const withTests = results.filter((r) => r.testResults.length > 0);
  if (withTests.length === 0) {
    return results.every((r) => r.status >= 200 && r.status < 300) ? 'PASS' : 'FAIL';
  }
  const allPassed = withTests.every((r) => r.testStatus === 'PASS');
  const allFailed = withTests.every((r) => r.testStatus === 'FAIL');
  if (allPassed) return 'PASS';
  if (allFailed) return 'FAIL';
  return 'PARTIAL';
}

function evaluateCondition(condition: BranchCondition, lastResult: AutomationRequestResult | null, emitted: Record<string, string>): boolean {
  switch (condition.type) {
    case 'lastRequestPass':
      if (!lastResult) return false;
      return lastResult.testStatus === 'PASS' || (lastResult.testResults.length === 0 && lastResult.status >= 200 && lastResult.status < 300);
    case 'lastRequestFail':
      if (!lastResult) return false;
      return lastResult.testStatus === 'FAIL' || (lastResult.testResults.length === 0 && (lastResult.status < 200 || lastResult.status >= 300));
    case 'lastStatusGte':
      if (!lastResult) return false;
      return lastResult.status >= condition.value;
    case 'lastStatusLt':
      if (!lastResult) return false;
      return lastResult.status < condition.value;
    case 'emittedEquals':
      return emitted[condition.key] === condition.value;
    case 'emittedExists':
      return condition.key in emitted;
    case 'emittedTruthy':
      return Boolean(emitted[condition.key]);
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function useAutomationRunner() {
  const [runState, setRunState] = useState<AutomationRunState>({
    status: 'idle',
    results: [],
    currentIndex: -1,
    totalCount: 0,
    startedAt: null,
    durationMs: null,
    overallStatus: null,
  });

  const cancelledRef = useRef(false);
  const dataFilesRef = useRef<DataFile[]>([]);

  // Returns true if execution should stop (stop step hit or cancelled)
  const executeSteps = useCallback(async (
    steps: AutomationStep[],
    requestMap: Map<number, Request>,
    envVarsRef: { current: KeyValue[] },
    emittedVarsRef: { current: Record<string, string> },
    secrets: KeyValue[],
    collectedResults: AutomationRequestResult[],
    pushResult: (r: AutomationRequestResult) => void,
    onLog?: (entry: Omit<LogEntry, 'id'>) => void,
    containerLabel?: string,
  ): Promise<'stop' | 'cancelled' | 'done'> => {
    for (const step of steps) {
      if (cancelledRef.current) return 'cancelled';

      if (step.type === 'stop') {
        return 'stop';
      }

      if (step.type === 'delay') {
        await sleep(step.delayMs);
        continue;
      }

      if (step.type === 'repeat') {
        for (let i = 0; i < step.count; i++) {
          if (cancelledRef.current) return 'cancelled';
          const outcome = await executeSteps(step.steps, requestMap, envVarsRef, emittedVarsRef, secrets, collectedResults, pushResult, onLog, 'Repeat');
          if (outcome === 'stop' || outcome === 'cancelled') return outcome;
        }
        continue;
      }

      if (step.type === 'branch') {
        const lastResult = collectedResults.length > 0 ? collectedResults[collectedResults.length - 1] : null;
        const branch = evaluateCondition(step.condition, lastResult, emittedVarsRef.current) ? step.trueSteps : step.falseSteps;
        const outcome = await executeSteps(branch, requestMap, envVarsRef, emittedVarsRef, secrets, collectedResults, pushResult, onLog, 'Branch');
        if (outcome === 'stop' || outcome === 'cancelled') return outcome;
        continue;
      }

      if (step.type === 'fanout') {
        // Snapshot state so every lane starts with the same input
        const snapshotEmitted = { ...emittedVarsRef.current };
        const snapshotEnvVars = [...envVarsRef.current];
        for (const lane of step.lanes) {
          if (cancelledRef.current) return 'cancelled';
          const laneEmitted = { current: { ...snapshotEmitted } };
          const laneEnv = { current: [...snapshotEnvVars] };
          const outcome = await executeSteps(lane, requestMap, laneEnv, laneEmitted, secrets, collectedResults, pushResult, onLog, 'Fanout');
          if (outcome === 'stop' || outcome === 'cancelled') return outcome;
          // Merge lane mutations back (last lane wins on conflict)
          Object.assign(emittedVarsRef.current, laneEmitted.current);
          envVarsRef.current = laneEnv.current;
        }
        continue;
      }

      if (step.type === 'log') {
        if (onLog) {
          const lastResult = collectedResults.length > 0 ? collectedResults[collectedResults.length - 1] : null;
          let data: unknown;
          switch (step.scope) {
            case 'request':
              if (lastResult) {
                const all = { url: lastResult.url, method: lastResult.method, headers: lastResult.requestHeaders, params: lastResult.requestParams, body: lastResult.requestBody };
                data = step.object === 'all' ? all : (all as Record<string, unknown>)[step.object];
              }
              break;
            case 'response':
              if (lastResult) {
                const all = { status: lastResult.status, statusText: lastResult.statusText, headers: lastResult.responseHeaders, body: lastResult.responseBody };
                data = step.object === 'all' ? all : (all as Record<string, unknown>)[step.object];
              }
              break;
            case 'env':
              data = Object.fromEntries(envVarsRef.current.filter((v) => v.enabled !== false).map((v) => [v.key, v.value]));
              break;
            case 'emitter':
              data = { ...emittedVarsRef.current };
              break;
          }
          const label = step.object === 'all' ? step.scope : `${step.scope}.${step.object}`;
          onLog({
            timestamp: Date.now(),
            kind: 'automation',
            message: `[${label}] ${JSON.stringify(data, null, 2)}`,
          });
        }
        continue;
      }

      if (step.type === 'csv_iterator') {
        if (step.dataFileId == null) continue;
        const dataFile = dataFilesRef.current.find((d) => d.id === step.dataFileId);
        if (!dataFile || !dataFile.content.trim()) continue;
        const { headers, rows } = parseCsv(dataFile.content);
        const limitedRows = step.limit != null ? rows.slice(0, step.limit) : rows;
        for (let rowIdx = 0; rowIdx < limitedRows.length; rowIdx++) {
          if (cancelledRef.current) return 'cancelled';
          const row = limitedRows[rowIdx];
          const rowKeyValues: KeyValue[] = headers.map((h, i) => ({ key: `#${h}`, value: row[i] ?? '', enabled: true }));
          const rowEnvRef = { current: [...envVarsRef.current, ...rowKeyValues] };
          const rowData: Record<string, string> = Object.fromEntries(headers.map((h, i) => [h, row[i] ?? '']));
          const rowPushResult = (r: AutomationRequestResult) => pushResult({ ...r, rowIndex: rowIdx + 1, rowData, containerLabel: 'Iterator' });
          const outcome = await executeSteps(step.steps, requestMap, rowEnvRef, emittedVarsRef, secrets, collectedResults, rowPushResult, onLog, 'Iterator');
          if (outcome === 'stop' || outcome === 'cancelled') return outcome;
        }
        continue;
      }

      if (step.type === 'request') {
        if (step.requestId == null) continue;
        const req = requestMap.get(step.requestId);
        if (!req) continue;

        let currentEnvVars = envVarsRef.current;

        const resolvedParams = req.params.map((p) => ({
          ...p,
          key: resolveTemplate(p.key, currentEnvVars),
          value: resolveTemplate(p.value, currentEnvVars),
        }));
        const resolvedHeaders = req.headers.map((h) => ({
          ...h,
          key: resolveTemplate(h.key, currentEnvVars),
          value: resolveTemplate(h.value, currentEnvVars),
        }));
        const resolvedUrl = resolveTemplate(req.url || '', currentEnvVars);
        const resolvedBody = resolveTemplate(req.body || '', currentEnvVars);

        let effectiveUrl = resolvedUrl;
        let effectiveParams = resolvedParams;
        let effectiveHeaders = resolvedHeaders;
        let effectiveBody = resolvedBody;

        if (req.pre_script?.trim()) {
          const preResult = runScript(req.pre_script, {
            request: { method: req.method, url: effectiveUrl, headers: effectiveHeaders, params: effectiveParams, body: effectiveBody },
            response: undefined,
            envVars: currentEnvVars,
            secrets,
          });
          if (preResult.mutatedRequest) {
            effectiveUrl = preResult.mutatedRequest.url;
            effectiveHeaders = preResult.mutatedRequest.headers;
            effectiveParams = preResult.mutatedRequest.params;
            effectiveBody = preResult.mutatedRequest.body;
          }
          if (preResult.envMutations) {
            for (const [key, value] of Object.entries(preResult.envMutations.set)) {
              const idx = currentEnvVars.findIndex((v) => v.key === key);
              if (idx >= 0) currentEnvVars = currentEnvVars.map((v) => (v.key === key ? { ...v, value } : v));
              else currentEnvVars = [...currentEnvVars, { key, value, enabled: true }];
            }
            envVarsRef.current = currentEnvVars;
          }
          if (preResult.emitMutations) {
            emittedVarsRef.current = { ...emittedVarsRef.current, ...preResult.emitMutations };
          }
        }

        let normalizedUrl = effectiveUrl.trim();
        try {
          normalizedUrl = new URL(normalizedUrl).toString();
        } catch {
          if (!normalizedUrl.match(/^https?:\/\//i)) normalizedUrl = `http://${normalizedUrl}`;
        }

        const curl = buildCurlCmd(req.method, normalizedUrl, effectiveParams, effectiveHeaders, effectiveBody);

        let result: AutomationRequestResult;
        try {
          const resp = await invoke<{ status: number; statusText: string; headers: { key: string; value: string }[]; body: string; timeMs: number; size: number }>('send_request', {
            method: req.method,
            url: normalizedUrl,
            params: effectiveParams.filter((p) => p.enabled !== false),
            headers: effectiveHeaders.filter((h) => h.enabled !== false),
            body: effectiveBody,
            followRedirects: true,
            attachments: req.files ?? [],
          });

          let testResults: import('../lib/types').TestResult[] = [];
          let testStatus: TestStatus | null = null;

          if (req.post_script?.trim()) {
            const postResult = runScript(req.post_script, {
              request: { method: req.method, url: normalizedUrl, headers: effectiveHeaders, params: effectiveParams, body: effectiveBody },
              response: {
                status: resp.status,
                statusText: resp.statusText,
                headers: resp.headers,
                body: resp.body,
                time: resp.timeMs,
              },
              envVars: currentEnvVars,
              secrets,
            });
            testResults = postResult.testResults;
            if (testResults.length > 0) {
              const passed = testResults.filter((t) => t.passed).length;
              testStatus = passed === testResults.length ? 'PASS' : passed === 0 ? 'FAIL' : 'PARTIAL';
            }
            if (postResult.envMutations) {
              for (const [key, value] of Object.entries(postResult.envMutations.set)) {
                const idx = currentEnvVars.findIndex((v) => v.key === key);
                if (idx >= 0) currentEnvVars = currentEnvVars.map((v) => (v.key === key ? { ...v, value } : v));
                else currentEnvVars = [...currentEnvVars, { key, value, enabled: true }];
              }
              envVarsRef.current = currentEnvVars;
            }
            if (postResult.emitMutations) {
              emittedVarsRef.current = { ...emittedVarsRef.current, ...postResult.emitMutations };
            }
          }

          result = {
            requestId: req.id,
            requestName: req.name,
            method: req.method,
            url: normalizedUrl,
            status: resp.status,
            statusText: resp.statusText,
            timeMs: resp.timeMs,
            testResults,
            testStatus,
            curl,
            responseBody: resp.body,
            responseHeaders: resp.headers,
            requestParams: effectiveParams.filter((p) => p.enabled !== false && p.key.trim()),
            requestHeaders: effectiveHeaders.filter((h) => h.enabled !== false && h.key.trim()),
            requestBody: effectiveBody.trim() || undefined,
            containerLabel,
          };
        } catch (e) {
          result = {
            requestId: req.id,
            requestName: req.name,
            method: req.method,
            url: normalizedUrl,
            status: 0,
            statusText: '',
            timeMs: 0,
            testResults: [],
            testStatus: null,
            error: e instanceof Error ? e.message : String(e),
            curl,
            requestParams: effectiveParams.filter((p) => p.enabled !== false && p.key.trim()),
            requestHeaders: effectiveHeaders.filter((h) => h.enabled !== false && h.key.trim()),
            requestBody: effectiveBody.trim() || undefined,
            containerLabel,
          };
        }

        pushResult(result);
      }
    }

    return 'done';
  }, []);

  const run = useCallback(
    async (
      steps: AutomationStep[],
      requestMap: Map<number, Request>,
      envVars: KeyValue[],
      activeEnvId: number | null,
      onLog?: (entry: Omit<LogEntry, 'id'>) => void,
      dataFiles?: DataFile[],
    ): Promise<{ results: AutomationRequestResult[]; durationMs: number; overallStatus: TestStatus | 'ERROR' }> => {
      cancelledRef.current = false;
      dataFilesRef.current = dataFiles ?? [];
      const startedAt = Date.now();

      // Count request steps for progress tracking
      function countRequestSteps(ss: AutomationStep[]): number {
        let n = 0;
        for (const s of ss) {
          if (s.type === 'request') n++;
          else if (s.type === 'repeat') n += s.count * countRequestSteps(s.steps);
          else if (s.type === 'branch') n += Math.max(countRequestSteps(s.trueSteps), countRequestSteps(s.falseSteps));
          else if (s.type === 'fanout') n += s.lanes.reduce((sum, lane) => sum + countRequestSteps(lane), 0);
          else if (s.type === 'csv_iterator') {
            const dataFile = dataFilesRef.current.find((d) => d.id === s.dataFileId);
            if (dataFile && dataFile.content.trim()) {
              const { rows } = parseCsv(dataFile.content);
              const rowCount = s.limit != null ? Math.min(rows.length, s.limit) : rows.length;
              n += rowCount * countRequestSteps(s.steps);
            }
          }
        }
        return n;
      }

      setRunState({
        status: 'running',
        results: [],
        currentIndex: 0,
        totalCount: countRequestSteps(steps),
        startedAt,
        durationMs: null,
        overallStatus: null,
      });

      const collectedResults: AutomationRequestResult[] = [];
      const envVarsRef = { current: [...envVars] };
      const emittedVarsRef = { current: {} as Record<string, string> };
      const secrets = activeEnvId != null ? loadSecrets(activeEnvId) : [];

      const pushResult = (r: AutomationRequestResult) => {
        collectedResults.push(r);
        setRunState((prev) => ({
          ...prev,
          results: [...collectedResults],
          currentIndex: prev.currentIndex + 1,
        }));
      };

      const outcome = await executeSteps(steps, requestMap, envVarsRef, emittedVarsRef, secrets, collectedResults, pushResult, onLog);

      const durationMs = Date.now() - startedAt;
      const stopped = outcome === 'cancelled';
      const overallStatus = stopped ? 'ERROR' : computeOverallStatus(collectedResults);

      setRunState((prev) => ({
        ...prev,
        status: stopped ? 'cancelled' : 'done',
        results: collectedResults,
        currentIndex: -1,
        durationMs,
        overallStatus,
      }));

      return { results: collectedResults, durationMs, overallStatus };
    },
    [executeSteps]
  );

  const stop = useCallback(async () => {
    cancelledRef.current = true;
    try {
      await invoke('cancel_request');
    } catch {
      // ignore
    }
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    setRunState({
      status: 'idle',
      results: [],
      currentIndex: -1,
      totalCount: 0,
      startedAt: null,
      durationMs: null,
      overallStatus: null,
    });
  }, []);

  return { runState, run, stop, reset };
}
