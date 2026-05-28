import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useReplayServer() {
  const startReplay = useCallback(
    async (replayId: number, requestId: number, port: number, hitLimit: number): Promise<number> => {
      return invoke<number>('start_replay', { replayId, requestId, port, hitLimit });
    },
    [],
  );

  const stopReplay = useCallback(async (replayId: number): Promise<void> => {
    await invoke('stop_replay', { replayId });
  }, []);

  const listRunningReplays = useCallback(async (): Promise<number[]> => {
    return invoke<number[]>('list_running_replays');
  }, []);

  return { startReplay, stopReplay, listRunningReplays };
}
