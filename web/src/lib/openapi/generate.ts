import type {
  DocumentationFields,
  KeyValue,
  Project,
  Request,
  Response as AppResponse,
} from '../types';
import type {
  OpenAPIDocument,
  OpenAPIOperation,
  OpenAPIParameter,
  OpenAPIPathItem,
  OpenAPIRequestBody,
  OpenAPIResponse,
} from './types';
import { parse as yamlParse } from 'yaml';
import { resolveTemplate } from '../template';
import { inferSchemaFromBody } from './schemaInfer';
import { toOpenAPIPath } from './pathTemplate';

const SKIP_HEADER_PARAMS = new Set([
  'content-type',
  'authorization',
  'accept',
  'accept-encoding',
  'accept-language',
  'user-agent',
  'host',
  'cookie',
  'connection',
  'content-length',
]);

function getHeader(headers: KeyValue[], name: string): string {
  const lower = name.toLowerCase();
  return headers.find((h) => h.key.toLowerCase() === lower && h.enabled !== false)?.value ?? '';
}

function slugifyOperationId(method: string, path: string): string {
  const cleaned = path
    .replace(/\{(\w+)\}/g, 'By$1')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
  return `${method.toLowerCase()}${cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : ''}`;
}

export function generateOperation(
  request: Request,
  lastResponse: AppResponse | null,
  docs: DocumentationFields = {},
  envVars: KeyValue[] = [],
): OpenAPIOperation {
  const resolvedUrl = envVars.length ? resolveTemplate(request.url, envVars) : request.url;
  const { path, pathVars } = toOpenAPIPath(resolvedUrl);

  const parameters: OpenAPIParameter[] = [];

  for (const v of pathVars) {
    parameters.push({
      name: v,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  }

  for (const p of request.params || []) {
    if (!p.key || p.enabled === false) continue;
    parameters.push({
      name: p.key,
      in: 'query',
      required: false,
      schema: { type: 'string' },
      ...(p.value ? { example: p.value } : {}),
    });
  }

  for (const h of request.headers || []) {
    if (!h.key || h.enabled === false) continue;
    const lk = h.key.toLowerCase();
    if (SKIP_HEADER_PARAMS.has(lk)) continue;
    parameters.push({
      name: h.key,
      in: 'header',
      required: false,
      schema: { type: 'string' },
      ...(h.value ? { example: h.value } : {}),
    });
  }

  let requestBody: OpenAPIRequestBody | undefined;
  const requestSample = (docs.sampleRequestBody && docs.sampleRequestBody.trim())
    ? docs.sampleRequestBody
    : (request.body && request.body.trim() ? request.body : '');
  if (requestSample) {
    const ct = getHeader(request.headers || [], 'Content-Type') || 'application/json';
    const inferred = inferSchemaFromBody(requestSample, ct);
    if (inferred) {
      requestBody = {
        content: {
          [ct.split(';')[0].trim()]: {
            schema: inferred.schema,
            example: inferred.example,
          },
        },
      };
    }
  }

  const responses: Record<string, OpenAPIResponse> = {};
  const sampleResponseBody = docs.sampleResponseBody && docs.sampleResponseBody.trim() ? docs.sampleResponseBody : '';
  const sampleStatus = docs.sampleResponseStatus;
  const sampleCt = docs.sampleResponseContentType;
  if (sampleResponseBody || sampleStatus) {
    const status = String(sampleStatus ?? (lastResponse?.status ?? 200));
    const ct = sampleCt
      || (lastResponse?.headers || []).find((h) => h.key.toLowerCase() === 'content-type')?.value
      || 'application/json';
    const inferred = sampleResponseBody ? inferSchemaFromBody(sampleResponseBody, ct) : null;
    const resp: OpenAPIResponse = {
      description: lastResponse?.statusText || 'Response',
    };
    if (inferred) {
      resp.content = {
        [ct.split(';')[0].trim()]: {
          schema: inferred.schema,
          example: inferred.example,
        },
      };
    }
    responses[status] = resp;
  } else if (lastResponse && lastResponse.status > 0) {
    const status = String(lastResponse.status);
    const ct = (lastResponse.headers || []).find((h) => h.key.toLowerCase() === 'content-type')?.value || 'application/json';
    const inferred = inferSchemaFromBody(lastResponse.body || '', ct);
    const resp: OpenAPIResponse = {
      description: lastResponse.statusText || 'Response',
    };
    if (inferred) {
      resp.content = {
        [ct.split(';')[0].trim()]: {
          schema: inferred.schema,
          example: inferred.example,
        },
      };
    }
    responses[status] = resp;
  } else {
    responses.default = { description: 'No response captured yet' };
  }

  const method = (request.method || 'GET').toLowerCase();
  const operation: OpenAPIOperation = {
    operationId: docs.operationId || slugifyOperationId(method, path),
    summary: docs.summary || request.name || undefined,
    description: docs.description || undefined,
    tags: docs.tags && docs.tags.length ? docs.tags : undefined,
    deprecated: docs.deprecated || undefined,
    externalDocs: docs.externalDocsUrl
      ? { url: docs.externalDocsUrl, ...(docs.externalDocsDescription ? { description: docs.externalDocsDescription } : {}) }
      : undefined,
    parameters: parameters.length ? parameters : undefined,
    requestBody,
    responses,
  };

  return stripUndefined(operation);
}

function stripUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = stripUndefined(v);
  }
  return out as T;
}

export function generateDocument(
  project: Project,
  requests: Request[],
  lastResponseByRequestId: Map<number, AppResponse | null>,
  envVarsByRequestId: Map<number, KeyValue[]> = new Map(),
  serverUrl?: string,
): OpenAPIDocument {
  const paths: Record<string, OpenAPIPathItem> = {};
  let inferredServer = serverUrl;

  for (const req of requests) {
    const envVars = envVarsByRequestId.get(req.id) || [];
    const resolvedUrl = envVars.length ? resolveTemplate(req.url, envVars) : req.url;
    const { path, baseUrl } = toOpenAPIPath(resolvedUrl);
    if (!inferredServer && baseUrl) inferredServer = baseUrl;
    const method = (req.method || 'GET').toLowerCase() as keyof OpenAPIPathItem;
    const docs = req.documentation || {};
    let op: OpenAPIOperation;
    if (docs.yamlOverride && docs.yamlOverride.trim()) {
      try {
        op = yamlParse(docs.yamlOverride) as OpenAPIOperation;
      } catch {
        op = generateOperation(req, lastResponseByRequestId.get(req.id) ?? null, docs, envVars);
      }
    } else {
      op = generateOperation(req, lastResponseByRequestId.get(req.id) ?? null, docs, envVars);
    }
    if (!paths[path]) paths[path] = {};
    paths[path][method] = op;
  }

  const doc: OpenAPIDocument = {
    openapi: '3.1.0',
    info: {
      title: project.name || 'Untitled',
      version: '1.0.0',
      ...(project.description ? { description: project.description } : {}),
    },
    paths,
  };
  if (inferredServer) doc.servers = [{ url: inferredServer }];
  return doc;
}
