import type { KeyValue, TestResult } from '../lib/types';

// Error classes for test severity levels
class Warn extends Error {
  constructor(...args: unknown[]) {
    super(args.map(safeStringify).join(' '));
    this.name = 'Warn';
  }
}

class Success extends Error {
  constructor(...args: unknown[]) {
    super(args.map(safeStringify).join(' '));
    this.name = 'Success';
  }
}

class ScriptError extends Error {
  constructor(...args: unknown[]) {
    super(args.map(safeStringify).join(' '));
    this.name = 'Error';
  }
}

export interface ScriptRequest {
  method: string;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
}

export interface ScriptResponse {
  status: number;
  statusText: string;
  headers: KeyValue[];
  body: string;
  time: number;
}

export interface EnvMutations {
  set: Record<string, string>;
  unset: string[];
}

export interface ScriptResult {
  logs: string[];
  testResults: TestResult[];
  mutatedRequest?: ScriptRequest;
  envMutations: EnvMutations;
  secretMutations: EnvMutations;
  emitMutations: Record<string, string>;
  error?: string;
}

function safeStringify(v: unknown): string {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (typeof v === 'object') {
    try { return JSON.stringify(v, null, 2); } catch { return String(v); }
  }
  return String(v);
}

export function runScript(
  script: string,
  context: {
    request?: ScriptRequest;
    response?: ScriptResponse;
    envVars?: KeyValue[];
    secrets?: KeyValue[];
  }
): ScriptResult {
  if (!script.trim()) {
    return { logs: [], testResults: [], envMutations: { set: {}, unset: [] }, secretMutations: { set: {}, unset: [] }, emitMutations: {} };
  }

  const logs: string[] = [];
  const testResults: TestResult[] = [];
  const envMutations: EnvMutations = { set: {}, unset: [] };
  const secretMutations: EnvMutations = { set: {}, unset: [] };

  const consoleMock = {
    log: (...args: unknown[]) => logs.push(args.map(safeStringify).join(' ')),
    debug: (...args: unknown[]) => logs.push('[debug] ' + args.map(safeStringify).join(' ')),
    info: (...args: unknown[]) => logs.push('[info] ' + args.map(safeStringify).join(' ')),
    warn: (...args: unknown[]) => logs.push('[warn] ' + args.map(safeStringify).join(' ')),
    error: (...args: unknown[]) => logs.push('[error] ' + args.map(safeStringify).join(' ')),
  };

  const testFn = (description: string, fn: () => unknown) => {
    try {
      const result = fn();
      let message: string | undefined;
      if (typeof result === 'string' && result) {
        message = result;
      } else if (result && typeof result === 'object' && 'message' in result) {
        message = String((result as { message: unknown }).message);
      }
      testResults.push({ description, passed: true, message });
    } catch (e) {
      if (e instanceof Success) {
        testResults.push({
          description,
          passed: true,
          severity: 'success',
          message: e.message,
        });
      } else if (e instanceof Warn) {
        testResults.push({
          description,
          passed: false,
          severity: 'warning',
          error: e.message,
        });
      } else {
        testResults.push({
          description,
          passed: false,
          severity: 'error',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  };

  const envVarMap = new Map((context.envVars ?? []).map(v => [v.key, v.value]));
  const secretsMap = new Map(
    (context.secrets ?? []).filter(s => s.enabled !== false && s.key).map(s => [s.key, s.value])
  );
  const envObj = {
    get: (key: string) => envVarMap.get(key),
    set: (key: string, value: string) => {
      envMutations.set[key] = String(value);
      envVarMap.set(key, String(value));
    },
    unset: (key: string) => {
      envMutations.unset.push(key);
      envVarMap.delete(key);
    },
    secret: {
      get: (key: string) => secretsMap.get(key),
      set: (key: string, value: string) => {
        secretMutations.set[key] = String(value);
        secretsMap.set(key, String(value));
      },
      unset: (key: string) => {
        secretMutations.unset.push(key);
        secretsMap.delete(key);
      },
    },
  };

  function parseBodyJson(body: string): unknown {
    if (!body || !body.trim()) return null;
    try { return JSON.parse(body); } catch { return null; }
  }

  // Deep-clone the request so scripts can mutate it, attach .json
  const requestClone = context.request
    ? Object.assign(JSON.parse(JSON.stringify(context.request)), {
        json: parseBodyJson(context.request.body),
      })
    : undefined;

  // Response is read-only from script perspective, attach .json
  const responseCopy = context.response
    ? Object.assign(
        { ...context.response, headers: [...context.response.headers] },
        { json: parseBodyJson(context.response.body) }
      )
    : undefined;

  const emitMutations: Record<string, string> = {};
  const emitFn = (key: unknown, value: unknown) => {
    emitMutations[String(key)] = String(value);
  };

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function('request', 'response', 'console', 'test', 'env', 'Warn', 'Success', 'emit', 'Error', script);
    fn(requestClone, responseCopy, consoleMock, testFn, envObj, Warn, Success, emitFn, ScriptError);
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    logs.push('[error] Script error: ' + errMsg);
    return { logs, testResults, mutatedRequest: requestClone, envMutations, secretMutations, emitMutations: {}, error: errMsg };
  }

  return { logs, testResults, mutatedRequest: requestClone, envMutations, secretMutations, emitMutations };
}
