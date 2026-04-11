import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import styles from './EnvSelector.module.css';
export function EnvSelector({ environments, activeEnvId, onSelect }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    const activeEnv = environments.find((e) => e.id === activeEnvId) ?? null;
    useEffect(() => {
        if (!open)
            return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);
    const handleSelect = (env) => {
        setOpen(false);
        onSelect(env);
    };
    return (_jsxs("div", { className: styles.wrapper, ref: ref, children: [_jsxs("button", { className: `${styles.pill} ${activeEnv ? styles.active : ''}`, onClick: () => setOpen((o) => !o), title: "Select environment", children: [_jsxs("svg", { width: "10", height: "10", viewBox: "0 0 10 10", fill: "none", "aria-hidden": true, children: [_jsx("circle", { cx: "5", cy: "5", r: "4", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M3 5H7M5 3C4.2 3.5 3.8 4.2 3.8 5S4.2 6.5 5 7C5.8 6.5 6.2 5.8 6.2 5S5.8 3.5 5 3Z", stroke: "currentColor", strokeWidth: "1", strokeLinecap: "round" })] }), _jsx("span", { children: activeEnv ? activeEnv.name : 'No Env' }), _jsx("svg", { width: "8", height: "8", viewBox: "0 0 8 8", fill: "none", "aria-hidden": true, className: styles.chevron, children: _jsx("path", { d: "M1.5 3L4 5.5L6.5 3", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" }) })] }), open && (_jsx("div", { className: styles.dropdown, children: environments.length === 0 ? (_jsx("div", { className: styles.empty, children: "No environments \u2014 add one in the sidebar" })) : (environments.map((env) => (_jsxs("button", { className: `${styles.option} ${env.id === activeEnvId ? styles.selectedOption : ''}`, onClick: () => handleSelect(env), children: [env.id === activeEnvId && (_jsx("svg", { width: "10", height: "10", viewBox: "0 0 10 10", fill: "none", "aria-hidden": true, children: _jsx("path", { d: "M2 5L4.5 7.5L8 2.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) })), _jsx("span", { children: env.name })] }, env.id)))) }))] }));
}
