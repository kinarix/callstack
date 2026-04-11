import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { KeyValueEditor } from '../RequestBuilder/KeyValueEditor';
import styles from './EnvModal.module.css';
export function EnvModal({ env, onSave, onClose }) {
    const [name, setName] = useState(env.name);
    const [variables, setVariables] = useState(env.variables);
    const [editingName, setEditingName] = useState(false);
    const nameInputRef = useRef(null);
    useEffect(() => {
        setName(env.name);
        setVariables(env.variables);
    }, [env.id]);
    useEffect(() => {
        if (editingName) {
            nameInputRef.current?.focus();
            nameInputRef.current?.select();
        }
    }, [editingName]);
    const handleSave = () => {
        const trimmed = name.trim() || env.name;
        onSave(env.id, trimmed, variables);
        onClose();
    };
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            handleSave();
        }
    };
    const handleNameCommit = () => {
        setEditingName(false);
        if (!name.trim())
            setName(env.name);
    };
    return (_jsx("div", { className: styles.overlay, onMouseDown: handleOverlayClick, children: _jsxs("div", { className: styles.modal, children: [_jsx("div", { className: styles.header, children: _jsx("div", { className: styles.titleRow, children: editingName ? (_jsx("input", { ref: nameInputRef, className: styles.nameInput, value: name, onChange: (e) => setName(e.target.value), onBlur: handleNameCommit, onKeyDown: (e) => {
                                if (e.key === 'Enter')
                                    handleNameCommit();
                                if (e.key === 'Escape') {
                                    setName(env.name);
                                    setEditingName(false);
                                }
                            } })) : (_jsxs("button", { className: styles.nameBtn, onClick: () => setEditingName(true), title: "Rename", children: [name, _jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", "aria-hidden": true, children: _jsx("path", { d: "M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z", stroke: "currentColor", strokeWidth: "1.2", strokeLinejoin: "round" }) })] })) }) }), _jsx("div", { className: styles.body, children: _jsx(KeyValueEditor, { items: variables, onChange: setVariables }) }), _jsxs("div", { className: styles.footer, children: [_jsx("button", { className: styles.cancelBtn, onClick: onClose, children: "Cancel" }), _jsx("button", { className: styles.saveBtn, onClick: handleSave, children: "Save" })] })] }) }));
}
