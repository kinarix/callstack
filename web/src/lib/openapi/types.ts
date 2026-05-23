export interface OpenAPISchema {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';
  format?: string;
  properties?: Record<string, OpenAPISchema>;
  required?: string[];
  items?: OpenAPISchema;
  example?: unknown;
  nullable?: boolean;
  enum?: unknown[];
}

export interface OpenAPIParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: OpenAPISchema;
  example?: unknown;
}

export interface OpenAPIMediaType {
  schema?: OpenAPISchema;
  example?: unknown;
}

export interface OpenAPIRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIResponse {
  description: string;
  content?: Record<string, OpenAPIMediaType>;
}

export interface OpenAPIExternalDocs {
  url: string;
  description?: string;
}

export interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  externalDocs?: OpenAPIExternalDocs;
  parameters?: OpenAPIParameter[];
  requestBody?: OpenAPIRequestBody;
  responses: Record<string, OpenAPIResponse>;
}

export type OpenAPIPathItem = Partial<Record<
  'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' | 'trace',
  OpenAPIOperation
>>;

export interface OpenAPIInfo {
  title: string;
  version: string;
  description?: string;
}

export interface OpenAPIServer {
  url: string;
  description?: string;
}

export interface OpenAPIDocument {
  openapi: '3.1.0';
  info: OpenAPIInfo;
  servers?: OpenAPIServer[];
  paths: Record<string, OpenAPIPathItem>;
}
