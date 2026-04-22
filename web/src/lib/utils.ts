import type { HTTPMethod, KeyValue } from './types';

export function getMethodColor(method: HTTPMethod): string {
  const colors: Record<HTTPMethod, string> = {
    GET: 'var(--accent-get)',
    POST: 'var(--accent-post)',
    PUT: 'var(--accent-put)',
    DELETE: 'var(--accent-delete)',
    PATCH: 'var(--accent-patch)',
    HEAD: 'var(--accent-head)',
    OPTIONS: 'var(--accent-options)',
  };
  return colors[method] || 'var(--text-tertiary)';
}

export function getMethodIcon(method: HTTPMethod): string {
  const icons: Record<HTTPMethod, string> = {
    GET: '↓',      // Download/retrieve
    POST: '↑',     // Upload/create
    PUT: '↔',      // Replace/update
    DELETE: '✕',   // Delete/remove
    PATCH: '◐',    // Partial/patch
    HEAD: '⌒',     // Head/metadata
    OPTIONS: '⊕',  // Options/capabilities
  };
  return icons[method] || '?';
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
  try {
    implicit.push({ key: 'Host', value: new URL(url).host, enabled: true });
  } catch {}
  implicit.push({ key: 'User-Agent', value: 'Callstack/1.0', enabled: true });
  implicit.push({ key: 'Accept', value: '*/*', enabled: true });
  implicit.push({ key: 'Accept-Encoding', value: 'gzip, deflate, br', enabled: true });
  implicit.push({ key: 'Cache-Control', value: 'no-cache', enabled: true });
  try {
    const origin = new URL(url).origin;
    if (origin && origin !== 'null') implicit.push({ key: 'Origin', value: origin, enabled: true });
  } catch {}
  if (bodyLength != null && bodyLength > 0) {
    implicit.push({ key: 'Content-Length', value: String(bodyLength), enabled: true });
  }
  return implicit;
}

export function getImplicitHeaders(url: string, activeHeaders: KeyValue[], bodyLength?: number, allHeaders?: KeyValue[]): KeyValue[] {
  const keys = new Set((allHeaders ?? activeHeaders).map(h => h.key.toLowerCase()));
  return getImplicitDefaults(url, bodyLength).filter(h => !keys.has(h.key.toLowerCase()));
}
