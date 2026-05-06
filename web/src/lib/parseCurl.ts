import type { KeyValue } from './types';

export interface CurlImport {
  method: string;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
}

interface QuoteResult {
  token: string;
  i: number;
}

interface ParseState {
  method: string;
  url: string;
  headers: KeyValue[];
  body: string;
}

type FlagHandler = (tokens: string[], i: number, state: ParseState) => number;

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

function readAnsiCQuoted(src: string, i: number): QuoteResult {
  let token = '';
  i += 2; // skip $'
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
  return { token, i: i + 1 }; // +1 for closing '
}

function readSingleQuoted(src: string, i: number): QuoteResult {
  let token = '';
  i++; // skip opening '
  while (i < src.length && src[i] !== "'") {
    token += src[i++];
  }
  return { token, i: i + 1 }; // +1 for closing '
}

function readDoubleQuoted(src: string, i: number): QuoteResult {
  let token = '';
  i++; // skip opening "
  while (i < src.length && src[i] !== '"') {
    if (src[i] === '\\') {
      i++;
      token += src[i] ?? '';
    } else {
      token += src[i];
    }
    i++;
  }
  return { token, i: i + 1 }; // +1 for closing "
}

// Tokenize a curl command string, respecting single/double/ansi-c quotes
// and line-continuation backslashes.
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const src = input.replace(/\\\n/g, ' ');
  let i = 0;

  while (i < src.length) {
    while (i < src.length && /\s/.test(src[i])) i++;
    if (i >= src.length) break;

    let token = '';

    while (i < src.length && !/\s/.test(src[i])) {
      const ch = src[i];
      if (ch === '$' && src[i + 1] === "'") {
        const r = readAnsiCQuoted(src, i);
        token += r.token;
        i = r.i;
      } else if (ch === "'") {
        const r = readSingleQuoted(src, i);
        token += r.token;
        i = r.i;
      } else if (ch === '"') {
        const r = readDoubleQuoted(src, i);
        token += r.token;
        i = r.i;
      } else {
        token += ch;
        i++;
      }
    }

    if (token) tokens.push(token);
  }

  return tokens;
}

function parseUrl(raw: string): { url: string; params: KeyValue[] } {
  const qIdx = raw.indexOf('?');
  if (qIdx === -1) return { url: raw, params: [] };

  const url = raw.slice(0, qIdx);
  const params: KeyValue[] = [];
  for (const pair of raw.slice(qIdx + 1).split('&')) {
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
  return { url, params };
}

function methodHandler(tokens: string[], i: number, state: ParseState): number {
  state.method = tokens[i + 1] ?? '';
  return i + 2;
}

function headerHandler(tokens: string[], i: number, state: ParseState): number {
  const raw = tokens[i + 1] ?? '';
  const colon = raw.indexOf(':');
  if (colon > 0) {
    state.headers.push({
      key: raw.slice(0, colon).trim(),
      value: raw.slice(colon + 1).trim(),
      enabled: true,
    });
  }
  return i + 2;
}

function dataHandler(tokens: string[], i: number, state: ParseState): number {
  const chunk = tokens[i + 1] ?? '';
  state.body = state.body ? `${state.body}&${chunk}` : chunk;
  return i + 2;
}

function userHandler(tokens: string[], i: number, state: ParseState): number {
  const encoded = btoa(tokens[i + 1] ?? '');
  state.headers.push({ key: 'Authorization', value: `Basic ${encoded}`, enabled: true });
  return i + 2;
}

function userAgentHandler(tokens: string[], i: number, state: ParseState): number {
  state.headers.push({ key: 'User-Agent', value: tokens[i + 1] ?? '', enabled: true });
  return i + 2;
}

function urlFlagHandler(tokens: string[], i: number, state: ParseState): number {
  state.url = tokens[i + 1] ?? '';
  return i + 2;
}

const FLAG_HANDLERS: Record<string, FlagHandler> = {
  '-X': methodHandler, '--request': methodHandler,
  '-H': headerHandler, '--header': headerHandler,
  '-d': dataHandler, '--data': dataHandler, '--data-raw': dataHandler,
  '--data-binary': dataHandler, '--data-urlencode': dataHandler,
  '-u': userHandler, '--user': userHandler,
  '-A': userAgentHandler, '--user-agent': userAgentHandler,
  '--url': urlFlagHandler,
};

export function parseCurl(input: string): CurlImport | null {
  const trimmed = input.trimStart();
  if (!trimmed.toLowerCase().startsWith('curl')) return null;

  const tokens = tokenize(trimmed);
  if (!tokens.length || tokens[0].toLowerCase() !== 'curl') return null;

  const state: ParseState = { method: '', url: '', headers: [], body: '' };

  let i = 1; // skip 'curl'
  while (i < tokens.length) {
    const tok = tokens[i];
    const handler = FLAG_HANDLERS[tok];

    if (handler) {
      i = handler(tokens, i, state);
    } else if (NO_ARG_FLAGS.has(tok)) {
      i++;
    } else if (SKIP_ARG_FLAGS.has(tok)) {
      i += 2;
    } else if (/^-[a-zA-Z]{2,}$/.test(tok)) {
      i++;
    } else {
      if (!tok.startsWith('-')) state.url = tok;
      i++;
    }
  }

  if (!state.url) return null;

  const method = (state.method || (state.body ? 'POST' : 'GET')).toUpperCase();
  const { url, params } = parseUrl(state.url);

  return { method, url, headers: state.headers, params, body: state.body };
}
