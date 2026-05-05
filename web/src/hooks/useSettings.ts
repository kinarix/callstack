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
  zoomIn: string;
  zoomOut: string;
  historyBack: string;
  historyForward: string;
}

export interface Settings {
  zoom: number;
  shortcuts: ActionShortcuts;
  responseHistoryLimit: number;
  httpTimeout: number;
  formatOnSend: boolean;
}

export const DEFAULTS: Settings = {
  zoom: 1,
  shortcuts: {
    execute:      `${mod}+Enter`,
    rename:       `${mod}+r`,
    newRequest:   `${mod}+n`,
    copyResponse: `${mod}+c`,
    cloneRequest: `${mod}+d`,
    saveResponse: `${mod}+s`,
    zoomIn:       `${mod}+=`,
    zoomOut:      `${mod}+-`,
    historyBack:    'Meta+[',
    historyForward: 'Meta+]',
  },
  responseHistoryLimit: 10,
  httpTimeout: 30,
  formatOnSend: true,
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
        zoomIn:       s.zoomIn       ?? DEFAULTS.shortcuts.zoomIn,
        zoomOut:      s.zoomOut      ?? DEFAULTS.shortcuts.zoomOut,
        historyBack:    s.historyBack    ?? DEFAULTS.shortcuts.historyBack,
        historyForward: s.historyForward ?? DEFAULTS.shortcuts.historyForward,
      },
      responseHistoryLimit: parsed.responseHistoryLimit ?? DEFAULTS.responseHistoryLimit,
      httpTimeout: parsed.httpTimeout ?? DEFAULTS.httpTimeout,
      formatOnSend: parsed.formatOnSend ?? DEFAULTS.formatOnSend,
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

  const setHttpTimeout = useCallback((httpTimeout: number) => {
    setSettings((prev) => {
      const next = { ...prev, httpTimeout };
      saveSettings(next);
      return next;
    });
  }, []);

  const setFormatOnSend = useCallback((formatOnSend: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, formatOnSend };
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULTS);
    saveSettings(DEFAULTS);
  }, []);

  return { settings, setZoom, setShortcut, setResponseHistoryLimit, setHttpTimeout, setFormatOnSend, resetSettings };
}
