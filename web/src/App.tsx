import { useEffect, useState, useCallback } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header/Header';
import { Sidebar } from './components/Sidebar/Sidebar';
import { RequestBuilder } from './components/RequestBuilder/RequestBuilder';
import { Footer } from './components/Footer/Footer';
import styles from './App.module.css';
import { useDatabase } from './hooks/useDatabase';
import { useAuth } from './hooks/useAuth';

function AppContent() {
  const { state, dispatch } = useApp();
  const { loadUserProjects, loadUserRequests, loadFolders, listEnvironments } = useDatabase();
  useAuth();

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
    const email = state.currentUser?.email ?? null;
    loadUserProjects(email).then(async (projects) => {
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
    });
  }, [state.currentUser?.email, dispatch, loadUserProjects, loadUserRequests, loadFolders, listEnvironments]);

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

  const currentRequest = state.requests.find((r) => r.id === state.currentRequestId) || null;

  const gridCols = sidebarCollapsed ? `0px 0px 1fr` : `${sidebarWidth}px 4px 1fr`;

  return (
    <div className={styles.app}>
      <Header />
      <div className={styles.body}>
      <div className={styles.content} style={{ gridTemplateColumns: gridCols }}>
        <div className={styles.sidebarWrap}>
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
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
