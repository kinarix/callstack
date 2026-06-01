import { faker } from '@faker-js/faker';
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { snippetCompletion } from '@codemirror/autocomplete';
import type { KeyValue } from './types';
import { FAKER_TOKENS } from './templateTokens';

const FAKER_GENERATORS: Record<string, () => string> = {
  $randomUUID: () => faker.string.uuid(),
  $guid: () => faker.string.uuid(),
  $randomEmail: () => faker.internet.email(),
  $randomFirstName: () => faker.person.firstName(),
  $randomLastName: () => faker.person.lastName(),
  $randomFullName: () => faker.person.fullName(),
  $randomUserName: () => faker.internet.username(),
  $randomPassword: () => faker.internet.password(),
  $randomInt: () => faker.number.int({ min: 0, max: 1000 }).toString(),
  $randomFloat: () => faker.number.float({ min: 0, max: 1000, fractionDigits: 2 }).toString(),
  $randomPhoneNumber: () => faker.phone.number(),
  $randomUrl: () => faker.image.url(),
  $randomDomainName: () => faker.internet.domainName(),
  $randomIP: () => faker.internet.ipv4(),
  $randomIPV6: () => faker.internet.ipv6(),
  $randomMACAddress: () => faker.internet.mac(),
  $randomLoremWord: () => faker.lorem.word(),
  $randomLoremSentence: () => faker.lorem.sentence(),
  $randomLoremParagraph: () => faker.lorem.paragraph(),
  $randomCity: () => faker.location.city(),
  $randomCountry: () => faker.location.country(),
  $randomStreetAddress: () => faker.location.streetAddress(),
  $randomZipCode: () => faker.location.zipCode(),
  $randomCompanyName: () => faker.company.name(),
  $randomJobTitle: () => faker.person.jobTitle(),
  $randomColor: () => faker.color.human(),
  $randomHexColor: () => faker.color.rgb({ format: 'hex' }),
  $timestamp: () => Math.floor(Date.now() / 1000).toString(),
  $isoTimestamp: () => new Date().toISOString(),
};

/** True if the token name is a known faker generator (without generating a value). */
export function isFakerToken(tokenName: string): boolean {
  return Object.prototype.hasOwnProperty.call(FAKER_GENERATORS, tokenName);
}

function resolveFakerToken(tokenName: string): string | undefined {
  const generator = FAKER_GENERATORS[tokenName];
  return generator ? generator() : undefined;
}

export function resolveTemplate(text: string, variables: KeyValue[]): string {
  if (!text) return text;

  const activeVars = variables.filter((v) => v.enabled !== false && v.key.trim());
  const activeVarMap = new Map(activeVars.map((v) => [v.key, v]));
  const resolvedCache = new Map<string, string>();

  // Returns null if key is not a known env var (or is a circular ref)
  function resolveValue(key: string, visited: Set<string>): string | null {
    if (resolvedCache.has(key)) return resolvedCache.get(key)!;
    if (visited.has(key)) return null; // circular reference — leave intact

    const found = activeVarMap.get(key);
    if (!found) return null;

    visited.add(key);
    const resolved = found.value.replace(/\{\{\s*([\w.$#-]+)\s*\}\}/g, (match, k) => {
      const envValue = resolveValue(k, visited);
      if (envValue !== null) return envValue;

      if (k.startsWith('$')) {
        const fakerValue = resolveFakerToken(k);
        if (fakerValue !== undefined) return fakerValue;
      }

      return match;
    });
    visited.delete(key);

    resolvedCache.set(key, resolved);
    return resolved;
  }

  return text.replace(/\{\{\s*([\w.$#-]+)\s*\}\}/g, (match, key) => {
    const envValue = resolveValue(key, new Set());
    if (envValue !== null) return envValue;

    if (key.startsWith('$')) {
      const fakerValue = resolveFakerToken(key);
      if (fakerValue !== undefined) return fakerValue;
    }

    return match;
  });
}

export type TokenKind = 'env' | 'secret' | 'faker' | 'csv' | 'unresolved';

export interface TemplateMatch {
  /** Index of `{{` in the source text. */
  start: number;
  /** Index just after `}}` in the source text. */
  end: number;
  /** Inner token name, trimmed (e.g. `baseUrl`, `$randomUUID`, `#col`). */
  key: string;
  kind: TokenKind;
  /** False only for `unresolved`. */
  resolved: boolean;
  /** Human-readable value/label for a tooltip. Secrets are masked; faker/csv describe themselves. */
  displayValue: string;
}

const TEMPLATE_TOKEN_RE = /\{\{\s*([\w.$#-]+)\s*\}\}/g;

const fakerTokenDetail = new Map(FAKER_TOKENS.map((t) => [t.name, t]));

/** Locate every `{{token}}` in `text` and classify whether it resolves against the
 *  given env vars / secrets / faker / csv tokens. Shared by the input overlay and the
 *  CodeMirror body decorations so both surfaces agree on what counts as "unresolved". */
export function analyzeTemplates(
  text: string,
  envVars: KeyValue[],
  secrets: KeyValue[],
): TemplateMatch[] {
  if (!text) return [];

  const activeEnv = envVars.filter((v) => v.enabled !== false && v.key.trim());
  const activeSecrets = secrets.filter((s) => s.enabled !== false && s.key.trim());
  const envKeys = new Set(activeEnv.map((v) => v.key));
  const secretKeys = new Set(activeSecrets.map((s) => s.key));
  // Env values may reference other env vars (and faker tokens); resolve display values
  // against the combined map so the tooltip shows what actually gets sent.
  const combined = [...activeEnv, ...activeSecrets];

  const matches: TemplateMatch[] = [];
  TEMPLATE_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TEMPLATE_TOKEN_RE.exec(text)) !== null) {
    const key = m[1].trim();
    const start = m.index;
    const end = m.index + m[0].length;

    if (envKeys.has(key)) {
      matches.push({
        start, end, key, kind: 'env', resolved: true,
        displayValue: resolveTemplate(`{{${key}}}`, combined),
      });
    } else if (secretKeys.has(key)) {
      matches.push({
        start, end, key, kind: 'secret', resolved: true,
        displayValue: '••••••• (secret)',
      });
    } else if (key.startsWith('$') && isFakerToken(key)) {
      const detail = fakerTokenDetail.get(key);
      const label = detail?.example ? `${detail.detail} — e.g. ${detail.example}` : (detail?.detail ?? 'random value');
      matches.push({
        start, end, key, kind: 'faker', resolved: true,
        displayValue: `${label} (dynamic)`,
      });
    } else if (key.startsWith('#')) {
      matches.push({
        start, end, key, kind: 'csv', resolved: true,
        displayValue: 'resolved during CSV iteration (dynamic)',
      });
    } else {
      matches.push({
        start, end, key, kind: 'unresolved', resolved: false,
        displayValue: 'Unresolved — no matching variable',
      });
    }
  }
  return matches;
}

export function replaceTokensForValidation(text: string, contentType: string): string {
  if (contentType.includes('json')) {
    return text.replace(/"?\{\{\s*[\w.$#-]+\s*\}\}"?/g, (match) => {
      if (match.startsWith('"') && match.endsWith('"')) return '"sample"';
      if (match.startsWith('"')) return '"sample';
      if (match.endsWith('"')) return 'sample"';
      return '0';
    });
  }
  return text.replace(/\{\{\s*[\w.$#-]+\s*\}\}/g, 'sample');
}

/** CodeMirror completion source for template tokens */
export function templateCompletion(envVarKeys: string[] = [], secretKeys: string[] = []) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const before = ctx.state.doc.sliceString(Math.max(0, ctx.pos - 100), ctx.pos);
    const match = before.match(/\{\{([\w.$-]*)$/);

    if (!match) return null;

    const partial = match[1];
    const envOptions = envVarKeys.map((key) =>
      snippetCompletion(key, {
        label: key,
        detail: 'environment variable',
        type: 'variable',
      })
    );

    const secretOptions = secretKeys.map((key) =>
      snippetCompletion(key, {
        label: key,
        detail: 'secret',
        type: 'variable',
      })
    );

    const fakerOptions = FAKER_TOKENS.map((token) =>
      snippetCompletion(token.name, {
        label: token.name,
        detail: token.detail,
        type: 'variable',
      })
    );

    const all = [...envOptions, ...secretOptions, ...fakerOptions];
    const filtered = all.filter((c) =>
      c.label.toLowerCase().includes(partial.toLowerCase())
    );

    return {
      from: ctx.pos - partial.length,
      options: filtered,
      validFor: /^[\w.$-]*$/,
    };
  };
}
