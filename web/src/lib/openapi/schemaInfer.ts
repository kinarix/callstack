import type { OpenAPISchema } from './types';

export function inferSchemaFromValue(value: unknown): OpenAPISchema {
  if (value === null) return { type: 'null' };
  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length > 0 ? inferSchemaFromValue(value[0]) : {},
    };
  }
  switch (typeof value) {
    case 'string':
      return { type: 'string' };
    case 'number':
      return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'object': {
      const obj = value as Record<string, unknown>;
      const properties: Record<string, OpenAPISchema> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(obj)) {
        properties[k] = inferSchemaFromValue(v);
        if (v !== null && v !== undefined) required.push(k);
      }
      const schema: OpenAPISchema = { type: 'object', properties };
      if (required.length > 0) schema.required = required;
      return schema;
    }
    default:
      return {};
  }
}

export function inferSchemaFromBody(body: string, contentType: string): {
  schema: OpenAPISchema;
  example: unknown;
} | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  const ct = contentType.toLowerCase();
  if (ct.includes('json') || (!ct && (trimmed.startsWith('{') || trimmed.startsWith('[')))) {
    try {
      const parsed = JSON.parse(trimmed);
      return { schema: inferSchemaFromValue(parsed), example: parsed };
    } catch {
      return { schema: { type: 'string' }, example: trimmed };
    }
  }
  return { schema: { type: 'string' }, example: trimmed };
}
