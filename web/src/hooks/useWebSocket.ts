import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { KeyValue } from '../lib/types';

/** Thin wrappers over the Rust WebSocket commands. */
export function useWebSocket() {
  const wsConnect = useCallback(
    async (requestId: number, url: string, headers: KeyValue[]): Promise<void> => {
      const tuples: [string, string][] = headers
        .filter((h) => h.enabled !== false && h.key.trim())
        .map((h) => [h.key, h.value]);
      await invoke('ws_connect', { requestId, url, headers: tuples });
    },
    [],
  );

  const wsSend = useCallback(async (requestId: number, text: string): Promise<void> => {
    await invoke('ws_send', { requestId, text });
  }, []);

  const wsClose = useCallback(async (requestId: number): Promise<void> => {
    await invoke('ws_close', { requestId });
  }, []);

  const wsListOpen = useCallback(async (): Promise<number[]> => {
    return invoke<number[]>('ws_list_open');
  }, []);

  return { wsConnect, wsSend, wsClose, wsListOpen };
}
