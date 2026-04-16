import React, { createContext, useReducer, useEffect, ReactNode } from 'react';
import type { AppContextType, AppAction, AppState } from '../lib/types';

export const AppContext = createContext<AppContextType | undefined>(undefined);

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProjectId: action.payload };
    case 'SET_CURRENT_REQUEST':
      return { ...state, currentRequestId: action.payload, currentResponse: action.payload === state.currentRequestId ? state.currentResponse : null };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'ADD_PROJECT':
      return { ...state, projects: [action.payload, ...state.projects] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.payload.id ? action.payload : p)),
      };
    case 'DELETE_PROJECT': {
      const deletedProjectId = action.payload;
      const deletedEnvIds = new Set(
        state.environments.filter((e) => e.project_id === deletedProjectId).map((e) => e.id)
      );
      const deletedAutomationIds = new Set(
        state.automations.filter((a) => a.projectId === deletedProjectId).map((a) => a.id)
      );
      const deletedRequestIds = new Set(
        state.requests.filter((r) => r.project_id === deletedProjectId).map((r) => r.id)
      );
      const deletedDataFileIds = new Set(
        state.dataFiles.filter((d) => d.project_id === deletedProjectId).map((d) => d.id)
      );
      const activeEnvGone = state.activeEnvironmentId != null && deletedEnvIds.has(state.activeEnvironmentId);
      const activeAutomationGone = state.activeAutomationId != null && deletedAutomationIds.has(state.activeAutomationId);
      const activeRequestGone = state.currentRequestId != null && deletedRequestIds.has(state.currentRequestId);
      const activeDataFileGone = state.activeDataFileId != null && deletedDataFileIds.has(state.activeDataFileId);
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== deletedProjectId),
        folders: state.folders.filter((f) => f.project_id !== deletedProjectId),
        requests: state.requests.filter((r) => r.project_id !== deletedProjectId),
        environments: state.environments.filter((e) => e.project_id !== deletedProjectId),
        automations: state.automations.filter((a) => a.projectId !== deletedProjectId),
        dataFiles: state.dataFiles.filter((d) => d.project_id !== deletedProjectId),
        currentProjectId: state.currentProjectId === deletedProjectId ? null : state.currentProjectId,
        currentRequestId: activeRequestGone ? null : state.currentRequestId,
        activeEnvironmentId: activeEnvGone ? null : state.activeEnvironmentId,
        activeAutomationId: activeAutomationGone ? null : state.activeAutomationId,
        activeDataFileId: activeDataFileGone ? null : state.activeDataFileId,
        activeView: activeEnvGone || activeAutomationGone || activeDataFileGone ? 'request' : state.activeView,
      };
    }
    case 'SET_REQUESTS':
      return { ...state, requests: action.payload };
    case 'ADD_REQUEST':
      return { ...state, requests: [action.payload, ...state.requests] };
    case 'UPDATE_REQUEST':
      return {
        ...state,
        requests: state.requests.map((r) => (r.id === action.payload.id ? action.payload : r)),
      };
    case 'DELETE_REQUEST':
      return {
        ...state,
        requests: state.requests.filter((r) => r.id !== action.payload),
        currentRequestId: state.currentRequestId === action.payload ? null : state.currentRequestId,
      };
    case 'MOVE_REQUEST': {
      const { ids, requestId, projectId, folderId } = action.payload;
      const idMap = new Map(ids.map((id, i) => [id, i]));
      const reordered = [...state.requests]
        .map((r) => {
          let updated = r;
          if (r.id === requestId) updated = { ...updated, project_id: projectId, folder_id: folderId };
          if (idMap.has(r.id)) updated = { ...updated, position: idMap.get(r.id)! };
          return updated;
        });
      return { ...state, requests: reordered };
    }
    case 'MOVE_FOLDER': {
      const { folderId, projectId } = action.payload;
      return {
        ...state,
        folders: state.folders.map((f) => f.id === folderId ? { ...f, project_id: projectId } : f),
        requests: state.requests.map((r) => r.folder_id === folderId ? { ...r, project_id: projectId } : r),
      };
    }
    case 'SET_RESPONSE':
      return { ...state, currentResponse: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_EXECUTING_REQUEST':
      return { ...state, executingRequestId: action.payload };
    case 'TOGGLE_PROJECT':
      return {
        ...state,
        expandedProjects: new Set(
          state.expandedProjects.has(action.payload)
            ? [...state.expandedProjects].filter((p) => p !== action.payload)
            : [...state.expandedProjects, action.payload]
        ),
      };
    case 'SET_FOLDERS':
      return { ...state, folders: action.payload };
    case 'ADD_FOLDER':
      return { ...state, folders: [...state.folders, action.payload] };
    case 'UPDATE_FOLDER':
      return {
        ...state,
        folders: state.folders.map((f) => (f.id === action.payload.id ? action.payload : f)),
      };
    case 'DELETE_FOLDER': {
      const folderRequestIds = new Set(
        state.requests.filter((r) => r.folder_id === action.payload).map((r) => r.id)
      );
      return {
        ...state,
        folders: state.folders.filter((f) => f.id !== action.payload),
        requests: state.requests.filter((r) => r.folder_id !== action.payload),
        currentRequestId: folderRequestIds.has(state.currentRequestId ?? -1)
          ? null
          : state.currentRequestId,
      };
    }
    case 'TOGGLE_FOLDER': {
      const next = new Set(state.expandedFolders);
      if (next.has(action.payload)) {
        next.delete(action.payload);
      } else {
        next.add(action.payload);
      }
      return { ...state, expandedFolders: next };
    }
    case 'SET_ENVIRONMENTS': {
      const ids = new Set(action.payload.map((e) => e.id));
      const stillValid = state.activeEnvironmentId != null && ids.has(state.activeEnvironmentId);
      return {
        ...state,
        environments: action.payload,
        activeEnvironmentId: stillValid ? state.activeEnvironmentId : null,
        activeView:
          !stillValid && state.activeView === 'environment' ? 'request' : state.activeView,
      };
    }
    case 'ADD_ENVIRONMENT':
      return { ...state, environments: [...state.environments, action.payload] };
    case 'UPDATE_ENVIRONMENT':
      return {
        ...state,
        environments: state.environments.map((e) => (e.id === action.payload.id ? action.payload : e)),
      };
    case 'DELETE_ENVIRONMENT': {
      const isActive = state.activeEnvironmentId === action.payload;
      return {
        ...state,
        environments: state.environments.filter((e) => e.id !== action.payload),
        activeEnvironmentId: isActive ? null : state.activeEnvironmentId,
        activeView: isActive && state.activeView === 'environment' ? 'request' : state.activeView,
      };
    }
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs, action.payload] };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'SET_AUTOMATIONS': {
      const ids = new Set(action.payload.map((a) => a.id));
      const stillValid = state.activeAutomationId != null && ids.has(state.activeAutomationId);
      return {
        ...state,
        automations: action.payload,
        activeAutomationId: stillValid ? state.activeAutomationId : null,
      };
    }
    case 'ADD_AUTOMATION':
      return { ...state, automations: [...state.automations, action.payload] };
    case 'UPDATE_AUTOMATION':
      return {
        ...state,
        automations: state.automations.map((a) => (a.id === action.payload.id ? action.payload : a)),
      };
    case 'DELETE_AUTOMATION':
      return { ...state, automations: state.automations.filter((a) => a.id !== action.payload) };
    case 'SET_VIEW':
      return { ...state, activeView: action.payload };
    case 'SET_ACTIVE_AUTOMATION':
      return { ...state, activeAutomationId: action.payload };
    case 'SET_ACTIVE_ENVIRONMENT':
      return { ...state, activeEnvironmentId: action.payload };
    case 'SET_DATA_FILES':
      return { ...state, dataFiles: action.payload };
    case 'ADD_DATA_FILE':
      return { ...state, dataFiles: [...state.dataFiles, action.payload] };
    case 'UPDATE_DATA_FILE':
      return { ...state, dataFiles: state.dataFiles.map((d) => d.id === action.payload.id ? action.payload : d) };
    case 'DELETE_DATA_FILE': {
      const gone = state.activeDataFileId === action.payload;
      return {
        ...state,
        dataFiles: state.dataFiles.filter((d) => d.id !== action.payload),
        activeDataFileId: gone ? null : state.activeDataFileId,
        activeView: gone ? 'request' : state.activeView,
      };
    }
    case 'SET_ACTIVE_DATA_FILE':
      return { ...state, activeDataFileId: action.payload };
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, () => {
    const parseIds = (key: string) => {
      try { return new Set<number>(JSON.parse(localStorage.getItem(key) || '[]')); }
      catch { return new Set<number>(); }
    };
    return {
      currentProjectId: null,
      currentRequestId: null,
      projects: [],
      requests: [],
      folders: [],
      environments: [],
      dataFiles: [],
      currentResponse: null,
      isLoading: false,
      executingRequestId: null,
      expandedProjects: parseIds('callstack.expandedProjects'),
      expandedFolders: parseIds('callstack.expandedFolders'),
      logs: [],
      automations: [],
      activeView: ((): 'request' | 'automation' | 'environment' | 'dataFile' => {
        const v = localStorage.getItem('callstack.activeView');
        if (v === 'automation') return 'automation';
        if (v === 'environment') return 'environment';
        if (v === 'dataFile') return 'dataFile';
        return 'request';
      })(),
      activeAutomationId: ((): number | null => {
        const v = localStorage.getItem('callstack.activeAutomationId');
        if (!v) return null;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : null;
      })(),
      activeEnvironmentId: ((): number | null => {
        const v = localStorage.getItem('callstack.activeEnvironmentId');
        if (!v) return null;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : null;
      })(),
      activeDataFileId: ((): number | null => {
        const v = localStorage.getItem('callstack.activeDataFileId');
        if (!v) return null;
        const n = parseInt(v, 10);
        return Number.isFinite(n) ? n : null;
      })(),
    };
  });

  useEffect(() => {
    localStorage.setItem('callstack.activeView', state.activeView);
  }, [state.activeView]);

  useEffect(() => {
    if (state.activeAutomationId == null) {
      localStorage.removeItem('callstack.activeAutomationId');
    } else {
      localStorage.setItem('callstack.activeAutomationId', String(state.activeAutomationId));
    }
  }, [state.activeAutomationId]);

  useEffect(() => {
    if (state.activeEnvironmentId == null) {
      localStorage.removeItem('callstack.activeEnvironmentId');
    } else {
      localStorage.setItem('callstack.activeEnvironmentId', String(state.activeEnvironmentId));
    }
  }, [state.activeEnvironmentId]);

  useEffect(() => {
    if (state.activeDataFileId == null) {
      localStorage.removeItem('callstack.activeDataFileId');
    } else {
      localStorage.setItem('callstack.activeDataFileId', String(state.activeDataFileId));
    }
  }, [state.activeDataFileId]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
