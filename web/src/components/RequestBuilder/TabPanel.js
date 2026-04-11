import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { KeyValueEditor } from './KeyValueEditor';
import { BodyEditor } from './BodyEditor';
import { FileUpload } from './FileUpload';
import styles from './TabPanel.module.css';
const PINNABLE = ['params', 'headers', 'files'];
const STORAGE_KEY_PREFIX = 'callstack.pinnedTabs.';
function loadPinned(requestId) {
    try {
        const key = STORAGE_KEY_PREFIX + requestId;
        const stored = localStorage.getItem(key);
        if (stored) {
            const arr = JSON.parse(stored);
            return new Set(arr.filter((t) => PINNABLE.includes(t)));
        }
    }
    catch { }
    return new Set();
}
function savePinned(requestId, pinned) {
    const key = STORAGE_KEY_PREFIX + requestId;
    localStorage.setItem(key, JSON.stringify([...pinned]));
}
function detectContentType(body) {
    const trimmed = body.trim();
    if (!trimmed)
        return '';
    try {
        JSON.parse(trimmed);
        return 'application/json';
    }
    catch { }
    if (trimmed.startsWith('<'))
        return 'application/xml';
    if (/^[\w%+.-]+=/.test(trimmed) && !trimmed.includes('{') && !trimmed.includes('[')) {
        return 'application/x-www-form-urlencoded';
    }
    return 'text/plain';
}
function getContentType(headers) {
    return headers.find(h => h.key.toLowerCase() === 'content-type')?.value ?? '';
}
function upsertContentType(headers, value) {
    const idx = headers.findIndex(h => h.key.toLowerCase() === 'content-type');
    if (value === '') {
        return idx >= 0 ? headers.filter((_, i) => i !== idx) : headers;
    }
    if (idx >= 0) {
        const next = [...headers];
        next[idx] = { ...next[idx], value };
        return next;
    }
    return [...headers, { key: 'Content-Type', value, enabled: true }];
}
function PinIcon({ pinned }) {
    return (_jsx("svg", { width: "11", height: "11", viewBox: "0 0 11 11", fill: "none", "aria-hidden": true, children: pinned ? (_jsxs(_Fragment, { children: [_jsx("path", { d: "M7 1.5L9.5 4L7 6.5H5L3 8.5V6.5H1L3.5 4V1.5H7Z", fill: "currentColor" }), _jsx("line", { x1: "3", y1: "8.5", x2: "1.5", y2: "10", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] })) : (_jsxs(_Fragment, { children: [_jsx("path", { d: "M7 1.5L9.5 4L7 6.5H5L3 8.5V6.5H1L3.5 4V1.5H7Z", stroke: "currentColor", strokeWidth: "1.2", strokeLinejoin: "round" }), _jsx("line", { x1: "3", y1: "8.5", x2: "1.5", y2: "10", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] })) }));
}
export function TabPanel({ request, onRequestChange, files, onFilesChange }) {
    const [activeTab, setActiveTab] = useState('params');
    const [pinned, setPinned] = useState(() => request ? loadPinned(request.id) : new Set());
    useEffect(() => {
        if (request) {
            setPinned(loadPinned(request.id));
        }
    }, [request?.id]);
    if (!request) {
        return _jsx("div", { className: styles.empty, children: "Select a request to get started" });
    }
    const togglePin = (panel) => {
        setPinned(prev => {
            const next = new Set(prev);
            next.has(panel) ? next.delete(panel) : next.add(panel);
            savePinned(request.id, next);
            return next;
        });
    };
    const handleBodyChange = (body) => {
        const changes = { body };
        const currentCt = getContentType(request.headers);
        if (!currentCt) {
            const detected = detectContentType(body);
            if (detected) {
                changes.headers = upsertContentType(request.headers, detected);
            }
        }
        onRequestChange(changes);
    };
    const handleContentTypeChange = (value) => {
        onRequestChange({ headers: upsertContentType(request.headers, value) });
    };
    const currentContentType = getContentType(request.headers);
    const TABS = [
        { name: 'params', label: 'Params', count: request.params.filter(p => p.key).length || undefined },
        { name: 'headers', label: 'Headers', count: request.headers.filter(h => h.key).length || undefined },
        { name: 'files', label: 'Files', count: files.length || undefined },
        { name: 'body', label: 'Body' },
    ];
    function renderPinnedContent(p) {
        if (p === 'params') {
            return _jsx(KeyValueEditor, { items: request.params, onChange: (params) => onRequestChange({ params }) });
        }
        if (p === 'headers') {
            return _jsx(KeyValueEditor, { items: request.headers, onChange: (headers) => onRequestChange({ headers }) });
        }
        return _jsx(FileUpload, { files: files, onChange: onFilesChange });
    }
    function renderTabLabel(p) {
        if (p === 'params')
            return 'Params';
        if (p === 'headers')
            return 'Headers';
        return 'Files';
    }
    return (_jsxs("div", { className: styles.tabPanel, children: [_jsxs("div", { className: styles.tabBar, children: [_jsx("span", { className: styles.sectionLabel, children: "Request" }), TABS.map((tab) => {
                        const isPinnable = PINNABLE.includes(tab.name);
                        const isPinned = pinned.has(tab.name);
                        return (_jsxs("div", { className: styles.tabGroup, children: [_jsxs("button", { className: `${styles.tab} ${activeTab === tab.name ? styles.active : ''}`, onClick: () => setActiveTab(tab.name), children: [tab.label, tab.count != null && (_jsx("span", { className: styles.count, children: tab.count }))] }), isPinnable && (_jsx("button", { className: `${styles.pinBtn} ${isPinned ? styles.pinActive : ''}`, onClick: () => togglePin(tab.name), title: isPinned ? `Unpin ${tab.label}` : `Pin ${tab.label} (always visible)`, children: _jsx(PinIcon, { pinned: isPinned }) }))] }, tab.name));
                    })] }), PINNABLE
                .filter(p => pinned.has(p) && activeTab !== p)
                .map(p => (_jsxs("div", { className: styles.pinnedPanel, children: [_jsxs("div", { className: styles.pinnedHeader, children: [_jsx("span", { children: renderTabLabel(p) }), _jsx("span", { className: styles.pinnedBadge, children: "pinned" })] }), _jsx("div", { className: styles.pinnedContent, children: renderPinnedContent(p) })] }, p))), _jsxs("div", { className: styles.content, children: [activeTab === 'params' && (_jsx(KeyValueEditor, { items: request.params, onChange: (params) => onRequestChange({ params }) })), activeTab === 'headers' && (_jsx(KeyValueEditor, { items: request.headers, onChange: (headers) => onRequestChange({ headers }) })), activeTab === 'body' && (_jsx(BodyEditor, { body: request.body, contentType: currentContentType, onChange: handleBodyChange, onContentTypeChange: handleContentTypeChange })), activeTab === 'files' && (_jsx(FileUpload, { files: files, onChange: onFilesChange }))] })] }));
}
