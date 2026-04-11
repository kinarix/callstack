import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef } from 'react';
import styles from './FileUpload.module.css';
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export function FileUpload({ files, onChange }) {
    const inputRef = useRef(null);
    const handleFileSelect = (e) => {
        const selected = Array.from(e.target.files ?? []);
        if (!selected.length)
            return;
        const attachments = selected.map((file) => {
            const tauriFile = file;
            const path = tauriFile.path || '';
            return {
                name: file.name,
                size: file.size,
                mime: file.type || 'application/octet-stream',
                path,
            };
        });
        onChange([...files, ...attachments]);
        e.target.value = '';
    };
    const handleRemove = (index) => {
        onChange(files.filter((_, i) => i !== index));
    };
    return (_jsxs("div", { className: styles.container, children: [_jsx("input", { ref: inputRef, type: "file", multiple: true, className: styles.hiddenInput, onChange: handleFileSelect }), _jsxs("div", { className: styles.toolbar, children: [_jsx("button", { className: styles.addBtn, onClick: () => inputRef.current?.click(), children: "+ Add Files" }), files.length > 0 && (_jsx("button", { className: styles.clearBtn, onClick: () => onChange([]), children: "Clear all" }))] }), files.length === 0 ? (_jsx("div", { className: styles.empty, children: "No files attached. Click \"Add Files\" to upload." })) : (_jsx("div", { className: styles.list, children: files.map((f, i) => (_jsxs("div", { className: styles.item, children: [_jsx("span", { className: styles.fileName, children: f.name }), _jsxs("span", { className: styles.fileMeta, children: [f.mime, " \u00B7 ", formatBytes(f.size)] }), _jsx("button", { className: styles.removeBtn, onClick: () => handleRemove(i), title: "Remove file", children: "\u00D7" })] }, i))) }))] }));
}
