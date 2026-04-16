export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
export type Theme = 'dark' | 'light' | 'dim' | 'system';

export interface KeyValue {
  key: string;
  value: string;
  enabled?: boolean;
}

export interface Project {
  id: number;
  user_email: string | null;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Folder {
  id: number;
  project_id: number;
  name: string;
  created_at: string;
  updated_at: string;
  imported: boolean;
}

export interface Request {
  id: number;
  project_id: number;
  folder_id: number | null;
  user_email: string | null;
  name: string;
  method: HTTPMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
  files: FileAttachment[];
  pre_script: string;
  post_script: string;
  position: number;
  created_at: string;
  updated_at: string;
  imported: boolean;
  env_id: number | null;
}

export interface TestResult {
  description: string;
  passed: boolean;
  severity?: 'success' | 'warning' | 'error';
  error?: string;
  message?: string;
}

export type TestStatus = 'PASS' | 'FAIL' | 'PARTIAL';

export interface Response {
  id: number;
  request_id: number;
  status: number;
  statusText: string;
  headers: KeyValue[];
  body: string;
  time: number;
  size: number;
  timestamp?: number;
  isBase64?: boolean;
  testResults?: TestResult[];
  testStatus?: TestStatus;
}

export interface FileAttachment {
  name: string;
  size: number;
  mime: string;
  path: string; // empty string = file not on this machine (imported from another machine)
}

export interface Environment {
  id: number;
  project_id: number;
  name: string;
  variables: KeyValue[];
  created_at: string;
  updated_at: string;
}

export interface DataFile {
  id: number;
  project_id: number;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  id: number;
  timestamp: number;
  kind?: 'http' | 'automation';
  // HTTP log fields
  method?: string;
  url?: string;
  curl?: string;
  status?: number;
  statusText?: string;
  time?: number;
  size?: number;
  error?: string;
  // Automation log fields
  message?: string;
}

export interface AppState {
  currentRequestId: number | null;
  currentProjectId: number | null;
  projects: Project[];
  requests: Request[];
  folders: Folder[];
  environments: Environment[];
  dataFiles: DataFile[];
  currentResponse: Response | null;
  isLoading: boolean;
  executingRequestId: number | null;
  expandedProjects: Set<number>;
  expandedFolders: Set<number>;
  logs: LogEntry[];
  automations: Automation[];
  activeView: 'request' | 'automation' | 'environment' | 'dataFile';
  activeAutomationId: number | null;
  activeEnvironmentId: number | null;
  activeDataFileId: number | null;
  error: { message: string; showReset: boolean } | null;
}

export interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export type AppAction =
  | { type: 'SET_CURRENT_PROJECT'; payload: number | null }
  | { type: 'SET_CURRENT_REQUEST'; payload: number | null }
  | { type: 'SET_PROJECTS'; payload: Project[] }
  | { type: 'ADD_PROJECT'; payload: Project }
  | { type: 'UPDATE_PROJECT'; payload: Project }
  | { type: 'DELETE_PROJECT'; payload: number }
  | { type: 'SET_REQUESTS'; payload: Request[] }
  | { type: 'ADD_REQUEST'; payload: Request }
  | { type: 'UPDATE_REQUEST'; payload: Request }
  | { type: 'DELETE_REQUEST'; payload: number }
  | { type: 'MOVE_REQUEST'; payload: { ids: number[]; requestId: number; projectId: number; folderId: number | null } }
  | { type: 'MOVE_FOLDER'; payload: { folderId: number; projectId: number } }
  | { type: 'SET_RESPONSE'; payload: Response | null }
  | { type: 'SET_LOADING'; payload: boolean }
| { type: 'SET_EXECUTING_REQUEST'; payload: number | null }
  | { type: 'TOGGLE_PROJECT'; payload: number }
  | { type: 'SET_FOLDERS'; payload: Folder[] }
  | { type: 'ADD_FOLDER'; payload: Folder }
  | { type: 'UPDATE_FOLDER'; payload: Folder }
  | { type: 'DELETE_FOLDER'; payload: number }
  | { type: 'TOGGLE_FOLDER'; payload: number }
  | { type: 'SET_ENVIRONMENTS'; payload: Environment[] }
  | { type: 'ADD_ENVIRONMENT'; payload: Environment }
  | { type: 'UPDATE_ENVIRONMENT'; payload: Environment }
  | { type: 'DELETE_ENVIRONMENT'; payload: number }
  | { type: 'ADD_LOG'; payload: LogEntry }
  | { type: 'CLEAR_LOGS' }
  | { type: 'SET_AUTOMATIONS'; payload: Automation[] }
  | { type: 'ADD_AUTOMATION'; payload: Automation }
  | { type: 'UPDATE_AUTOMATION'; payload: Automation }
  | { type: 'DELETE_AUTOMATION'; payload: number }
  | { type: 'SET_VIEW'; payload: 'request' | 'automation' | 'environment' | 'dataFile' }
  | { type: 'SET_DATA_FILES'; payload: DataFile[] }
  | { type: 'ADD_DATA_FILE'; payload: DataFile }
  | { type: 'UPDATE_DATA_FILE'; payload: DataFile }
  | { type: 'DELETE_DATA_FILE'; payload: number }
  | { type: 'SET_ACTIVE_DATA_FILE'; payload: number | null }
  | { type: 'SET_ACTIVE_AUTOMATION'; payload: number | null }
  | { type: 'SET_ACTIVE_ENVIRONMENT'; payload: number | null }
  | { type: 'SHOW_ERROR'; payload: { message: string; showReset: boolean } }
  | { type: 'CLEAR_ERROR' };

export type BranchCondition =
  | { type: 'lastRequestPass' }
  | { type: 'lastRequestFail' }
  | { type: 'lastStatusGte'; value: number }
  | { type: 'lastStatusLt'; value: number }
  | { type: 'emittedEquals'; key: string; value: string }
  | { type: 'emittedExists'; key: string }
  | { type: 'emittedTruthy'; key: string };

export type LogScope = 'request' | 'response' | 'env' | 'emitter';

export type AutomationStep =
  | { id: string; type: 'request'; requestId: number | null }
  | { id: string; type: 'delay'; delayMs: number }
  | { id: string; type: 'repeat'; count: number; steps: AutomationStep[] }
  | { id: string; type: 'csv_iterator'; dataFileId: number | null; limit?: number | null; steps: AutomationStep[] }
  | { id: string; type: 'branch'; condition: BranchCondition; trueSteps: AutomationStep[]; falseSteps: AutomationStep[] }
  | { id: string; type: 'fanout'; lanes: AutomationStep[][] }
  | { id: string; type: 'stop' }
  | { id: string; type: 'log'; scope: LogScope; object: string }
  | { id: string; type: 'set_env'; envId: number | null };

export interface Automation {
  id: number;
  projectId: number;
  name: string;
  steps: AutomationStep[];
  createdAt: string;
  updatedAt: string;
  envId: number | null;
}

export interface AutomationRequestResult {
  requestId: number;
  requestName: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  timeMs: number;
  testResults: TestResult[];
  testStatus: TestStatus | null;
  error?: string;
  curl?: string;
  responseBody?: string;
  responseHeaders?: { key: string; value: string }[];
  requestParams?: { key: string; value: string }[];
  requestHeaders?: { key: string; value: string }[];
  requestBody?: string;
  rowIndex?: number;
  rowData?: Record<string, string>;
  containerLabel?: string;
}

export interface AutomationRun {
  id: number;
  automationId: number;
  status: TestStatus | 'ERROR';
  results: AutomationRequestResult[];
  durationMs: number;
  createdAt: string;
}
