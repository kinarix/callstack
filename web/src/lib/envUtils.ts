export function getEnvColor(name: string): string {
  const n = name.toLowerCase();
  if (/prod|production/.test(n)) return 'var(--accent-delete)';
  if (/stag|staging/.test(n)) return 'var(--accent-put)';
  if (/dev|local|development/.test(n)) return 'var(--accent-get)';
  if (/test|qa|testing|uat|canary/.test(n)) return 'var(--accent-post)';
  if (/sandbox|demo/.test(n)) return 'var(--accent-patch)';
  return 'var(--text-tertiary)';
}
