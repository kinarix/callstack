import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useDatabase } from '../../hooks/useDatabase';
import { RequestItem } from './RequestItem';
import { NewProjectModal } from './NewProjectModal';
import { NewFolderModal } from './NewFolderModal';
import { EnvModal } from '../EnvModal/EnvModal';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import styles from './Sidebar.module.css';
// ─── Sub-components ───────────────────────────────────────────────────────────
function InlineNameInput({ initialValue, className, onCommit, onCancel, }) {
    const [value, setValue] = useState(initialValue);
    const ref = useRef(null);
    useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
    return (_jsx("input", { ref: ref, className: className, value: value, onChange: (e) => setValue(e.target.value), onKeyDown: (e) => {
            if (e.key === 'Enter')
                onCommit(value.trim() || initialValue);
            else if (e.key === 'Escape')
                onCancel();
            e.stopPropagation();
        }, onBlur: () => onCommit(value.trim() || initialValue), onClick: (e) => e.stopPropagation() }));
}
function Chevron({ expanded }) {
    return (_jsx("svg", { className: styles.chevron, style: { transform: expanded ? undefined : 'rotate(-90deg)' }, width: "13", height: "13", viewBox: "0 0 13 13", fill: "none", children: _jsx("path", { d: "M2.5 4.5L6 8L9.5 4.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) }));
}
function BinIcon() {
    return (_jsx("svg", { width: "13", height: "13", viewBox: "0 0 13 13", fill: "none", children: _jsx("path", { d: "M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3.5 3.5l.5 7h5l.5-7", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }) }));
}
function PenIcon() {
    return (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", children: _jsx("path", { d: "M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }) }));
}
function ProjectIcon() {
    return (_jsxs("svg", { className: `${styles.treeIcon} ${styles.treeIconProject}`, width: "13", height: "13", viewBox: "0 0 13 13", fill: "none", children: [_jsx("rect", { x: "1.5", y: "3.5", width: "10", height: "7.5", rx: "1.5", stroke: "currentColor", strokeWidth: "1.3" }), _jsx("path", { d: "M4.5 3.5V2.5C4.5 2.22 4.72 2 5 2H8C8.28 2 8.5 2.22 8.5 2.5V3.5", stroke: "currentColor", strokeWidth: "1.3", strokeLinecap: "round" })] }));
}
function FolderIcon({ open }) {
    return (_jsx("svg", { className: `${styles.treeIcon} ${styles.treeIconFolder}`, width: "13", height: "13", viewBox: "0 0 13 13", fill: "none", children: _jsx("path", { d: "M1.5 4.5C1.5 3.95 1.95 3.5 2.5 3.5H5L6 4.5H10.5C11.05 4.5 11.5 4.95 11.5 5.5V9.5C11.5 10.05 11.05 10.5 10.5 10.5H2.5C1.95 10.5 1.5 10.05 1.5 9.5V4.5Z", stroke: "currentColor", strokeWidth: "1.3", fill: open ? 'currentColor' : 'none', fillOpacity: open ? 0.25 : 0 }) }));
}
function EnvIcon() {
    return (_jsxs("svg", { className: `${styles.treeIcon} ${styles.treeIconEnv}`, width: "13", height: "13", viewBox: "0 0 13 13", fill: "none", children: [_jsx("circle", { cx: "6.5", cy: "6.5", r: "4.5", stroke: "currentColor", strokeWidth: "1.3" }), _jsx("path", { d: "M4.5 6.5H8.5M6 4.5L8.5 6.5L6 8.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" })] }));
}
// ─── Main component ───────────────────────────────────────────────────────────
export function Sidebar({ collapsed, onToggleCollapse }) {
    const { state, dispatch } = useApp();
    const { createProject, createRequest, updateRequest, updateProject, updateFolder, deleteProject, deleteRequest, createFolder, deleteFolder, getLastResponse, createEnvironment, updateEnvironment, deleteEnvironment, moveRequest, moveFolder, reorderRequests, } = useDatabase();
    const { projects, requests, folders, environments, currentRequestId, expandedProjects, expandedFolders } = state;
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [folderModalProjectId, setFolderModalProjectId] = useState(null);
    const [editingRequestId, setEditingRequestId] = useState(null);
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [editingFolderId, setEditingFolderId] = useState(null);
    const [newFolderId, setNewFolderId] = useState(null);
    const [envModalEnv, setEnvModalEnv] = useState(null);
    const [expandedEnvSections, setExpandedEnvSections] = useState(new Set());
    const [pendingDelete, setPendingDelete] = useState(null);
    // Native DnD — ref avoids re-renders during drag; state drives visual feedback
    const dragging = useRef(null);
    const [dragOver, setDragOver] = useState(null);
    useEffect(() => {
        if (newFolderId === null)
            return;
        const el = document.getElementById(`folder-row-${newFolderId}`);
        if (el)
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        setNewFolderId(null);
    }, [newFolderId, folders]);
    if (collapsed)
        return null;
    // ─── Non-DnD handlers ──────────────────────────────────────────────────────
    const handleCreateNewProject = async (name, description) => {
        const project = await createProject(state.currentUser?.email ?? null, name, description || null);
        dispatch({ type: 'ADD_PROJECT', payload: project });
        dispatch({ type: 'TOGGLE_PROJECT', payload: project.id });
        setShowNewProjectModal(false);
    };
    const handleCreateRootRequest = async (projectId, e) => {
        e.stopPropagation();
        const request = await createRequest(projectId, state.currentUser?.email ?? null, 'New Request', null);
        dispatch({ type: 'ADD_REQUEST', payload: request });
        dispatch({ type: 'SET_CURRENT_REQUEST', payload: request.id });
        setEditingRequestId(request.id);
    };
    const handleCreateFolderRequest = async (projectId, folderId, e) => {
        e.stopPropagation();
        const request = await createRequest(projectId, state.currentUser?.email ?? null, 'New Request', folderId);
        dispatch({ type: 'ADD_REQUEST', payload: request });
        dispatch({ type: 'SET_CURRENT_REQUEST', payload: request.id });
        setEditingRequestId(request.id);
    };
    const handleSelect = async (id) => {
        dispatch({ type: 'SET_CURRENT_REQUEST', payload: id });
        const response = await getLastResponse(id).catch(() => null);
        dispatch({ type: 'SET_RESPONSE', payload: response });
    };
    const requestDeleteProject = (projectId, e) => {
        e.stopPropagation();
        const project = projects.find((p) => p.id === projectId);
        const requestCount = requests.filter((r) => r.project_id === projectId).length;
        const folderCount = folders.filter((f) => f.project_id === projectId).length;
        const envCount = environments.filter((ev) => ev.project_id === projectId).length;
        setPendingDelete({ type: 'project', id: projectId, name: project.name, requestCount, folderCount, envCount });
    };
    const requestDeleteFolder = (folderId, e) => {
        e.stopPropagation();
        const folder = folders.find((f) => f.id === folderId);
        const requestCount = requests.filter((r) => r.folder_id === folderId).length;
        setPendingDelete({ type: 'folder', id: folderId, name: folder.name, requestCount });
    };
    const requestDeleteRequest = (id, e) => {
        e.stopPropagation();
        const request = requests.find((r) => r.id === id);
        setPendingDelete({ type: 'request', id, name: request.name, method: request.method });
    };
    const requestDeleteEnv = (id, name, e) => {
        e.stopPropagation();
        setPendingDelete({ type: 'env', id, name });
    };
    const handleConfirmDelete = async () => {
        if (!pendingDelete)
            return;
        const pd = pendingDelete;
        setPendingDelete(null);
        if (pd.type === 'project') {
            await deleteProject(pd.id);
            dispatch({ type: 'DELETE_PROJECT', payload: pd.id });
        }
        else if (pd.type === 'folder') {
            await deleteFolder(pd.id);
            dispatch({ type: 'DELETE_FOLDER', payload: pd.id });
        }
        else if (pd.type === 'request') {
            await deleteRequest(pd.id);
            dispatch({ type: 'DELETE_REQUEST', payload: pd.id });
        }
        else if (pd.type === 'env') {
            await deleteEnvironment(pd.id);
            dispatch({ type: 'DELETE_ENVIRONMENT', payload: pd.id });
        }
    };
    const handleCreateFolder = (projectId, e) => {
        e.stopPropagation();
        setFolderModalProjectId(projectId);
    };
    const handleCreateEnvironment = async (projectId, e) => {
        e.stopPropagation();
        const env = await createEnvironment(projectId, 'New Environment');
        dispatch({ type: 'ADD_ENVIRONMENT', payload: env });
        setEnvModalEnv(env);
    };
    const handleFolderModalConfirm = async (name) => {
        if (folderModalProjectId === null)
            return;
        const folder = await createFolder(folderModalProjectId, name);
        dispatch({ type: 'ADD_FOLDER', payload: folder });
        if (!expandedProjects.has(folderModalProjectId)) {
            dispatch({ type: 'TOGGLE_PROJECT', payload: folderModalProjectId });
        }
        dispatch({ type: 'TOGGLE_FOLDER', payload: folder.id });
        setNewFolderId(folder.id);
        setFolderModalProjectId(null);
    };
    const handleRenameCommit = async (id, name) => {
        setEditingRequestId(null);
        await updateRequest(id, { name });
        dispatch({ type: 'UPDATE_REQUEST', payload: { ...requests.find((r) => r.id === id), name } });
    };
    const handleProjectRenameCommit = async (id, name) => {
        setEditingProjectId(null);
        const project = projects.find((p) => p.id === id);
        const updated = await updateProject(id, name, project.description ?? null);
        dispatch({ type: 'UPDATE_PROJECT', payload: updated });
    };
    const handleFolderRenameCommit = async (id, name) => {
        setEditingFolderId(null);
        const updated = await updateFolder(id, name);
        dispatch({ type: 'UPDATE_FOLDER', payload: updated });
    };
    // ─── Native DnD handlers ───────────────────────────────────────────────────
    const applyRequestMove = async (requestId, targetProjectId, targetFolderId, insertBeforeId, above) => {
        const movingRequest = requests.find((r) => r.id === requestId);
        if (!movingRequest)
            return;
        const isCrossContainer = movingRequest.project_id !== targetProjectId || movingRequest.folder_id !== targetFolderId;
        const containerRequests = requests
            .filter((r) => r.project_id === targetProjectId && r.folder_id === targetFolderId)
            .sort((a, b) => a.position - b.position);
        const withoutActive = containerRequests.filter((r) => r.id !== requestId);
        if (insertBeforeId === null) {
            withoutActive.push(movingRequest);
        }
        else {
            const overIdx = withoutActive.findIndex((r) => r.id === insertBeforeId);
            if (overIdx === -1) {
                withoutActive.push(movingRequest);
            }
            else if (above) {
                withoutActive.splice(overIdx, 0, movingRequest);
            }
            else {
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
        }
        catch (err) {
            console.error('Failed to move request:', err);
        }
    };
    const handleDropOnProject = async (e, projectId) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(null);
        const d = dragging.current;
        dragging.current = null;
        if (!d)
            return;
        if (d.kind === 'folder') {
            try {
                await moveFolder(d.id, projectId);
                dispatch({ type: 'MOVE_FOLDER', payload: { folderId: d.id, projectId } });
            }
            catch (err) {
                console.error('Failed to move folder:', err);
            }
        }
        else {
            await applyRequestMove(d.id, projectId, null, null, true);
        }
    };
    const handleDropOnFolder = async (e, folder) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(null);
        const d = dragging.current;
        dragging.current = null;
        if (!d)
            return;
        if (d.kind === 'folder') {
            try {
                await moveFolder(d.id, folder.project_id);
                dispatch({ type: 'MOVE_FOLDER', payload: { folderId: d.id, projectId: folder.project_id } });
            }
            catch (err) {
                console.error('Failed to move folder:', err);
            }
        }
        else {
            await applyRequestMove(d.id, folder.project_id, folder.id, null, true);
        }
    };
    const handleDropOnRequest = async (e, overRequest) => {
        e.preventDefault();
        e.stopPropagation();
        const d = dragging.current;
        const currentDragOver = dragOver;
        setDragOver(null);
        dragging.current = null;
        if (!d || d.kind !== 'request' || d.id === overRequest.id)
            return;
        const above = currentDragOver?.type === 'request-above';
        await applyRequestMove(d.id, overRequest.project_id, overRequest.folder_id, overRequest.id, above);
    };
    const onRequestDragOver = (e, request) => {
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
    const clearDragOverIfLeaving = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOver(null);
        }
    };
    // ─── Render ────────────────────────────────────────────────────────────────
    return (_jsxs(_Fragment, { children: [showNewProjectModal && (_jsx(NewProjectModal, { onConfirm: handleCreateNewProject, onCancel: () => setShowNewProjectModal(false) })), folderModalProjectId !== null && (_jsx(NewFolderModal, { onConfirm: handleFolderModalConfirm, onCancel: () => setFolderModalProjectId(null) })), envModalEnv && (_jsx(EnvModal, { env: envModalEnv, onClose: () => setEnvModalEnv(null), onSave: async (id, name, variables) => {
                    const updated = await updateEnvironment(id, name, variables);
                    dispatch({ type: 'UPDATE_ENVIRONMENT', payload: updated });
                } })), pendingDelete && (_jsxs(ConfirmModal, { title: pendingDelete.type === 'project' ? `Delete project "${pendingDelete.name}"?` :
                    pendingDelete.type === 'folder' ? `Delete folder "${pendingDelete.name}"?` :
                        pendingDelete.type === 'request' ? `Delete request "${pendingDelete.name}"?` :
                            `Delete environment "${pendingDelete.name}"?`, onConfirm: handleConfirmDelete, onCancel: () => setPendingDelete(null), children: [pendingDelete.type === 'project' && (_jsxs(_Fragment, { children: [_jsxs("p", { children: ["This will permanently remove ", _jsx("strong", { children: pendingDelete.name }), " and all its contents:"] }), _jsxs("ul", { children: [pendingDelete.requestCount > 0 && (_jsxs("li", { children: [pendingDelete.requestCount, " request", pendingDelete.requestCount !== 1 ? 's' : ''] })), pendingDelete.folderCount > 0 && (_jsxs("li", { children: [pendingDelete.folderCount, " folder", pendingDelete.folderCount !== 1 ? 's' : ''] })), pendingDelete.envCount > 0 && (_jsxs("li", { children: [pendingDelete.envCount, " environment", pendingDelete.envCount !== 1 ? 's' : ''] })), pendingDelete.requestCount === 0 && pendingDelete.folderCount === 0 && pendingDelete.envCount === 0 && (_jsx("li", { children: "No requests, folders, or environments" }))] }), _jsx("p", { children: "This action cannot be undone." })] })), pendingDelete.type === 'folder' && (_jsxs(_Fragment, { children: [_jsxs("p", { children: ["This will permanently remove ", _jsx("strong", { children: pendingDelete.name }), pendingDelete.requestCount > 0
                                        ? ` and its ${pendingDelete.requestCount} request${pendingDelete.requestCount !== 1 ? 's' : ''}.`
                                        : '.'] }), _jsx("p", { children: "This action cannot be undone." })] })), pendingDelete.type === 'request' && (_jsxs(_Fragment, { children: [_jsxs("p", { children: ["Permanently delete ", _jsxs("strong", { children: [pendingDelete.method, " \u2014 ", pendingDelete.name] }), "?"] }), _jsx("p", { children: "This action cannot be undone." })] })), pendingDelete.type === 'env' && (_jsxs(_Fragment, { children: [_jsxs("p", { children: ["Permanently delete environment ", _jsx("strong", { children: pendingDelete.name }), "?"] }), _jsx("p", { children: "This action cannot be undone." })] }))] })), _jsxs("div", { className: styles.sidebar, children: [_jsxs("div", { className: styles.header, children: [_jsx("span", { className: styles.title, children: "Explorer" }), _jsxs("div", { className: styles.headerActions, children: [_jsx("button", { className: styles.newProjectBtn, onClick: () => setShowNewProjectModal(true), title: "New Project", children: "+" }), _jsx("button", { className: styles.collapseBtn, onClick: onToggleCollapse, title: "Collapse navigator", children: "\u2039" })] })] }), _jsx("div", { className: styles.tree, children: projects.length === 0 ? (_jsx("div", { className: styles.empty, children: "No projects yet. Click + to create one." })) : (projects.map((project) => {
                            const isExpanded = expandedProjects.has(project.id);
                            const projectFolders = folders
                                .filter((f) => f.project_id === project.id);
                            const rootRequests = requests
                                .filter((r) => r.project_id === project.id && !r.folder_id)
                                .sort((a, b) => a.position - b.position);
                            const projectEnvs = environments.filter((e) => e.project_id === project.id);
                            const isProjectDragOver = dragOver?.type === 'project' && dragOver.id === project.id;
                            return (_jsxs("div", { className: styles.project, children: [_jsxs("div", { className: `${styles.projectRow}${isProjectDragOver ? ` ${styles.dragOver}` : ''}`, onClick: () => dispatch({ type: 'TOGGLE_PROJECT', payload: project.id }), onDragOver: (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setDragOver({ type: 'project', id: project.id });
                                        }, onDragLeave: clearDragOverIfLeaving, onDrop: (e) => handleDropOnProject(e, project.id), children: [_jsx(Chevron, { expanded: isExpanded }), _jsx(ProjectIcon, {}), editingProjectId === project.id ? (_jsx(InlineNameInput, { initialValue: project.name, className: styles.projectNameInput, onCommit: (name) => handleProjectRenameCommit(project.id, name), onCancel: () => setEditingProjectId(null) })) : (_jsx("span", { className: styles.projectName, onDoubleClick: (e) => { e.stopPropagation(); setEditingProjectId(project.id); }, children: project.name })), _jsx("button", { className: `${styles.iconBtn} ${styles.folderAddBtn}`, onClick: (e) => handleCreateFolder(project.id, e), title: "Add folder", children: "+folder" }), _jsx("button", { className: styles.iconBtn, onClick: (e) => handleCreateRootRequest(project.id, e), title: "Add request", children: "+" }), editingProjectId !== project.id && (_jsx("button", { className: styles.iconBtn, onClick: (e) => { e.stopPropagation(); setEditingProjectId(project.id); }, title: "Rename project", children: _jsx(PenIcon, {}) })), _jsx("button", { className: `${styles.iconBtn} ${styles.deleteBtn}`, onClick: (e) => requestDeleteProject(project.id, e), title: "Delete project", children: _jsx(BinIcon, {}) })] }), isExpanded && (_jsxs("div", { className: styles.children, children: [projectFolders.map((folder) => {
                                                const isFolderExpanded = expandedFolders.has(folder.id);
                                                const folderRequests = requests
                                                    .filter((r) => r.folder_id === folder.id)
                                                    .sort((a, b) => a.position - b.position);
                                                const isFolderDragOver = dragOver?.type === 'folder' && dragOver.id === folder.id;
                                                return (_jsxs("div", { className: styles.folder, children: [_jsxs("div", { id: `folder-row-${folder.id}`, className: `${styles.folderRow}${isFolderDragOver ? ` ${styles.dragOver}` : ''}`, draggable: true, onDragStart: (e) => {
                                                                dragging.current = { kind: 'folder', id: folder.id };
                                                                e.dataTransfer.effectAllowed = 'move';
                                                                e.stopPropagation();
                                                            }, onDragEnd: () => {
                                                                dragging.current = null;
                                                                setDragOver(null);
                                                            }, onDragOver: (e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setDragOver({ type: 'folder', id: folder.id });
                                                            }, onDragLeave: clearDragOverIfLeaving, onDrop: (e) => handleDropOnFolder(e, folder), onClick: () => dispatch({ type: 'TOGGLE_FOLDER', payload: folder.id }), children: [_jsx(Chevron, { expanded: isFolderExpanded }), _jsx(FolderIcon, { open: isFolderExpanded }), editingFolderId === folder.id ? (_jsx(InlineNameInput, { initialValue: folder.name, className: styles.folderNameInput, onCommit: (name) => handleFolderRenameCommit(folder.id, name), onCancel: () => setEditingFolderId(null) })) : (_jsx("span", { className: styles.folderName, onDoubleClick: (e) => { e.stopPropagation(); setEditingFolderId(folder.id); }, children: folder.name })), _jsx("button", { className: styles.iconBtn, onClick: (e) => { e.stopPropagation(); handleCreateFolderRequest(project.id, folder.id, e); }, title: "Add request", children: "+" }), editingFolderId !== folder.id && (_jsx("button", { className: styles.iconBtn, onClick: (e) => { e.stopPropagation(); setEditingFolderId(folder.id); }, title: "Rename folder", children: _jsx(PenIcon, {}) })), _jsx("button", { className: `${styles.iconBtn} ${styles.deleteBtn}`, onClick: (e) => { e.stopPropagation(); requestDeleteFolder(folder.id, e); }, title: "Delete folder", children: _jsx(BinIcon, {}) })] }), isFolderExpanded && (_jsx("div", { className: styles.folderChildren, children: folderRequests.length === 0 ? (_jsx("div", { className: `${styles.treeRow} ${styles.emptyRow}`, children: "No requests" })) : (folderRequests.map((request) => (_jsxs("div", { className: styles.requestRowWrap, children: [dragOver?.id === request.id && dragOver.type === 'request-above' && (_jsx("div", { className: `${styles.dropLine} ${styles.dropAbove}` })), _jsx("div", { className: styles.treeRow, draggable: true, onDragStart: (e) => {
                                                                            dragging.current = { kind: 'request', id: request.id };
                                                                            e.dataTransfer.effectAllowed = 'move';
                                                                            e.stopPropagation();
                                                                        }, onDragEnd: () => {
                                                                            dragging.current = null;
                                                                            setDragOver(null);
                                                                        }, onDragOver: (e) => onRequestDragOver(e, request), onDragLeave: clearDragOverIfLeaving, onDrop: (e) => handleDropOnRequest(e, request), children: _jsx(RequestItem, { request: request, isSelected: currentRequestId === request.id, isEditing: editingRequestId === request.id, onSelect: handleSelect, onDelete: requestDeleteRequest, onRenameCommit: handleRenameCommit, onRenameCancel: () => setEditingRequestId(null), onRenameStart: () => setEditingRequestId(request.id) }) }), dragOver?.id === request.id && dragOver.type === 'request-below' && (_jsx("div", { className: `${styles.dropLine} ${styles.dropBelow}` }))] }, request.id)))) }))] }, folder.id));
                                            }), _jsx("div", { children: rootRequests.length === 0 && projectFolders.length === 0 ? (_jsx("div", { className: `${styles.treeRow} ${styles.emptyRow}`, children: "No requests" })) : (rootRequests.map((request) => (_jsxs("div", { className: styles.requestRowWrap, children: [dragOver?.id === request.id && dragOver.type === 'request-above' && (_jsx("div", { className: `${styles.dropLine} ${styles.dropAbove}` })), _jsx("div", { className: styles.treeRow, draggable: true, onDragStart: (e) => {
                                                                dragging.current = { kind: 'request', id: request.id };
                                                                e.dataTransfer.effectAllowed = 'move';
                                                                e.stopPropagation();
                                                            }, onDragEnd: () => {
                                                                dragging.current = null;
                                                                setDragOver(null);
                                                            }, onDragOver: (e) => onRequestDragOver(e, request), onDragLeave: clearDragOverIfLeaving, onDrop: (e) => handleDropOnRequest(e, request), children: _jsx(RequestItem, { request: request, isSelected: currentRequestId === request.id, isEditing: editingRequestId === request.id, onSelect: handleSelect, onDelete: requestDeleteRequest, onRenameCommit: handleRenameCommit, onRenameCancel: () => setEditingRequestId(null), onRenameStart: () => setEditingRequestId(request.id) }) }), dragOver?.id === request.id && dragOver.type === 'request-below' && (_jsx("div", { className: `${styles.dropLine} ${styles.dropBelow}` }))] }, request.id)))) }), (() => {
                                                const envsExpanded = expandedEnvSections.has(project.id);
                                                return (_jsxs("div", { className: styles.folder, children: [_jsxs("div", { className: styles.folderRow, onClick: () => setExpandedEnvSections((prev) => {
                                                                const next = new Set(prev);
                                                                if (next.has(project.id))
                                                                    next.delete(project.id);
                                                                else
                                                                    next.add(project.id);
                                                                return next;
                                                            }), children: [_jsx(Chevron, { expanded: envsExpanded }), _jsx(EnvIcon, {}), _jsx("span", { className: styles.folderName, children: "Environments" }), _jsx("button", { className: `${styles.iconBtn} ${styles.folderAddBtn}`, onClick: (e) => handleCreateEnvironment(project.id, e), title: "Add environment", children: "+env" })] }), envsExpanded && (_jsx("div", { className: styles.folderChildren, children: projectEnvs.length === 0 ? (_jsx("div", { className: `${styles.treeRow} ${styles.emptyRow}`, children: "No environments" })) : (projectEnvs.map((env) => (_jsxs("div", { className: `${styles.treeRow} ${styles.envRow}`, onClick: () => setEnvModalEnv(env), children: [_jsx(EnvIcon, {}), _jsx("span", { className: styles.envName, children: env.name }), _jsx("button", { className: `${styles.iconBtn} ${styles.deleteBtn}`, onClick: (e) => requestDeleteEnv(env.id, env.name, e), title: "Delete environment", children: _jsx(BinIcon, {}) })] }, env.id)))) }))] }));
                                            })()] }))] }, project.id));
                        })) })] })] }));
}
