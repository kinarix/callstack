export function getMethodColor(method) {
    const colors = {
        GET: 'var(--accent-get)',
        POST: 'var(--accent-post)',
        PUT: 'var(--accent-put)',
        DELETE: 'var(--accent-delete)',
        PATCH: 'var(--accent-patch)',
    };
    return colors[method] || 'var(--text-tertiary)';
}
export function getMethodIcon(method) {
    const icons = {
        GET: '↓', // Download/retrieve
        POST: '↑', // Upload/create
        PUT: '↔', // Replace/update
        DELETE: '✕', // Delete/remove
        PATCH: '◐', // Partial/patch
    };
    return icons[method] || '?';
}
export function getStatusColor(status) {
    if (status >= 200 && status < 300)
        return 'var(--status-success)';
    if (status >= 400 && status < 500)
        return 'var(--status-warning)';
    if (status >= 500)
        return 'var(--status-error)';
    return 'var(--text-secondary)';
}
export function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
