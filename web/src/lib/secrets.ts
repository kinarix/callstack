import type { KeyValue } from './types';

const key = (envId: number) => `callstack.secrets.${envId}`;

export function loadSecrets(envId: number): KeyValue[] {
  try {
    const raw = localStorage.getItem(key(envId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveSecrets(envId: number, secrets: KeyValue[]) {
  localStorage.setItem(key(envId), JSON.stringify(secrets));
}
