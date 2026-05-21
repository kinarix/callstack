import { useEffect, useMemo, useRef, useState } from 'react';
import type { Request, PreChainStep } from '../../lib/types';
import styles from './PreChainEditor.module.css';

interface PreChainEditorProps {
  currentRequest: Request;
  siblingRequests: Request[];
  onChange: (steps: PreChainStep[]) => void;
}

function methodColorVar(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return 'var(--accent-get)';
    case 'POST': return 'var(--accent-post)';
    case 'PUT': return 'var(--accent-put)';
    case 'DELETE': return 'var(--accent-delete)';
    case 'PATCH': return 'var(--accent-patch)';
    default: return 'var(--accent-options)';
  }
}

export function PreChainEditor({ currentRequest, siblingRequests, onChange }: Readonly<PreChainEditorProps>) {
  const steps = currentRequest.pre_chain ?? [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const requestById = useMemo(() => {
    const m = new Map<number, Request>();
    for (const r of siblingRequests) m.set(r.id, r);
    return m;
  }, [siblingRequests]);

  const grouped = useMemo(() => {
    const eligible = siblingRequests.filter(r => r.id !== currentRequest.id);
    const byFolder = new Map<number | null, Request[]>();
    for (const r of eligible) {
      const k = r.folder_id ?? null;
      if (!byFolder.has(k)) byFolder.set(k, []);
      byFolder.get(k)!.push(r);
    }
    for (const list of byFolder.values()) {
      list.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    }
    return byFolder;
  }, [siblingRequests, currentRequest.id]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pickerOpen]);

  const updateStep = (index: number, patch: Partial<PreChainStep>) => {
    onChange(steps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeStep = (index: number) => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addStep = (requestId: number) => {
    onChange([...steps, { requestId, continueOnError: false }]);
    setPickerOpen(false);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.hint}>
        These requests run silently in order before the main request. Their responses go to the script console; any <code>env.set()</code> they perform is visible to the next step and the main request. Pre-chain is ignored inside automations.
      </div>

      {steps.length === 0 ? (
        <div className={styles.empty}>No pre-requests configured.</div>
      ) : (
        <div className={styles.list}>
          {steps.map((step, index) => {
            const req = requestById.get(step.requestId);
            const continueOn = step.continueOnError ?? false;
            return (
              <div
                key={`${step.requestId}-${index}`}
                className={`${styles.row} ${!req ? styles.rowMissing : ''}`}
              >
                <span className={styles.order}>{index + 1}.</span>
                {req ? (
                  <>
                    <span className={styles.method} style={{ color: methodColorVar(req.method) }}>
                      {req.method}
                    </span>
                    <span className={styles.name} title={req.name}>{req.name}</span>
                  </>
                ) : (
                  <span className={`${styles.name} ${styles.missing}`}>
                    Missing (id #{step.requestId})
                  </span>
                )}
                <label className={styles.continueLabel} title="Continue running the chain even if this step fails">
                  <input
                    type="checkbox"
                    checked={continueOn}
                    onChange={(e) => updateStep(index, { continueOnError: e.target.checked })}
                  />
                  continue on error
                </label>
                <button
                  className={styles.iconBtn}
                  onClick={() => moveStep(index, -1)}
                  disabled={index === 0}
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  className={styles.iconBtn}
                  onClick={() => moveStep(index, 1)}
                  disabled={index === steps.length - 1}
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  className={`${styles.iconBtn} ${styles.remove}`}
                  onClick={() => removeStep(index)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.addRow}>
        <div className={styles.pickerWrap} ref={pickerRef}>
          <button
            className={styles.addBtn}
            onClick={() => setPickerOpen(o => !o)}
            type="button"
          >
            + Add request
          </button>
          {pickerOpen && (
            <div className={styles.picker}>
              {grouped.size === 0 ? (
                <div className={styles.empty}>No other requests in this project.</div>
              ) : (
                Array.from(grouped.entries()).map(([folderId, reqs]) => (
                  <div key={folderId ?? 'root'}>
                    <div className={styles.pickerGroup}>
                      {folderId === null ? 'Root' : `Folder #${folderId}`}
                    </div>
                    {reqs.map(r => (
                      <button
                        key={r.id}
                        className={styles.pickerItem}
                        onClick={() => addStep(r.id)}
                        type="button"
                      >
                        <span className={styles.method} style={{ color: methodColorVar(r.method) }}>
                          {r.method}
                        </span>
                        <span>{r.name}</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
