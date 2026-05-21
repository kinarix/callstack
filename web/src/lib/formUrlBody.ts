import type { KeyValue } from './types';

const TOKEN_RE = /\{\{\s*[#$]?[\w.-]+\s*\}\}/g;

function encodePreservingTokens(s: string): string {
  let out = '';
  let last = 0;
  for (const m of s.matchAll(TOKEN_RE)) {
    out += encodeURIComponent(s.slice(last, m.index));
    out += m[0];
    last = (m.index ?? 0) + m[0].length;
  }
  out += encodeURIComponent(s.slice(last));
  return out;
}

function decodeSegment(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

function decodePreservingTokens(s: string): string {
  let out = '';
  let last = 0;
  for (const m of s.matchAll(TOKEN_RE)) {
    out += decodeSegment(s.slice(last, m.index));
    out += m[0];
    last = (m.index ?? 0) + m[0].length;
  }
  out += decodeSegment(s.slice(last));
  return out;
}

export function parseFormUrl(body: string): KeyValue[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  return trimmed.split('&').map((pair) => {
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    return {
      key: decodePreservingTokens(rawKey),
      value: decodePreservingTokens(rawValue),
      enabled: true,
    };
  });
}

export function serializeFormUrl(items: KeyValue[]): string {
  return items
    .filter((i) => (i.enabled ?? true) && i.key)
    .map((i) => `${encodePreservingTokens(i.key)}=${encodePreservingTokens(i.value)}`)
    .join('&');
}
