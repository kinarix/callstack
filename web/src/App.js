import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    const startSidebarResize = useCallback((e) => {
        const startX = e.clientX;
        const startW = sidebarWidth;
        const onMove = (e) => {
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
            if (projects.length === 0)
                return;
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
    const currentRequest = state.requests.find((r) => r.id === state.currentRequestId) || null;
    const gridCols = sidebarCollapsed ? `0px 0px 1fr` : `${sidebarWidth}px 4px 1fr`;
    return (_jsxs("div", { className: styles.app, children: [_jsx(Header, {}), _jsxs("div", { className: styles.body, children: [_jsxs("div", { className: styles.content, style: { gridTemplateColumns: gridCols }, children: [_jsx("div", { className: styles.sidebarWrap, children: _jsx(Sidebar, { collapsed: sidebarCollapsed, onToggleCollapse: () => setSidebarCollapsed((c) => !c) }) }), _jsx("div", { className: styles.resizeHandle, onMouseDown: sidebarCollapsed ? undefined : startSidebarResize }), _jsx("div", { className: styles.main, children: currentRequest ? (_jsx(RequestBuilder, { request: currentRequest, showExpandBtn: sidebarCollapsed, onExpand: () => setSidebarCollapsed(false) })) : (_jsxs("div", { className: styles.emptyState, children: [sidebarCollapsed && (_jsx("button", { className: styles.floatingExpand, onClick: () => setSidebarCollapsed(false), title: "Show navigator", children: "\u203A" })), _jsx("h2", { children: "Welcome to Callstack" }), _jsx("p", { children: "Select a request from the sidebar or create a new one to get started." })] })) })] }), _jsx(Footer, {})] })] }));
}
export default function App() {
    return (_jsx(AppProvider, { children: _jsx(AppContent, {}) }));
}
