import type { HTTPMethod } from './types';

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
