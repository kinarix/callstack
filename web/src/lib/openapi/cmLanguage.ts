import type { Extension } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { javascript } from '@codemirror/lang-javascript';
import { markdown } from '@codemirror/lang-markdown';

export function getLanguageExtension(contentType: string | undefined | null): Extension[] {
  const ct = (contentType || '').toLowerCase();
  if (!ct) return [json()];
  if (ct.includes('json')) return [json()];
  if (ct.includes('xml')) return [xml()];
  if (ct.includes('html')) return [xml()];
  if (ct.includes('javascript') || ct.includes('ecmascript')) return [javascript()];
  if (ct.includes('markdown')) return [markdown()];
  return [];
}
