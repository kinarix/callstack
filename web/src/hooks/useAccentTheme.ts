import { useEffect, useState, useCallback } from 'react';

export type AccentTheme = 'color' | 'bright' | 'mono';

const ACCENT_KEY = 'callstack-accent';
const CYCLE: AccentTheme[] = ['color', 'bright', 'mono'];

export function useAccentTheme() {
  const [accent, setAccent] = useState<AccentTheme>(() => {
    const saved = localStorage.getItem(ACCENT_KEY) as AccentTheme | null;
    return saved && CYCLE.includes(saved) ? saved : 'color';
  });

  const applyAccent = useCallback((a: AccentTheme) => {
    const root = document.documentElement;
    if (a === 'color') {
      root.removeAttribute('data-accent');
    } else {
      root.setAttribute('data-accent', a);
    }
    localStorage.setItem(ACCENT_KEY, a);
    setAccent(a);
  }, []);

  const cycleAccent = useCallback(() => {
    setAccent((current) => {
      const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
      applyAccent(next);
      return next;
    });
  }, [applyAccent]);

  useEffect(() => {
    applyAccent(accent);
  }, []);

  return { accent, cycleAccent, applyAccent };
}
