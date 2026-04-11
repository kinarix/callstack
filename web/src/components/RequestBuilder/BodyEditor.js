import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import styles from './BodyEditor.module.css';
function validateBodyContent(body, contentType) {
    const trimmed = body.trim();
    if (!trimmed)
        return { valid: true };
    if (contentType.includes('json')) {
        try {
            JSON.parse(trimmed);
            return { valid: true };
        }
        catch (e) {
            const msg = e instanceof SyntaxError ? e.message : 'Invalid JSON';
            return { valid: false, error: msg };
        }
    }
    if (contentType.includes('xml') || contentType.includes('html')) {
        try {
            const result = new DOMParser().parseFromString(trimmed, contentType.includes('xml') ? 'application/xml' : 'text/html');
            const hasError = result.getElementsByTagName('parsererror').length > 0;
            if (hasError) {
                return { valid: false, error: 'Invalid XML/HTML' };
            }
            return { valid: true };
        }
        catch (e) {
            return { valid: false, error: 'Invalid XML/HTML' };
        }
    }
    return { valid: true };
}
const PRESETS = [
    'application/json',
    'application/xml',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain',
    'text/html',
];
function getLanguage(contentType) {
    if (contentType.includes('json'))
        return json();
    if (contentType.includes('xml') || contentType.includes('html'))
        return xml();
    return null;
}
function resolveTheme() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark')
        return 'dark';
    if (attr === 'light')
        return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function useResolvedTheme() {
    const [theme, setTheme] = useState(resolveTheme);
    useEffect(() => {
        const observer = new MutationObserver(() => setTheme(resolveTheme()));
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);
    return theme;
}
export function BodyEditor({ body, contentType = '', onChange, onContentTypeChange, readOnly = false, }) {
    const [validation, setValidation] = useState({ valid: true });
    const isPreset = PRESETS.includes(contentType);
    const theme = useResolvedTheme();
    const lang = getLanguage(contentType);
    useEffect(() => {
        setValidation(validateBodyContent(body, contentType));
    }, [body, contentType]);
    return (_jsxs("div", { className: styles.editor, children: [_jsxs("div", { className: styles.toolbarContainer, children: [!readOnly && (_jsxs("div", { className: styles.toolbar, children: [_jsx("span", { className: styles.ctLabel, children: "Content-Type" }), _jsxs("select", { className: styles.ctSelect, value: isPreset ? contentType : '__custom__', onChange: (e) => {
                                    if (e.target.value !== '__custom__') {
                                        onContentTypeChange?.(e.target.value);
                                    }
                                }, children: [_jsx("option", { value: "", children: "None" }), PRESETS.map(p => (_jsx("option", { value: p, children: p }, p))), _jsx("option", { value: "__custom__", children: "Custom\u2026" })] }), !isPreset && contentType !== '' && (_jsx("input", { className: styles.ctInput, value: contentType, onChange: (e) => onContentTypeChange?.(e.target.value), placeholder: "e.g. application/json", spellCheck: false, autoComplete: "off", autoCorrect: "off", autoCapitalize: "off" }))] })), _jsx("div", { className: `${styles.validationTag} ${validation.valid ? styles.validationTagValid : styles.validationTagInvalid}`, title: validation.error, children: validation.valid ? '✓ Valid' : `✗ ${validation.error || 'Invalid'}` })] }), _jsx("div", { className: `${styles.editorWrap} ${!validation.valid ? styles.editorWrapInvalid : ''}`, children: _jsx(CodeMirror, { value: body, onChange: onChange, extensions: lang ? [lang] : [], theme: theme, height: "100%", readOnly: readOnly, basicSetup: {
                        lineNumbers: true,
                        foldGutter: true,
                        bracketMatching: true,
                        closeBrackets: true,
                        autocompletion: true,
                    } }) })] }));
}
