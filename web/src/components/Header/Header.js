import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { RefreshButton } from './RefreshButton';
import { ThemeToggle } from './ThemeToggle';
import { UserSection } from './UserSection';
import styles from './Header.module.css';
export function Header() {
    return (_jsxs("div", { className: styles.header, children: [_jsx("div", { className: styles.logo, children: "CALLSTACK" }), _jsxs("div", { className: styles.userSection, children: [_jsx(RefreshButton, {}), _jsx(ThemeToggle, {}), _jsx(UserSection, {})] })] }));
}
