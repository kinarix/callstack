import { useState, useCallback, useMemo } from 'react';
import type { Request, Environment } from '../../lib/types';
import { getMethodColor } from '../../lib/utils';
import styles from './ExportModal.module.css';

export type ExportFormat = 'postman' | 'callstack';

export interface ExportItem {
  request: Request;
  folderName?: string;
}

export interface ExportResult {
  items: ExportItem[];
  format: ExportFormat;
  includeResponses: boolean;
  selectedEnvironmentIds: Set<number>;
}

interface ExportModalProps {
  title: string;
  items: ExportItem[];
  environments: Environment[];
  onExport: (result: ExportResult) => void;
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

export function ExportModal({ title, items, environments, onExport, onCancel }: ExportModalProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(items.map((item) => item.request.id)),
  );
  const [format, setFormat] = useState<ExportFormat>('callstack');
  const [includeResponses, setIncludeResponses] = useState(true);
  const [selectedEnvIds, setSelectedEnvIds] = useState<Set<number>>(
    () => new Set(environments.map((e) => e.id)),
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

  const toggleEnv = useCallback((id: number) => {
    setSelectedEnvIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const allEnvsSelected = environments.length > 0 && selectedEnvIds.size === environments.length;

  const toggleAllEnvs = useCallback(() => {
    if (allEnvsSelected) {
      setSelectedEnvIds(new Set());
    } else {
      setSelectedEnvIds(new Set(environments.map((e) => e.id)));
    }
  }, [allEnvsSelected, environments]);

  const handleExport = useCallback(() => {
    const picked = items.filter((item) => selected.has(item.request.id));
    onExport({ items: picked, format, includeResponses, selectedEnvironmentIds: selectedEnvIds });
  }, [items, selected, format, includeResponses, selectedEnvIds, onExport]);

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

        {/* Format selector */}
        <div className={styles.formatSection}>
          <div className={styles.formatLabel}>Format</div>
          <div className={styles.formatOptions}>
            <label className={styles.formatOption}>
              <input
                type="radio"
                name="format"
                value="callstack"
                checked={format === 'callstack'}
                onChange={() => setFormat('callstack')}
              />
              <span className={styles.formatText}>
                <span className={styles.formatName}>Callstack Archive</span>
                <span className={styles.formatDesc}>Full project backup with scripts & environments</span>
              </span>
            </label>
            <label className={styles.formatOption}>
              <input
                type="radio"
                name="format"
                value="postman"
                checked={format === 'postman'}
                onChange={() => setFormat('postman')}
              />
              <span className={styles.formatText}>
                <span className={styles.formatName}>Postman Collection</span>
                <span className={styles.formatDesc}>Compatible with Postman v2.1</span>
              </span>
            </label>
          </div>

          {format === 'callstack' && (
            <div className={styles.callstackOptions}>
              <div className={styles.alwaysIncluded}>
                <span className={styles.includedLabel}>Always included:</span>
                <span className={styles.includedPill}>Folders</span>
                <span className={styles.includedPill}>Scripts</span>
              </div>
              <label className={styles.optionRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={includeResponses}
                  onChange={(e) => setIncludeResponses(e.target.checked)}
                />
                <span className={styles.optionText}>Include stored responses</span>
              </label>
            </div>
          )}
        </div>

        {/* Environments (Callstack only) */}
        {format === 'callstack' && environments.length > 0 && (
          <div className={styles.envsSection}>
            <div className={styles.envsSectionHeader}>
              <span className={styles.envsSectionLabel}>Environments</span>
              <button
                type="button"
                className={styles.envToggleAll}
                onClick={toggleAllEnvs}
              >
                {allEnvsSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <div className={styles.envList}>
              {environments.map((env) => (
                <label key={env.id} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={selectedEnvIds.has(env.id)}
                    onChange={() => toggleEnv(env.id)}
                  />
                  <span className={styles.envName}>{env.name}</span>
                  <span className={styles.count}>{env.variables.length} var{env.variables.length !== 1 ? 's' : ''}</span>
                </label>
              ))}
            </div>
          </div>
        )}

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
