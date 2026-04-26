import { useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { KeyValue, FileAttachment } from '../lib/types';

interface SendOptions {
  method: string;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: string;
  followRedirects: boolean;
  attachments: FileAttachment[];
  projectId: number | null;
  useCookieJar: boolean;
  timeoutSecs: number;
}

interface SendResult {
  status: number;
  statusText: string;
  headers: { key: string; value: string }[];
  body: string;
  timeMs: number;
  size: number;
  transferSize: number;
}

export function useHttpClient() {
  const send = useCallback(async (options: SendOptions): Promise<SendResult> => {
    return invoke<SendResult>('send_request', { ...options });
  }, []);

  const cancelRequest = useCallback(async () => {
    await invoke('cancel_request');
  }, []);

  return { send, cancelRequest };
}
