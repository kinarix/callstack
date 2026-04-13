import { useEffect, useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { RequestBuilder } from './components/RequestBuilder/RequestBuilder';
import { Footer } from './components/Footer/Footer';
import { SettingsModal } from './components/SettingsModal/SettingsModal';
import styles from './App.module.css';
import { useDatabase } from './hooks/useDatabase';
import { useSettings, matchesShortcut } from './hooks/useSettings';

function AppContent() {
  const { state, dispatch } = useApp();
  const { loadUserProjects, loadUserRequests, loadFolders, listEnvironments, createRequest, duplicateRequest, getLastResponse } = useDatabase();
  const { settings, setZoom, setShortcut, resetSettings } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const executeRef = useRef<(() => void) | null>(null);
  const [externalRenameId, setExternalRenameId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyFlash, setCopyFlash] = useState(false);
  const [ready, setReady] = useState(false);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const v = localStorage.getItem('callstack.sidebarWidth');
    return v ? parseInt(v, 10) : 280;
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const startSidebarResize = useCallback((e: React.MouseEvent) => {
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (e: MouseEvent) => {
      const w = Math.max(180, Math.min(480, startW + e.clientX - startX));
      setSidebarWidth(w);
      localStorage.setItem('callstack.sidebarWidth', String(w));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  useEffect(() => {
    loadUserProjects(null).then(async (projects) => {
      dispatch({ type: 'SET_PROJECTS', payload: projects });
      if (projects.length > 0 && !state.currentProjectId) {
        dispatch({ type: 'SET_CURRENT_PROJECT', payload: projects[0].id });
      }
      if (projects.length === 0) return;
      const [allRequests, allFolders, allEnvs] = await Promise.all([
        Promise.all(projects.map((p) => loadUserRequests(p.id))).then((r) => r.flat()),
        Promise.all(projects.map((p) => loadFolders(p.id))).then((r) => r.flat()),
        Promise.all(projects.map((p) => listEnvironments(p.id))).then((r) => r.flat()),
      ]);
      dispatch({ type: 'SET_REQUESTS', payload: allRequests });
      dispatch({ type: 'SET_FOLDERS', payload: allFolders });
      dispatch({ type: 'SET_ENVIRONMENTS', payload: allEnvs });

      // Restore last selected request
      const savedId = localStorage.getItem('callstack.currentRequestId');
      if (savedId) {
        const id = parseInt(savedId, 10);
        const req = allRequests.find((r) => r.id === id);
        if (req) {
          dispatch({ type: 'SET_CURRENT_REQUEST', payload: id });
        }
      }
    });
  }, [dispatch, loadUserProjects, loadUserRequests, loadFolders, listEnvironments]);

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
      // Copy response shortcut works everywhere (even in editors)
      if (matchesShortcut(e, settings.shortcuts.copyResponse)) {
        if (window.getSelection()?.toString()) return; // let browser copy selection
        e.preventDefault();
        const body = state.currentResponse?.body?.trim();
        if (body) {
          navigator.clipboard.writeText(state.currentResponse!.body);
          setCopyFlash(true);
          setTimeout(() => setCopyFlash(false), 1200);
        } else {
          setErrorMessage('No response to copy.');
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
  }, [settings.shortcuts, state.currentRequestId, state.currentProjectId, state.currentResponse, createRequest, duplicateRequest, dispatch]);

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
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <div className={styles.body}>
      <div className={styles.content} style={{ gridTemplateColumns: gridCols }}>
        <div className={styles.sidebarWrap}>
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            externalRenameRequestId={externalRenameId}
          />
        </div>
        <div
          className={styles.resizeHandle}
          onMouseDown={sidebarCollapsed ? undefined : startSidebarResize}
        />
        <div className={styles.main}>
          {currentRequest ? (
            <RequestBuilder
              request={currentRequest}
              showExpandBtn={sidebarCollapsed}
              onExpand={() => setSidebarCollapsed(false)}
              executeRef={executeRef}
              copyFlash={copyFlash}
              onCopyResponse={() => {
                setCopyFlash(true);
                setTimeout(() => setCopyFlash(false), 1200);
              }}
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
      </div>
      <Footer />
      </div>
      {settingsOpen && (
        <SettingsModal
          settings={settings}
          onSetZoom={setZoom}
          onSetShortcut={setShortcut}
          onReset={resetSettings}
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
