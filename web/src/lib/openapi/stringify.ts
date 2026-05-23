import { stringify as yamlStringify } from 'yaml';

export function toYAML(value: unknown): string {
  return yamlStringify(value, {
    indent: 2,
    lineWidth: 0,
    blockQuote: 'literal',
  });
}
