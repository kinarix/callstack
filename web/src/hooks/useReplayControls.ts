import { useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useReplayServer } from './useReplayServer';
import { useSettings } from './useSettings';
import type { Replay } from '../lib/types';

/** Global start/stop for replays — all run together or none do. */
export function useReplayControls() {
  const { state, dispatch } = useApp();
  const { startReplay, stopReplay } = useReplayServer();
  const { settings } = useSettings();

  const startAll = useCallback(
    async (extra?: Replay[]) => {
      const seen = new Set<number>();
      const all = [...state.replays, ...(extra ?? [])].filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      });
      for (const r of all) {
        if (state.runningReplayIds.has(r.id)) continue;
        try {
          await startReplay(r.id, r.requestId, r.port, settings.replayHitLimit);
          dispatch({ type: 'SET_REPLAY_RUNNING', payload: { id: r.id, running: true } });
        } catch {
          /* e.g. a foreign process holds the port — skip this one */
        }
      }
    },
    [state.replays, state.runningReplayIds, settings.replayHitLimit, startReplay, dispatch],
  );

  const stopAll = useCallback(async () => {
    const ids = [...state.runningReplayIds];
    await Promise.all(ids.map((id) => stopReplay(id).catch(() => {})));
    ids.forEach((id) => dispatch({ type: 'SET_REPLAY_RUNNING', payload: { id, running: false } }));
  }, [state.runningReplayIds, stopReplay, dispatch]);

  return { startAll, stopAll };
}
