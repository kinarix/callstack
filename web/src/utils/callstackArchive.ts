import JSZip from 'jszip';
import type { Project, Folder, Request, Environment, Response, Automation, AutomationStep } from '../lib/types';
import type {
  CallstackManifest,
  ExportFolder,
  ExportRequest,
  ExportResponse,
  ExportAutomation,
  ExportAutomationStep,
  ArchivePreview,
} from '../lib/callstackSchema';
import { CALLSTACK_SCHEMA_VERSION } from '../lib/callstackSchema';

// ── Export ───────────────────────────────────────────────

interface ExportOptions {
  project: Project;
  folders: Folder[];
  requests: Request[];
  environments: Environment[];
  automations?: Automation[];
  responses?: Response[];
  selectedEnvironmentName?: string;
}

// Helper: serialize AutomationStep recursively, mapping requestIds to requestRefs
function serializeAutomationStep(step: AutomationStep, requestRefMap: Map<number, string>): ExportAutomationStep {
  const base = { id: step.id, type: step.type } as ExportAutomationStep;

  if (step.type === 'request') {
    return {
      id: step.id,
      type: 'request',
      requestRef: step.requestId != null ? (requestRefMap.get(step.requestId) ?? null) : null,
    };
  }
  if (step.type === 'delay') {
    return {
      id: step.id,
      type: 'delay',
      delayMs: step.delayMs,
    };
  }
  if (step.type === 'repeat') {
    return {
      id: step.id,
      type: 'repeat',
      count: step.count,
      steps: step.steps.map((s) => serializeAutomationStep(s, requestRefMap)),
    };
  }
  if (step.type === 'branch') {
    return {
      id: step.id,
      type: 'branch',
      condition: step.condition as any, // BranchCondition type is identical in export
      trueSteps: step.trueSteps.map((s) => serializeAutomationStep(s, requestRefMap)),
      falseSteps: step.falseSteps.map((s) => serializeAutomationStep(s, requestRefMap)),
    };
  }
  if (step.type === 'fanout') {
    return {
      id: step.id,
      type: 'fanout',
      lanes: step.lanes.map((lane) => lane.map((s) => serializeAutomationStep(s, requestRefMap))),
    };
  }
  if (step.type === 'stop') {
    return {
      id: step.id,
      type: 'stop',
    };
  }
  if (step.type === 'log') {
    return {
      id: step.id,
      type: 'log',
      scope: step.scope,
      object: step.object,
    };
  }

  return base;
}

export async function exportProject(opts: ExportOptions): Promise<Blob> {
  const { project, folders, requests, environments, automations, responses, selectedEnvironmentName } = opts;

  const zip = new JSZip();

  // Build folder ref map: database ID → _ref string
  const folderRefMap = new Map<number, string>();
  const exportFolders: ExportFolder[] = folders.map((f, i) => {
    const ref = `folder-${i}`;
    folderRefMap.set(f.id, ref);
    return { _ref: ref, name: f.name };
  });

  // Build request ref map
  const requestRefMap = new Map<number, string>();
  const exportRequests: ExportRequest[] = [];

  for (let i = 0; i < requests.length; i++) {
    const r = requests[i];
    const ref = `req-${i}`;
    requestRefMap.set(r.id, ref);

    exportRequests.push({
      _ref: ref,
      folderRef: r.folder_id != null ? (folderRefMap.get(r.folder_id) ?? null) : null,
      name: r.name,
      method: r.method,
      url: r.url,
      params: r.params,
      headers: r.headers,
      body: r.body,
      preScript: r.pre_script,
      postScript: r.post_script,
      position: r.position,
      attachments: (r.files ?? []).map(({ name, size, mime }) => ({ name, size, mime })),
    });
  }

  // Build responses if included
  let exportResponses: ExportResponse[] | undefined;
  if (responses && responses.length > 0) {
    exportResponses = responses
      .filter((resp) => requestRefMap.has(resp.request_id))
      .map((resp) => ({
        requestRef: requestRefMap.get(resp.request_id)!,
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers,
        body: resp.body,
        timeMs: resp.time,
        size: resp.size,
        timestamp: resp.timestamp ?? 0,
      }));
  }

  // Build automations with serialized steps
  let exportAutomations: ExportAutomation[] | undefined;
  if (automations && automations.length > 0) {
    const automationRefMap = new Map<number, string>();
    exportAutomations = automations.map((a, i) => {
      const ref = `auto-${i}`;
      automationRefMap.set(a.id, ref);
      return {
        _ref: ref,
        name: a.name,
        steps: a.steps.map((s) => serializeAutomationStep(s, requestRefMap)),
      };
    });
  }

  const manifest: CallstackManifest = {
    schemaVersion: CALLSTACK_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    generator: `callstack/${__APP_VERSION__}`,
    project: {
      name: project.name,
      description: project.description,
      ...(selectedEnvironmentName ? { selectedEnvironmentName } : {}),
    },
    folders: exportFolders,
    requests: exportRequests,
    environments: environments.map((e) => ({
      name: e.name,
      variables: e.variables,
    })),
    ...(exportAutomations ? { automations: exportAutomations } : {}),
    ...(exportResponses ? { responses: exportResponses } : {}),
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function exportProjectPlain(opts: ExportOptions): Promise<string> {
  const { project, folders, requests, environments, automations, responses, selectedEnvironmentName } = opts;

  const folderRefMap = new Map<number, string>();
  const exportFolders: ExportFolder[] = folders.map((f, i) => {
    const ref = `folder-${i}`;
    folderRefMap.set(f.id, ref);
    return { _ref: ref, name: f.name };
  });

  const requestRefMap = new Map<number, string>();
  const exportRequests: ExportRequest[] = [];

  for (let i = 0; i < requests.length; i++) {
    const r = requests[i];
    const ref = `req-${i}`;
    requestRefMap.set(r.id, ref);

    exportRequests.push({
      _ref: ref,
      folderRef: r.folder_id != null ? (folderRefMap.get(r.folder_id) ?? null) : null,
      name: r.name,
      method: r.method,
      url: r.url,
      params: r.params,
      headers: r.headers,
      body: r.body,
      preScript: r.pre_script,
      postScript: r.post_script,
      position: r.position,
      attachments: (r.files ?? []).map(({ name, size, mime }) => ({ name, size, mime })),
    });
  }

  let exportResponses: ExportResponse[] | undefined;
  if (responses && responses.length > 0) {
    exportResponses = responses
      .filter((resp) => requestRefMap.has(resp.request_id))
      .map((resp) => ({
        requestRef: requestRefMap.get(resp.request_id)!,
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers,
        body: resp.body,
        timeMs: resp.time,
        size: resp.size,
        timestamp: resp.timestamp ?? 0,
      }));
  }

  // Build automations with serialized steps
  let exportAutomations: ExportAutomation[] | undefined;
  if (automations && automations.length > 0) {
    const automationRefMap = new Map<number, string>();
    exportAutomations = automations.map((a, i) => {
      const ref = `auto-${i}`;
      automationRefMap.set(a.id, ref);
      return {
        _ref: ref,
        name: a.name,
        steps: a.steps.map((s) => serializeAutomationStep(s, requestRefMap)),
      };
    });
  }

  const manifest: CallstackManifest = {
    schemaVersion: CALLSTACK_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    generator: `callstack/${__APP_VERSION__}`,
    project: {
      name: project.name,
      description: project.description,
      ...(selectedEnvironmentName ? { selectedEnvironmentName } : {}),
    },
    folders: exportFolders,
    requests: exportRequests,
    environments: environments.map((e) => ({
      name: e.name,
      variables: e.variables,
    })),
    ...(exportAutomations ? { automations: exportAutomations } : {}),
    ...(exportResponses ? { responses: exportResponses } : {}),
  };

  return JSON.stringify(manifest, null, 2);
}

// ── Import ──────────────────────────────────────────────

// Helper: deserialize ExportAutomationStep back to AutomationStep, mapping requestRefs to requestIds
export function deserializeAutomationStep(
  step: ExportAutomationStep,
  requestRefToId: Map<string, number>,
): AutomationStep {
  const base = { id: step.id, type: step.type } as AutomationStep;

  if (step.type === 'request') {
    return {
      id: step.id,
      type: 'request',
      requestId: step.requestRef != null ? (requestRefToId.get(step.requestRef) ?? null) : null,
    };
  }
  if (step.type === 'delay') {
    return {
      id: step.id,
      type: 'delay',
      delayMs: step.delayMs,
    };
  }
  if (step.type === 'repeat') {
    return {
      id: step.id,
      type: 'repeat',
      count: step.count,
      steps: step.steps.map((s) => deserializeAutomationStep(s, requestRefToId)),
    };
  }
  if (step.type === 'branch') {
    return {
      id: step.id,
      type: 'branch',
      condition: step.condition as any,
      trueSteps: step.trueSteps.map((s) => deserializeAutomationStep(s, requestRefToId)),
      falseSteps: step.falseSteps.map((s) => deserializeAutomationStep(s, requestRefToId)),
    };
  }
  if (step.type === 'fanout') {
    return {
      id: step.id,
      type: 'fanout',
      lanes: step.lanes.map((lane) => lane.map((s) => deserializeAutomationStep(s, requestRefToId))),
    };
  }
  if (step.type === 'stop') {
    return {
      id: step.id,
      type: 'stop',
    };
  }
  if (step.type === 'log') {
    return {
      id: step.id,
      type: 'log',
      scope: step.scope as any,
      object: step.object,
    };
  }

  return base;
}

export interface ParsedCallstackExport {
  manifest: CallstackManifest;
}

export async function importArchive(file: File): Promise<ParsedCallstackExport> {
  const header = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  const isZip = header[0] === 0x50 && header[1] === 0x4b;

  if (isZip) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('Invalid .callstack file: missing manifest.json');
    }

    const manifestText = await manifestFile.async('text');
    const manifest = JSON.parse(manifestText) as CallstackManifest;

    const majorVersion = parseInt(manifest.schemaVersion.split('.')[0], 10);
    if (isNaN(majorVersion) || majorVersion > 1) {
      throw new Error(
        `Unsupported schema version: ${manifest.schemaVersion}. This version of Callstack supports schema v1.x.x.`
      );
    }

    return { manifest };
  }

  // Plain JSON format
  const text = await file.text();
  const manifest = JSON.parse(text) as CallstackManifest;

  const majorVersion = parseInt(manifest.schemaVersion.split('.')[0], 10);
  if (isNaN(majorVersion) || majorVersion > 1) {
    throw new Error(
      `Unsupported schema version: ${manifest.schemaVersion}. This version of Callstack supports schema v1.x.x.`
    );
  }

  return { manifest };
}

// ── Preview (lightweight) ───────────────────────────────

export async function previewArchive(file: File): Promise<ArchivePreview> {
  const header = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  const isZip = header[0] === 0x50 && header[1] === 0x4b;

  let manifest: CallstackManifest;

  if (isZip) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const manifestFile = zip.file('manifest.json');
    if (!manifestFile) {
      throw new Error('Invalid .callstack file: missing manifest.json');
    }
    manifest = JSON.parse(await manifestFile.async('text')) as CallstackManifest;
  } else {
    manifest = JSON.parse(await file.text()) as CallstackManifest;
  }

  return {
    name: manifest.project.name,
    description: manifest.project.description,
    schemaVersion: manifest.schemaVersion,
    exportedAt: manifest.exportedAt,
    folderCount: manifest.folders.length,
    requestCount: manifest.requests.length,
    environmentCount: manifest.environments.length,
    automationCount: manifest.automations ? manifest.automations.length : 0,
    hasResponses: Array.isArray(manifest.responses) && manifest.responses.length > 0,
  };
}

// ── Detect file format ──────────────────────────────────

export type ImportFileFormat = 'callstack' | 'postman' | 'unknown';

export async function detectFileFormat(file: File): Promise<ImportFileFormat> {
  // ZIP files start with PK (0x50 0x4B)
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (header[0] === 0x50 && header[1] === 0x4b) {
    return 'callstack';
  }

  // Try parsing as JSON
  try {
    const text = await file.text();
    const json = JSON.parse(text);
    // Plain callstack format has a schemaVersion field
    if (json?.schemaVersion) {
      return 'callstack';
    }
    if (json?.info?.schema?.includes('getpostman.com')) {
      return 'postman';
    }
  } catch {
    // Not valid JSON
  }

  return 'unknown';
}

// ── App version placeholder (replaced by Vite) ─────────
declare const __APP_VERSION__: string;
