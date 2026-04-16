import { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { RequestBuilder } from './components/RequestBuilder/RequestBuilder';
import AutomationView from './components/AutomationView/AutomationView';
import EnvironmentView from './components/EnvironmentView/EnvironmentView';
import DataFileView from './components/DataFileView/DataFileView';
import { Footer } from './components/Footer/Footer';
import { SettingsModal } from './components/SettingsModal/SettingsModal';
import styles from './App.module.css';
import { useDatabase } from './hooks/useDatabase';
import { useSettings, matchesShortcut } from './hooks/useSettings';
import { formatBody } from './lib/formatBody';

function AppContent() {
  const { state, dispatch } = useApp();
  const { loadUserProjects, loadUserRequests, loadFolders, listEnvironments, listAutomations, listDataFiles, createRequest, duplicateRequest, getLastResponse } = useDatabase();
  const { settings, setZoom, setShortcut, resetSettings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const executeRef = useRef<(() => void) | null>(null);
  const [externalRenameId, setExternalRenameId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyFlashPane, setCopyFlashPane] = useState<'request' | 'response' | null>(null);
  const [activePane, setActivePane] = useState<'request' | 'response'>('response');
  const [ready, setReady] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const v = localStorage.getItem('callstack.sidebarWidth');
    return v ? parseInt(v, 10) : 280;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('callstack.sidebarCollapsed') === '1';
  });

  useEffect(() => {
    localStorage.setItem('callstack.sidebarCollapsed', sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  const startSidebarResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    document.body.style.userSelect = 'none';
    const onMove = (e: MouseEvent) => {
      const w = Math.max(180, Math.min(480, startW + e.clientX - startX));
      setSidebarWidth(w);
      localStorage.setItem('callstack.sidebarWidth', String(w));
    };
    const onUp = () => {
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  useEffect(() => {
    loadUserProjects(null).then(async (projects) => {
      if (projects.length === 0) {
        dispatch({ type: 'SET_PROJECTS', payload: projects });
        return;
      }

      // Load all child data BEFORE dispatching anything, so the first render with projects
      // also has requests/automations — eliminates the "blank intermediate state" flash.
      const [allRequests, allFolders, allEnvs, allAutomations, allDataFiles] = await Promise.all([
        Promise.all(projects.map((p) => loadUserRequests(p.id))).then((r) => r.flat()),
        Promise.all(projects.map((p) => loadFolders(p.id))).then((r) => r.flat()),
        Promise.all(projects.map((p) => listEnvironments(p.id))).then((r) => r.flat()),
        Promise.all(projects.map((p) => listAutomations(p.id))).then((r) => r.flat()),
        Promise.all(projects.map((p) => listDataFiles(p.id))).then((r) => r.flat()),
      ]);

      // Pick initial project (LS pref → first project)
      const savedProjectId = localStorage.getItem('callstack.currentProjectId');
      let initialProjectId: number | null = null;
      if (savedProjectId) {
        const id = parseInt(savedProjectId, 10);
        if (projects.find((p) => p.id === id)) initialProjectId = id;
      }
      if (initialProjectId == null) initialProjectId = projects[0].id;

      // If a saved request belongs to a different project, prefer that project
      const savedReqId = localStorage.getItem('callstack.currentRequestId');
      let restoredReqId: number | null = null;
      if (savedReqId) {
        const id = parseInt(savedReqId, 10);
        const req = allRequests.find((r) => r.id === id);
        if (req) {
          restoredReqId = id;
          initialProjectId = req.project_id;
        }
      }

      // If active automation belongs to a different project, prefer that project
      const savedAutoId = localStorage.getItem('callstack.activeAutomationId');
      if (savedAutoId) {
        const id = parseInt(savedAutoId, 10);
        const auto = allAutomations.find((a) => a.id === id);
        if (auto) initialProjectId = auto.projectId;
      }

      // All dispatches together — React 18 batches into a single render
      dispatch({ type: 'SET_PROJECTS', payload: projects });
      dispatch({ type: 'SET_REQUESTS', payload: allRequests });
      dispatch({ type: 'SET_FOLDERS', payload: allFolders });
      dispatch({ type: 'SET_ENVIRONMENTS', payload: allEnvs });
      dispatch({ type: 'SET_AUTOMATIONS', payload: allAutomations });
      dispatch({ type: 'SET_DATA_FILES', payload: allDataFiles });
      dispatch({ type: 'SET_CURRENT_PROJECT', payload: initialProjectId });
      if (restoredReqId != null) {
        dispatch({ type: 'SET_CURRENT_REQUEST', payload: restoredReqId });
      }
    });
  }, [dispatch, loadUserProjects, loadUserRequests, loadFolders, listEnvironments, listAutomations, listDataFiles]);

  // Persist current project across sessions
  useEffect(() => {
    if (state.currentProjectId != null) {
      localStorage.setItem('callstack.currentProjectId', String(state.currentProjectId));
    }
  }, [state.currentProjectId]);

  // Show window and fade splash when app is ready
  useEffect(() => {
    if (state.projects.length > 0 && !ready) {
      (async () => {
        try {
          const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow');
          const window = getCurrentWebviewWindow();
          await window.show();
        } catch {
          // Not in Tauri (dev mode), safe to ignore
        }
        setReady(true);
      })();
    }
  }, [state.projects.length, ready]);

  // Load last response whenever selected request changes
  useEffect(() => {
    if (state.currentRequestId == null) return;
    getLastResponse(state.currentRequestId).then((response) => {
      dispatch({ type: 'SET_RESPONSE', payload: response });
    }).catch(() => {});
  }, [state.currentRequestId]);

  // Persist sidebar state across restarts
  useEffect(() => {
    if (state.currentRequestId != null) {
      localStorage.setItem('callstack.currentRequestId', String(state.currentRequestId));
    }
  }, [state.currentRequestId]);

  useEffect(() => {
    localStorage.setItem('callstack.expandedProjects', JSON.stringify([...state.expandedProjects]));
  }, [state.expandedProjects]);

  useEffect(() => {
    localStorage.setItem('callstack.expandedFolders', JSON.stringify([...state.expandedFolders]));
  }, [state.expandedFolders]);

  // F-key shortcuts (navigate to request)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!/^F([1-9]|1[0-2])$/.test(e.key)) return;
      try {
        const raw = localStorage.getItem('callstack.shortcuts');
        const shortcuts: { [fkey: string]: number } = raw ? JSON.parse(raw) : {};
        const requestId = shortcuts[e.key];
        if (requestId != null) {
          e.preventDefault();
          dispatch({ type: 'SET_CURRENT_REQUEST', payload: requestId });
        }
      } catch {}
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  // Action shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Copy shortcut works everywhere (even in editors) — copies active pane
      if (matchesShortcut(e, settings.shortcuts.copyResponse)) {
        if (window.getSelection()?.toString()) return; // let browser copy selection
        e.preventDefault();

        if (activePane === 'request') {
          const currentReq = state.requests.find(r => r.id === state.currentRequestId);
          const body = currentReq?.body?.trim();
          if (body) {
            const ct = currentReq!.headers.find(h => h.key.toLowerCase() === 'content-type')?.value ?? '';
            navigator.clipboard.writeText(formatBody(currentReq!.body, ct));
            setCopyFlashPane('request');
            setTimeout(() => setCopyFlashPane(null), 1200);
          } else {
            setErrorMessage('No request body to copy.');
          }
        } else {
          const body = state.currentResponse?.body?.trim();
          if (body) {
            const ct = state.currentResponse!.headers.find(h => h.key.toLowerCase() === 'content-type')?.value ?? '';
            navigator.clipboard.writeText(formatBody(state.currentResponse!.body, ct));
            setCopyFlashPane('response');
            setTimeout(() => setCopyFlashPane(null), 1200);
          } else {
            setErrorMessage('No response to copy.');
          }
        }
        return;
      }

      // Don't fire when typing in inputs / textareas
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;

      if (matchesShortcut(e, settings.shortcuts.execute)) {
        e.preventDefault();
        executeRef.current?.();
        return;
      }

      const currentId = state.currentRequestId;

      if (matchesShortcut(e, settings.shortcuts.newRequest)) {
        e.preventDefault();
        const projectId = state.currentProjectId;
        if (projectId == null) return;
        createRequest(projectId, null, 'New Request', null).then((req) => {
          dispatch({ type: 'ADD_REQUEST', payload: req });
          dispatch({ type: 'SET_CURRENT_REQUEST', payload: req.id });
          setExternalRenameId(req.id);
          setTimeout(() => setExternalRenameId(null), 50);
        });
        return;
      }

      if (currentId == null) return;

      if (matchesShortcut(e, settings.shortcuts.rename)) {
        e.preventDefault();
        setExternalRenameId(currentId);
        setTimeout(() => setExternalRenameId(null), 50);
        return;
      }

      if (matchesShortcut(e, settings.shortcuts.cloneRequest)) {
        e.preventDefault();
        duplicateRequest(currentId).then((req) => {
          dispatch({ type: 'ADD_REQUEST', payload: req });
          dispatch({ type: 'SET_CURRENT_REQUEST', payload: req.id });
        });
        return;
      }

      if (matchesShortcut(e, settings.shortcuts.saveResponse)) {
        e.preventDefault();
        const body = state.currentResponse?.body?.trim();
        if (body) {
          invoke('save_file', { filename: 'response.txt', content: state.currentResponse!.body }).catch(console.error);
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings.shortcuts, state.currentRequestId, state.currentProjectId, state.currentResponse, state.requests, activePane, createRequest, duplicateRequest, dispatch]);

  useEffect(() => {
    if (errorMessage == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        setErrorMessage(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [errorMessage]);

  const currentRequest = state.requests.find((r) => r.id === state.currentRequestId) || null;

  const gridCols = sidebarCollapsed ? `0px 0px 1fr` : `${sidebarWidth}px 4px 1fr`;

  return (
    <div className={styles.app} style={{ zoom: settings.zoom }}>
      <div className={styles.body}>
      <div className={styles.content} style={{ gridTemplateColumns: gridCols }}>
        <div className={styles.sidebarWrap}>
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            externalRenameRequestId={externalRenameId}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
        <div
          className={styles.resizeHandle}
          onMouseDown={sidebarCollapsed ? undefined : startSidebarResize}
        />
        <div className={styles.rightPanel}>
          <div className={styles.main}>
            {state.activeView === 'automation' && state.activeAutomationId !== null ? (
              <AutomationView
                automationId={state.activeAutomationId}
                showExpandBtn={sidebarCollapsed}
                onExpand={() => setSidebarCollapsed(false)}
              />
            ) : state.activeView === 'environment' && state.activeEnvironmentId !== null ? (
              <EnvironmentView
                environmentId={state.activeEnvironmentId}
                showExpandBtn={sidebarCollapsed}
                onExpand={() => setSidebarCollapsed(false)}
              />
            ) : state.activeView === 'dataFile' && state.activeDataFileId !== null ? (
              <DataFileView
                dataFileId={state.activeDataFileId}
                showExpandBtn={sidebarCollapsed}
                onExpand={() => setSidebarCollapsed(false)}
              />
            ) : currentRequest ? (
              <RequestBuilder
                request={currentRequest}
                showExpandBtn={sidebarCollapsed}
                onExpand={() => setSidebarCollapsed(false)}
                executeRef={executeRef}
                copyFlashPane={copyFlashPane}
                onCopyResponse={() => {
                  setCopyFlashPane('response');
                  setTimeout(() => setCopyFlashPane(null), 1200);
                }}
                onRequestFocus={() => setActivePane('request')}
                onResponseFocus={() => setActivePane('response')}
              />
            ) : (
              <div className={styles.emptyState}>
                {sidebarCollapsed && (
                  <button
                    className={styles.floatingExpand}
                    onClick={() => setSidebarCollapsed(false)}
                    title="Show navigator"
                  >
                    ›
                  </button>
                )}
                <h2>Welcome to Callstack</h2>
                <p>Select a request from the sidebar or create a new one to get started.</p>
              </div>
            )}
          </div>
          <Footer />
        </div>
      </div>
      </div>
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSetZoom={setZoom}
          onSetShortcut={setShortcut}
          onReset={resetSettings}
          onResetAll={() => invoke('reset_all_data')}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {errorMessage && (
        <div className={styles.confirmOverlay} onClick={() => setErrorMessage(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <p>{errorMessage}</p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmDelete} onClick={() => setErrorMessage(null)}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
