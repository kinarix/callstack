import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { getMethodColor, getMethodIcon } from '../../lib/utils';
import { EnvSelector } from './EnvSelector';
import styles from './UrlBar.module.css';
const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
function renderUrlSegments(url, error) {
    const { start, end } = error;
    if (start === undefined || end === undefined || start >= end || start < 0 || end > url.length) {
        return _jsx("span", { className: styles.urlErrorSpan, children: url });
    }
    return (_jsxs(_Fragment, { children: [start > 0 && _jsx("span", { children: url.slice(0, start) }), _jsx("span", { className: styles.urlErrorSpan, children: url.slice(start, end) }), end < url.length && _jsx("span", { children: url.slice(end) })] }));
}
export function UrlBar({ request, isLoading, urlError, showExpandBtn, onExpand, onMethodChange, onUrlChange, onNameChange, onSend, followRedirects, onFollowRedirectsChange, environments, activeEnvId, onEnvSelect, }) {
    const method = request?.method ?? 'GET';
    const url = request?.url ?? '';
    const methodColor = getMethodColor(method);
    return (_jsxs("div", { className: styles.urlBar, children: [showExpandBtn && (_jsx("button", { className: styles.expandBtn, onClick: onExpand, title: "Show navigator", children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 14 14", fill: "none", "aria-hidden": true, children: _jsx("path", { d: "M5.5 3.5L9 7L5.5 10.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" }) }) })), _jsx("input", { type: "text", className: styles.nameInput, placeholder: "Request name", value: request?.name ?? '', title: request?.name ?? '', onChange: (e) => onNameChange(e.target.value), autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false }), _jsx(EnvSelector, { environments: environments, activeEnvId: activeEnvId, onSelect: onEnvSelect }), _jsx("select", { className: styles.methodSelect, value: method, onChange: (e) => onMethodChange(e.target.value), style: { backgroundColor: methodColor }, children: METHODS.map((m) => (_jsxs("option", { value: m, children: [getMethodIcon(m), " ", m] }, m))) }), _jsxs("div", { className: styles.urlInputWrapper, children: [urlError && url && (_jsx("div", { className: styles.urlOverlay, "aria-hidden": true, children: renderUrlSegments(url, urlError) })), _jsx("input", { type: "text", className: styles.urlInput, placeholder: "https://api.example.com/endpoint", defaultValue: url, onChange: (e) => onUrlChange(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter')
                            onSend(); }, autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false }, request?.id ?? 'none'), _jsxs("label", { className: styles.redirectToggle, title: "Follow 3xx redirects automatically", children: [_jsx("input", { type: "checkbox", checked: followRedirects, onChange: (e) => onFollowRedirectsChange(e.target.checked) }), _jsx("span", { children: "3xx Redirects" })] })] }), _jsx("button", { className: styles.sendBtn, onClick: onSend, disabled: isLoading || !url, title: "Send request (Enter)", children: isLoading ? '⟳' : '→' })] }));
}
