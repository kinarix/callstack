import JSZip from 'jszip';
import type { Project, Folder, Request, Environment, Response } from '../lib/types';
import type {
  CallstackManifest,
  ExportFolder,
  ExportRequest,
  ExportResponse,
  ExportAttachment,
  ArchivePreview,
} from '../lib/callstackSchema';
import { CALLSTACK_SCHEMA_VERSION } from '../lib/callstackSchema';

// ── Export ───────────────────────────────────────────────

interface ExportOptions {
  project: Project;
  folders: Folder[];
  requests: Request[];
  environments: Environment[];
  responses?: Response[];
  selectedEnvironmentName?: string;
}

export async function exportProject(opts: ExportOptions): Promise<Blob> {
  const { project, folders, requests, environments, responses, selectedEnvironmentName } = opts;

  const zip = new JSZip();

  // Build folder ref map: database ID → _ref string
  const folderRefMap = new Map<number, string>();
  const exportFolders: ExportFolder[] = folders.map((f, i) => {
    const ref = `folder-${i}`;
    folderRefMap.set(f.id, ref);
    return { _ref: ref, name: f.name };
  });

  // Build request ref map and collect attachments
  const requestRefMap = new Map<number, string>();
  const exportRequests: ExportRequest[] = [];

  for (let i = 0; i < requests.length; i++) {
    const r = requests[i];
    const ref = `req-${i}`;
    requestRefMap.set(r.id, ref);

    const attachments: ExportAttachment[] = [];
    if (r.files && r.files.length > 0) {
      for (let j = 0; j < r.files.length; j++) {
        const file = r.files[j];
        const archivePath = `attachments/${ref}-${j}-${file.name}`;
        attachments.push({
          name: file.name,
          size: file.size,
          mime: file.mime,
          archivePath,
        });
        // Store binary data in ZIP if available
        if (file.data) {
          zip.file(archivePath, file.data, { base64: true });
        }
      }
    }

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
      attachments,
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
    ...(exportResponses ? { responses: exportResponses } : {}),
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

// ── Import ──────────────────────────────────────────────

export interface ParsedCallstackExport {
  manifest: CallstackManifest;
  attachmentData: Map<string, string>; // archivePath → base64 data
}

export async function importArchive(file: File): Promise<ParsedCallstackExport> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid .callstack file: missing manifest.json');
  }

  const manifestText = await manifestFile.async('text');
  const manifest = JSON.parse(manifestText) as CallstackManifest;

  // Validate schema version (reject if major version > 1)
  const majorVersion = parseInt(manifest.schemaVersion.split('.')[0], 10);
  if (isNaN(majorVersion) || majorVersion > 1) {
    throw new Error(
      `Unsupported schema version: ${manifest.schemaVersion}. This version of Callstack supports schema v1.x.x.`
    );
  }

  // Extract attachment data
  const attachmentData = new Map<string, string>();
  for (const req of manifest.requests) {
    for (const att of req.attachments) {
      const zipFile = zip.file(att.archivePath);
      if (zipFile) {
        const data = await zipFile.async('base64');
        attachmentData.set(att.archivePath, data);
      }
    }
  }

  return { manifest, attachmentData };
}

// ── Preview (lightweight) ───────────────────────────────

export async function previewArchive(file: File): Promise<ArchivePreview> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid .callstack file: missing manifest.json');
  }

  const manifestText = await manifestFile.async('text');
  const manifest = JSON.parse(manifestText) as CallstackManifest;

  return {
    name: manifest.project.name,
    description: manifest.project.description,
    schemaVersion: manifest.schemaVersion,
    exportedAt: manifest.exportedAt,
    folderCount: manifest.folders.length,
    requestCount: manifest.requests.length,
    environmentCount: manifest.environments.length,
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

  // Try parsing as JSON for Postman
  try {
    const text = await file.text();
    const json = JSON.parse(text);
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
