import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { MethodBadge } from '../MethodBadge/MethodBadge';
import styles from './RequestItem.module.css';
function MethodIcon({ method }) {
    const baseProps = { width: '11', height: '13', viewBox: '0 0 11 13', fill: 'none', className: styles.fileIcon, 'aria-hidden': true };
    switch (method) {
        case 'GET':
            return (_jsxs("svg", { ...baseProps, children: [_jsx("path", { d: "M1.5 6.5L5 10L9.5 5.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("path", { d: "M9.5 5.5V1.5H1.5V11.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" })] }));
        case 'POST':
            return (_jsxs("svg", { ...baseProps, children: [_jsx("path", { d: "M5.5 2V10M2 5.5H9", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("rect", { x: "1.5", y: "1.5", width: "8", height: "10", rx: "1", stroke: "currentColor", strokeWidth: "1.2" })] }));
        case 'PUT':
            return (_jsxs("svg", { ...baseProps, children: [_jsx("path", { d: "M2 3.5H9M2 6.5H9M2 9.5H9", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }), _jsx("rect", { x: "1.5", y: "1.5", width: "8", height: "10", rx: "1", stroke: "currentColor", strokeWidth: "1.2" })] }));
        case 'DELETE':
            return (_jsxs("svg", { ...baseProps, children: [_jsx("path", { d: "M3.5 4.5L7.5 8.5M7.5 4.5L3.5 8.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }), _jsx("circle", { cx: "5.5", cy: "6.5", r: "4", stroke: "currentColor", strokeWidth: "1.2" })] }));
        case 'PATCH':
            return (_jsxs("svg", { ...baseProps, children: [_jsx("circle", { cx: "5.5", cy: "6.5", r: "3.5", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M5.5 4.5V8.5M3.5 6.5H7.5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }));
        default:
            return (_jsxs("svg", { ...baseProps, children: [_jsx("path", { d: "M2 1.5H6.5L9 4V11.5C9 11.78 8.78 12 8.5 12H2C1.72 12 1.5 11.78 1.5 11.5V2C1.5 1.72 1.72 1.5 2 1.5Z", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M6.5 1.5V4H9", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" })] }));
    }
}
function PenIcon() {
    return (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", children: _jsx("path", { d: "M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }) }));
}
export function RequestItem({ request, isSelected, isEditing, onSelect, onDelete, onRenameCommit, onRenameCancel, onRenameStart, }) {
    const [draftName, setDraftName] = useState(request.name);
    const inputRef = useRef(null);
    useEffect(() => {
        if (isEditing) {
            setDraftName(request.name);
            requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            });
        }
    }, [isEditing, request.name]);
    const commit = () => {
        const trimmed = draftName.trim();
        onRenameCommit?.(request.id, trimmed || request.name);
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit();
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            onRenameCancel?.();
        }
    };
    return (_jsxs("div", { className: `${styles.item} ${isSelected ? styles.selected : ''}`, onClick: () => !isEditing && onSelect(request.id), children: [_jsx(MethodIcon, { method: request.method }), _jsx(MethodBadge, { method: request.method }), _jsx("div", { className: styles.content, children: isEditing ? (_jsx("input", { ref: inputRef, className: styles.nameInput, value: draftName, onChange: (e) => setDraftName(e.target.value), onBlur: commit, onKeyDown: handleKeyDown, onClick: (e) => e.stopPropagation(), autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false })) : (_jsx("div", { className: styles.name, children: request.name })) }), !isEditing && (_jsxs(_Fragment, { children: [_jsx("button", { className: styles.editBtn, onClick: (e) => { e.stopPropagation(); onRenameStart?.(); }, title: "Rename", children: _jsx(PenIcon, {}) }), _jsx("button", { className: styles.deleteBtn, onClick: (e) => onDelete(request.id, e), title: "Delete", children: _jsx("svg", { width: "13", height: "13", viewBox: "0 0 13 13", fill: "none", "aria-hidden": true, children: _jsx("path", { d: "M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3.5 3.5l.5 7h5l.5-7", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }) }) })] }))] }));
}
