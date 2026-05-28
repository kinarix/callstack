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

  const setReplayPaused = useCallback(async (replayId: number, paused: boolean): Promise<void> => {
    await invoke('set_replay_paused', { replayId, paused });
  }, []);

  const resumeReplay = useCallback(async (pauseId: number): Promise<void> => {
    await invoke('resume_replay', { pauseId });
  }, []);

  return { startReplay, stopReplay, listRunningReplays, setReplayPaused, resumeReplay };
}
