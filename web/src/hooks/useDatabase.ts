import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Project, Request, Folder, Response, Environment, DataFile, KeyValue, Automation, AutomationRun, AutomationRequestResult, AutomationStep, Cookie } from '../lib/types';

/** Ensure every nested step type has its required arrays, guarding against old DB data. */
function normalizeSteps(steps: AutomationStep[]): AutomationStep[] {
  if (!Array.isArray(steps)) return [];
  return steps.map((s) => {
    if (s.type === 'repeat') return { ...s, steps: normalizeSteps(s.steps ?? []) };
    if (s.type === 'csv_iterator') return { ...s, steps: normalizeSteps((s as any).steps ?? []) };
    if (s.type === 'branch') return { ...s, trueSteps: normalizeSteps((s as any).trueSteps ?? []), falseSteps: normalizeSteps((s as any).falseSteps ?? []) };
    if (s.type === 'fanout') return { ...s, lanes: ((s as any).lanes ?? []).map((l: AutomationStep[]) => normalizeSteps(l ?? [])) };
    return s;
  });
}

interface RawRequest {
  id: number;
  projectId: number;
  folderId: number | null;
  userEmail: string | null;
  name: string;
  method: string;
  url: string;
  params: string;
  headers: string;
  body: string;
  attachments: string;
  preScript: string;
  postScript: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  imported: boolean;
  envId: number | null;
}

function parseRequest(raw: RawRequest): Request {
  return {
    id: raw.id,
    project_id: raw.projectId,
    folder_id: raw.folderId ?? null,
    user_email: raw.userEmail,
    name: raw.name,
    method: raw.method as any,
    url: raw.url,
    params: JSON.parse(raw.params || '[]'),
    headers: JSON.parse(raw.headers || '[]'),
    body: raw.body,
    files: JSON.parse(raw.attachments || '[]'),
    pre_script: raw.preScript ?? '',
    post_script: raw.postScript ?? '',
    position: raw.position,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
    imported: raw.imported ?? false,
    env_id: raw.envId ?? null,
  };
}

interface RawFolder {
  id: number;
  projectId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  imported: boolean;
}

function parseFolder(raw: RawFolder): Folder {
  return {
    id: raw.id,
    project_id: raw.projectId,
    name: raw.name,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
    imported: raw.imported ?? false,
  };
}

interface RawProject {
  id: number;
  userEmail: string | null;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseProject(raw: RawProject): Project {
  return {
    id: raw.id,
    user_email: raw.userEmail,
    name: raw.name,
    description: raw.description,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
  };
}

export function useDatabase() {
  const loadUserProjects = useCallback(
    async (userEmail: string | null): Promise<Project[]> => {
      const raws = await invoke<RawProject[]>('list_projects', { userEmail });
      return raws.map(parseProject);
    },
    []
  );

  const createProject = useCallback(
    async (userEmail: string | null, name: string, description: string | null): Promise<Project> => {
      const raw = await invoke<RawProject>('create_project', { userEmail, name, description });
      return parseProject(raw);
    },
    []
  );

  const updateProject = useCallback(
    async (id: number, name: string, description: string | null): Promise<Project> => {
      const raw = await invoke<RawProject>('update_project', { id, name, description });
      return parseProject(raw);
    },
    []
  );

  const deleteProject = useCallback(
    async (id: number): Promise<void> => {
      await invoke('delete_project', { id });
    },
    []
  );

  const loadUserRequests = useCallback(
    async (projectId: number): Promise<Request[]> => {
      const raws = await invoke<RawRequest[]>('list_requests', { projectId });
      return raws.map(parseRequest);
    },
    []
  );

  const createRequest = useCallback(
    async (projectId: number, userEmail: string | null, name: string, folderId?: number | null): Promise<Request> => {
      const raw = await invoke<RawRequest>('create_request', { projectId, userEmail, name, folderId: folderId ?? null });
      return parseRequest(raw);
    },
    []
  );

  const updateRequest = useCallback(
    async (
      id: number,
      fields: {
        name?: string;
        method?: string;
        url?: string;
        params?: string;
        headers?: string;
        body?: string;
        attachments?: string;
        pre_script?: string;
        post_script?: string;
        env_id?: number | null;
      }
    ): Promise<Request> => {
      const { pre_script, post_script, env_id, ...rest } = fields;
      const raw = await invoke<RawRequest>('update_request', {
        id,
        ...rest,
        ...(pre_script !== undefined ? { preScript: pre_script } : {}),
        ...(post_script !== undefined ? { postScript: post_script } : {}),
        ...(env_id !== undefined ? { envId: env_id } : {}),
      });
      return parseRequest(raw);
    },
    []
  );

  const deleteRequest = useCallback(
    async (id: number): Promise<void> => {
      await invoke('delete_request', { id });
    },
    []
  );

  const moveRequest = useCallback(
    async (id: number, projectId: number, folderId: number | null, position: number): Promise<void> => {
      await invoke('move_request', { id, projectId, folderId, position });
    },
    []
  );

  const moveFolder = useCallback(
    async (id: number, projectId: number): Promise<void> => {
      await invoke('move_folder', { id, projectId });
    },
    []
  );

  const reorderRequests = useCallback(
    async (ids: number[]): Promise<void> => {
      await invoke('reorder_requests', { ids });
    },
    []
  );

  const loadFolders = useCallback(
    async (projectId: number): Promise<Folder[]> => {
      const raws = await invoke<RawFolder[]>('list_folders', { projectId });
      return raws.map(parseFolder);
    },
    []
  );

  const createFolder = useCallback(
    async (projectId: number, name: string, imported?: boolean): Promise<Folder> => {
      const raw = await invoke<RawFolder>('create_folder', { projectId, name, imported: imported ?? null });
      return parseFolder(raw);
    },
    []
  );

  const importRequests = useCallback(
    async (
      projectId: number,
      folderId: number | null,
      userEmail: string | null,
      requests: { name: string; method: string; url: string; params: string; headers: string; body: string; pre_script?: string; post_script?: string }[]
    ): Promise<Request[]> => {
      // Rust struct uses camelCase (rename_all = "camelCase"), so transform keys
      const mapped = requests.map(({ pre_script, post_script, ...rest }) => ({
        ...rest,
        ...(pre_script !== undefined ? { preScript: pre_script } : {}),
        ...(post_script !== undefined ? { postScript: post_script } : {}),
      }));
      const raws = await invoke<RawRequest[]>('import_requests', { projectId, folderId, userEmail, requests: mapped });
      return raws.map(parseRequest);
    },
    []
  );

  const updateFolder = useCallback(
    async (id: number, name: string): Promise<Folder> => {
      const raw = await invoke<RawFolder>('update_folder', { id, name });
      return parseFolder(raw);
    },
    []
  );

  const deleteFolder = useCallback(
    async (id: number): Promise<void> => {
      await invoke('delete_folder', { id });
    },
    []
  );

  const duplicateRequest = useCallback(
    async (id: number): Promise<Request> => {
      const raw = await invoke<RawRequest>('duplicate_request', { id });
      return parseRequest(raw);
    },
    []
  );

  const duplicateFolder = useCallback(
    async (id: number): Promise<{ folder: Folder; requests: Request[] }> => {
      const raw = await invoke<{ folder: RawFolder; requests: RawRequest[] }>('duplicate_folder', { id });
      return { folder: parseFolder(raw.folder), requests: raw.requests.map(parseRequest) };
    },
    []
  );

  const saveResponse = useCallback(
    async (
      requestId: number,
      status: number,
      statusText: string,
      headers: Response['headers'],
      body: string,
      timeMs: number,
      size: number,
      timestampMs: number,
      historyLimit: number,
      requestHeaders: Response['headers'],
      requestParams: Response['headers'],
      requestBody: string,
    ): Promise<void> => {
      await invoke('save_response', {
        requestId,
        status,
        statusText,
        headers: JSON.stringify(headers),
        body,
        timeMs,
        size,
        timestampMs,
        historyLimit,
        requestHeaders: JSON.stringify(requestHeaders),
        requestParams: JSON.stringify(requestParams),
        requestBody,
      });
    },
    []
  );

  const listEnvironments = useCallback(
    async (projectId: number): Promise<Environment[]> => {
      interface RawEnv {
        id: number;
        projectId: number;
        name: string;
        variables: string;
        createdAt: string;
        updatedAt: string;
      }
      const raws = await invoke<RawEnv[]>('list_environments', { projectId });
      return raws.map((r) => ({
        id: r.id,
        project_id: r.projectId,
        name: r.name,
        variables: JSON.parse(r.variables || '[]') as KeyValue[],
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      }));
    },
    []
  );

  const createEnvironment = useCallback(
    async (projectId: number, name: string): Promise<Environment> => {
      interface RawEnv {
        id: number;
        projectId: number;
        name: string;
        variables: string;
        createdAt: string;
        updatedAt: string;
      }
      const r = await invoke<RawEnv>('create_environment', { projectId, name });
      return {
        id: r.id,
        project_id: r.projectId,
        name: r.name,
        variables: JSON.parse(r.variables || '[]') as KeyValue[],
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      };
    },
    []
  );

  const updateEnvironment = useCallback(
    async (id: number, name: string, variables: KeyValue[]): Promise<Environment> => {
      interface RawEnv {
        id: number;
        projectId: number;
        name: string;
        variables: string;
        createdAt: string;
        updatedAt: string;
      }
      const r = await invoke<RawEnv>('update_environment', {
        id,
        name,
        variables: JSON.stringify(variables),
      });
      return {
        id: r.id,
        project_id: r.projectId,
        name: r.name,
        variables: JSON.parse(r.variables || '[]') as KeyValue[],
        created_at: r.createdAt,
        updated_at: r.updatedAt,
      };
    },
    []
  );

  const deleteEnvironment = useCallback(
    async (id: number): Promise<void> => {
      await invoke('delete_environment', { id });
    },
    []
  );

  const getLastResponse = useCallback(
    async (requestId: number): Promise<Response | null> => {
      interface RawStoredResponse {
        id: number;
        requestId: number;
        status: number;
        statusText: string;
        headers: string;
        body: string;
        timeMs: number;
        size: number;
        timestampMs: number;
        requestHeaders: string;
        requestParams: string;
        requestBody: string;
      }
      const raw = await invoke<RawStoredResponse | null>('get_last_response', { requestId });
      if (!raw) return null;
      return {
        id: raw.id,
        request_id: raw.requestId,
        status: raw.status,
        statusText: raw.statusText,
        headers: JSON.parse(raw.headers || '[]'),
        body: raw.body,
        time: raw.timeMs,
        size: raw.size,
        timestamp: raw.timestampMs || undefined,
        requestHeaders: JSON.parse(raw.requestHeaders || '[]'),
        requestParams: JSON.parse(raw.requestParams || '[]'),
        requestBody: raw.requestBody || undefined,
      };
    },
    []
  );

  const getResponseHistory = useCallback(
    async (requestId: number): Promise<Response[]> => {
      interface RawStoredResponse {
        id: number;
        requestId: number;
        status: number;
        statusText: string;
        headers: string;
        body: string;
        timeMs: number;
        size: number;
        timestampMs: number;
        requestHeaders: string;
        requestParams: string;
        requestBody: string;
      }
      const rows = await invoke<RawStoredResponse[]>('get_response_history', { requestId });
      return rows.map((raw) => ({
        id: raw.id,
        request_id: raw.requestId,
        status: raw.status,
        statusText: raw.statusText,
        headers: JSON.parse(raw.headers || '[]'),
        body: raw.body,
        time: raw.timeMs,
        size: raw.size,
        timestamp: raw.timestampMs || undefined,
        requestHeaders: JSON.parse(raw.requestHeaders || '[]'),
        requestParams: JSON.parse(raw.requestParams || '[]'),
        requestBody: raw.requestBody || undefined,
      }));
    },
    []
  );

  // --- Automation methods ---

  const listAutomations = useCallback(async (projectId: number): Promise<Automation[]> => {
    const rows = await invoke<{ id: number; projectId: number; name: string; steps: string; createdAt: string; updatedAt: string; envId: number | null }[]>('list_automations', { projectId });
    return rows.map((r) => ({ ...r, steps: normalizeSteps(JSON.parse(r.steps || '[]')), envId: r.envId ?? null }));
  }, []);

  const createAutomation = useCallback(async (projectId: number, name: string, steps: AutomationStep[]): Promise<Automation> => {
    const r = await invoke<{ id: number; projectId: number; name: string; steps: string; createdAt: string; updatedAt: string; envId: number | null }>('create_automation', { projectId, name, steps: JSON.stringify(steps) });
    return { ...r, steps: normalizeSteps(JSON.parse(r.steps || '[]')), envId: r.envId ?? null };
  }, []);

  const updateAutomation = useCallback(async (id: number, name: string, steps: AutomationStep[], envId?: number | null): Promise<Automation> => {
    const r = await invoke<{ id: number; projectId: number; name: string; steps: string; createdAt: string; updatedAt: string; envId: number | null }>('update_automation', {
      id,
      name,
      steps: JSON.stringify(steps),
      ...(envId !== undefined ? { envId } : {}),
    });
    return { ...r, steps: normalizeSteps(JSON.parse(r.steps || '[]')), envId: r.envId ?? null };
  }, []);

  const deleteAutomation = useCallback(async (id: number): Promise<void> => {
    await invoke('delete_automation', { id });
  }, []);

  const saveAutomationRun = useCallback(async (automationId: number, status: string, results: AutomationRequestResult[], durationMs: number): Promise<AutomationRun> => {
    const r = await invoke<{ id: number; automationId: number; status: string; results: string; durationMs: number; createdAt: string }>('save_automation_run', {
      automationId,
      status,
      results: JSON.stringify(results),
      durationMs,
    });
    return { ...r, status: r.status as AutomationRun['status'], results: JSON.parse(r.results || '[]') };
  }, []);

  const listAutomationRuns = useCallback(async (automationId: number, limit = 20): Promise<AutomationRun[]> => {
    const rows = await invoke<{ id: number; automationId: number; status: string; results: string; durationMs: number; createdAt: string }[]>('list_automation_runs', { automationId, limit });
    return rows.map((r) => ({ ...r, status: r.status as AutomationRun['status'], results: JSON.parse(r.results || '[]') }));
  }, []);

  const clearAutomationRuns = useCallback(async (automationId: number): Promise<void> => {
    await invoke('clear_automation_runs', { automationId });
  }, []);

  const deleteAutomationRun = useCallback(async (id: number): Promise<void> => {
    await invoke('delete_automation_run', { id });
  }, []);

  // --- Data file methods ---

  interface RawDataFile {
    id: number;
    projectId: number;
    name: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  }

  const toDataFile = (r: RawDataFile): DataFile => ({
    id: r.id,
    project_id: r.projectId,
    name: r.name,
    content: r.content,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  });

  const listDataFiles = useCallback(async (projectId: number): Promise<DataFile[]> => {
    const rows = await invoke<RawDataFile[]>('list_data_files', { projectId });
    return rows.map(toDataFile);
  }, []);

  const createDataFile = useCallback(async (projectId: number, name: string, content: string): Promise<DataFile> => {
    const r = await invoke<RawDataFile>('create_data_file', { projectId, name, content });
    return toDataFile(r);
  }, []);

  const updateDataFile = useCallback(async (id: number, name: string, content: string): Promise<DataFile> => {
    const r = await invoke<RawDataFile>('update_data_file', { id, name, content });
    return toDataFile(r);
  }, []);

  const deleteDataFile = useCallback(async (id: number): Promise<void> => {
    await invoke('delete_data_file', { id });
  }, []);

  const listCookies = useCallback(async (projectId: number): Promise<Cookie[]> => {
    return invoke<Cookie[]>('list_cookies', { projectId });
  }, []);

  const deleteCookie = useCallback(async (id: number): Promise<void> => {
    await invoke('delete_cookie', { id });
  }, []);

  const clearCookies = useCallback(async (projectId: number, domain?: string): Promise<void> => {
    await invoke('clear_cookies', { projectId, domain: domain ?? null });
  }, []);

  return {
    isReady: true, // Always ready — Rust manages the DB
    loadUserProjects,
    createProject,
    updateProject,
    deleteProject,
    loadUserRequests,
    createRequest,
    updateRequest,
    deleteRequest,
    moveRequest,
    moveFolder,
    reorderRequests,
    loadFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    importRequests,
    duplicateRequest,
    duplicateFolder,
    saveResponse,
    getLastResponse,
    getResponseHistory,
    listEnvironments,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    listDataFiles,
    createDataFile,
    updateDataFile,
    deleteDataFile,
    listAutomations,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    saveAutomationRun,
    listAutomationRuns,
    clearAutomationRuns,
    deleteAutomationRun,
    listCookies,
    deleteCookie,
    clearCookies,
  };
}
