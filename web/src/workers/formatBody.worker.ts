/// <reference lib="webworker" />
import { formatBody } from '../lib/formatBody';

globalThis.onmessage = (e: MessageEvent<{ body: string; contentType: string }>) => {
  globalThis.postMessage(formatBody(e.data.body, e.data.contentType));
};
