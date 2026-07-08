import { useState, useCallback } from 'react';

export type AccentTheme = 'color' | 'bright' | 'mono';

const ACCENT_KEY = 'callstack-accent';
const CYCLE: AccentTheme[] = ['color', 'bright', 'mono'];

export function readStoredAccent(): AccentTheme {
  const saved = localStorage.getItem(ACCENT_KEY) as AccentTheme | null;
  return saved && CYCLE.includes(saved) ? saved : 'color';
}

function applyAccentToDom(a: AccentTheme) {
  const root = document.documentElement;
  if (a === 'color') {
    root.removeAttribute('data-accent');
  } else {
    root.setAttribute('data-accent', a);
  }
}

/** Apply the persisted accent to the DOM. Call once at app boot. */
export function applyStoredAccent() {
  applyAccentToDom(readStoredAccent());
}

export function useAccentTheme() {
  const [accent, setAccent] = useState<AccentTheme>(readStoredAccent);

  const applyAccent = useCallback((a: AccentTheme) => {
    applyAccentToDom(a);
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

  return { accent, cycleAccent, applyAccent };
}
