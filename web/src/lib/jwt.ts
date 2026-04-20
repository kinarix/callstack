export interface JWTPayload {
  email: string;
  name: string;
  picture: string;
  [key: string]: any;
}

export function parseJwt(token: string): JWTPayload {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}

function stripBearer(value: string): string {
  return value.replace(/^bearer\s+/i, '');
}

function b64urlDecode(seg: string): Record<string, any> {
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
  const json = decodeURIComponent(
    atob(b64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
  );
  return JSON.parse(json);
}

export function isJwt(value: string): boolean {
  const token = stripBearer(value.trim());
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  if (!parts.every((p) => /^[A-Za-z0-9_-]+$/.test(p))) return false;
  try {
    const header = b64urlDecode(parts[0]);
    return typeof header === 'object' && header !== null && 'alg' in header;
  } catch {
    return false;
  }
}

export interface DecodedJwt {
  header: Record<string, any>;
  payload: Record<string, any>;
}

export function decodeJwt(value: string): DecodedJwt | null {
  try {
    const token = stripBearer(value.trim());
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return { header: b64urlDecode(parts[0]), payload: b64urlDecode(parts[1]) };
  } catch {
    return null;
  }
}

export interface FoundJwt {
  path: string;
  value: string;
}

export function findJwtsInBody(body: string): FoundJwt[] {
  const results: FoundJwt[] = [];

  function walk(node: unknown, path: string) {
    if (typeof node === 'string') {
      if (isJwt(node)) results.push({ path, value: node });
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`));
    } else if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  }

  try {
    walk(JSON.parse(body), '');
  } catch {
    const trimmed = body.trim();
    if (isJwt(trimmed)) results.push({ path: '', value: trimmed });
  }

  return results;
}
