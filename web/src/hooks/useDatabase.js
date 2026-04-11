import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
function parseRequest(raw) {
    return {
        id: raw.id,
        project_id: raw.projectId,
        folder_id: raw.folderId ?? null,
        user_email: raw.userEmail,
        name: raw.name,
        method: raw.method,
        url: raw.url,
        params: JSON.parse(raw.params || '[]'),
        headers: JSON.parse(raw.headers || '[]'),
        body: raw.body,
        files: JSON.parse(raw.attachments || '[]'),
        position: raw.position,
        created_at: raw.createdAt,
        updated_at: raw.updatedAt,
    };
}
function parseFolder(raw) {
    return {
        id: raw.id,
        project_id: raw.projectId,
        name: raw.name,
        created_at: raw.createdAt,
        updated_at: raw.updatedAt,
    };
}
function parseProject(raw) {
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
    const loadUserProjects = useCallback(async (userEmail) => {
        const raws = await invoke('list_projects', { userEmail });
        return raws.map(parseProject);
    }, []);
    const createProject = useCallback(async (userEmail, name, description) => {
        const raw = await invoke('create_project', { userEmail, name, description });
        return parseProject(raw);
    }, []);
    const updateProject = useCallback(async (id, name, description) => {
        const raw = await invoke('update_project', { id, name, description });
        return parseProject(raw);
    }, []);
    const deleteProject = useCallback(async (id) => {
        await invoke('delete_project', { id });
    }, []);
    const loadUserRequests = useCallback(async (projectId) => {
        const raws = await invoke('list_requests', { projectId });
        return raws.map(parseRequest);
    }, []);
    const createRequest = useCallback(async (projectId, userEmail, name, folderId) => {
        const raw = await invoke('create_request', { projectId, userEmail, name, folderId: folderId ?? null });
        return parseRequest(raw);
    }, []);
    const updateRequest = useCallback(async (id, fields) => {
        const raw = await invoke('update_request', { id, ...fields });
        return parseRequest(raw);
    }, []);
    const deleteRequest = useCallback(async (id) => {
        await invoke('delete_request', { id });
    }, []);
    const moveRequest = useCallback(async (id, projectId, folderId, position) => {
        await invoke('move_request', { id, projectId, folderId, position });
    }, []);
    const moveFolder = useCallback(async (id, projectId) => {
        await invoke('move_folder', { id, projectId });
    }, []);
    const reorderRequests = useCallback(async (ids) => {
        await invoke('reorder_requests', { ids });
    }, []);
    const loadFolders = useCallback(async (projectId) => {
        const raws = await invoke('list_folders', { projectId });
        return raws.map(parseFolder);
    }, []);
    const createFolder = useCallback(async (projectId, name) => {
        const raw = await invoke('create_folder', { projectId, name });
        return parseFolder(raw);
    }, []);
    const updateFolder = useCallback(async (id, name) => {
        const raw = await invoke('update_folder', { id, name });
        return parseFolder(raw);
    }, []);
    const deleteFolder = useCallback(async (id) => {
        await invoke('delete_folder', { id });
    }, []);
    const saveResponse = useCallback(async (requestId, status, statusText, headers, body, timeMs, size, timestampMs) => {
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
    }, []);
    const listEnvironments = useCallback(async (projectId) => {
        const raws = await invoke('list_environments', { projectId });
        return raws.map((r) => ({
            id: r.id,
            project_id: r.projectId,
            name: r.name,
            variables: JSON.parse(r.variables || '[]'),
            created_at: r.createdAt,
            updated_at: r.updatedAt,
        }));
    }, []);
    const createEnvironment = useCallback(async (projectId, name) => {
        const r = await invoke('create_environment', { projectId, name });
        return {
            id: r.id,
            project_id: r.projectId,
            name: r.name,
            variables: JSON.parse(r.variables || '[]'),
            created_at: r.createdAt,
            updated_at: r.updatedAt,
        };
    }, []);
    const updateEnvironment = useCallback(async (id, name, variables) => {
        const r = await invoke('update_environment', {
            id,
            name,
            variables: JSON.stringify(variables),
        });
        return {
            id: r.id,
            project_id: r.projectId,
            name: r.name,
            variables: JSON.parse(r.variables || '[]'),
            created_at: r.createdAt,
            updated_at: r.updatedAt,
        };
    }, []);
    const deleteEnvironment = useCallback(async (id) => {
        await invoke('delete_environment', { id });
    }, []);
    const getLastResponse = useCallback(async (requestId) => {
        const raw = await invoke('get_last_response', { requestId });
        if (!raw)
            return null;
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
        saveResponse,
        getLastResponse,
        listEnvironments,
        createEnvironment,
        updateEnvironment,
        deleteEnvironment,
    };
}
