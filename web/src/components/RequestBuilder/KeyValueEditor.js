import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './KeyValueEditor.module.css';
export function KeyValueEditor({ items, onChange, readOnly = false, }) {
    const handleKeyChange = (index, key) => {
        const updated = [...items];
        updated[index].key = key;
        onChange(updated);
    };
    const handleValueChange = (index, value) => {
        const updated = [...items];
        updated[index].value = value;
        onChange(updated);
    };
    const handleEnabledToggle = (index) => {
        const updated = [...items];
        updated[index] = { ...updated[index], enabled: !(updated[index].enabled ?? true) };
        onChange(updated);
    };
    const handleAdd = () => {
        onChange([...items, { key: '', value: '', enabled: true }]);
    };
    const handleRemove = (index) => {
        onChange(items.filter((_, i) => i !== index));
    };
    if (readOnly && items.length === 0) {
        return _jsx("div", { className: styles.empty, children: "No items" });
    }
    return (_jsxs("div", { className: styles.editor, children: [_jsx("div", { className: styles.rows, children: items.map((item, index) => (_jsxs("div", { className: styles.row, children: [!readOnly && (_jsx("button", { className: `${styles.checkbox} ${item.enabled ?? true ? styles.checked : ''}`, onClick: () => handleEnabledToggle(index), title: "Toggle item", children: "\u2713" })), _jsx("input", { type: "text", className: styles.input, placeholder: "Key", value: item.key, onChange: (e) => handleKeyChange(index, e.target.value), disabled: readOnly, autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false }), _jsx("input", { type: "text", className: styles.input, placeholder: "Value", value: item.value, onChange: (e) => handleValueChange(index, e.target.value), disabled: readOnly, autoComplete: "off", autoCorrect: "off", autoCapitalize: "off", spellCheck: false }), !readOnly && (_jsx("button", { className: styles.deleteBtn, onClick: () => handleRemove(index), title: "Delete", children: "\u00D7" }))] }, index))) }), !readOnly && (_jsx("button", { className: styles.addBtn, onClick: handleAdd, children: "+ Add" }))] }));
}
