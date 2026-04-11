import { useState, useCallback } from 'react';
import type { ParsedRequest } from '../../utils/postmanParser';
import { getMethodColor } from '../../lib/utils';
import styles from './ImportModal.module.css';

interface ImportModalProps {
  collectionName: string;
  requests: ParsedRequest[];
  onImport: (selected: ParsedRequest[]) => void;
  onCancel: () => void;
}

function MethodBadge({ method }: { method: string }) {
  const knownMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
  const color = knownMethods.includes(method)
    ? getMethodColor(method as any)
    : 'var(--text-tertiary)';
  return (
    <span className={styles.methodBadge} style={{ backgroundColor: color }}>
      {method}
    </span>
  );
}

export function ImportModal({ collectionName, requests, onImport, onCancel }: ImportModalProps) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(requests.map((_, i) => i)));

  const allSelected = selected.size === requests.length;
  const noneSelected = selected.size === 0;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(requests.map((_, i) => i)));
    }
  }, [allSelected, requests]);

  const toggleOne = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleImport = useCallback(() => {
    const picked = requests.filter((_, i) => selected.has(i));
    onImport(picked);
  }, [requests, selected, onImport]);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.importIcon}>⬇</span>
          <div className={styles.headerText}>
            <div className={styles.title}>Import requests</div>
            <div className={styles.subtitle}>{collectionName}</div>
          </div>
        </div>

        <div className={styles.selectAll}>
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              className={styles.checkbox}
              checked={allSelected}
              ref={(el) => {
                if (el) el.indeterminate = !allSelected && !noneSelected;
              }}
              onChange={toggleAll}
            />
            <span className={styles.selectAllLabel}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </span>
            <span className={styles.count}>{requests.length} requests</span>
          </label>
        </div>

        <div className={styles.list}>
          {requests.map((req, i) => (
            <label key={i} className={styles.checkRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={selected.has(i)}
                onChange={() => toggleOne(i)}
              />
              <MethodBadge method={req.method} />
              <span className={styles.requestName} title={req.url}>
                {req.name}
              </span>
            </label>
          ))}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={styles.importBtn}
            onClick={handleImport}
            disabled={noneSelected}
          >
            Import {selected.size > 0 ? `${selected.size} ` : ''}selected
          </button>
        </div>
      </div>
    </div>
  );
}
