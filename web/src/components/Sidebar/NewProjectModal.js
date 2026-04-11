import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import styles from './NewProjectModal.module.css';
export function NewProjectModal({ onConfirm, onCancel }) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const nameRef = useRef(null);
    useEffect(() => {
        nameRef.current?.focus();
    }, []);
    const handleSubmit = (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed)
            return;
        onConfirm(trimmed, description.trim());
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Escape')
            onCancel();
    };
    return (_jsx("div", { className: styles.overlay, onClick: onCancel, onKeyDown: handleKeyDown, children: _jsxs("div", { className: styles.modal, onClick: (e) => e.stopPropagation(), children: [_jsx("div", { className: styles.header, children: _jsx("h2", { className: styles.title, children: "New Project" }) }), _jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: styles.body, children: [_jsxs("div", { className: styles.field, children: [_jsx("label", { className: styles.label, children: "Name" }), _jsx("input", { ref: nameRef, className: styles.input, type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "My API Project", onKeyDown: (e) => e.key === 'Escape' && onCancel(), autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false })] }), _jsxs("div", { className: styles.field, children: [_jsxs("label", { className: styles.label, children: ["Description ", _jsx("span", { className: styles.optional, children: "(optional)" })] }), _jsx("textarea", { className: styles.textarea, value: description, onChange: (e) => setDescription(e.target.value), placeholder: "What is this project for?", rows: 3, onKeyDown: (e) => e.key === 'Escape' && onCancel(), autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false })] })] }), _jsxs("div", { className: styles.footer, children: [_jsx("button", { type: "button", className: styles.cancelBtn, onClick: onCancel, children: "Cancel" }), _jsx("button", { type: "submit", className: styles.createBtn, disabled: !name.trim(), children: "Create Project" })] })] })] }) }));
}
