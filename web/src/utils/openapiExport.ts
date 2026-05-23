import type { Environment, KeyValue, Project, Request, Response as AppResponse } from '../lib/types';
import { generateDocument } from '../lib/openapi/generate';
import { toYAML } from '../lib/openapi/stringify';

export interface OpenAPIExportOptions {
  project: Project;
  requests: Request[];
  lastResponses: AppResponse[];
  environments?: Environment[];
}

export function exportProjectAsOpenAPIYAML({ project, requests, lastResponses, environments }: OpenAPIExportOptions): string {
  const responseMap = new Map<number, AppResponse | null>();
  for (const r of lastResponses) responseMap.set(r.request_id, r);

  const envVarsByRequestId = new Map<number, KeyValue[]>();
  if (environments && environments.length) {
    for (const req of requests) {
      const env = req.env_id != null ? environments.find((e) => e.id === req.env_id) : null;
      envVarsByRequestId.set(req.id, env?.variables ?? []);
    }
  }

  const doc = generateDocument(project, requests, responseMap, envVarsByRequestId);
  return toYAML(doc);
}
