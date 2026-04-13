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
  path: string;
  data?: string; // base64-encoded file contents
}

export interface Environment {
  id: number;
  project_id: number;
  name: string;
  variables: KeyValue[];
  created_at: string;
  updated_at: string;
}

export interface LogEntry {
  id: number;
  timestamp: number;
  method: string;
  url: string;
  curl: string;
  status?: number;
  statusText?: string;
  time?: number;
  size?: number;
  error?: string;
}

export interface AppState {
  currentRequestId: number | null;
  currentProjectId: number | null;
  projects: Project[];
  requests: Request[];
  folders: Folder[];
  environments: Environment[];
  currentResponse: Response | null;
  isLoading: boolean;
  executingRequestId: number | null;
  expandedProjects: Set<number>;
  expandedFolders: Set<number>;
  logs: LogEntry[];
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
  | { type: 'CLEAR_LOGS' };
