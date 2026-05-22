import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'callstack.wrapBody';
const EVENT = 'callstack.wrapBody.change';

function read(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; }
  catch { return false; }
}

export function useWrapBody(): [boolean, (v: boolean) => void] {
  const [wrap, setWrap] = useState<boolean>(read);
  useEffect(() => {
    const onChange = () => setWrap(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);
  const set = useCallback((v: boolean) => {
    try { localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch {}
    setWrap(v);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [wrap, set];
}
