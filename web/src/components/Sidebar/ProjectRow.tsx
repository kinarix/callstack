import { useEffect, useRef, useState } from 'react';
import type { Environment, Folder, Project, Request } from '../../lib/types';
import { RequestItem } from './RequestItem';
import {
  BinIcon,
  Chevron,
  CopyIcon,
  EnvIcon,
  ExportIcon,
  FolderIcon,
  ImportedFolderIcon,
  ImportIcon,
  NewEnvIcon,
  NewFolderIcon,
  PenIcon,
  ProjectIcon,
} from './SidebarIcons';
import styles from './Sidebar.module.css';

// ─── InlineNameInput ──────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

export type DragOver = {
  type: 'project' | 'folder' | 'request-above' | 'request-below';
  id: number;
} | null;

export interface ProjectRowProps {
  project: Project;
  folders: Folder[];
  projectRequests: Request[];
  projectEnvs: Environment[];
  isExpanded: boolean;
  expandedFolders: Set<number>;
  expandedEnvSections: Set<number>;
  setExpandedEnvSections: React.Dispatch<React.SetStateAction<Set<number>>>;
  editingProjectId: number | null;
  onEditProject: (id: number | null) => void;
  editingFolderId: number | null;
  onEditFolder: (id: number | null) => void;
  editingRequestId: number | null;
  onEditRequest: (id: number | null) => void;
  currentRequestId: number | null;
  executingRequestId: number | null;
  dragOver: DragOver;
  dragging: React.MutableRefObject<{ kind: 'request' | 'folder'; id: number } | null>;
  setDragOver: React.Dispatch<React.SetStateAction<DragOver>>;
  onSelect: (id: number) => void;
  onCreateRootRequest: (projectId: number, e: React.MouseEvent) => void;
  onCreateFolderRequest: (projectId: number, folderId: number, e: React.MouseEvent) => void;
  onCreateFolder: (projectId: number, e: React.MouseEvent) => void;
  onCreateEnvironment: (projectId: number, e: React.MouseEvent) => void;
  onProjectRenameCommit: (id: number, name: string) => void;
  onFolderRenameCommit: (id: number, name: string) => void;
  onRenameCommit: (id: number, name: string) => void;
  onDuplicateRequest: (id: number) => void;
  onDuplicateFolder: (id: number) => void;
  onDeleteProject: (id: number, e: React.MouseEvent) => void;
  onDeleteFolder: (id: number, e: React.MouseEvent) => void;
  onDeleteRequest: (id: number, e: React.MouseEvent) => void;
  onDeleteEnv: (id: number, name: string, e: React.MouseEvent) => void;
  onProjectImport: (e: React.MouseEvent, projectId: number) => void;
  onFolderImport: (e: React.MouseEvent, folderId: number, projectId: number) => void;
  onProjectExport: (e: React.MouseEvent, projectId: number) => void;
  onFolderExport: (e: React.MouseEvent, folderId: number) => void;
  getShortcutForRequest: (id: number) => string | null;
  onOpenShortcutModal: (id: number) => void;
  onEnvClick: (env: Environment) => void;
  onToggleProject: () => void;
  onToggleFolder: (id: number) => void;
  onDropOnProject: (e: React.DragEvent, projectId: number) => void;
  onDropOnFolder: (e: React.DragEvent, folder: { id: number; project_id: number }) => void;
  onDropOnRequest: (e: React.DragEvent, request: Request) => void;
  onRequestDragOver: (e: React.DragEvent, request: Request) => void;
  clearDragOverIfLeaving: (e: React.DragEvent) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectRow({
  project,
  folders,
  projectRequests,
  projectEnvs,
  isExpanded,
  expandedFolders,
  expandedEnvSections,
  setExpandedEnvSections,
  editingProjectId,
  onEditProject,
  editingFolderId,
  onEditFolder,
  editingRequestId,
  onEditRequest,
  currentRequestId,
  executingRequestId,
  dragOver,
  dragging,
  setDragOver,
  onSelect,
  onCreateRootRequest,
  onCreateFolderRequest,
  onCreateFolder,
  onCreateEnvironment,
  onProjectRenameCommit,
  onFolderRenameCommit,
  onRenameCommit,
  onDuplicateRequest,
  onDuplicateFolder,
  onDeleteProject,
  onDeleteFolder,
  onDeleteRequest,
  onDeleteEnv,
  onProjectImport,
  onFolderImport,
  onProjectExport,
  onFolderExport,
  getShortcutForRequest,
  onOpenShortcutModal,
  onEnvClick,
  onToggleProject,
  onToggleFolder,
  onDropOnProject,
  onDropOnFolder,
  onDropOnRequest,
  onRequestDragOver,
  clearDragOverIfLeaving,
}: ProjectRowProps) {
  const rootRequests = projectRequests
    .filter((r) => !r.folder_id)
    .sort((a, b) => a.position - b.position);

  const isProjectDragOver = dragOver?.type === 'project' && dragOver.id === project.id;
  const envsExpanded = expandedEnvSections.has(project.id);

  function renderRequestRow(request: Request) {
    return (
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
          onDrop={(e) => onDropOnRequest(e, request)}
        >
          <RequestItem
            request={request}
            isSelected={currentRequestId === request.id}
            isEditing={editingRequestId === request.id}
            isExecuting={executingRequestId === request.id}
            onSelect={onSelect}
            onDelete={onDeleteRequest}
            onRenameCommit={onRenameCommit}
            onRenameCancel={() => onEditRequest(null)}
            onRenameStart={() => onEditRequest(request.id)}
            onDuplicate={() => onDuplicateRequest(request.id)}
            assignedShortcut={getShortcutForRequest(request.id)}
            onOpenShortcutModal={() => onOpenShortcutModal(request.id)}
          />
        </div>
        {dragOver?.id === request.id && dragOver.type === 'request-below' && (
          <div className={`${styles.dropLine} ${styles.dropBelow}`} />
        )}
      </div>
    );
  }

  return (
    <div className={styles.project}>
      {/* Project header — drop target */}
      <div
        className={`${styles.projectRow}${isProjectDragOver ? ` ${styles.dragOver}` : ''}`}
        onClick={onToggleProject}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver({ type: 'project', id: project.id });
        }}
        onDragLeave={clearDragOverIfLeaving}
        onDrop={(e) => onDropOnProject(e, project.id)}
      >
        <Chevron expanded={isExpanded} />
        <ProjectIcon />
        {editingProjectId === project.id ? (
          <InlineNameInput
            initialValue={project.name}
            className={styles.projectNameInput}
            onCommit={(name) => onProjectRenameCommit(project.id, name)}
            onCancel={() => onEditProject(null)}
          />
        ) : (
          <span
            className={styles.projectName}
            onDoubleClick={(e) => { e.stopPropagation(); onEditProject(project.id); }}
          >
            {project.name}
          </span>
        )}
        <button
          className={`${styles.iconBtn} ${styles.folderAddBtn} ${styles.addBtn}`}
          onClick={(e) => onCreateFolder(project.id, e)}
          title="Add folder"
        >
          <NewFolderIcon />
        </button>
        <button
          className={`${styles.iconBtn} ${styles.importBtn}`}
          onClick={(e) => onProjectImport(e, project.id)}
          title="Import Postman collection"
        >
          <ImportIcon />
        </button>
        <button
          className={`${styles.iconBtn} ${styles.exportBtn}`}
          onClick={(e) => onProjectExport(e, project.id)}
          title="Export as Postman collection"
        >
          <ExportIcon />
        </button>
        <button
          className={`${styles.iconBtn} ${styles.addBtn}`}
          onClick={(e) => onCreateRootRequest(project.id, e)}
          title="Add request"
        >
          +
        </button>
        {editingProjectId !== project.id && (
          <button
            className={`${styles.iconBtn} ${styles.renameBtn}`}
            onClick={(e) => { e.stopPropagation(); onEditProject(project.id); }}
            title="Rename project"
          >
            <PenIcon />
          </button>
        )}
        <button
          className={`${styles.iconBtn} ${styles.deleteBtn}`}
          onClick={(e) => onDeleteProject(project.id, e)}
          title="Delete project"
        >
          <BinIcon />
        </button>
      </div>

      {isExpanded && (
        <div className={styles.children}>
          {/* Folders */}
          {folders.map((folder) => {
            const isFolderExpanded = expandedFolders.has(folder.id);
            const folderRequests = projectRequests
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
                  onDrop={(e) => onDropOnFolder(e, folder)}
                  onClick={() => onToggleFolder(folder.id)}
                >
                  <Chevron expanded={isFolderExpanded} />
                  <FolderIcon open={isFolderExpanded} />
                  {editingFolderId === folder.id ? (
                    <InlineNameInput
                      initialValue={folder.name}
                      className={styles.folderNameInput}
                      onCommit={(name) => onFolderRenameCommit(folder.id, name)}
                      onCancel={() => onEditFolder(null)}
                    />
                  ) : (
                    <span
                      className={styles.folderName}
                      onDoubleClick={(e) => { e.stopPropagation(); onEditFolder(folder.id); }}
                    >
                      {folder.name}
                      {folder.imported && <ImportedFolderIcon />}
                    </span>
                  )}
                  <button
                    className={`${styles.iconBtn} ${styles.addBtn}`}
                    onClick={(e) => { e.stopPropagation(); onCreateFolderRequest(project.id, folder.id, e); }}
                    title="Add request"
                  >
                    +
                  </button>
                  <button
                    className={`${styles.iconBtn} ${styles.importBtn}`}
                    onClick={(e) => onFolderImport(e, folder.id, project.id)}
                    title="Import Postman collection into folder"
                  >
                    <ImportIcon />
                  </button>
                  <button
                    className={`${styles.iconBtn} ${styles.exportBtn}`}
                    onClick={(e) => onFolderExport(e, folder.id)}
                    title="Export folder as Postman collection"
                  >
                    <ExportIcon />
                  </button>
                  {editingFolderId !== folder.id && (
                    <button
                      className={`${styles.iconBtn} ${styles.renameBtn}`}
                      onClick={(e) => { e.stopPropagation(); onEditFolder(folder.id); }}
                      title="Rename folder"
                    >
                      <PenIcon />
                    </button>
                  )}
                  {editingFolderId !== folder.id && (
                    <button
                      className={`${styles.iconBtn} ${styles.duplicateBtn}`}
                      onClick={(e) => { e.stopPropagation(); onDuplicateFolder(folder.id); }}
                      title="Duplicate folder"
                    >
                      <CopyIcon />
                    </button>
                  )}
                  <button
                    className={`${styles.iconBtn} ${styles.deleteBtn}`}
                    onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id, e); }}
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
                      folderRequests.map(renderRequestRow)
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Root-level requests */}
          <div>
            {rootRequests.length === 0 && folders.length === 0 ? (
              <div className={`${styles.treeRow} ${styles.emptyRow}`}>No requests</div>
            ) : (
              rootRequests.map(renderRequestRow)
            )}
          </div>

          {/* Environments group */}
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
                className={`${styles.iconBtn} ${styles.folderAddBtn} ${styles.addBtn}`}
                onClick={(e) => onCreateEnvironment(project.id, e)}
                title="Add environment"
              >
                <NewEnvIcon />
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
                      onClick={() => onEnvClick(env)}
                    >
                      <EnvIcon />
                      <span className={styles.envName}>{env.name}</span>
                      <button
                        className={`${styles.iconBtn} ${styles.deleteBtn}`}
                        onClick={(e) => onDeleteEnv(env.id, env.name, e)}
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
        </div>
      )}
    </div>
  );
}
