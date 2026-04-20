import { useState, useCallback } from 'react';

const STORAGE_KEY = 'callstack.shortcuts';

function load(): { [fkey: string]: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(shortcuts: { [fkey: string]: number }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
}

export function useShortcuts() {
  const [shortcuts, setShortcuts] = useState<{ [fkey: string]: number }>(load);

  const assignShortcut = useCallback((fkey: string, requestId: number) => {
    setShortcuts((prev) => {
      const next = { ...prev };
      // Remove any existing assignment for this requestId
      for (const k of Object.keys(next)) {
        if (next[k] === requestId) delete next[k];
      }
      next[fkey] = requestId;
      save(next);
      return next;
    });
  }, []);

  const removeShortcut = useCallback((requestId: number) => {
    setShortcuts((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (next[k] === requestId) delete next[k];
      }
      save(next);
      return next;
    });
  }, []);

  const getShortcutForRequest = useCallback(
    (requestId: number): string | null => {
      for (const [k, v] of Object.entries(shortcuts)) {
        if (v === requestId) return k;
      }
      return null;
    },
    [shortcuts]
  );

  const getRequestIdForShortcut = useCallback(
    (fkey: string): number | null => shortcuts[fkey] ?? null,
    [shortcuts]
  );

  return { shortcuts, assignShortcut, removeShortcut, getShortcutForRequest, getRequestIdForShortcut };
}
