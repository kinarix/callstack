import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useDatabase } from '../../hooks/useDatabase';
import { RequestItem } from './RequestItem';
import { NewProjectModal } from './NewProjectModal';
import { NewFolderModal } from './NewFolderModal';
import { EnvModal } from '../EnvModal/EnvModal';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import type { Environment, Request } from '../../lib/types';
import styles from './Sidebar.module.css';

// ─── Sub-components ───────────────────────────────────────────────────────────

function InlineNameInput({
  initialValue,
  className,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  className?: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
  return (
    <input
      ref={ref}
      className={className}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit(value.trim() || initialValue);
        else if (e.key === 'Escape') onCancel();
        e.stopPropagation();
      }}
      onBlur={() => onCommit(value.trim() || initialValue)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={styles.chevron}
      style={{ transform: expanded ? undefined : 'rotate(-90deg)' }}
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
    >
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 8H2C1.72 8 1.5 7.78 1.5 7.5V2C1.5 1.72 1.72 1.5 2 1.5H7.5C7.78 1.5 8 1.72 8 2V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProjectIcon() {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconProject}`} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1.5" y="3.5" width="10" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 3.5V2.5C4.5 2.22 4.72 2 5 2H8C8.28 2 8.5 2.22 8.5 2.5V3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconFolder}`} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M1.5 4.5C1.5 3.95 1.95 3.5 2.5 3.5H5L6 4.5H10.5C11.05 4.5 11.5 4.95 11.5 5.5V9.5C11.5 10.05 11.05 10.5 10.5 10.5H2.5C1.95 10.5 1.5 10.05 1.5 9.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill={open ? 'currentColor' : 'none'}
        fillOpacity={open ? 0.25 : 0}
      />
    </svg>
  );
}

function EnvIcon() {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconEnv}`} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 6.5H8.5M6 4.5L8.5 6.5L6 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingDelete =
  | { type: 'project'; id: number; name: string; requestCount: number; folderCount: number; envCount: number }
  | { type: 'folder'; id: number; name: string; requestCount: number }
  | { type: 'request'; id: number; name: string; method: string }
  | { type: 'env'; id: number; name: string };

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

type DragOver = {
  type: 'project' | 'folder' | 'request-above' | 'request-below';
  id: number;
} | null;

// ─── Main component ───────────────────────────────────────────────────────────

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
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
    getLastResponse,
    createEnvironment,
    updateEnvironment,
    deleteEnvironment,
    moveRequest,
    moveFolder,
    reorderRequests,
    duplicateRequest,
    duplicateFolder,
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

  // Native DnD — ref avoids re-renders during drag; state drives visual feedback
  const dragging = useRef<{ kind: 'request' | 'folder'; id: number } | null>(null);
  const [dragOver, setDragOver] = useState<DragOver>(null);

  useEffect(() => {
    if (newFolderId === null) return;
    const el = document.getElementById(`folder-row-${newFolderId}`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setNewFolderId(null);
  }, [newFolderId, folders]);

  if (collapsed) return null;

  // ─── Non-DnD handlers ──────────────────────────────────────────────────────

  const handleCreateNewProject = async (name: string, description: string) => {
    const project = await createProject(state.currentUser?.email ?? null, name, description || null);
    dispatch({ type: 'ADD_PROJECT', payload: project });
    dispatch({ type: 'TOGGLE_PROJECT', payload: project.id });
    setShowNewProjectModal(false);
  };

  const handleCreateRootRequest = async (projectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const request = await createRequest(projectId, state.currentUser?.email ?? null, 'New Request', null);
    dispatch({ type: 'ADD_REQUEST', payload: request });
    dispatch({ type: 'SET_CURRENT_REQUEST', payload: request.id });
    setEditingRequestId(request.id);
  };

  const handleCreateFolderRequest = async (projectId: number, folderId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const request = await createRequest(projectId, state.currentUser?.email ?? null, 'New Request', folderId);
    dispatch({ type: 'ADD_REQUEST', payload: request });
    dispatch({ type: 'SET_CURRENT_REQUEST', payload: request.id });
    setEditingRequestId(request.id);
  };

  const handleSelect = async (id: number) => {
    dispatch({ type: 'SET_CURRENT_REQUEST', payload: id });
    const response = await getLastResponse(id).catch(() => null);
    dispatch({ type: 'SET_RESPONSE', payload: response });
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

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    const pd = pendingDelete;
    setPendingDelete(null);
    if (pd.type === 'project') {
      await deleteProject(pd.id);
      dispatch({ type: 'DELETE_PROJECT', payload: pd.id });
    } else if (pd.type === 'folder') {
      await deleteFolder(pd.id);
      dispatch({ type: 'DELETE_FOLDER', payload: pd.id });
    } else if (pd.type === 'request') {
      await deleteRequest(pd.id);
      dispatch({ type: 'DELETE_REQUEST', payload: pd.id });
    } else if (pd.type === 'env') {
      await deleteEnvironment(pd.id);
      dispatch({ type: 'DELETE_ENVIRONMENT', payload: pd.id });
    }
  };

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

  // ─── Native DnD handlers ───────────────────────────────────────────────────

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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {showNewProjectModal && (
        <NewProjectModal
          onConfirm={handleCreateNewProject}
          onCancel={() => setShowNewProjectModal(false)}
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
            projects.map((project) => {
              const isExpanded = expandedProjects.has(project.id);
              const projectFolders = folders
                .filter((f) => f.project_id === project.id);
              const rootRequests = requests
                .filter((r) => r.project_id === project.id && !r.folder_id)
                .sort((a, b) => a.position - b.position);
              const projectEnvs = environments.filter((e) => e.project_id === project.id);
              const isProjectDragOver = dragOver?.type === 'project' && dragOver.id === project.id;

              return (
                <div key={project.id} className={styles.project}>
                  {/* Project header — drop target */}
                  <div
                    className={`${styles.projectRow}${isProjectDragOver ? ` ${styles.dragOver}` : ''}`}
                    onClick={() => dispatch({ type: 'TOGGLE_PROJECT', payload: project.id })}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDragOver({ type: 'project', id: project.id });
                    }}
                    onDragLeave={clearDragOverIfLeaving}
                    onDrop={(e) => handleDropOnProject(e, project.id)}
                  >
                    <Chevron expanded={isExpanded} />
                    <ProjectIcon />
                    {editingProjectId === project.id ? (
                      <InlineNameInput
                        initialValue={project.name}
                        className={styles.projectNameInput}
                        onCommit={(name) => handleProjectRenameCommit(project.id, name)}
                        onCancel={() => setEditingProjectId(null)}
                      />
                    ) : (
                      <span
                        className={styles.projectName}
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingProjectId(project.id); }}
                      >
                        {project.name}
                      </span>
                    )}
                    <button
                      className={`${styles.iconBtn} ${styles.folderAddBtn}`}
                      onClick={(e) => handleCreateFolder(project.id, e)}
                      title="Add folder"
                    >
                      +folder
                    </button>
                    <button
                      className={styles.iconBtn}
                      onClick={(e) => handleCreateRootRequest(project.id, e)}
                      title="Add request"
                    >
                      +
                    </button>
                    {editingProjectId !== project.id && (
                      <button
                        className={styles.iconBtn}
                        onClick={(e) => { e.stopPropagation(); setEditingProjectId(project.id); }}
                        title="Rename project"
                      >
                        <PenIcon />
                      </button>
                    )}
                    <button
                      className={`${styles.iconBtn} ${styles.deleteBtn}`}
                      onClick={(e) => requestDeleteProject(project.id, e)}
                      title="Delete project"
                    >
                      <BinIcon />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className={styles.children}>
                      {/* Folders */}
                      {projectFolders.map((folder) => {
                        const isFolderExpanded = expandedFolders.has(folder.id);
                        const folderRequests = requests
                          .filter((r) => r.folder_id === folder.id)
                          .sort((a, b) => a.position - b.position);
                        const isFolderDragOver = dragOver?.type === 'folder' && dragOver.id === folder.id;

                        return (
                          <div key={folder.id} className={styles.folder}>
                            {/* Folder row — draggable + drop target */}
                            <div
                              id={`folder-row-${folder.id}`}
                              className={`${styles.folderRow}${isFolderDragOver ? ` ${styles.dragOver}` : ''}`}
                              draggable
                              onDragStart={(e) => {
                                dragging.current = { kind: 'folder', id: folder.id };
                                e.dataTransfer.effectAllowed = 'move';
                                e.stopPropagation();
                              }}
                              onDragEnd={() => {
                                dragging.current = null;
                                setDragOver(null);
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDragOver({ type: 'folder', id: folder.id });
                              }}
                              onDragLeave={clearDragOverIfLeaving}
                              onDrop={(e) => handleDropOnFolder(e, folder)}
                              onClick={() => dispatch({ type: 'TOGGLE_FOLDER', payload: folder.id })}
                            >
                              <Chevron expanded={isFolderExpanded} />
                              <FolderIcon open={isFolderExpanded} />
                              {editingFolderId === folder.id ? (
                                <InlineNameInput
                                  initialValue={folder.name}
                                  className={styles.folderNameInput}
                                  onCommit={(name) => handleFolderRenameCommit(folder.id, name)}
                                  onCancel={() => setEditingFolderId(null)}
                                />
                              ) : (
                                <span
                                  className={styles.folderName}
                                  onDoubleClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); }}
                                >
                                  {folder.name}
                                </span>
                              )}
                              <button
                                className={styles.iconBtn}
                                onClick={(e) => { e.stopPropagation(); handleCreateFolderRequest(project.id, folder.id, e); }}
                                title="Add request"
                              >
                                +
                              </button>
                              {editingFolderId !== folder.id && (
                                <button
                                  className={styles.iconBtn}
                                  onClick={(e) => { e.stopPropagation(); setEditingFolderId(folder.id); }}
                                  title="Rename folder"
                                >
                                  <PenIcon />
                                </button>
                              )}
                              {editingFolderId !== folder.id && (
                                <button
                                  className={styles.iconBtn}
                                  onClick={(e) => { e.stopPropagation(); handleDuplicateFolder(folder.id); }}
                                  title="Duplicate folder"
                                >
                                  <CopyIcon />
                                </button>
                              )}
                              <button
                                className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                onClick={(e) => { e.stopPropagation(); requestDeleteFolder(folder.id, e); }}
                                title="Delete folder"
                              >
                                <BinIcon />
                              </button>
                            </div>

                            {isFolderExpanded && (
                              <div className={styles.folderChildren}>
                                {folderRequests.length === 0 ? (
                                  <div className={`${styles.treeRow} ${styles.emptyRow}`}>No requests</div>
                                ) : (
                                  folderRequests.map((request) => (
                                    <div key={request.id} className={styles.requestRowWrap}>
                                      {dragOver?.id === request.id && dragOver.type === 'request-above' && (
                                        <div className={`${styles.dropLine} ${styles.dropAbove}`} />
                                      )}
                                      <div
                                        className={styles.treeRow}
                                        draggable
                                        onDragStart={(e) => {
                                          dragging.current = { kind: 'request', id: request.id };
                                          e.dataTransfer.effectAllowed = 'move';
                                          e.stopPropagation();
                                        }}
                                        onDragEnd={() => {
                                          dragging.current = null;
                                          setDragOver(null);
                                        }}
                                        onDragOver={(e) => onRequestDragOver(e, request)}
                                        onDragLeave={clearDragOverIfLeaving}
                                        onDrop={(e) => handleDropOnRequest(e, request)}
                                      >
                                        <RequestItem
                                          request={request}
                                          isSelected={currentRequestId === request.id}
                                          isEditing={editingRequestId === request.id}
                                          onSelect={handleSelect}
                                          onDelete={requestDeleteRequest}
                                          onRenameCommit={handleRenameCommit}
                                          onRenameCancel={() => setEditingRequestId(null)}
                                          onRenameStart={() => setEditingRequestId(request.id)}
                                          onDuplicate={() => handleDuplicateRequest(request.id)}
                                        />
                                      </div>
                                      {dragOver?.id === request.id && dragOver.type === 'request-below' && (
                                        <div className={`${styles.dropLine} ${styles.dropBelow}`} />
                                      )}
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Root-level requests */}
                      <div>
                        {rootRequests.length === 0 && projectFolders.length === 0 ? (
                          <div className={`${styles.treeRow} ${styles.emptyRow}`}>No requests</div>
                        ) : (
                          rootRequests.map((request) => (
                            <div key={request.id} className={styles.requestRowWrap}>
                              {dragOver?.id === request.id && dragOver.type === 'request-above' && (
                                <div className={`${styles.dropLine} ${styles.dropAbove}`} />
                              )}
                              <div
                                className={styles.treeRow}
                                draggable
                                onDragStart={(e) => {
                                  dragging.current = { kind: 'request', id: request.id };
                                  e.dataTransfer.effectAllowed = 'move';
                                  e.stopPropagation();
                                }}
                                onDragEnd={() => {
                                  dragging.current = null;
                                  setDragOver(null);
                                }}
                                onDragOver={(e) => onRequestDragOver(e, request)}
                                onDragLeave={clearDragOverIfLeaving}
                                onDrop={(e) => handleDropOnRequest(e, request)}
                              >
                                <RequestItem
                                  request={request}
                                  isSelected={currentRequestId === request.id}
                                  isEditing={editingRequestId === request.id}
                                  onSelect={handleSelect}
                                  onDelete={requestDeleteRequest}
                                  onRenameCommit={handleRenameCommit}
                                  onRenameCancel={() => setEditingRequestId(null)}
                                  onRenameStart={() => setEditingRequestId(request.id)}
                                  onDuplicate={() => handleDuplicateRequest(request.id)}
                                />
                              </div>
                              {dragOver?.id === request.id && dragOver.type === 'request-below' && (
                                <div className={`${styles.dropLine} ${styles.dropBelow}`} />
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Environments group */}
                      {(() => {
                        const envsExpanded = expandedEnvSections.has(project.id);
                        return (
                          <div className={styles.folder}>
                            <div
                              className={styles.folderRow}
                              onClick={() => setExpandedEnvSections((prev) => {
                                const next = new Set(prev);
                                if (next.has(project.id)) next.delete(project.id);
                                else next.add(project.id);
                                return next;
                              })}
                            >
                              <Chevron expanded={envsExpanded} />
                              <EnvIcon />
                              <span className={styles.folderName}>Environments</span>
                              <button
                                className={`${styles.iconBtn} ${styles.folderAddBtn}`}
                                onClick={(e) => handleCreateEnvironment(project.id, e)}
                                title="Add environment"
                              >
                                +env
                              </button>
                            </div>
                            {envsExpanded && (
                              <div className={styles.folderChildren}>
                                {projectEnvs.length === 0 ? (
                                  <div className={`${styles.treeRow} ${styles.emptyRow}`}>No environments</div>
                                ) : (
                                  projectEnvs.map((env) => (
                                    <div
                                      key={env.id}
                                      className={`${styles.treeRow} ${styles.envRow}`}
                                      onClick={() => setEnvModalEnv(env)}
                                    >
                                      <EnvIcon />
                                      <span className={styles.envName}>{env.name}</span>
                                      <button
                                        className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                        onClick={(e) => requestDeleteEnv(env.id, env.name, e)}
                                        title="Delete environment"
                                      >
                                        <BinIcon />
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
