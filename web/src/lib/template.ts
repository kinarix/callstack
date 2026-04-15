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

  return text.replace(/\{\{\s*([\w.$-]+)\s*\}\}/g, (match, key) => {
    // Check env vars first (user override)
    const found = activeVars.find((v) => v.key === key);
    if (found !== undefined) return found.value;

    // Check faker tokens
    if (key.startsWith('$')) {
      const fakerValue = resolveFakerToken(key);
      if (fakerValue !== undefined) return fakerValue;
    }

    // Unknown token, leave intact
    return match;
  });
}

/** CodeMirror completion source for template tokens */
export function templateCompletion(envVarKeys: string[] = []) {
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

    const fakerOptions = FAKER_TOKENS.map((token) =>
      snippetCompletion(token.name, {
        label: token.name,
        detail: token.detail,
        type: 'variable',
      })
    );

    const all = [...envOptions, ...fakerOptions];
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
