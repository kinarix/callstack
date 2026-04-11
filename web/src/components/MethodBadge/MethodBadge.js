import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getMethodColor, getMethodIcon } from '../../lib/utils';
import styles from './MethodBadge.module.css';
export function MethodBadge({ method }) {
    const color = getMethodColor(method);
    const icon = getMethodIcon(method);
    return (_jsxs("div", { className: styles.badge, style: { backgroundColor: color }, children: [_jsx("span", { className: styles.icon, children: icon }), _jsx("span", { className: styles.text, children: method })] }));
}
