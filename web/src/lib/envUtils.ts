export function getEnvColor(name: string): string {
  const n = name.toLowerCase();
  if (/prod|production/.test(n)) return '#ef4444';
  if (/stag|staging/.test(n)) return '#f59e0b';
  if (/dev|local|development/.test(n)) return '#10b981';
  if (/test|qa|testing|uat|canary/.test(n)) return '#3b82f6';
  if (/sandbox|demo/.test(n)) return '#a855f7';
  return '#6b7280';
}
