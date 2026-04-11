import type { KeyValue, Request } from '../lib/types';

export interface ParsedRequest {
  name: string;
  method: string;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
}

export interface ParsedCollection {
  name: string;
  requests: ParsedRequest[];
}

const VALID_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']);

function parseUrl(url: unknown): { raw: string; query: KeyValue[] } {
  if (typeof url === 'string') return { raw: url, query: [] };
  if (url && typeof url === 'object') {
    const u = url as Record<string, unknown>;
    const raw = typeof u.raw === 'string' ? u.raw : '';
    const query: KeyValue[] = [];
    if (Array.isArray(u.query)) {
      for (const q of u.query) {
        if (q && typeof q === 'object') {
          const entry = q as Record<string, unknown>;
          if (typeof entry.key === 'string') {
            query.push({
              key: entry.key,
              value: typeof entry.value === 'string' ? entry.value : '',
              enabled: entry.disabled !== true,
            });
          }
        }
      }
    }
    return { raw, query };
  }
  return { raw: '', query: [] };
}

function parseHeaders(headers: unknown): KeyValue[] {
  if (!Array.isArray(headers)) return [];
  return headers
    .filter((h) => h && typeof h === 'object' && typeof (h as Record<string, unknown>).key === 'string')
    .map((h) => {
      const entry = h as Record<string, unknown>;
      return {
        key: entry.key as string,
        value: typeof entry.value === 'string' ? entry.value : '',
        enabled: entry.disabled !== true,
      };
    });
}

function parseBody(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const b = body as Record<string, unknown>;
  if (b.mode === 'raw' && typeof b.raw === 'string') return b.raw;
  return '';
}

function parseItem(item: unknown): ParsedRequest | null {
  if (!item || typeof item !== 'object') return null;
  const entry = item as Record<string, unknown>;

  // Sub-folder items have an `item` array — skip (callers handle recursion)
  if (Array.isArray(entry.item)) return null;

  const req = entry.request;
  if (!req || typeof req !== 'object') return null;
  const r = req as Record<string, unknown>;

  const method = (typeof r.method === 'string' ? r.method.toUpperCase() : 'GET');
  const { raw: url, query } = parseUrl(r.url);
  const headers = parseHeaders(r.header);
  const body = parseBody(r.body);

  return {
    name: typeof entry.name === 'string' ? entry.name : 'Unnamed Request',
    method: VALID_METHODS.has(method) ? method : 'GET',
    url,
    params: query,
    headers,
    body,
  };
}

function collectRequests(items: unknown[]): ParsedRequest[] {
  const result: ParsedRequest[] = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;

    if (Array.isArray(entry.item)) {
      // Sub-folder — recurse and flatten
      result.push(...collectRequests(entry.item));
    } else {
      const parsed = parseItem(entry);
      if (parsed) result.push(parsed);
    }
  }
  return result;
}

// ─── Postman v2.1 export ──────────────────────────────────────────────────────

const POSTMAN_SCHEMA = 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json';

function toPostmanItem(req: Request) {
  return {
    name: req.name,
    request: {
      method: req.method,
      header: req.headers
        .filter((h) => h.enabled !== false)
        .map((h) => ({ key: h.key, value: h.value, type: 'text' })),
      url: {
        raw: req.url,
        query: req.params
          .filter((p) => p.enabled !== false)
          .map((p) => ({ key: p.key, value: p.value })),
      },
      ...(req.body ? { body: { mode: 'raw' as const, raw: req.body } } : {}),
    },
  };
}

export function exportFolderAsPostman(folderName: string, requests: Request[]): string {
  return JSON.stringify(
    { info: { name: folderName, schema: POSTMAN_SCHEMA }, item: requests.map(toPostmanItem) },
    null,
    2,
  );
}

export function exportProjectAsPostman(
  projectName: string,
  rootRequests: Request[],
  folders: { name: string; requests: Request[] }[],
): string {
  const item = [
    ...rootRequests.map(toPostmanItem),
    ...folders.map(({ name, requests }) => ({ name, item: requests.map(toPostmanItem) })),
  ];
  return JSON.stringify({ info: { name: projectName, schema: POSTMAN_SCHEMA }, item }, null, 2);
}

// ─── Postman v2.1 import ──────────────────────────────────────────────────────

export function parsePostmanCollection(json: unknown): ParsedCollection {
  if (!json || typeof json !== 'object') {
    throw new Error('Invalid Postman collection: not a JSON object');
  }

  const col = json as Record<string, unknown>;

  const info = col.info as Record<string, unknown> | undefined;
  if (!info || typeof info.schema !== 'string' || !info.schema.includes('getpostman.com')) {
    throw new Error('Invalid Postman collection: missing or unrecognised info.schema');
  }

  const name = typeof info.name === 'string' && info.name.trim()
    ? info.name.trim()
    : 'Imported Collection';

  const items = Array.isArray(col.item) ? col.item : [];
  const requests = collectRequests(items);

  return { name, requests };
}
