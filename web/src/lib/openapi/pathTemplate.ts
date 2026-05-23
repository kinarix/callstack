export interface TemplatedPath {
  path: string;
  pathVars: string[];
  baseUrl: string;
}

export function toOpenAPIPath(rawUrl: string): TemplatedPath {
  let url = (rawUrl || '').trim();
  let baseUrl = '';
  const schemeMatch = url.match(/^([a-zA-Z][a-zA-Z0-9+\-.]*):\/\/[^/?#]+/);
  if (schemeMatch) {
    baseUrl = schemeMatch[0];
    url = url.slice(schemeMatch[0].length);
  }
  const q = url.indexOf('?');
  if (q >= 0) url = url.slice(0, q);
  const h = url.indexOf('#');
  if (h >= 0) url = url.slice(0, h);
  if (!url.startsWith('/')) url = '/' + url;

  const vars: string[] = [];
  const templated = url
    .replace(/\{\{\s*([\w-]+)\s*\}\}/g, (_, name) => {
      if (!vars.includes(name)) vars.push(name);
      return `{${name}}`;
    })
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, name) => {
      if (!vars.includes(name)) vars.push(name);
      return `{${name}}`;
    });

  for (const m of templated.matchAll(/\{([\w-]+)\}/g)) {
    if (!vars.includes(m[1])) vars.push(m[1]);
  }

  return { path: templated || '/', pathVars: vars, baseUrl };
}
