import { useEffect, useRef, useState } from 'react';
import type { Automation, DataFile, Environment, Folder, Project, Replay, Request } from '../../lib/types';
import { RequestItem } from './RequestItem';
import {
  AutomationIcon,
  AutomationsFolderIcon,
  BinIcon,
  Chevron,
  CookiesGroupIcon,
  CookieDomainIcon,
  CopyIcon,
  DataFileIcon,
  DatasetItemIcon,
  EnvIcon,
  EnvIconFor,
  ExportIcon,
  FolderIcon,
  ImportedFolderIcon,
  ImportIcon,
  NewAutomationIcon,
  NewDataFileIcon,
  NewEnvIcon,
  NewFolderIcon,
  PenIcon,
  ProjectIcon,
  ReplayIcon,
  StopIcon,
  ReplaysFolderIcon,
} from './SidebarIcons';
import styles from './Sidebar.module.css';

function DomainFavicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  const clean = domain.replace(/^\./, '');
  if (failed) return <CookieDomainIcon />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${clean}&sz=16`}
      width={12}
      height={12}
      style={{ flexShrink: 0, borderRadius: 2 }}
      onError={() => setFailed(true)}
      alt=""
    />
  );
}

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
  activeView: 'request' | 'automation' | 'environment' | 'dataFile' | 'cookies' | 'replay';
  activeAutomationId: number | null;
  activeEnvironmentId: number | null;
  activeDataFileId: number | null;
  activeReplayId: number | null;
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
  editingEnvId: number | null;
  onStartEditEnv: (id: number) => void;
  onEnvRenameCommit: (id: number, name: string) => void;
  projectAutomations: Automation[];
  expandedAutomationSections: Set<number>;
  setExpandedAutomationSections: React.Dispatch<React.SetStateAction<Set<number>>>;
  onCreateAutomation: (projectId: number, e: React.MouseEvent) => void;
  onOpenAutomation: (automation: Automation) => void;
  onDeleteAutomation: (id: number, name: string, e: React.MouseEvent) => void;
  editingAutomationId: number | null;
  onStartEditAutomation: (id: number) => void;
  onAutomationRenameCommit: (id: number, name: string) => void;
  projectReplays: Replay[];
  expandedReplaySections: Set<number>;
  setExpandedReplaySections: React.Dispatch<React.SetStateAction<Set<number>>>;
  runningReplayIds: Set<number>;
  onStopReplays: () => void;
  onOpenReplay: (replay: Replay) => void;
  onDeleteReplay: (id: number, name: string, e: React.MouseEvent) => void;
  editingReplayId: number | null;
  onStartEditReplay: (id: number) => void;
  onReplayRenameCommit: (id: number, name: string) => void;
  projectDataFiles: DataFile[];
  expandedDataFileSections: Set<number>;
  setExpandedDataFileSections: React.Dispatch<React.SetStateAction<Set<number>>>;
  onCreateDataFile: (projectId: number, e: React.MouseEvent) => void;
  onDataFileClick: (dataFile: DataFile) => void;
  onDeleteDataFile: (id: number, name: string, e: React.MouseEvent) => void;
  editingDataFileId: number | null;
  onStartEditDataFile: (id: number) => void;
  onDataFileRenameCommit: (id: number, name: string) => void;
  onProjectImport: (e: React.MouseEvent, projectId: number) => void;
  onFolderImport: (e: React.MouseEvent, folderId: number, projectId: number) => void;
  onProjectExport: (e: React.MouseEvent, projectId: number) => void;
  onFolderExport: (e: React.MouseEvent, folderId: number) => void;
  getShortcutForRequest: (id: number) => string | null;
  onOpenShortcutModal: (id: number) => void;
  onEnvClick: (env: Environment) => void;
  cookieDomains: string[];
  expandedCookieSections: Set<number>;
  onCookieSectionToggle: (projectId: number) => void;
  onCookieDomainClick: (domain: string) => void;
  onClearAllCookies: (projectId: number, e: React.MouseEvent) => void;
  onClearDomainCookies: (projectId: number, domain: string, e: React.MouseEvent) => void;
  activeCookieDomain: string | null;
  searchQuery?: string;
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
  activeView,
  activeAutomationId,
  activeEnvironmentId,
  activeDataFileId,
  activeReplayId,
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
  editingEnvId,
  onStartEditEnv,
  onEnvRenameCommit,
  projectAutomations,
  expandedAutomationSections,
  setExpandedAutomationSections,
  onCreateAutomation,
  onOpenAutomation,
  onDeleteAutomation,
  editingAutomationId,
  onStartEditAutomation,
  onAutomationRenameCommit,
  projectReplays,
  expandedReplaySections,
  setExpandedReplaySections,
  runningReplayIds,
  onStopReplays,
  onOpenReplay,
  onDeleteReplay,
  editingReplayId,
  onStartEditReplay,
  onReplayRenameCommit,
  projectDataFiles,
  expandedDataFileSections,
  setExpandedDataFileSections,
  onCreateDataFile,
  onDataFileClick,
  onDeleteDataFile,
  editingDataFileId,
  onStartEditDataFile,
  onDataFileRenameCommit,
  onProjectImport,
  onFolderImport,
  onProjectExport,
  onFolderExport,
  getShortcutForRequest,
  onOpenShortcutModal,
  onEnvClick,
  cookieDomains,
  expandedCookieSections,
  onCookieSectionToggle,
  onCookieDomainClick,
  onClearAllCookies,
  onClearDomainCookies,
  activeCookieDomain,
  searchQuery,
  onToggleProject,
  onToggleFolder,
  onDropOnProject,
  onDropOnFolder,
  onDropOnRequest,
  onRequestDragOver,
  clearDragOverIfLeaving,
}: Readonly<ProjectRowProps>) {
  const rootRequests = projectRequests
    .filter((r) => !r.folder_id)
    .sort((a, b) => a.position - b.position);

  // ─── Search filtering ────────────────────────────────────────────────────────
  const sq = (searchQuery ?? '').trim().toLowerCase();
  const filtering = sq.length > 0;
  const hit = (text: string) => text.toLowerCase().includes(sq);
  const projectHit = filtering && hit(project.name);

  const visibleRootRequests = !filtering || projectHit ? rootRequests : rootRequests.filter((r) => hit(r.name));
  const visibleFolders = !filtering || projectHit
    ? folders
    : folders.filter((f) => hit(f.name) || projectRequests.some((r) => r.folder_id === f.id && hit(r.name)));
  const visibleEnvs = !filtering || projectHit ? projectEnvs : projectEnvs.filter((e) => hit(e.name));
  const visibleAutomations = !filtering || projectHit ? projectAutomations : projectAutomations.filter((a) => hit(a.name));
  const visibleDataFiles = !filtering || projectHit ? projectDataFiles : projectDataFiles.filter((d) => hit(d.name));
  const visibleReplays = !filtering || projectHit ? projectReplays : projectReplays.filter((r) => hit(r.name));
  const visibleCookieDomains = !filtering || projectHit ? cookieDomains : cookieDomains.filter((d) => hit(d));

  const isProjectDragOver = dragOver?.type === 'project' && dragOver.id === project.id;
  const envsExpanded = expandedEnvSections.has(project.id) || (filtering && visibleEnvs.length > 0);
  const cookiesExpanded = expandedCookieSections.has(project.id) || (filtering && visibleCookieDomains.length > 0);
  const automationsExpanded = expandedAutomationSections.has(project.id) || (filtering && visibleAutomations.length > 0);
  const dataFilesExpanded = expandedDataFileSections.has(project.id) || (filtering && visibleDataFiles.length > 0);
  const replaysExpanded = expandedReplaySections.has(project.id) || (filtering && visibleReplays.length > 0);

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
            e.dataTransfer.setData('callstack/request', JSON.stringify({ id: request.id, projectId: request.project_id }));
            e.dataTransfer.setData(`callstack/request-project-${request.project_id}`, '1');
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
            isSelected={activeView === 'request' && currentRequestId === request.id}
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
            isNameTaken={(name) => {
              const target = name.trim().toLowerCase();
              return projectRequests.some(
                (r) =>
                  r.id !== request.id &&
                  (r.folder_id ?? null) === (request.folder_id ?? null) &&
                  r.name.trim().toLowerCase() === target,
              );
            }}
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
          title="Import"
        >
          <ImportIcon />
        </button>
        <button
          className={`${styles.iconBtn} ${styles.exportBtn}`}
          onClick={(e) => onProjectExport(e, project.id)}
          title="Export"
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
          {visibleFolders.map((folder) => {
            const allFolderRequests = projectRequests
              .filter((r) => r.folder_id === folder.id)
              .sort((a, b) => a.position - b.position);
            const folderRequests = !filtering || projectHit || hit(folder.name)
              ? allFolderRequests
              : allFolderRequests.filter((r) => hit(r.name));
            const isFolderExpanded = expandedFolders.has(folder.id) || (filtering && folderRequests.length > 0);
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
                  {folderRequests.length > 0 && (
                    <span className={styles.countBadge}>{folderRequests.length}</span>
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
                    title="Import"
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
                      !filtering && <div className={`${styles.treeRow} ${styles.emptyRow}`}>No requests</div>
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
            {visibleRootRequests.length === 0 && visibleFolders.length === 0 ? (
              !filtering && <div className={`${styles.treeRow} ${styles.emptyRow}`}>No requests</div>
            ) : (
              visibleRootRequests.map(renderRequestRow)
            )}
          </div>

          {/* Environments group */}
          {(!filtering || visibleEnvs.length > 0) && <div className={styles.folder}>
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
              {projectEnvs.length > 0 && (
                <span className={styles.countBadge}>{projectEnvs.length}</span>
              )}
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
                {visibleEnvs.length === 0 ? (
                  !filtering && <div className={`${styles.treeRow} ${styles.emptyRow}`}>No environments</div>
                ) : (
                  visibleEnvs.map((env) => (
                    <div
                      key={env.id}
                      className={`${styles.treeRow} ${styles.envRow} ${activeView === 'environment' && activeEnvironmentId === env.id ? styles.selected : ''}`}
                      onClick={() => editingEnvId !== env.id && onEnvClick(env)}
                    >
                      <EnvIconFor name={env.name} />
                      {editingEnvId === env.id ? (
                        <InlineNameInput
                          initialValue={env.name}
                          className={styles.folderNameInput}
                          onCommit={(name) => onEnvRenameCommit(env.id, name)}
                          onCancel={() => onEnvRenameCommit(env.id, env.name)}
                        />
                      ) : (
                        <span className={styles.envName}>{env.name}</span>
                      )}
                      <button
                        className={`${styles.iconBtn} ${styles.renameBtn}`}
                        onClick={(e) => { e.stopPropagation(); onStartEditEnv(env.id); }}
                        title="Rename environment"
                      >
                        <PenIcon />
                      </button>
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
          </div>}

          {/* Cookies group */}
          {(!filtering || visibleCookieDomains.length > 0) && <div className={styles.folder}>
            <div
              className={styles.folderRow}
              onClick={() => onCookieSectionToggle(project.id)}
            >
              <Chevron expanded={cookiesExpanded} />
              <CookiesGroupIcon />
              <span className={styles.folderName}>Cookies</span>
              {cookieDomains.length > 0 && (
                <span className={styles.countBadge}>{cookieDomains.length}</span>
              )}
              {cookieDomains.length > 0 && (
                <button
                  className={`${styles.iconBtn} ${styles.deleteBtn}`}
                  onClick={(e) => onClearAllCookies(project.id, e)}
                  title="Clear all cookies"
                >
                  <BinIcon />
                </button>
              )}
            </div>
            {cookiesExpanded && (
              <div className={styles.folderChildren}>
                {visibleCookieDomains.length === 0 ? (
                  !filtering && <div className={`${styles.treeRow} ${styles.emptyRow}`}>No cookies stored</div>
                ) : (
                  visibleCookieDomains.map((domain) => (
                    <div
                      key={domain}
                      className={`${styles.treeRow} ${styles.envRow} ${activeView === 'cookies' && activeCookieDomain === domain ? styles.selected : ''}`}
                      onClick={() => onCookieDomainClick(domain)}
                    >
                      <DomainFavicon domain={domain} />
                      <span className={styles.envName}>{domain}</span>
                      <button
                        className={`${styles.iconBtn} ${styles.deleteBtn}`}
                        onClick={(e) => onClearDomainCookies(project.id, domain, e)}
                        title={`Clear cookies for ${domain}`}
                      >
                        <BinIcon />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>}

          {/* Automations group */}
          {(!filtering || visibleAutomations.length > 0) && <div className={styles.folder}>
            <div
              className={styles.folderRow}
              onClick={() => setExpandedAutomationSections((prev) => {
                const next = new Set(prev);
                if (next.has(project.id)) next.delete(project.id);
                else next.add(project.id);
                return next;
              })}
            >
              <Chevron expanded={automationsExpanded} />
              <AutomationsFolderIcon />
              <span className={styles.folderName}>Automations</span>
              {projectAutomations.length > 0 && (
                <span className={styles.countBadge}>{projectAutomations.length}</span>
              )}
              <button
                className={`${styles.iconBtn} ${styles.folderAddBtn} ${styles.addBtn}`}
                onClick={(e) => onCreateAutomation(project.id, e)}
                title="Add automation"
              >
                <NewAutomationIcon />
              </button>
            </div>
            {automationsExpanded && (
              <div className={styles.folderChildren}>
                {visibleAutomations.length === 0 ? (
                  !filtering && <div className={`${styles.treeRow} ${styles.emptyRow}`}>No automations</div>
                ) : (
                  visibleAutomations.map((automation) => (
                    <div
                      key={automation.id}
                      className={`${styles.treeRow} ${styles.automationRow} ${activeView === 'automation' && activeAutomationId === automation.id ? styles.selected : ''}`}
                      onClick={() => editingAutomationId !== automation.id && onOpenAutomation(automation)}
                    >
                      <AutomationIcon />
                      {editingAutomationId === automation.id ? (
                        <InlineNameInput
                          initialValue={automation.name}
                          className={styles.folderNameInput}
                          onCommit={(name) => onAutomationRenameCommit(automation.id, name)}
                          onCancel={() => onAutomationRenameCommit(automation.id, automation.name)}
                        />
                      ) : (
                        <span className={styles.automationName}>{automation.name}</span>
                      )}
                      <button
                        className={`${styles.iconBtn} ${styles.renameBtn}`}
                        onClick={(e) => { e.stopPropagation(); onStartEditAutomation(automation.id); }}
                        title="Rename automation"
                      >
                        <PenIcon />
                      </button>
                      <button
                        className={`${styles.iconBtn} ${styles.deleteBtn}`}
                        onClick={(e) => onDeleteAutomation(automation.id, automation.name, e)}
                        title="Delete automation"
                      >
                        <BinIcon />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>}

          {/* Replays group */}
          {(!filtering || visibleReplays.length > 0) && <div className={styles.folder}>
            <div
              className={styles.folderRow}
              onClick={() => setExpandedReplaySections((prev) => {
                const next = new Set(prev);
                if (next.has(project.id)) next.delete(project.id);
                else next.add(project.id);
                return next;
              })}
            >
              <Chevron expanded={replaysExpanded} />
              <ReplaysFolderIcon />
              <span className={styles.folderName}>Replays</span>
              {projectReplays.length > 0 && (
                <span className={styles.countBadge}>{projectReplays.length}</span>
              )}
              {projectReplays.some((r) => runningReplayIds.has(r.id)) && (
                <button
                  className={`${styles.iconBtn} ${styles.replayStopBtn}`}
                  onClick={(e) => { e.stopPropagation(); onStopReplays(); }}
                  title="Stop replay server (stops all replays)"
                >
                  <StopIcon />
                </button>
              )}
            </div>
            {replaysExpanded && (
              <div className={styles.folderChildren}>
                {visibleReplays.length === 0 ? (
                  !filtering && <div className={`${styles.treeRow} ${styles.emptyRow}`}>No replays</div>
                ) : (
                  visibleReplays.map((replay) => (
                    <div
                      key={replay.id}
                      className={`${styles.treeRow} ${styles.automationRow} ${activeView === 'replay' && activeReplayId === replay.id ? styles.selected : ''}`}
                      onClick={() => editingReplayId !== replay.id && onOpenReplay(replay)}
                    >
                      <span className={runningReplayIds.has(replay.id) ? styles.replayRunning : undefined}>
                        <ReplayIcon />
                      </span>
                      {editingReplayId === replay.id ? (
                        <InlineNameInput
                          initialValue={replay.name}
                          className={styles.folderNameInput}
                          onCommit={(name) => onReplayRenameCommit(replay.id, name)}
                          onCancel={() => onReplayRenameCommit(replay.id, replay.name)}
                        />
                      ) : (
                        <span className={styles.automationName}>{replay.name}</span>
                      )}
                      <button
                        className={`${styles.iconBtn} ${styles.renameBtn}`}
                        onClick={(e) => { e.stopPropagation(); onStartEditReplay(replay.id); }}
                        title="Rename replay"
                      >
                        <PenIcon />
                      </button>
                      <button
                        className={`${styles.iconBtn} ${styles.deleteBtn}`}
                        onClick={(e) => onDeleteReplay(replay.id, replay.name, e)}
                        title="Delete replay"
                      >
                        <BinIcon />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>}

          {/* Data Files group */}
          {(!filtering || visibleDataFiles.length > 0) && <div className={styles.folder}>
            <div
              className={styles.folderRow}
              onClick={() => setExpandedDataFileSections((prev) => {
                const next = new Set(prev);
                if (next.has(project.id)) next.delete(project.id);
                else next.add(project.id);
                return next;
              })}
            >
              <Chevron expanded={dataFilesExpanded} />
              <DataFileIcon />
              <span className={styles.folderName}>Datasets</span>
              {projectDataFiles.length > 0 && (
                <span className={styles.countBadge}>{projectDataFiles.length}</span>
              )}
              <button
                className={`${styles.iconBtn} ${styles.folderAddBtn} ${styles.addBtn}`}
                onClick={(e) => onCreateDataFile(project.id, e)}
                title="Add data file"
              >
                <NewDataFileIcon />
              </button>
            </div>
            {dataFilesExpanded && (
              <div className={styles.folderChildren}>
                {visibleDataFiles.length === 0 ? (
                  !filtering && <div className={`${styles.treeRow} ${styles.emptyRow}`}>No data files</div>
                ) : (
                  visibleDataFiles.map((dataFile) => (
                    <div
                      key={dataFile.id}
                      className={`${styles.treeRow} ${styles.envRow} ${activeView === 'dataFile' && activeDataFileId === dataFile.id ? styles.selected : ''}`}
                      onClick={() => editingDataFileId !== dataFile.id && onDataFileClick(dataFile)}
                    >
                      <DatasetItemIcon />
                      {editingDataFileId === dataFile.id ? (
                        <InlineNameInput
                          initialValue={dataFile.name}
                          className={styles.folderNameInput}
                          onCommit={(name) => onDataFileRenameCommit(dataFile.id, name)}
                          onCancel={() => onDataFileRenameCommit(dataFile.id, dataFile.name)}
                        />
                      ) : (
                        <span className={styles.envName}>{dataFile.name}</span>
                      )}
                      <button
                        className={`${styles.iconBtn} ${styles.renameBtn}`}
                        onClick={(e) => { e.stopPropagation(); onStartEditDataFile(dataFile.id); }}
                        title="Rename data file"
                      >
                        <PenIcon />
                      </button>
                      <button
                        className={`${styles.iconBtn} ${styles.deleteBtn}`}
                        onClick={(e) => onDeleteDataFile(dataFile.id, dataFile.name, e)}
                        title="Delete data file"
                      >
                        <BinIcon />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>}
        </div>
      )}
    </div>
  );
}
