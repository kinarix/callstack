import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DataGrid, renderTextEditor, type Column, type SortColumn, type RenderHeaderCellProps, type DataGridHandle } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { useApp } from '../../context/AppContext';
import { useDatabase } from '../../hooks/useDatabase';
import { parseCsv, csvToString } from '../../lib/parseCsv';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import styles from './DataFileView.module.css';

interface Props {
  dataFileId: number;
  showExpandBtn?: boolean;
  onExpand?: () => void;
}

type RowData = Record<string, string>;

let _nextId = 0;
const makeId = () => String(++_nextId);

function toRowObjects(headers: string[], rows: string[][]): RowData[] {
  return rows.map((r) => {
    const obj: RowData = { __id__: makeId() };
    headers.forEach((_, i) => { obj[`c${i}`] = r[i] ?? ''; });
    return obj;
  });
}

function fromRowObjects(colCount: number, rowObjs: RowData[]): string[][] {
  return rowObjs.map((r) => Array.from({ length: colCount }, (_, i) => r[`c${i}`] ?? ''));
}

// ── Editable column header ───────────────────────────────────────────────────

interface EditableHeaderProps extends RenderHeaderCellProps<RowData> {
  headerName: string;
  colIdx: number;
  onRename: (colIdx: number, value: string) => void;
  onDelete: (colIdx: number) => void;
  showFilters: boolean;
  filterValue: string;
  onFilterChange: (colIdx: number, value: string) => void;
}

function EditableHeader({
  headerName, colIdx, sortDirection,
  onRename, onDelete,
  showFilters, filterValue, onFilterChange,
}: EditableHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(headerName);
  const inputRef = useRef<HTMLInputElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(headerName); }, [headerName]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    onRename(colIdx, value);
  };

  const sortIcon = sortDirection === 'ASC' ? ' ↑' : sortDirection === 'DESC' ? ' ↓' : '';

  return (
    <div className={`${styles.headerCellInner} ${showFilters ? styles.headerCellInnerWithFilter : ''}`}>
      <div className={styles.headerTop}>
        {editing ? (
          <input
            ref={inputRef}
            className={styles.headerInput}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.stopPropagation(); commit(); }
              if (e.key === 'Escape') { e.stopPropagation(); setValue(headerName); setEditing(false); }
              e.stopPropagation();
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={styles.headerLabel}
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title="Double-click to rename"
          >
            {headerName || `col${colIdx + 1}`}{sortIcon}
          </span>
        )}
        <button
          className={styles.deleteColBtn}
          onClick={(e) => { e.stopPropagation(); onDelete(colIdx); }}
          title="Delete column"
          type="button"
        >
          ×
        </button>
      </div>
      {showFilters && (
        <div className={styles.filterRow} onClick={(e) => e.stopPropagation()}>
          <input
            ref={filterRef}
            className={`${styles.filterInput} ${filterValue ? styles.filterInputActive : ''}`}
            placeholder="Filter…"
            value={filterValue}
            onChange={(e) => onFilterChange(colIdx, e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
          {filterValue && (
            <button
              className={styles.filterClearBtn}
              onClick={() => onFilterChange(colIdx, '')}
              type="button"
              title="Clear filter"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function DataFileView({ dataFileId, showExpandBtn, onExpand }: Props) {
  const { state, dispatch } = useApp();
  const { updateDataFile } = useDatabase();

  const dataFile = useMemo(
    () => state.dataFiles.find((d) => d.id === dataFileId) ?? null,
    [state.dataFiles, dataFileId]
  );

  const [name, setName] = useState(dataFile?.name ?? '');
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const parsed = useMemo(
    () => (dataFile ? parseCsv(dataFile.content) : { headers: [], rows: [] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataFile?.content]
  );

  const [headers, setHeaders] = useState<string[]>(parsed.headers);
  const [rowObjects, setRowObjects] = useState<RowData[]>(() => toRowObjects(parsed.headers, parsed.rows));
  const [sortColumns, setSortColumns] = useState<SortColumn[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [pendingDeleteCol, setPendingDeleteCol] = useState<number | null>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const rowObjectsRef = useRef(rowObjects);
  useEffect(() => { rowObjectsRef.current = rowObjects; }, [rowObjects]);

  const gridRef = useRef<DataGridHandle>(null);

  // Track whether there are columns beyond the visible area
  const colCount = headers.length;
  useEffect(() => {
    const el = gridRef.current?.element;
    if (!el) return;
    const check = () => setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    check();
    el.addEventListener('scroll', check, { passive: true });
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', check); ro.disconnect(); };
    // Re-run whenever columns change so we recheck after layout
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colCount, dataFileId]);

  // Reload when switching data files
  useEffect(() => {
    if (!dataFile) return;
    setName(dataFile.name);
    const p = parseCsv(dataFile.content);
    setHeaders(p.headers);
    setRowObjects(toRowObjects(p.headers, p.rows));
    setSortColumns([]);
    setFilters({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataFile?.id]);

  // Clear filters when column count changes (add/delete column)
  const prevColCount = useRef(headers.length);
  useEffect(() => {
    if (headers.length !== prevColCount.current) {
      setFilters({});
      prevColCount.current = headers.length;
    }
  }, [headers.length]);

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const schedSave = useCallback(
    (newName: string, newHeaders: string[], newRowObjs: RowData[]) => {
      if (!dataFile) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const trimmed = newName.trim() || dataFile.name;
        const rows = fromRowObjects(newHeaders.length, newRowObjs);
        const content = newHeaders.length > 0 ? csvToString(newHeaders, rows) : '';
        const updated = await updateDataFile(dataFile.id, trimmed, content);
        dispatch({ type: 'UPDATE_DATA_FILE', payload: updated });
      }, 400);
    },
    [dataFile, updateDataFile, dispatch]
  );

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  if (!dataFile) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>Data file not found.</div>
      </div>
    );
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleNameCommit = () => {
    setEditingName(false);
    if (!name.trim()) setName(dataFile.name);
    schedSave(name, headers, rowObjects);
  };

  const handleRenameColumn = useCallback((colIdx: number, value: string) => {
    setHeaders((prev) => {
      const next = prev.map((h, i) => (i === colIdx ? value : h));
      schedSave(name, next, rowObjectsRef.current);
      return next;
    });
  }, [name, schedSave]);

  const deleteColumn = useCallback((colIdx: number) => {
    setHeaders((prevH) => {
      const newHeaders = prevH.filter((_, i) => i !== colIdx);
      setRowObjects((prevR) => {
        const newRowObjs = prevR.map((r) => {
          const obj: RowData = { __id__: r.__id__ };
          newHeaders.forEach((_, newI) => {
            const oldI = newI >= colIdx ? newI + 1 : newI;
            obj[`c${newI}`] = r[`c${oldI}`] ?? '';
          });
          return obj;
        });
        schedSave(name, newHeaders, newRowObjs);
        return newRowObjs;
      });
      return newHeaders;
    });
    setPendingDeleteCol(null);
  }, [name, schedSave]);

  const requestDeleteColumn = useCallback((colIdx: number) => {
    setPendingDeleteCol(colIdx);
  }, []);

  const addColumn = useCallback(() => {
    const newColIdx = headers.length; // index after row-num column (+1 offset in grid)
    setHeaders((prevH) => {
      const newHeaders = [...prevH, `col${prevH.length + 1}`];
      const colKey = `c${prevH.length}`;
      setRowObjects((prevR) => {
        const newRowObjs = prevR.map((r) => ({ ...r, [colKey]: '' }));
        schedSave(name, newHeaders, newRowObjs);
        return newRowObjs;
      });
      return newHeaders;
    });
    // Scroll to newly added column after render (+1 because col 0 is the row-number column)
    setTimeout(() => gridRef.current?.scrollToCell({ idx: newColIdx + 1, rowIdx: 0 }), 0);
  }, [name, headers.length, schedSave]);

  const deleteRowById = useCallback((id: string) => {
    const newObjs = rowObjectsRef.current.filter((r) => r.__id__ !== id);
    setRowObjects(newObjs);
    schedSave(name, headers, newObjs);
  }, [name, headers, schedSave]);

  const addRow = useCallback(() => {
    const newObj: RowData = { __id__: makeId() };
    headers.forEach((_, i) => { newObj[`c${i}`] = ''; });
    const newRowObjs = [...rowObjectsRef.current, newObj];
    setRowObjects(newRowObjs);
    schedSave(name, headers, newRowObjs);
  }, [name, headers, schedSave]);

  const handleImportCsv = useCallback(async () => {
    const bytes = await invoke<number[] | null>('pick_file', { filters: ['csv'] });
    if (!bytes) return;
    const text = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    const p = parseCsv(text);
    const newRowObjs = toRowObjects(p.headers, p.rows);
    setHeaders(p.headers);
    setRowObjects(newRowObjs);
    schedSave(name, p.headers, newRowObjs);
  }, [name, schedSave]);

  const handleRowsChange = useCallback((updatedRows: RowData[]) => {
    const updatedMap = new Map(updatedRows.map((r) => [r.__id__, r]));
    const newObjs = rowObjectsRef.current.map((r) => updatedMap.get(r.__id__) ?? r);
    setRowObjects(newObjs);
    schedSave(name, headers, newObjs);
  }, [name, headers, schedSave]);

  const handleFilterChange = useCallback((colIdx: number, value: string) => {
    setFilters((prev) => ({ ...prev, [`c${colIdx}`]: value }));
  }, []);

  const clearAllFilters = useCallback(() => setFilters({}), []);

  // ── Filtered + sorted rows ───────────────────────────────────────────────────

  const activeFilters = Object.entries(filters).filter(([, v]) => v.trim() !== '');

  const filteredRows = useMemo(() => {
    if (!activeFilters.length) return rowObjects;
    return rowObjects.filter((row) =>
      activeFilters.every(([key, term]) =>
        (row[key] ?? '').toLowerCase().includes(term.toLowerCase())
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowObjects, filters]);

  const sortedRows = useMemo(() => {
    if (!sortColumns.length) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      for (const sc of sortColumns) {
        const aVal = a[sc.columnKey] ?? '';
        const bVal = b[sc.columnKey] ?? '';
        const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
        if (cmp !== 0) return sc.direction === 'ASC' ? cmp : -cmp;
      }
      return 0;
    });
  }, [filteredRows, sortColumns]);

  // ── Column definitions ───────────────────────────────────────────────────────

  const columns = useMemo((): Column<RowData>[] => {
    const rowNumCol: Column<RowData> = {
      key: '__rownum__',
      name: '',
      width: 52,
      minWidth: 52,
      maxWidth: 52,
      frozen: true,
      resizable: false,
      sortable: false,
      cellClass: styles.rowNumCell,
      renderCell: ({ row, rowIdx }) => (
        <div className={styles.rowNumInner}>
          <span className={styles.rowNumLabel}>{rowIdx + 1}</span>
          <button
            className={styles.deleteRowBtnInline}
            onClick={(e) => { e.stopPropagation(); deleteRowById(row.__id__); }}
            title="Delete row"
            type="button"
          >
            ×
          </button>
        </div>
      ),
    };

    const dataCols: Column<RowData>[] = headers.map((h, i) => ({
      key: `c${i}`,
      name: h,
      resizable: true,
      sortable: true,
      editable: true,
      minWidth: 80,
      renderEditCell: renderTextEditor,
      renderHeaderCell: (props) => (
        <EditableHeader
          {...props}
          headerName={h}
          colIdx={i}
          onRename={handleRenameColumn}
          onDelete={requestDeleteColumn}
          showFilters={showFilters}
          filterValue={filters[`c${i}`] ?? ''}
          onFilterChange={handleFilterChange}
        />
      ),
    }));

    return [rowNumCol, ...dataCols];
  }, [headers, deleteRowById, handleRenameColumn, requestDeleteColumn, showFilters, filters, handleFilterChange]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const isFiltered = activeFilters.length > 0;

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        {showExpandBtn && (
          <button className={styles.expandBtn} onClick={onExpand} title="Show navigator">›</button>
        )}
        <div className={styles.nameWrapper}>
          {editingName ? (
            <input
              ref={nameInputRef}
              className={styles.nameInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameCommit();
                if (e.key === 'Escape') { setName(dataFile.name); setEditingName(false); }
              }}
            />
          ) : (
            <button className={styles.nameBtn} onClick={() => setEditingName(true)} title="Rename">
              {name}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
        <button
          className={`${styles.filterToggleBtn} ${showFilters ? styles.filterToggleBtnActive : ''}`}
          onClick={() => { setShowFilters((v) => !v); if (showFilters) clearAllFilters(); }}
          title={showFilters ? 'Hide filters' : 'Show filters'}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M1 2.5h10M3 6h6M5 9.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Filter
          {isFiltered && <span className={styles.filterBadge}>{activeFilters.length}</span>}
        </button>
        <button className={styles.importBtn} onClick={handleImportCsv} title="Import CSV file">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
            <path d="M6.5 1v8M3.5 6.5l3 2.5 3-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M1.5 10.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          Import CSV
        </button>
      </div>

      <div className={styles.body}>
        {colCount === 0 ? (
          <div className={styles.emptyGrid}>
            <p>No data yet.</p>
            <div className={styles.emptyActions}>
              <button className={styles.addBtn} onClick={addColumn}>+ Add Column</button>
              <button className={styles.addBtn} onClick={handleImportCsv}>Import CSV</button>
            </div>
          </div>
        ) : (
          <>
            <div className={`${styles.gridWrapper} ${canScrollRight ? styles.gridWrapperScrollRight : ''}`}>
              <DataGrid
                ref={gridRef}
                className={styles.grid}
                columns={columns}
                rows={sortedRows}
                rowKeyGetter={(row) => row.__id__}
                onRowsChange={handleRowsChange}
                sortColumns={sortColumns}
                onSortColumnsChange={setSortColumns}
                rowHeight={30}
                headerRowHeight={showFilters ? 62 : 34}
                onFill={({ columnKey, sourceRow, targetRow }) => ({ ...targetRow, [columnKey]: sourceRow[columnKey] })}
                onCellPaste={(args, event) => {
                  const text = event.clipboardData.getData('text/plain');
                  return { ...args.row, [args.column.key]: text };
                }}
              />
            </div>
            <div className={styles.footer}>
              <button className={styles.addBtn} onClick={addRow}>+ Add Row</button>
              <button className={styles.addBtn} onClick={addColumn}>+ Add Column</button>
              {isFiltered && (
                <button className={styles.clearFiltersBtn} onClick={clearAllFilters} title="Clear all filters">
                  Clear filters
                </button>
              )}
              <span className={styles.stats}>
                {isFiltered
                  ? `${filteredRows.length} / ${rowObjects.length} rows · ${colCount} col${colCount !== 1 ? 's' : ''}`
                  : `${colCount} col${colCount !== 1 ? 's' : ''} · ${rowObjects.length} row${rowObjects.length !== 1 ? 's' : ''}`
                }
              </span>
            </div>
          </>
        )}
      </div>

      {pendingDeleteCol !== null && (
        <ConfirmModal
          title={`Delete column "${headers[pendingDeleteCol] || `col${pendingDeleteCol + 1}`}"?`}
          confirmLabel="Delete"
          onConfirm={() => deleteColumn(pendingDeleteCol)}
          onCancel={() => setPendingDeleteCol(null)}
        >
          <p>All data in this column will be permanently removed.</p>
        </ConfirmModal>
      )}
    </div>
  );
}
