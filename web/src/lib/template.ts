import { faker } from '@faker-js/faker';
import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { snippetCompletion } from '@codemirror/autocomplete';
import type { KeyValue } from './types';
import { FAKER_TOKENS } from './templateTokens';

function resolveFakerToken(tokenName: string): string | undefined {
  const fakerMap: Record<string, () => string> = {
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

  const generator = fakerMap[tokenName];
  return generator ? generator() : undefined;
}

export function resolveTemplate(text: string, variables: KeyValue[]): string {
  if (!text) return text;

  const activeVars = variables.filter((v) => v.enabled !== false && v.key.trim());
  const resolvedCache = new Map<string, string>();

  // Returns null if key is not a known env var (or is a circular ref)
  function resolveValue(key: string, visited: Set<string>): string | null {
    if (resolvedCache.has(key)) return resolvedCache.get(key)!;
    if (visited.has(key)) return null; // circular reference — leave intact

    const found = activeVars.find((v) => v.key === key);
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
