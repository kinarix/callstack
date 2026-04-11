import { jsx as _jsx } from "react/jsx-runtime";
import { useTheme } from '../../hooks/useTheme';
import styles from './ThemeToggle.module.css';
export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const icons = {
        dark: '🌙',
        light: '☀️',
        system: '🖥️',
    };
    return (_jsx("button", { className: styles.button, onClick: toggleTheme, title: `Theme: ${theme}`, children: icons[theme] }));
}
