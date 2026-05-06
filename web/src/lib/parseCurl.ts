import type { KeyValue } from './types';

export interface CurlImport {
  method: string;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
}

// Tokenize a curl command string, respecting single/double/ansi-c quotes
// and line-continuation backslashes.
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  // Normalize line continuations
  const src = input.replace(/\\\n/g, ' ');
  let i = 0;

  while (i < src.length) {
    // Skip whitespace
    while (i < src.length && /\s/.test(src[i])) i++;
    if (i >= src.length) break;

    let token = '';

    while (i < src.length && !/\s/.test(src[i])) {
      const ch = src[i];

      // ANSI-C quoting: $'...'
      if (ch === '$' && src[i + 1] === "'") {
        i += 2;
        while (i < src.length && src[i] !== "'") {
          if (src[i] === '\\') {
            i++;
            const esc = src[i];
            if (esc === 'n') token += '\n';
            else if (esc === 't') token += '\t';
            else if (esc === 'r') token += '\r';
            else token += esc;
          } else {
            token += src[i];
          }
          i++;
        }
        i++; // closing '
        continue;
      }

      // Single-quoted string: contents are literal
      if (ch === "'") {
        i++;
        while (i < src.length && src[i] !== "'") {
          token += src[i++];
        }
        i++; // closing '
        continue;
      }

      // Double-quoted string: backslash escapes apply
      if (ch === '"') {
        i++;
        while (i < src.length && src[i] !== '"') {
          if (src[i] === '\\') {
            i++;
            token += src[i] ?? '';
          } else {
            token += src[i];
          }
          i++;
        }
        i++; // closing "
        continue;
      }

      token += ch;
      i++;
    }

    if (token) tokens.push(token);
  }

  return tokens;
}

// Flags that consume no extra argument
const NO_ARG_FLAGS = new Set([
  '-L', '--location', '--compressed', '-v', '--verbose',
  '-s', '--silent', '-S', '--show-error', '-i', '--include',
  '-k', '--insecure', '-g', '--globoff', '--http1.1', '--http2',
  '--get', '-G',
]);

// Flags that consume one argument we don't care about
const SKIP_ARG_FLAGS = new Set([
  '-o', '--output', '--connect-timeout', '--max-time', '-m',
  '--limit-rate', '--proxy', '-x', '--cacert', '--cert', '--key',
  '--resolve', '--interface', '--dns-servers', '--retry',
  '--retry-delay', '--retry-max-time',
]);

export function parseCurl(input: string): CurlImport | null {
  const trimmed = input.trimStart();
  if (!trimmed.toLowerCase().startsWith('curl')) return null;

  const tokens = tokenize(trimmed);
  if (!tokens.length || tokens[0].toLowerCase() !== 'curl') return null;

  let method = '';
  let url = '';
  const headers: KeyValue[] = [];
  let body = '';

  let i = 1; // skip 'curl'
  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === '-X' || tok === '--request') {
      method = tokens[++i] ?? '';
      i++;
      continue;
    }

    if (tok === '-H' || tok === '--header') {
      const raw = tokens[++i] ?? '';
      const colon = raw.indexOf(':');
      if (colon > 0) {
        headers.push({
          key: raw.slice(0, colon).trim(),
          value: raw.slice(colon + 1).trim(),
          enabled: true,
        });
      }
      i++;
      continue;
    }

    if (tok === '-d' || tok === '--data' || tok === '--data-raw' ||
        tok === '--data-binary' || tok === '--data-urlencode') {
      const chunk = tokens[++i] ?? '';
      body = body ? body + '&' + chunk : chunk;
      i++;
      continue;
    }

    if (tok === '-u' || tok === '--user') {
      const userPass = tokens[++i] ?? '';
      const encoded = btoa(userPass);
      headers.push({ key: 'Authorization', value: `Basic ${encoded}`, enabled: true });
      i++;
      continue;
    }

    if (tok === '-A' || tok === '--user-agent') {
      const ua = tokens[++i] ?? '';
      headers.push({ key: 'User-Agent', value: ua, enabled: true });
      i++;
      continue;
    }

    if (tok === '--url') {
      url = tokens[++i] ?? '';
      i++;
      continue;
    }

    // Flags that accept no argument
    if (NO_ARG_FLAGS.has(tok)) {
      i++;
      continue;
    }

    // Flags that accept an argument we skip
    if (SKIP_ARG_FLAGS.has(tok)) {
      i += 2;
      continue;
    }

    // Combined short flags like -sSL or -Lk
    if (/^-[a-zA-Z]{2,}$/.test(tok)) {
      i++;
      continue;
    }

    // Bare argument is the URL (skip if it looks like an unknown flag)
    if (!tok.startsWith('-')) {
      url = tok;
    }

    i++;
  }

  if (!url) return null;

  // Infer method
  if (!method) method = body ? 'POST' : 'GET';
  method = method.toUpperCase();

  // Parse URL into base + query params
  let baseUrl = url;
  const params: KeyValue[] = [];

  const qIdx = url.indexOf('?');
  if (qIdx !== -1) {
    baseUrl = url.slice(0, qIdx);
    const qs = url.slice(qIdx + 1);
    for (const pair of qs.split('&')) {
      const eqIdx = pair.indexOf('=');
      if (eqIdx > 0) {
        params.push({
          key: decodeURIComponent(pair.slice(0, eqIdx)),
          value: decodeURIComponent(pair.slice(eqIdx + 1)),
          enabled: true,
        });
      } else if (pair) {
        params.push({ key: decodeURIComponent(pair), value: '', enabled: true });
      }
    }
  }

  return { method, url: baseUrl, headers, params, body };
}
