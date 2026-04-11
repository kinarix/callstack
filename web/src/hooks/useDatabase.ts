import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { Project, Request, Folder, Response, Environment, KeyValue } from '../lib/types';

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
  position: number;
  createdAt: string;
  updatedAt: string;
  imported: boolean;
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
    position: raw.position,
    created_at: raw.createdAt,
    updated_at: raw.updatedAt,
    imported: raw.imported ?? false,
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
      }
    ): Promise<Request> => {
      const raw = await invoke<RawRequest>('update_request', { id, ...fields });
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
      requests: { name: string; method: string; url: string; params: string; headers: string; body: string }[]
    ): Promise<Request[]> => {
      const raws = await invoke<RawRequest[]>('import_requests', { projectId, folderId, userEmail, requests });
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
      };
    },
    []
  );

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
    listEnvironments,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
  };
}
