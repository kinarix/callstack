import type { HTTPMethod, KeyValue } from './types';

// ── Schema version ──────────────────────────────────────
export const CALLSTACK_SCHEMA_VERSION = '1.0.0';
export const CALLSTACK_FILE_EXTENSION = '.callstack';
export const CALLSTACK_PLAIN_EXTENSION = '.callstack.json';

// ── Manifest (root of manifest.json inside archive) ─────
export interface CallstackManifest {
  schemaVersion: string;
  exportedAt: string;
  generator: string;
  project: ExportProject;
  folders: ExportFolder[];
  requests: ExportRequest[];
  environments: ExportEnvironment[];
  automations?: ExportAutomation[];
  dataFiles?: ExportDataFile[];
  responses?: ExportResponse[];
}

// ── Project ─────────────────────────────────────────────
export interface ExportProject {
  name: string;
  description: string | null;
  selectedEnvironmentName?: string; // name of the active env at export time
}

// ── Folder ──────────────────────────────────────────────
export interface ExportFolder {
  _ref: string;
  name: string;
}

// ── Request ─────────────────────────────────────────────
export interface ExportRequest {
  _ref: string;
  folderRef: string | null;
  name: string;
  method: HTTPMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
  preScript: string;
  postScript: string;
  position: number;
  attachments: ExportAttachment[];
}

// ── Attachment ──────────────────────────────────────────
export interface ExportAttachment {
  name: string;
  size: number;
  mime: string;
}

// ── Environment ─────────────────────────────────────────
export interface ExportEnvironment {
  name: string;
  variables: KeyValue[];
}

// ── Response ────────────────────────────────────────────
export interface ExportResponse {
  requestRef: string;
  status: number;
  statusText: string;
  headers: KeyValue[];
  body: string;
  timeMs: number;
  size: number;
  timestamp: number;
}

// ── Data File ──────────────────────────────────────────
export interface ExportDataFile {
  _ref: string;
  name: string;
  content: string;
}

// ── Automation ──────────────────────────────────────────
export type ExportBranchCondition =
  | { type: 'lastRequestPass' }
  | { type: 'lastRequestFail' }
  | { type: 'lastStatusGte'; value: number }
  | { type: 'lastStatusLt'; value: number }
  | { type: 'emittedEquals'; key: string; value: string }
  | { type: 'emittedExists'; key: string }
  | { type: 'emittedTruthy'; key: string };

export type ExportAutomationStep =
  | { id: string; type: 'request'; requestRef: string | null }
  | { id: string; type: 'delay'; delayMs: number }
  | { id: string; type: 'repeat'; count: number; steps: ExportAutomationStep[] }
  | { id: string; type: 'branch'; condition: ExportBranchCondition; trueSteps: ExportAutomationStep[]; falseSteps: ExportAutomationStep[] }
  | { id: string; type: 'csv_iterator'; dataFileRef: string | null; limit?: number | null; steps: ExportAutomationStep[] }
  | { id: string; type: 'fanout'; lanes: ExportAutomationStep[][] }
  | { id: string; type: 'stop' }
  | { id: string; type: 'log'; scope: string; object: string };

export interface ExportAutomation {
  _ref: string;
  name: string;
  steps: ExportAutomationStep[];
}

// ── Import types ────────────────────────────────────────
export type ImportStrategy = 'new-project' | 'merge-into';

export interface ArchivePreview {
  name: string;
  description: string | null;
  schemaVersion: string;
  exportedAt: string;
  folderCount: number;
  requestCount: number;
  environmentCount: number;
  automationCount: number;
  dataFileCount: number;
  hasResponses: boolean;
}
