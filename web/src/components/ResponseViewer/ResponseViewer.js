import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
function PinIcon({ pinned }) {
    return (_jsx("svg", { width: "11", height: "11", viewBox: "0 0 11 11", fill: "none", "aria-hidden": true, children: pinned ? (_jsxs(_Fragment, { children: [_jsx("path", { d: "M7 1.5L9.5 4L7 6.5H5L3 8.5V6.5H1L3.5 4V1.5H7Z", fill: "currentColor" }), _jsx("line", { x1: "3", y1: "8.5", x2: "1.5", y2: "10", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] })) : (_jsxs(_Fragment, { children: [_jsx("path", { d: "M7 1.5L9.5 4L7 6.5H5L3 8.5V6.5H1L3.5 4V1.5H7Z", stroke: "currentColor", strokeWidth: "1.2", strokeLinejoin: "round" }), _jsx("line", { x1: "3", y1: "8.5", x2: "1.5", y2: "10", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] })) }));
}
import { getStatusColor, formatBytes } from '../../lib/utils';
import styles from './ResponseViewer.module.css';
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
function getContentType(headers) {
    const ct = headers.find(h => h.key.toLowerCase() === 'content-type');
    return ct ? ct.value.toLowerCase() : '';
}
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function highlightJson(json) {
    const escaped = escapeHtml(json);
    return escaped.replace(/("(?:\\.|[^"\\])*"(?:\s*:)?|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, (match) => {
        if (match.endsWith(':')) {
            return `<span class="hl-key">${match}</span>`;
        }
        if (match.startsWith('"')) {
            return `<span class="hl-string">${match}</span>`;
        }
        if (match === 'true' || match === 'false') {
            return `<span class="hl-bool">${match}</span>`;
        }
        if (match === 'null') {
            return `<span class="hl-null">${match}</span>`;
        }
        return `<span class="hl-number">${match}</span>`;
    });
}
function formatXml(xml) {
    try {
        const lines = xml.replace(/>\s*</g, '>\n<').split('\n');
        let level = 0;
        return lines
            .map(line => {
            line = line.trim();
            if (!line)
                return '';
            if (line.startsWith('</')) {
                level = Math.max(0, level - 1);
                return '  '.repeat(level) + line;
            }
            const indented = '  '.repeat(level) + line;
            if (!line.startsWith('<?') && !line.startsWith('<!--') && !line.endsWith('/>') && !/<[^>]+\/>/.test(line) && !line.includes('</')) {
                level++;
            }
            return indented;
        })
            .filter(Boolean)
            .join('\n');
    }
    catch {
        return xml;
    }
}
function normalizeLineEndings(s) {
    return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
function renderBody(body, contentType) {
    const text = normalizeLineEndings(body);
    if (contentType.includes('json')) {
        try {
            const parsed = JSON.parse(text);
            const pretty = JSON.stringify(parsed, null, 2);
            return { html: true, content: highlightJson(pretty), label: 'JSON' };
        }
        catch {
            return { html: false, content: text, label: 'JSON (invalid)' };
        }
    }
    if (contentType.includes('xml') || contentType.includes('html')) {
        const label = contentType.includes('html') ? 'HTML' : 'XML';
        return { html: false, content: formatXml(text), label };
    }
    return { html: false, content: text, label: contentType.split(';')[0].split('/')[1]?.toUpperCase() ?? 'Text' };
}
function isPreviewable(contentType) {
    return contentType.includes('html') || contentType.includes('image/') || contentType.includes('video/') || contentType.includes('audio/');
}
export function ResponseViewer({ response, requestName, onClear }) {
    const [tab, setTab] = useState('body');
    const [headersPinned, setHeadersPinned] = useState(false);
    useEffect(() => {
        if (response) {
            const contentType = getContentType(response.headers);
            // Reset to body if current tab (preview) is no longer valid
            if (tab === 'preview' && !isPreviewable(contentType)) {
                setTab('body');
            }
            else if (!tab || tab === 'body' || tab === 'headers') {
                // Keep current tab selection if valid
                if (!response.body.trim() && tab === 'body') {
                    setTab('headers');
                }
            }
            setHeadersPinned(false);
        }
    }, [response]);
    const getFileExtension = (contentType) => {
        if (contentType.includes('json'))
            return 'json';
        if (contentType.includes('xml'))
            return 'xml';
        if (contentType.includes('html'))
            return 'html';
        if (contentType.includes('plain'))
            return 'txt';
        if (contentType.includes('csv'))
            return 'csv';
        if (contentType.includes('pdf'))
            return 'pdf';
        return 'txt';
    };
    const handleCopy = async () => {
        if (response?.body) {
            await navigator.clipboard.writeText(response.body);
        }
    };
    const handleClear = () => {
        onClear?.();
    };
    const handleSave = async () => {
        if (!response?.body || !response.body.trim())
            return;
        const contentType = response.headers
            ?.find((h) => h.key.toLowerCase() === 'content-type')?.value || 'text/plain';
        const ext = getFileExtension(contentType);
        const filename = `${requestName || 'response'}.${ext}`;
        try {
            await invoke('save_file', { filename, content: response.body });
        }
        catch (err) {
            console.error('Failed to save response:', err);
        }
    };
    if (!response) {
        return (_jsxs("div", { className: styles.viewerEmpty, children: [_jsx("div", { className: styles.sectionLabel, children: "Response" }), _jsx("div", { className: styles.emptyMessage, children: "Send a request to see the response" })] }));
    }
    const statusColor = getStatusColor(response.status);
    const contentType = getContentType(response.headers ?? []);
    const { html, content, label } = renderBody(response.body, contentType);
    return (_jsxs("div", { className: styles.viewer, children: [_jsxs("div", { className: styles.header, children: [_jsx("span", { className: styles.sectionLabel, children: "Response" }), _jsx("div", { className: styles.status, style: { backgroundColor: statusColor }, children: response.statusText || response.status }), _jsxs("div", { className: styles.info, children: [_jsxs("span", { className: styles.infoItem, children: ["Time: ", _jsxs("strong", { children: [response.time, "ms"] })] }), _jsxs("span", { className: styles.infoItem, children: ["Size: ", _jsx("strong", { children: formatBytes(response.size) })] }), response.timestamp != null && (_jsxs("span", { className: styles.infoItem, children: ["At: ", _jsx("strong", { children: formatTimestamp(response.timestamp) })] }))] }), _jsx("div", { className: styles.spacer }), contentType && _jsx("span", { className: styles.typeBadge, children: label })] }), _jsxs("div", { className: styles.tabs, children: [_jsx("button", { className: `${styles.tab} ${tab === 'body' ? styles.tabActive : ''}`, onClick: () => setTab('body'), children: "Body" }), isPreviewable(getContentType(response.headers)) && (_jsx("button", { className: `${styles.tab} ${tab === 'preview' ? styles.tabActive : ''}`, onClick: () => setTab('preview'), children: "Preview" })), _jsxs("div", { className: styles.tabGroup, children: [_jsxs("button", { className: `${styles.tab} ${tab === 'headers' ? styles.tabActive : ''}`, onClick: () => setTab('headers'), children: ["Headers", response.headers?.length > 0 && (_jsx("span", { className: styles.tabCount, children: response.headers.length }))] }), _jsx("button", { className: `${styles.pinBtn} ${headersPinned ? styles.pinActive : ''}`, onClick: () => setHeadersPinned(p => !p), title: headersPinned ? 'Unpin Headers' : 'Pin Headers (always visible)', children: _jsx(PinIcon, { pinned: headersPinned }) })] })] }), headersPinned && tab === 'body' && (_jsxs("div", { className: styles.pinnedPanel, children: [_jsxs("div", { className: styles.pinnedHeader, children: [_jsx("span", { children: "Headers" }), _jsx("span", { className: styles.pinnedBadge, children: "pinned" })] }), _jsx("div", { className: styles.pinnedContent, children: response.headers?.length > 0 ? (_jsx("div", { className: styles.headers, children: response.headers.map((header, i) => (_jsxs("div", { className: styles.headerRow, children: [_jsx("span", { className: styles.headerKey, children: header.key }), _jsx("span", { className: styles.headerValue, children: header.value })] }, i))) })) : (_jsx("div", { className: styles.emptyMessage, children: "No headers" })) })] })), tab === 'body' && (_jsx("div", { className: styles.body, children: _jsxs("div", { className: styles.preWrapper, children: [_jsxs("div", { className: styles.floatingButtons, children: [_jsx("button", { className: styles.floatingBtn, onClick: handleCopy, title: "Copy response body", children: "Copy" }), _jsx("button", { className: styles.floatingBtn, onClick: handleSave, title: "Save response to file", children: "Save" }), _jsx("button", { className: styles.floatingBtn, onClick: handleClear, title: "Clear response", children: "Clear" })] }), html ? (_jsx("pre", { className: styles.pre, dangerouslySetInnerHTML: { __html: content } })) : (_jsx("pre", { className: styles.pre, children: content }))] }) })), tab === 'headers' && (_jsx("div", { className: styles.headerList, children: _jsxs("div", { className: styles.headersWrapper, children: [_jsxs("div", { className: styles.floatingButtons, children: [_jsx("button", { className: styles.floatingBtn, onClick: handleCopy, title: "Copy response body", children: "Copy" }), _jsx("button", { className: styles.floatingBtn, onClick: handleSave, title: "Save response to file", children: "Save" }), _jsx("button", { className: styles.floatingBtn, onClick: handleClear, title: "Clear response", children: "Clear" })] }), response.headers?.length > 0 ? (_jsx("div", { className: styles.headers, children: response.headers.map((header, i) => (_jsxs("div", { className: styles.headerRow, children: [_jsx("span", { className: styles.headerKey, children: header.key }), _jsx("span", { className: styles.headerValue, children: header.value })] }, i))) })) : (_jsx("div", { className: styles.emptyMessage, children: "No headers" }))] }) })), tab === 'preview' && (_jsx("div", { className: styles.preview, children: (() => {
                    const ct = getContentType(response.headers);
                    if (ct.includes('html')) {
                        return (_jsx("iframe", { srcDoc: response.body, sandbox: "allow-same-origin allow-scripts", className: styles.previewFrame }));
                    }
                    if (ct.includes('image/')) {
                        return (_jsx("img", { src: `data:${ct};base64,${response.body}`, className: styles.previewImage, alt: "Preview" }));
                    }
                    if (ct.includes('video/')) {
                        return (_jsx("video", { src: `data:${ct};base64,${response.body}`, controls: true, className: styles.previewMedia }));
                    }
                    if (ct.includes('audio/')) {
                        return (_jsx("audio", { src: `data:${ct};base64,${response.body}`, controls: true, className: styles.previewMedia }));
                    }
                    return null;
                })() }))] }));
}
