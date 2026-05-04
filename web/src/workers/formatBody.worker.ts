/// <reference lib="webworker" />
import { formatBody } from '../lib/formatBody';

self.onmessage = (e: MessageEvent<{ body: string; contentType: string }>) => {
  self.postMessage(formatBody(e.data.body, e.data.contentType));
};
