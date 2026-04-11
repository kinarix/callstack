import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { getStatusColor, formatBytes } from '../../lib/utils';
import styles from './Footer.module.css';
function formatTimestamp(ts) {
    const d = new Date(ts);
    const yyyy = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mo}-${dd} ${h}:${m}:${s}`;
}
function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }
        catch {
            // fallback: select text
        }
    };
    return (_jsx("button", { className: styles.copyBtn, onClick: handleCopy, title: "Copy curl command", children: copied ? '✓' : 'Copy' }));
}
function LogRow({ entry }) {
    const [expanded, setExpanded] = useState(false);
    const statusColor = entry.status ? getStatusColor(entry.status) : '#6b7280';
    return (_jsxs("div", { className: `${styles.logRow} ${entry.error ? styles.logRowError : ''}`, children: [_jsxs("div", { className: styles.logSummary, onClick: () => setExpanded(e => !e), children: [_jsx("span", { className: styles.logChevron, children: expanded ? '▾' : '▸' }), _jsx("span", { className: styles.logTime, children: formatTimestamp(entry.timestamp) }), _jsx("span", { className: `${styles.logMethod} ${styles[`method${entry.method}`]}`, children: entry.method }), _jsx("span", { className: styles.logUrl, children: entry.url }), entry.error ? (_jsx("span", { className: styles.logError, children: entry.error })) : (_jsxs(_Fragment, { children: [_jsxs("span", { className: styles.logStatus, style: { backgroundColor: statusColor }, children: [entry.status, " ", entry.statusText] }), entry.time != null && (_jsxs("span", { className: styles.logMeta, children: [entry.time, "ms"] })), entry.size != null && (_jsx("span", { className: styles.logMeta, children: formatBytes(entry.size) }))] }))] }), expanded && (_jsxs("div", { className: styles.logDetail, children: [_jsxs("div", { className: styles.curlHeader, children: [_jsx("span", { className: styles.curlLabel, children: "curl" }), _jsx(CopyButton, { text: entry.curl })] }), _jsx("pre", { className: styles.curlPre, children: entry.curl })] }))] }));
}
const MIN_HEIGHT = 80;
const MAX_HEIGHT = 500;
const DEFAULT_HEIGHT = 180;
export function Footer() {
    const { state, dispatch } = useApp();
    const [open, setOpen] = useState(false);
    const [height, setHeight] = useState(() => {
        const v = localStorage.getItem('callstack.footerHeight');
        return v ? parseInt(v, 10) : DEFAULT_HEIGHT;
    });
    const bottomRef = useRef(null);
    const prevLogCount = useRef(state.logs.length);
    // Auto-scroll to bottom when new log arrives
    useEffect(() => {
        if (state.logs.length > prevLogCount.current && open) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        prevLogCount.current = state.logs.length;
    }, [state.logs.length, open]);
    const startResize = useCallback((e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startH = height;
        const onMove = (ev) => {
            const h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startH - (ev.clientY - startY)));
            setHeight(h);
            localStorage.setItem('callstack.footerHeight', String(h));
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }, [height]);
    return (_jsxs("div", { className: styles.footer, children: [_jsx("div", { className: styles.footerHandle, onMouseDown: open ? startResize : undefined }), _jsxs("div", { className: styles.footerBar, onClick: () => setOpen(o => !o), children: [_jsx("span", { className: styles.footerTitle, children: "Logs" }), state.logs.length > 0 && (_jsx("span", { className: styles.logCount, children: state.logs.length })), !open && state.logs.length > 0 && (() => {
                        const last = state.logs[state.logs.length - 1];
                        return (_jsxs("span", { className: styles.lastRequestSummary, children: [_jsx("span", { className: styles.lastMethod, style: { color: `var(--accent-${last.method.toLowerCase()}, var(--accent))` }, children: last.method }), _jsx("span", { className: styles.lastUrl, children: last.url }), last.status != null && (_jsx("span", { className: styles.lastStatus, "data-ok": last.status < 400, children: last.status })), last.time != null && (_jsxs("span", { className: styles.lastTime, children: [last.time, "ms"] }))] }));
                    })(), _jsx("div", { className: styles.footerBarSpacer }), open && state.logs.length > 0 && (_jsx("button", { className: styles.clearBtn, onClick: (e) => { e.stopPropagation(); dispatch({ type: 'CLEAR_LOGS' }); }, children: "Clear" })), _jsx("button", { className: styles.expandCollapseBtn, onClick: (e) => { e.stopPropagation(); setOpen(o => !o); }, title: open ? 'Collapse logs' : 'Expand logs', children: _jsx("svg", { className: `${styles.expandChevron} ${open ? styles.expandChevronOpen : ''}`, width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", "aria-hidden": true, children: _jsx("path", { d: "M2.5 7.5L6 4L9.5 7.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) }) })] }), open && (_jsx("div", { className: styles.logList, style: { height }, children: state.logs.length === 0 ? (_jsx("div", { className: styles.emptyLogs, children: "No requests yet" })) : (_jsxs(_Fragment, { children: [state.logs.map(entry => (_jsx(LogRow, { entry: entry }, entry.id))), _jsx("div", { ref: bottomRef })] })) }))] }));
}
