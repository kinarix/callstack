import { useState, useCallback } from 'react';
import type { Theme } from '../lib/types';

const THEME_KEY = 'callstack-theme';

export function readStoredTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY) as Theme | null;
  return saved || 'system';
}

function applyThemeToDom(t: Theme) {
  const root = document.documentElement;
  if (t === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', t);
  }
}

/** Apply the persisted theme to the DOM. Call once at app boot so the theme is
 *  active from launch and independent of whether the settings modal is open. */
export function applyStoredTheme() {
  applyThemeToDom(readStoredTheme());
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(readStoredTheme);

  const applyTheme = useCallback((t: Theme) => {
    applyThemeToDom(t);
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

  return { theme, toggleTheme, applyTheme };
}
