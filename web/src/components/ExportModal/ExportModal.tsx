import { useState, useCallback, useMemo } from 'react';
import type { Request } from '../../lib/types';
import { getMethodColor } from '../../lib/utils';
import styles from './ExportModal.module.css';

export interface ExportItem {
  request: Request;
  folderName?: string;
}

interface ExportModalProps {
  title: string;
  items: ExportItem[];
  onExport: (selected: ExportItem[]) => void;
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

export function ExportModal({ title, items, onExport, onCancel }: ExportModalProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(items.map((item) => item.request.id)),
  );

  const allSelected = selected.size === items.length;
  const noneSelected = selected.size === 0;

  // Group items by folderName for display
  const groups = useMemo(() => {
    const map = new Map<string | undefined, ExportItem[]>();
    for (const item of items) {
      const key = item.folderName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([name, groupItems]) => ({ name, items: groupItems }));
  }, [items]);

  const showGroupHeaders = groups.length > 1 || groups[0]?.name !== undefined;

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((item) => item.request.id)));
    }
  }, [allSelected, items]);

  const toggleOne = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleGroup = useCallback((groupItems: ExportItem[]) => {
    const ids = groupItems.map((i) => i.request.id);
    const allGroupSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allGroupSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [selected]);

  const handleExport = useCallback(() => {
    const picked = items.filter((item) => selected.has(item.request.id));
    onExport(picked);
  }, [items, selected, onExport]);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.exportIcon}>⬆</span>
          <div className={styles.headerText}>
            <div className={styles.title}>{title}</div>
            <div className={styles.subtitle}>{items.length} request{items.length !== 1 ? 's' : ''}</div>
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
            <span className={styles.count}>{items.length} requests</span>
          </label>
        </div>

        <div className={styles.list}>
          {groups.map((group, gi) => (
            <div key={gi}>
              {showGroupHeaders && group.name && (
                <div className={styles.folderHeader}>
                  <label className={styles.folderCheckRow}>
                    <input
                      type="checkbox"
                      className={styles.checkbox}
                      checked={group.items.every((i) => selected.has(i.request.id))}
                      ref={(el) => {
                        if (el) {
                          const someSelected = group.items.some((i) => selected.has(i.request.id));
                          const allGroupSel = group.items.every((i) => selected.has(i.request.id));
                          el.indeterminate = someSelected && !allGroupSel;
                        }
                      }}
                      onChange={() => toggleGroup(group.items)}
                    />
                    <span className={styles.folderName}>{group.name}</span>
                    <span className={styles.count}>{group.items.length}</span>
                  </label>
                </div>
              )}
              {group.items.map((item) => (
                <label
                  key={item.request.id}
                  className={`${styles.checkRow} ${showGroupHeaders && group.name ? styles.indented : ''}`}
                >
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selected.has(item.request.id)}
                    onChange={() => toggleOne(item.request.id)}
                  />
                  <MethodBadge method={item.request.method} />
                  <span className={styles.requestName} title={item.request.url}>
                    {item.request.name}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button
            className={styles.exportBtn}
            onClick={handleExport}
            disabled={noneSelected}
          >
            Export {selected.size > 0 ? `${selected.size} ` : ''}selected
          </button>
        </div>
      </div>
    </div>
  );
}
