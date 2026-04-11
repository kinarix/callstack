import { useEffect, useState, useCallback } from 'react';
const THEME_KEY = 'callstack-theme';
export function useTheme() {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem(THEME_KEY);
        return saved || 'system';
    });
    const applyTheme = useCallback((t) => {
        const root = document.documentElement;
        if (t === 'system') {
            root.removeAttribute('data-theme');
        }
        else {
            root.setAttribute('data-theme', t);
        }
        localStorage.setItem(THEME_KEY, t);
        setTheme(t);
    }, []);
    const toggleTheme = useCallback(() => {
        setTheme((current) => {
            let next;
            if (current === 'dark')
                next = 'light';
            else if (current === 'light')
                next = 'system';
            else
                next = 'dark';
            applyTheme(next);
            return next;
        });
    }, [applyTheme]);
    useEffect(() => {
        applyTheme(theme);
    }, []);
    return { theme, toggleTheme, applyTheme };
}
