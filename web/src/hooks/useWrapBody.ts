import { useCallback, useEffect, useState } from 'react';

const EVENT_PREFIX = 'callstack.wrapToggle.change:';

function read(key: string): boolean {
  try { return localStorage.getItem(key) === '1'; }
  catch { return false; }
}

/**
 * Wrap-toggle state persisted to localStorage under the given key.
 * Multiple components reading the same key stay in sync via a custom event.
 * Different keys give fully independent toggles (e.g. request vs response).
 */
export function useWrapToggle(key: string): [boolean, (v: boolean) => void] {
  const eventName = EVENT_PREFIX + key;
  const [wrap, setWrap] = useState<boolean>(() => read(key));
  useEffect(() => {
    const onChange = () => setWrap(read(key));
    window.addEventListener(eventName, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(eventName, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [key, eventName]);
  const set = useCallback((v: boolean) => {
    try { localStorage.setItem(key, v ? '1' : '0'); } catch {}
    setWrap(v);
    window.dispatchEvent(new Event(eventName));
  }, [key, eventName]);
  return [wrap, set];
}

/** Back-compat alias preserved for the response body editor. */
export function useWrapBody(): [boolean, (v: boolean) => void] {
  return useWrapToggle('callstack.wrapBody');
}
