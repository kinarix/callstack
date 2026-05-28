import type { HTTPMethod, KeyValue } from './types';

export function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: 'var(--accent-get)',
    POST: 'var(--accent-post)',
    PUT: 'var(--accent-put)',
    DELETE: 'var(--accent-delete)',
    PATCH: 'var(--accent-patch)',
    HEAD: 'var(--accent-head)',
    OPTIONS: 'var(--accent-options)',
    WS: 'var(--accent-ws)',
  };
  return colors[method] || 'var(--text-tertiary)';
}

export function getMethodIcon(method: string): string {
  const icons: Record<string, string> = {
    GET: '↓',      // Download/retrieve
    POST: '↑',     // Upload/create
    PUT: '↔',      // Replace/update
    DELETE: '✕',   // Delete/remove
    PATCH: '◐',    // Partial/patch
    HEAD: '⌒',     // Head/metadata
    OPTIONS: '⊕',  // Options/capabilities
    WS: '⇌',       // WebSocket — bidirectional
  };
  return icons[method] || '?';
}

/** Display label for a request's protocol/method (WS requests show "WS"). */
export function getRequestLabel(method: string, protocol?: string): string {
  return protocol === 'ws' ? 'WS' : method;
}

export type UrlScheme = 'http' | 'https' | 'ws' | 'wss';

/** Parse the literal leading scheme of a URL, or null if absent/templated. */
export function getUrlScheme(url: string): UrlScheme | null {
  const m = url.match(/^(https?|wss?):\/\//i);
  return m ? (m[1].toLowerCase() as UrlScheme) : null;
}

/** Transport derived from the URL scheme — ws/wss → 'ws', everything else → 'http'. */
export function getProtocol(url: string): 'http' | 'ws' {
  const scheme = getUrlScheme(url);
  return scheme === 'ws' || scheme === 'wss' ? 'ws' : 'http';
}

/** Remove one or more leading `scheme://` prefixes, leaving the hostname onward.
 *  Strips repeats so legacy double-scheme values self-heal. */
export function stripScheme(url: string): string {
  return url.replace(/^((https?|wss?):\/\/)+/i, '');
}

/** Replace (or set) the leading scheme of a URL, keeping the remainder intact. */
export function setScheme(url: string, scheme: UrlScheme): string {
  return `${scheme}://${stripScheme(url)}`;
}

/** Prepend the scheme only when the URL has none — never duplicates an existing one. */
export function applySchemeIfMissing(url: string, scheme: UrlScheme): string {
  return getUrlScheme(url) ? url : `${scheme}://${url}`;
}

export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return 'var(--status-success)';
  if (status >= 400 && status < 500) return 'var(--status-warning)';
  if (status >= 500) return 'var(--status-error)';
  return 'var(--text-secondary)';
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getImplicitDefaults(url: string, bodyLength?: number): KeyValue[] {
  const implicit: KeyValue[] = [];
  let parsed: URL | null = null;
  try { parsed = new URL(url); } catch {}
  implicit.push({ key: 'Host', value: parsed?.host ?? '', enabled: true });
  implicit.push({ key: 'User-Agent', value: 'Callstack/1.0', enabled: true });
  implicit.push({ key: 'Accept', value: '*/*', enabled: true });
  implicit.push({ key: 'Accept-Encoding', value: 'gzip, deflate, br', enabled: true });
  implicit.push({ key: 'Origin', value: (parsed && parsed.origin !== 'null') ? parsed.origin : '', enabled: true });
  if (bodyLength != null && bodyLength > 0) {
    implicit.push({ key: 'Content-Length', value: String(bodyLength), enabled: true });
  }
  return implicit;
}

export const SCRATCH_PROJECT_NAME = '__callstack__';

export function isScratchProject(name: string): boolean {
  return name === SCRATCH_PROJECT_NAME;
}

export function getImplicitHeaders(url: string, activeHeaders: KeyValue[], bodyLength?: number, allHeaders?: KeyValue[]): KeyValue[] {
  const keys = new Set((allHeaders ?? activeHeaders).map(h => h.key.toLowerCase()));
  return getImplicitDefaults(url, bodyLength).filter(h => !keys.has(h.key.toLowerCase()));
}
