export interface HeaderPreset {
  label: string;
  value: string;
}

const USER_AGENT_PRESETS: HeaderPreset[] = [
  { label: 'Callstack', value: 'Callstack/1.0' },
  { label: 'Chrome (macOS)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  { label: 'Chrome (Windows)', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  { label: 'Safari (macOS)', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15' },
  { label: 'Firefox', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:125.0) Gecko/20100101 Firefox/125.0' },
  { label: 'Edge', value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0' },
  { label: 'curl', value: 'curl/8.7.1' },
  { label: 'Python requests', value: 'python-requests/2.31.0' },
  { label: 'Postman', value: 'PostmanRuntime/7.37.0' },
];

const AUTHORIZATION_PRESETS: HeaderPreset[] = [
  { label: 'Bearer token', value: 'Bearer {{token}}' },
  { label: 'Basic auth', value: 'Basic {{credentials}}' },
  { label: 'API key', value: 'ApiKey {{api_key}}' },
  { label: 'Digest', value: 'Digest username="{{user}}", realm="{{realm}}", nonce="{{nonce}}", uri="{{uri}}", response="{{response}}"' },
  { label: 'AWS4-HMAC-SHA256', value: 'AWS4-HMAC-SHA256 Credential={{access_key}}, SignedHeaders={{signed_headers}}, Signature={{signature}}' },
];

const CONTENT_TYPE_PRESETS: HeaderPreset[] = [
  { label: 'JSON', value: 'application/json' },
  { label: 'XML', value: 'application/xml' },
  { label: 'Form URL-encoded', value: 'application/x-www-form-urlencoded' },
  { label: 'Multipart form', value: 'multipart/form-data' },
  { label: 'Plain text', value: 'text/plain' },
  { label: 'HTML', value: 'text/html' },
  { label: 'JavaScript', value: 'application/javascript' },
  { label: 'Octet-stream', value: 'application/octet-stream' },
];

const ACCEPT_PRESETS: HeaderPreset[] = [
  { label: 'Any', value: '*/*' },
  { label: 'JSON', value: 'application/json' },
  { label: 'XML', value: 'application/xml' },
  { label: 'HTML', value: 'text/html' },
  { label: 'Plain text', value: 'text/plain' },
  { label: 'JSON or XML', value: 'application/json, application/xml;q=0.9' },
];

const ACCEPT_ENCODING_PRESETS: HeaderPreset[] = [
  { label: 'gzip, deflate, br', value: 'gzip, deflate, br' },
  { label: 'gzip', value: 'gzip' },
  { label: 'Identity (no compression)', value: 'identity' },
];

const ACCEPT_LANGUAGE_PRESETS: HeaderPreset[] = [
  { label: 'English', value: 'en-US,en;q=0.9' },
  { label: 'Any', value: '*' },
];

const CACHE_CONTROL_PRESETS: HeaderPreset[] = [
  { label: 'no-cache', value: 'no-cache' },
  { label: 'no-store', value: 'no-store' },
  { label: 'max-age=0', value: 'max-age=0' },
  { label: 'max-age=3600', value: 'max-age=3600' },
];

const CONNECTION_PRESETS: HeaderPreset[] = [
  { label: 'keep-alive', value: 'keep-alive' },
  { label: 'close', value: 'close' },
];

const X_REQUESTED_WITH_PRESETS: HeaderPreset[] = [
  { label: 'XMLHttpRequest', value: 'XMLHttpRequest' },
  { label: 'Fetch', value: 'Fetch' },
];

export const HEADER_VALUE_PRESETS: Record<string, HeaderPreset[]> = {
  'user-agent': USER_AGENT_PRESETS,
  'authorization': AUTHORIZATION_PRESETS,
  'proxy-authorization': AUTHORIZATION_PRESETS,
  'content-type': CONTENT_TYPE_PRESETS,
  'accept': ACCEPT_PRESETS,
  'accept-encoding': ACCEPT_ENCODING_PRESETS,
  'accept-language': ACCEPT_LANGUAGE_PRESETS,
  'cache-control': CACHE_CONTROL_PRESETS,
  'connection': CONNECTION_PRESETS,
  'x-requested-with': X_REQUESTED_WITH_PRESETS,
};

export function getHeaderPresets(key: string): HeaderPreset[] | null {
  return HEADER_VALUE_PRESETS[key.toLowerCase()] ?? null;
}

export const COMMON_HEADER_NAMES: string[] = [
  'Accept',
  'Accept-Encoding',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Connection',
  'Content-Type',
  'Cookie',
  'Host',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'Origin',
  'Range',
  'Referer',
  'User-Agent',
  'X-Api-Key',
  'X-Correlation-ID',
  'X-CSRF-Token',
  'X-Forwarded-For',
  'X-Request-ID',
  'X-Requested-With',
];
