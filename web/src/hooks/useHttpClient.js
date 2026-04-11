import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
export function useHttpClient() {
    const send = useCallback(async (options) => {
        return invoke('send_request', { ...options });
    }, []);
    return { send };
}
