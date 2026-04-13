import { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useDatabase } from '../../hooks/useDatabase';
import { useShortcuts } from '../../hooks/useShortcuts';
import { ShortcutModal } from '../ShortcutModal/ShortcutModal';
import { NewProjectModal } from './NewProjectModal';
import { NewFolderModal } from './NewFolderModal';
import { EnvModal } from '../EnvModal/EnvModal';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import { ImportModal } from '../ImportModal/ImportModal';
import { ExportModal } from '../ExportModal/ExportModal';
import type { ExportItem } from '../ExportModal/ExportModal';
import type { ParsedCollection, ParsedRequest } from '../../utils/postmanParser';
import { exportFolderAsPostman, exportProjectAsPostman } from '../../utils/postmanParser';
import { invoke } from '@tauri-apps/api/core';
import type { Environment, Request } from '../../lib/types';
import { FilePickerModal } from '../FilePickerModal/FilePickerModal';
import { ProjectRow } from './ProjectRow';
import type { DragOver } from './ProjectRow';
import styles from './Sidebar.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingDelete =
  | { type: 'project'; id: number; name: string; requestCount: number; folderCount: number; envCount: number }
  | { type: 'folder'; id: number; name: string; requestCount: number }
  | { type: 'request'; id: number; name: string; method: string }
  | { type: 'env'; id: number; name: string };

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  externalRenameRequestId?: number | null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Sidebar({ collapsed, onToggleCollapse, externalRenameRequestId }: SidebarProps) {
  const { state, dispatch } = useApp();
  const {
    createProject,
    createRequest,
    updateRequest,
    updateProject,
    updateFolder,
    deleteProject,
    deleteRequest,
    createFolder,
    deleteFolder,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    moveRequest,
    moveFolder,
    reorderRequests,
    duplicateRequest,
    duplicateFolder,
    importRequests,
  } = useDatabase();

  const { projects, requests, folders, environments, currentRequestId, expandedProjects, expandedFolders } = state;

  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [folderModalProjectId, setFolderModalProjectId] = useState<number | null>(null);
  const [editingRequestId, setEditingRequestId] = useState<number | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [newFolderId, setNewFolderId] = useState<number | null>(null);
  const [envModalEnv, setEnvModalEnv] = useState<Environment | null>(null);
  const [expandedEnvSections, setExpandedEnvSections] = useState<Set<number>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const [shortcutModalRequestId, setShortcutModalRequestId] = useState<number | null>(null);
  const { shortcuts, assignShortcut, removeShortcut, getShortcutForRequest } = useShortcuts();
  const [importModalState, setImportModalState] = useState<{
    collectionName: string;
    requests: ParsedCollection['requests'];
    folderId: number;
    projectId: number;
  } | null>(null);
  const [exportModalState, setExportModalState] = useState<{
    title: string;
    items: ExportItem[];
    mode: 'project';
    projectName: string;
    folderGroups: { name: string; requests: Request[] }[];
    rootRequests: Request[];
  } | {
    title: string;
    items: ExportItem[];
    mode: 'folder';
    folderName: string;
  } | null>(null);
  const [filePickerState, setFilePickerState] = useState<
    | { mode: 'project'; projectId: number }
    | { mode: 'folder'; folderId: number; projectId: number }
    | null
  >(null);

  // Native DnD — ref avoids re-renders during drag; state drives visual feedback
  const dragging = useRef<{ kind: 'request' | 'folder'; id: number } | null>(null);
  const [dragOver, setDragOver] = useState<DragOver>(null);

  useEffect(() => {
    if (newFolderId === null) return;
    const el = document.getElementById(`folder-row-${newFolderId}`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setNewFolderId(null);
  }, [newFolderId, folders]);

  // Keyboard shortcut from App.tsx triggers inline rename
  useEffect(() => {
    if (externalRenameRequestId != null) setEditingRequestId(externalRenameRequestId);
  }, [externalRenameRequestId]);

  // ─── Non-DnD handlers ──────────────────────────────────────────────────────

  const handleCreateNewProject = async (name: string, description: string) => {
    const project = await createProject(null, name, description || null);
    dispatch({ type: 'ADD_PROJECT', payload: project });
    dispatch({ type: 'TOGGLE_PROJECT', payload: project.id });
    setShowNewProjectModal(false);
  };

  const handleCreateRootRequest = async (projectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const request = await createRequest(projectId, null, 'New Request', null);
    dispatch({ type: 'ADD_REQUEST', payload: request });
    dispatch({ type: 'SET_CURRENT_REQUEST', payload: request.id });
    setEditingRequestId(request.id);
  };

  const handleCreateFolderRequest = async (projectId: number, folderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const request = await createRequest(projectId, null, 'New Request', folderId);
    dispatch({ type: 'ADD_REQUEST', payload: request });
    dispatch({ type: 'SET_CURRENT_REQUEST', payload: request.id });
    setEditingRequestId(request.id);
  };

  const handleSelect = (id: number) => {
    dispatch({ type: 'SET_CURRENT_REQUEST', payload: id });
  };

  const requestDeleteProject = (projectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const project = projects.find((p) => p.id === projectId)!;
    const requestCount = requests.filter((r) => r.project_id === projectId).length;
    const folderCount = folders.filter((f) => f.project_id === projectId).length;
    const envCount = environments.filter((ev) => ev.project_id === projectId).length;
    setPendingDelete({ type: 'project', id: projectId, name: project.name, requestCount, folderCount, envCount });
  };

  const requestDeleteFolder = (folderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const folder = folders.find((f) => f.id === folderId)!;
    const requestCount = requests.filter((r) => r.folder_id === folderId).length;
    setPendingDelete({ type: 'folder', id: folderId, name: folder.name, requestCount });
  };

  const requestDeleteRequest = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const request = requests.find((r) => r.id === id)!;
    setPendingDelete({ type: 'request', id, name: request.name, method: request.method });
  };

  const requestDeleteEnv = (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPendingDelete({ type: 'env', id, name });
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    const pd = pendingDelete;
    console.log('Starting delete:', pd);
    setPendingDelete(null);
    try {
      if (pd.type === 'project') {
        console.log('Deleting project:', pd.id);
        await deleteProject(pd.id);
        dispatch({ type: 'DELETE_PROJECT', payload: pd.id });
      } else if (pd.type === 'folder') {
        console.log('Deleting folder:', pd.id);
        await deleteFolder(pd.id);
        dispatch({ type: 'DELETE_FOLDER', payload: pd.id });
      } else if (pd.type === 'request') {
        console.log('Deleting request:', pd.id);
        await deleteRequest(pd.id);
        console.log('Request deleted successfully');
        removeShortcut(pd.id);
        dispatch({ type: 'DELETE_REQUEST', payload: pd.id });
      } else if (pd.type === 'env') {
        console.log('Deleting environment:', pd.id);
        await deleteEnvironment(pd.id);
        dispatch({ type: 'DELETE_ENVIRONMENT', payload: pd.id });
      }
    } catch (error) {
      console.error('Delete failed:', error);
      setPendingDelete(pd);
    }
  }, [pendingDelete, deleteProject, deleteFolder, deleteRequest, deleteEnvironment, removeShortcut, dispatch]);

  const handleCreateFolder = (projectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderModalProjectId(projectId);
  };

  const handleCreateEnvironment = async (projectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const env = await createEnvironment(projectId, 'New Environment');
    dispatch({ type: 'ADD_ENVIRONMENT', payload: env });
    setEnvModalEnv(env);
  };

  const handleFolderModalConfirm = async (name: string) => {
    if (folderModalProjectId === null) return;
    const folder = await createFolder(folderModalProjectId, name);
    dispatch({ type: 'ADD_FOLDER', payload: folder });
    if (!expandedProjects.has(folderModalProjectId)) {
      dispatch({ type: 'TOGGLE_PROJECT', payload: folderModalProjectId });
    }
    dispatch({ type: 'TOGGLE_FOLDER', payload: folder.id });
    setNewFolderId(folder.id);
    setFolderModalProjectId(null);
  };

  const handleRenameCommit = async (id: number, name: string) => {
    setEditingRequestId(null);
    await updateRequest(id, { name });
    dispatch({ type: 'UPDATE_REQUEST', payload: { ...requests.find((r) => r.id === id)!, name } });
  };

  const handleProjectRenameCommit = async (id: number, name: string) => {
    setEditingProjectId(null);
    const project = projects.find((p) => p.id === id)!;
    const updated = await updateProject(id, name, project.description ?? null);
    dispatch({ type: 'UPDATE_PROJECT', payload: updated });
  };

  const handleFolderRenameCommit = async (id: number, name: string) => {
    setEditingFolderId(null);
    const updated = await updateFolder(id, name);
    dispatch({ type: 'UPDATE_FOLDER', payload: updated });
  };

  const handleDuplicateRequest = async (requestId: number) => {
    const newReq = await duplicateRequest(requestId);
    dispatch({ type: 'ADD_REQUEST', payload: newReq });
  };

  const handleDuplicateFolder = async (folderId: number) => {
    const result = await duplicateFolder(folderId);
    dispatch({ type: 'ADD_FOLDER', payload: result.folder });
    result.requests.forEach((r) => dispatch({ type: 'ADD_REQUEST', payload: r }));
  };

  // ─── Import handlers ────────────────────────────────────────────────────────

  const handleProjectImportClick = useCallback((e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    setFilePickerState({ mode: 'project', projectId });
  }, []);

  const handleFolderImportClick = useCallback((e: React.MouseEvent, folderId: number, projectId: number) => {
    e.stopPropagation();
    setFilePickerState({ mode: 'folder', folderId, projectId });
  }, []);

  const handleFilePickerParsed = useCallback(async (collection: ParsedCollection) => {
    if (!filePickerState) return;
    setFilePickerState(null);

    if (filePickerState.mode === 'project') {
      const { projectId } = filePickerState;
      try {
        const folder = await createFolder(projectId, collection.name, true);
        dispatch({ type: 'ADD_FOLDER', payload: folder });
        if (!expandedProjects.has(projectId)) {
          dispatch({ type: 'TOGGLE_PROJECT', payload: projectId });
        }
        dispatch({ type: 'TOGGLE_FOLDER', payload: folder.id });
        if (collection.requests.length > 0) {
          const requestData = collection.requests.map((r) => ({
            name: r.name,
            method: r.method,
            url: r.url,
            params: JSON.stringify(r.params),
            headers: JSON.stringify(r.headers),
            body: r.body,
          }));
          const imported = await importRequests(projectId, folder.id, null, requestData);
          imported.forEach((req) => dispatch({ type: 'ADD_REQUEST', payload: req }));
        }
      } catch (err) {
        console.error('Failed to import collection:', err);
      }
    } else {
      const { folderId, projectId } = filePickerState;
      setImportModalState({ collectionName: collection.name, requests: collection.requests, folderId, projectId });
    }
  }, [filePickerState, createFolder, importRequests, dispatch, expandedProjects]);

  const handleModalImport = useCallback(async (selected: ParsedRequest[]) => {
    const ctx = importModalState;
    setImportModalState(null);
    if (!ctx || selected.length === 0) return;

    try {
      const requestData = selected.map((r) => ({
        name: r.name,
        method: r.method,
        url: r.url,
        params: JSON.stringify(r.params),
        headers: JSON.stringify(r.headers),
        body: r.body,
      }));
      const imported = await importRequests(ctx.projectId, ctx.folderId, null, requestData);
      imported.forEach((req) => dispatch({ type: 'ADD_REQUEST', payload: req }));
    } catch (err) {
      console.error('Failed to import requests:', err);
    }
  }, [importModalState, importRequests, dispatch]);

  // ─── Export handlers ────────────────────────────────────────────────────────

  const handleProjectExportClick = useCallback((e: React.MouseEvent, projectId: number) => {
    e.stopPropagation();
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;
    const projectFolderList = state.folders.filter((f) => f.project_id === projectId);
    const allReqs = state.requests.filter((r) => r.project_id === projectId);
    const rootRequests = allReqs.filter((r) => r.folder_id == null);
    const folderGroups = projectFolderList.map((f) => ({
      name: f.name,
      requests: allReqs.filter((r) => r.folder_id === f.id),
    }));
    const items: ExportItem[] = [
      ...rootRequests.map((r) => ({ request: r })),
      ...projectFolderList.flatMap((f) =>
        allReqs.filter((r) => r.folder_id === f.id).map((r) => ({ request: r, folderName: f.name })),
      ),
    ];
    setExportModalState({ title: `Export "${project.name}"`, items, mode: 'project', projectName: project.name, folderGroups, rootRequests });
  }, [state.projects, state.folders, state.requests]);

  const handleFolderExportClick = useCallback((e: React.MouseEvent, folderId: number) => {
    e.stopPropagation();
    const folder = state.folders.find((f) => f.id === folderId);
    if (!folder) return;
    const items: ExportItem[] = state.requests
      .filter((r) => r.folder_id === folderId)
      .map((r) => ({ request: r, folderName: folder.name }));
    setExportModalState({ title: `Export folder "${folder.name}"`, items, mode: 'folder', folderName: folder.name });
  }, [state.folders, state.requests]);

  const handleModalExport = useCallback(async (selected: ExportItem[]) => {
    const ctx = exportModalState;
    setExportModalState(null);
    if (!ctx || selected.length === 0) return;
    try {
      let content: string;
      let filename: string;
      if (ctx.mode === 'folder') {
        content = exportFolderAsPostman(ctx.folderName, selected.map((i) => i.request));
        filename = `${ctx.folderName}.postman_collection.json`;
      } else {
        const selectedIds = new Set(selected.map((i) => i.request.id));
        const rootRequests = ctx.rootRequests.filter((r) => selectedIds.has(r.id));
        const folderGroups = ctx.folderGroups
          .map((g) => ({ name: g.name, requests: g.requests.filter((r) => selectedIds.has(r.id)) }))
          .filter((g) => g.requests.length > 0);
        content = exportProjectAsPostman(ctx.projectName, rootRequests, folderGroups);
        filename = `${ctx.projectName}.postman_collection.json`;
      }
      await invoke('save_file', { filename, content });
    } catch (err) {
      console.error('Failed to export:', err);
    }
  }, [exportModalState]);

  // ─── Native DnD handlers ────────────────────────────────────────────────────

  const applyRequestMove = async (
    requestId: number,
    targetProjectId: number,
    targetFolderId: number | null,
    insertBeforeId: number | null,
    above: boolean,
  ) => {
    const movingRequest = requests.find((r) => r.id === requestId);
    if (!movingRequest) return;

    const isCrossContainer =
      movingRequest.project_id !== targetProjectId || movingRequest.folder_id !== targetFolderId;

    const containerRequests = requests
      .filter((r) => r.project_id === targetProjectId && r.folder_id === targetFolderId)
      .sort((a, b) => a.position - b.position);

    const withoutActive = containerRequests.filter((r) => r.id !== requestId);
    if (insertBeforeId === null) {
      withoutActive.push(movingRequest);
    } else {
      const overIdx = withoutActive.findIndex((r) => r.id === insertBeforeId);
      if (overIdx === -1) {
        withoutActive.push(movingRequest);
      } else if (above) {
        withoutActive.splice(overIdx, 0, movingRequest);
      } else {
        withoutActive.splice(overIdx + 1, 0, movingRequest);
      }
    }

    const orderedIds = withoutActive.map((r) => r.id);
    try {
      if (isCrossContainer) {
        const newPos = withoutActive.findIndex((r) => r.id === requestId);
        await moveRequest(requestId, targetProjectId, targetFolderId, newPos);
        // Renumber the source container to close the gap left by the moved request
        const sourceContainerIds = requests
          .filter((r) => r.project_id === movingRequest.project_id && r.folder_id === movingRequest.folder_id && r.id !== requestId)
          .sort((a, b) => a.position - b.position)
          .map((r) => r.id);
        if (sourceContainerIds.length > 0) {
          await reorderRequests(sourceContainerIds);
        }
      }
      await reorderRequests(orderedIds);
      dispatch({
        type: 'MOVE_REQUEST',
        payload: { ids: orderedIds, requestId, projectId: targetProjectId, folderId: targetFolderId },
      });
    } catch (err) {
      console.error('Failed to move request:', err);
    }
  };

  const handleDropOnProject = async (e: React.DragEvent, projectId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const d = dragging.current;
    dragging.current = null;
    if (!d) return;
    if (d.kind === 'folder') {
      try {
        await moveFolder(d.id, projectId);
        dispatch({ type: 'MOVE_FOLDER', payload: { folderId: d.id, projectId } });
      } catch (err) {
        console.error('Failed to move folder:', err);
      }
    } else {
      await applyRequestMove(d.id, projectId, null, null, true);
    }
  };

  const handleDropOnFolder = async (e: React.DragEvent, folder: { id: number; project_id: number }) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(null);
    const d = dragging.current;
    dragging.current = null;
    if (!d) return;
    if (d.kind === 'folder') {
      try {
        await moveFolder(d.id, folder.project_id);
        dispatch({ type: 'MOVE_FOLDER', payload: { folderId: d.id, projectId: folder.project_id } });
      } catch (err) {
        console.error('Failed to move folder:', err);
      }
    } else {
      await applyRequestMove(d.id, folder.project_id, folder.id, null, true);
    }
  };

  const handleDropOnRequest = async (e: React.DragEvent, overRequest: Request) => {
    e.preventDefault();
    e.stopPropagation();
    const d = dragging.current;
    const currentDragOver = dragOver;
    setDragOver(null);
    dragging.current = null;
    if (!d || d.kind !== 'request' || d.id === overRequest.id) return;
    const above = currentDragOver?.type === 'request-above';
    await applyRequestMove(d.id, overRequest.project_id, overRequest.folder_id, overRequest.id, above);
  };

  const onRequestDragOver = (e: React.DragEvent, request: Request) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragging.current?.kind === 'request' && dragging.current.id === request.id) {
      setDragOver(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const above = e.clientY < rect.top + rect.height / 2;
    setDragOver({ type: above ? 'request-above' : 'request-below', id: request.id });
  };

  const clearDragOverIfLeaving = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOver(null);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (collapsed) return null;

  return (
    <>
      {showNewProjectModal && (
        <NewProjectModal
          onConfirm={handleCreateNewProject}
          onCancel={() => setShowNewProjectModal(false)}
        />
      )}
      {filePickerState && (
        <FilePickerModal
          title={filePickerState.mode === 'project' ? 'Import into project' : 'Import into folder'}
          confirmLabel={filePickerState.mode === 'project' ? 'Import all' : 'Select requests'}
          onParsed={handleFilePickerParsed}
          onCancel={() => setFilePickerState(null)}
        />
      )}
      {importModalState && (
        <ImportModal
          collectionName={importModalState.collectionName}
          requests={importModalState.requests}
          onImport={handleModalImport}
          onCancel={() => setImportModalState(null)}
        />
      )}
      {exportModalState && (
        <ExportModal
          title={exportModalState.title}
          items={exportModalState.items}
          onExport={handleModalExport}
          onCancel={() => setExportModalState(null)}
        />
      )}
      {folderModalProjectId !== null && (
        <NewFolderModal
          onConfirm={handleFolderModalConfirm}
          onCancel={() => setFolderModalProjectId(null)}
        />
      )}
      {envModalEnv && (
        <EnvModal
          env={envModalEnv}
          onClose={() => setEnvModalEnv(null)}
          onSave={async (id, name, variables) => {
            const updated = await updateEnvironment(id, name, variables);
            dispatch({ type: 'UPDATE_ENVIRONMENT', payload: updated });
          }}
        />
      )}
      {pendingDelete && (
        <ConfirmModal
          title={
            pendingDelete.type === 'project' ? `Delete project "${pendingDelete.name}"?` :
            pendingDelete.type === 'folder' ? `Delete folder "${pendingDelete.name}"?` :
            pendingDelete.type === 'request' ? `Delete request "${pendingDelete.name}"?` :
            `Delete environment "${pendingDelete.name}"?`
          }
          onConfirm={handleConfirmDelete}
          onCancel={() => setPendingDelete(null)}
        >
          {pendingDelete.type === 'project' && (
            <>
              <p>This will permanently remove <strong>{pendingDelete.name}</strong> and all its contents:</p>
              <ul>
                {pendingDelete.requestCount > 0 && (
                  <li>{pendingDelete.requestCount} request{pendingDelete.requestCount !== 1 ? 's' : ''}</li>
                )}
                {pendingDelete.folderCount > 0 && (
                  <li>{pendingDelete.folderCount} folder{pendingDelete.folderCount !== 1 ? 's' : ''}</li>
                )}
                {pendingDelete.envCount > 0 && (
                  <li>{pendingDelete.envCount} environment{pendingDelete.envCount !== 1 ? 's' : ''}</li>
                )}
                {pendingDelete.requestCount === 0 && pendingDelete.folderCount === 0 && pendingDelete.envCount === 0 && (
                  <li>No requests, folders, or environments</li>
                )}
              </ul>
              <p>This action cannot be undone.</p>
            </>
          )}
          {pendingDelete.type === 'folder' && (
            <>
              <p>
                This will permanently remove <strong>{pendingDelete.name}</strong>
                {pendingDelete.requestCount > 0
                  ? ` and its ${pendingDelete.requestCount} request${pendingDelete.requestCount !== 1 ? 's' : ''}.`
                  : '.'}
              </p>
              <p>This action cannot be undone.</p>
            </>
          )}
          {pendingDelete.type === 'request' && (
            <>
              <p>Permanently delete <strong>{pendingDelete.method} — {pendingDelete.name}</strong>?</p>
              <p>This action cannot be undone.</p>
            </>
          )}
          {pendingDelete.type === 'env' && (
            <>
              <p>Permanently delete environment <strong>{pendingDelete.name}</strong>?</p>
              <p>This action cannot be undone.</p>
            </>
          )}
        </ConfirmModal>
      )}

      {shortcutModalRequestId !== null && (
        <ShortcutModal
          requestId={shortcutModalRequestId}
          shortcuts={shortcuts}
          requests={state.requests}
          onAssign={(fkey) => {
            assignShortcut(fkey, shortcutModalRequestId);
            setShortcutModalRequestId(null);
          }}
          onRemove={() => {
            removeShortcut(shortcutModalRequestId);
            setShortcutModalRequestId(null);
          }}
          onClose={() => setShortcutModalRequestId(null)}
        />
      )}

      <div className={styles.sidebar}>
        <div className={styles.header}>
          <span className={styles.title}>Explorer</span>
          <div className={styles.headerActions}>
            <button className={styles.newProjectBtn} onClick={() => setShowNewProjectModal(true)} title="New Project">
              +
            </button>
            <button className={styles.collapseBtn} onClick={onToggleCollapse} title="Collapse navigator">
              ‹
            </button>
          </div>
        </div>

        <div className={styles.tree}>
          {projects.length === 0 ? (
            <div className={styles.empty}>No projects yet. Click + to create one.</div>
          ) : (
            projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                folders={folders.filter((f) => f.project_id === project.id)}
                projectRequests={requests.filter((r) => r.project_id === project.id)}
                projectEnvs={environments.filter((e) => e.project_id === project.id)}
                isExpanded={expandedProjects.has(project.id)}
                expandedFolders={expandedFolders}
                expandedEnvSections={expandedEnvSections}
                setExpandedEnvSections={setExpandedEnvSections}
                editingProjectId={editingProjectId}
                onEditProject={setEditingProjectId}
                editingFolderId={editingFolderId}
                onEditFolder={setEditingFolderId}
                editingRequestId={editingRequestId}
                onEditRequest={setEditingRequestId}
                currentRequestId={currentRequestId}
                executingRequestId={state.executingRequestId}
                dragOver={dragOver}
                dragging={dragging}
                setDragOver={setDragOver}
                onSelect={handleSelect}
                onCreateRootRequest={handleCreateRootRequest}
                onCreateFolderRequest={handleCreateFolderRequest}
                onCreateFolder={handleCreateFolder}
                onCreateEnvironment={handleCreateEnvironment}
                onProjectRenameCommit={handleProjectRenameCommit}
                onFolderRenameCommit={handleFolderRenameCommit}
                onRenameCommit={handleRenameCommit}
                onDuplicateRequest={handleDuplicateRequest}
                onDuplicateFolder={handleDuplicateFolder}
                onDeleteProject={requestDeleteProject}
                onDeleteFolder={requestDeleteFolder}
                onDeleteRequest={requestDeleteRequest}
                onDeleteEnv={requestDeleteEnv}
                onProjectImport={handleProjectImportClick}
                onFolderImport={handleFolderImportClick}
                onProjectExport={handleProjectExportClick}
                onFolderExport={handleFolderExportClick}
                getShortcutForRequest={getShortcutForRequest}
                onOpenShortcutModal={setShortcutModalRequestId}
                onEnvClick={setEnvModalEnv}
                onToggleProject={() => dispatch({ type: 'TOGGLE_PROJECT', payload: project.id })}
                onToggleFolder={(id) => dispatch({ type: 'TOGGLE_FOLDER', payload: id })}
                onDropOnProject={handleDropOnProject}
                onDropOnFolder={handleDropOnFolder}
                onDropOnRequest={handleDropOnRequest}
                onRequestDragOver={onRequestDragOver}
                clearDragOverIfLeaving={clearDragOverIfLeaving}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
}
