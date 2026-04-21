import { useState, useCallback } from 'react';

const STORAGE_KEY = 'callstack.settings';

export const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
const mod = isMac ? 'Meta' : 'Ctrl';

export interface ActionShortcuts {
  execute: string;
  rename: string;
  newRequest: string;
  copyResponse: string;
  cloneRequest: string;
  saveResponse: string;
}

export interface Settings {
  zoom: number;
  shortcuts: ActionShortcuts;
  responseHistoryLimit: number;
}

export const DEFAULTS: Settings = {
  zoom: 1,
  shortcuts: {
    execute:      `${mod}+x`,
    rename:       `${mod}+r`,
    newRequest:   `${mod}+n`,
    copyResponse: `${mod}+c`,
    cloneRequest: `${mod}+d`,
    saveResponse: `${mod}+s`,
  },
  responseHistoryLimit: 10,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    const s = parsed.shortcuts ?? {};
    return {
      zoom: parsed.zoom ?? DEFAULTS.zoom,
      shortcuts: {
        execute:      s.execute      ?? DEFAULTS.shortcuts.execute,
        rename:       s.rename       ?? DEFAULTS.shortcuts.rename,
        newRequest:   s.newRequest   ?? DEFAULTS.shortcuts.newRequest,
        copyResponse: s.copyResponse ?? DEFAULTS.shortcuts.copyResponse,
        cloneRequest: s.cloneRequest ?? DEFAULTS.shortcuts.cloneRequest,
        saveResponse: s.saveResponse ?? DEFAULTS.shortcuts.saveResponse,
      },
      responseHistoryLimit: parsed.responseHistoryLimit ?? DEFAULTS.responseHistoryLimit,
    };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: Settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut.split('+');
  const key = parts[parts.length - 1].toLowerCase();
  const needsMeta  = parts.includes('Meta');
  const needsCtrl  = parts.includes('Ctrl');
  const needsShift = parts.includes('Shift');
  const needsAlt   = parts.includes('Alt');
  return (
    e.key.toLowerCase() === key &&
    e.metaKey  === needsMeta  &&
    e.ctrlKey  === needsCtrl  &&
    e.shiftKey === needsShift &&
    e.altKey   === needsAlt
  );
}

/** Format a shortcut string for display.
 *  "Meta+r" → "Cmd+R" on Mac, "Ctrl+R" on Win/Linux */
export function formatShortcut(shortcut: string): string {
  const parts = shortcut.split('+');
  const key = parts[parts.length - 1].toUpperCase();
  return [...parts.slice(0, -1), key]
    .map((p) => (isMac && p === 'Meta' ? 'Cmd' : p))
    .join('+');
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  const setZoom = useCallback((zoom: number) => {
    setSettings((prev) => {
      const next = { ...prev, zoom };
      saveSettings(next);
      return next;
    });
  }, []);

  const setShortcut = useCallback((action: keyof ActionShortcuts, value: string) => {
    setSettings((prev) => {
      const next = { ...prev, shortcuts: { ...prev.shortcuts, [action]: value } };
      saveSettings(next);
      return next;
    });
  }, []);

  const setResponseHistoryLimit = useCallback((responseHistoryLimit: number) => {
    setSettings((prev) => {
      const next = { ...prev, responseHistoryLimit };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULTS);
    saveSettings(DEFAULTS);
  }, []);

  return { settings, setZoom, setShortcut, setResponseHistoryLimit, resetSettings };
}
