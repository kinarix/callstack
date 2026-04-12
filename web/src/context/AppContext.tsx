import React, { createContext, useReducer, ReactNode } from 'react';
import type { AppContextType, AppAction, AppState } from '../lib/types';

export const AppContext = createContext<AppContextType | undefined>(undefined);

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, currentUser: action.payload };
    case 'SET_CURRENT_PROJECT':
      return { ...state, currentProjectId: action.payload };
    case 'SET_CURRENT_REQUEST':
      return { ...state, currentRequestId: action.payload };
    case 'SET_PROJECTS':
      return { ...state, projects: action.payload };
    case 'ADD_PROJECT':
      return { ...state, projects: [action.payload, ...state.projects] };
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) => (p.id === action.payload.id ? action.payload : p)),
      };
    case 'DELETE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.payload),
        requests: state.requests.filter((r) => r.project_id !== action.payload),
        environments: state.environments.filter((e) => e.project_id !== action.payload),
        currentProjectId: state.currentProjectId === action.payload ? null : state.currentProjectId,
      };
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
        })
        .sort((a, b) => {
          const aIndex = idMap.get(a.id) ?? state.requests.length;
          const bIndex = idMap.get(b.id) ?? state.requests.length;
          return aIndex - bIndex;
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
    case 'DELETE_FOLDER':
      return {
        ...state,
        folders: state.folders.filter((f) => f.id !== action.payload),
        requests: state.requests.map((r) =>
          r.folder_id === action.payload ? { ...r, folder_id: null } : r
        ),
      };
    case 'TOGGLE_FOLDER': {
      const next = new Set(state.expandedFolders);
      if (next.has(action.payload)) {
        next.delete(action.payload);
      } else {
        next.add(action.payload);
      }
      return { ...state, expandedFolders: next };
    }
    case 'SET_ENVIRONMENTS':
      return { ...state, environments: action.payload };
    case 'ADD_ENVIRONMENT':
      return { ...state, environments: [...state.environments, action.payload] };
    case 'UPDATE_ENVIRONMENT':
      return {
        ...state,
        environments: state.environments.map((e) => (e.id === action.payload.id ? action.payload : e)),
      };
    case 'DELETE_ENVIRONMENT':
      return {
        ...state,
        environments: state.environments.filter((e) => e.id !== action.payload),
      };
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs, action.payload] };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    default:
      return state;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, {
    currentUser: null,
    currentProjectId: null,
    currentRequestId: null,
    projects: [],
    requests: [],
    folders: [],
    environments: [],
    currentResponse: null,
    isLoading: false,
    executingRequestId: null,
    expandedProjects: new Set<number>(),
    expandedFolders: new Set<number>(),
    logs: [],
  });

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
