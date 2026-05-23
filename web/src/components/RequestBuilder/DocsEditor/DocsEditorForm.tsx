import { useRef, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import type { DocumentationFields, KeyValue, Request, Response as AppResponse } from '../../../lib/types';
import { appEditorExtensions } from '../../../lib/editorTheme';
import MarkdownToolbar from './MarkdownToolbar';
import SampleBodyEditor from './SampleBodyEditor';
import styles from './DocsEditor.module.css';

function getHeaderValue(headers: { key: string; value: string; enabled?: boolean }[] | undefined, name: string): string {
  if (!headers) return '';
  const lower = name.toLowerCase();
  return headers.find((h) => h.key.toLowerCase() === lower && h.enabled !== false)?.value ?? '';
}

interface Props {
  value: DocumentationFields;
  request: Request;
  response: AppResponse | null;
  envVars?: KeyValue[];
  secrets?: KeyValue[];
  onChange: (next: DocumentationFields) => void;
}

export default function DocsEditorForm({ value, request, response, envVars, secrets, onChange }: Props) {
  const [tagDraft, setTagDraft] = useState('');
  const descViewRef = useRef<EditorView | null>(null);

  const patch = (p: Partial<DocumentationFields>) => onChange({ ...value, ...p });

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/,$/, '').trim();
    if (!t) return;
    const next = [...(value.tags || [])];
    if (!next.includes(t)) next.push(t);
    patch({ tags: next });
    setTagDraft('');
  };

  const removeTag = (t: string) => {
    patch({ tags: (value.tags || []).filter((x) => x !== t) });
  };

  const useCurrentRequestBody = () => {
    if (request.body) patch({ sampleRequestBody: request.body });
  };

  const useCurrentResponseBody = () => {
    if (!response) return;
    const ct = (response.headers || []).find((h) => h.key.toLowerCase() === 'content-type')?.value;
    patch({
      sampleResponseBody: response.body || '',
      sampleResponseStatus: response.status || undefined,
      sampleResponseContentType: ct || undefined,
    });
  };

  const clearSampleRequest = () => patch({ sampleRequestBody: undefined });
  const clearSampleResponse = () =>
    patch({ sampleResponseBody: undefined, sampleResponseStatus: undefined, sampleResponseContentType: undefined });

  const requestContentType = getHeaderValue(request.headers, 'Content-Type') || 'application/json';
  const responseContentType =
    value.sampleResponseContentType
    || getHeaderValue(response?.headers, 'Content-Type')
    || 'application/json';

  return (
    <>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Summary</label>
        <input
          className={styles.textInput}
          type="text"
          value={value.summary || ''}
          onChange={(e) => patch({ summary: e.target.value || undefined })}
          placeholder="Short, human-readable name for this operation"
        />
      </div>

      <div className={styles.twoCol}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Operation ID</label>
          <input
            className={styles.textInput}
            type="text"
            value={value.operationId || ''}
            onChange={(e) => patch({ operationId: e.target.value || undefined })}
            placeholder="Auto-generated from method + path"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>External docs URL</label>
          <input
            className={styles.textInput}
            type="url"
            value={value.externalDocsUrl || ''}
            onChange={(e) => patch({ externalDocsUrl: e.target.value || undefined })}
            placeholder="https://docs.example.com/endpoint"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>External docs description</label>
          <input
            className={styles.textInput}
            type="text"
            value={value.externalDocsDescription || ''}
            onChange={(e) => patch({ externalDocsDescription: e.target.value || undefined })}
            placeholder="Short label shown next to the link"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Tags</label>
          <div className={styles.tagsRow}>
            {(value.tags || []).map((t) => (
              <span key={t} className={styles.tagChip}>
                {t}
                <button
                  type="button"
                  className={styles.tagRemove}
                  onClick={() => removeTag(t)}
                  aria-label={`Remove tag ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              className={styles.tagInput}
              type="text"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addTag(tagDraft);
                } else if (e.key === 'Backspace' && !tagDraft && (value.tags || []).length) {
                  removeTag((value.tags as string[])[(value.tags as string[]).length - 1]);
                }
              }}
              onBlur={() => addTag(tagDraft)}
              placeholder={(value.tags || []).length ? '' : 'Add a tag and press Enter'}
            />
          </div>
        </div>
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel}>Description (Markdown)</label>
        <div className={styles.markdownBlock}>
          <MarkdownToolbar viewRef={descViewRef} />
          <div className={styles.descriptionEditor}>
            <CodeMirror
              value={value.description || ''}
              onChange={(v) => patch({ description: v || undefined })}
              extensions={[markdown(), ...appEditorExtensions, EditorView.lineWrapping]}
              theme="none"
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: false,
                highlightActiveLineGutter: false,
              }}
              onCreateEditor={(view) => { descViewRef.current = view; }}
              style={{ height: '100%' }}
            />
          </div>
        </div>
      </div>

      <CollapsibleSection
        title="Sample request body"
        hint={requestContentType}
        defaultOpen={Boolean(value.sampleRequestBody)}
        badge={value.sampleRequestBody ? 'set' : undefined}
        actions={
          <>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={useCurrentRequestBody}
              disabled={!request.body}
              title={request.body ? 'Copy the current request body into the sample' : 'Current request has no body'}
            >
              Use current
            </button>
            {value.sampleRequestBody && (
              <button type="button" className={styles.linkBtn} onClick={clearSampleRequest}>
                Clear
              </button>
            )}
          </>
        }
      >
        <SampleBodyEditor
          value={value.sampleRequestBody || ''}
          contentType={requestContentType}
          envVars={envVars}
          secrets={secrets}
          wrapKey="callstack.wrapBody.docsSampleReq"
          onChange={(v) => patch({ sampleRequestBody: v || undefined })}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Sample response body"
        hint={responseContentType}
        defaultOpen={Boolean(value.sampleResponseBody || value.sampleResponseStatus)}
        badge={value.sampleResponseStatus ? String(value.sampleResponseStatus) : (value.sampleResponseBody ? 'set' : undefined)}
        actions={
          <>
            <input
              type="number"
              className={styles.statusInput}
              placeholder="200"
              min={100}
              max={599}
              value={value.sampleResponseStatus ?? ''}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                patch({ sampleResponseStatus: Number.isFinite(n) ? n : undefined });
              }}
              title="Sample response status code"
            />
            <button
              type="button"
              className={styles.linkBtn}
              onClick={useCurrentResponseBody}
              disabled={!response}
              title={response ? 'Copy the latest captured response into the sample' : 'No response captured yet'}
            >
              Use current
            </button>
            {(value.sampleResponseBody || value.sampleResponseStatus) && (
              <button type="button" className={styles.linkBtn} onClick={clearSampleResponse}>
                Clear
              </button>
            )}
          </>
        }
      >
        <SampleBodyEditor
          value={value.sampleResponseBody || ''}
          contentType={responseContentType}
          wrapKey="callstack.wrapBody.docsSampleRes"
          onChange={(v) => patch({ sampleResponseBody: v || undefined })}
        />
      </CollapsibleSection>

      <div className={styles.field}>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={!!value.deprecated}
            onChange={(e) => patch({ deprecated: e.target.checked || undefined })}
          />
          Mark this operation as deprecated
        </label>
      </div>
    </>
  );
}

interface CollapsibleProps {
  title: string;
  hint?: string;
  badge?: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

function CollapsibleSection({ title, hint, badge, defaultOpen = false, actions, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`${styles.field} ${styles.collapsibleField}`}>
      <div className={styles.sampleHeader}>
        <button
          type="button"
          className={`${styles.collapseToggle} ${open ? styles.collapseToggleOpen : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title={open ? 'Collapse section' : 'Expand section'}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
            <path d="M3 2.5L6.5 5 3 7.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={styles.fieldLabel}>{title}</span>
          {hint && <span className={styles.ctHint}>{hint}</span>}
          {badge && <span className={styles.collapseBadge}>{badge}</span>}
        </button>
        {open && actions && <div className={styles.sampleActions}>{actions}</div>}
      </div>
      {open && children}
    </div>
  );
}
