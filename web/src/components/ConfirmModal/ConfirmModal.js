import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './ConfirmModal.module.css';
export function ConfirmModal({ title, children, confirmLabel = 'Delete', onConfirm, onCancel }) {
    const handleOverlay = (e) => {
        if (e.target === e.currentTarget)
            onCancel();
    };
    return (_jsx("div", { className: styles.overlay, onMouseDown: handleOverlay, children: _jsxs("div", { className: styles.modal, children: [_jsxs("div", { className: styles.header, children: [_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", className: styles.warnIcon, "aria-hidden": true, children: [_jsx("path", { d: "M8 2L14.5 13.5H1.5L8 2Z", stroke: "currentColor", strokeWidth: "1.4", strokeLinejoin: "round" }), _jsx("path", { d: "M8 6.5V9.5", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }), _jsx("circle", { cx: "8", cy: "11.5", r: "0.6", fill: "currentColor" })] }), _jsx("span", { className: styles.title, children: title })] }), _jsx("div", { className: styles.body, children: children }), _jsxs("div", { className: styles.footer, children: [_jsx("button", { className: styles.cancelBtn, onClick: onCancel, children: "Cancel" }), _jsx("button", { className: styles.confirmBtn, onClick: onConfirm, children: confirmLabel })] })] }) }));
}
