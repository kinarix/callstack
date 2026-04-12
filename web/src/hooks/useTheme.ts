import { useEffect, useState, useCallback } from 'react';
import type { Theme } from '../lib/types';

const THEME_KEY = 'callstack-theme';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    return saved || 'system';
  });

  const applyTheme = useCallback((t: Theme) => {
    const root = document.documentElement;
    if (t === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', t);
    }
    localStorage.setItem(THEME_KEY, t);
    setTheme(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      let next: Theme;
      if (current === 'dark') next = 'light';
      else if (current === 'light') next = 'dim';
      else if (current === 'dim') next = 'system';
      else next = 'dark';
      applyTheme(next);
      return next;
    });
  }, [applyTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, []);

  return { theme, toggleTheme, applyTheme };
}
