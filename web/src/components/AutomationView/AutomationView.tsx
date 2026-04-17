import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useDatabase } from '../../hooks/useDatabase';
import { useAutomationRunner } from '../../hooks/useAutomationRunner';
import type { AutomationRequestResult, AutomationRun, AutomationStep, BranchCondition, DataFile, Environment, LogScope } from '../../lib/types';
import { parseCsv } from '../../lib/parseCsv';
import { invoke } from '@tauri-apps/api/core';
import { formatBody } from '../../lib/formatBody';
import styles from './AutomationView.module.css';
import { EnvSelector } from '../RequestBuilder/EnvSelector';

// ── Helpers ──────────────────────────────────────────────────

function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return 'var(--accent-get)';
    case 'POST': return 'var(--accent-post)';
    case 'PUT': return 'var(--accent-put)';
    case 'DELETE': return 'var(--accent-delete)';
    case 'PATCH': return 'var(--accent-patch)';
    default: return 'var(--text-secondary)';
  }
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string): string {
  const normalized = iso.endsWith('Z') ? iso : iso.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'var(--accent-get)';
  if (status >= 300 && status < 400) return 'var(--accent-put)';
  if (status >= 400) return 'var(--accent-delete)';
  return 'var(--text-secondary)';
}

function runStatusClass(status: string, s: Record<string, string>): string {
  switch (status) {
    case 'PASS': return s.runStatusPass;
    case 'FAIL': return s.runStatusFail;
    case 'PARTIAL': return s.runStatusPartial;
    default: return s.runStatusError;
  }
}

function resultPassed(result: AutomationRequestResult): boolean {
  if (result.error) return false;
  if (result.testResults.length > 0) return result.testStatus === 'PASS';
  return result.status >= 200 && result.status < 300;
}

function resultFailed(result: AutomationRequestResult): boolean {
  if (result.error) return true;
  if (result.testResults.length > 0) return result.testStatus === 'FAIL' || result.testStatus === 'PARTIAL';
  return result.status >= 400 || result.status === 0;
}

function formatResultAsText(result: AutomationRequestResult, idx: number): string {
  const lines: string[] = [];
  const sep = '─'.repeat(60);

  lines.push(`Result #${idx + 1}: ${result.method} ${result.requestName}`);
  lines.push(sep);

  if (result.rowData && Object.keys(result.rowData).length > 0) {
    lines.push(`Data Row ${result.rowIndex}`);
    for (const [k, v] of Object.entries(result.rowData)) lines.push(`  ${k}: ${v}`);
    lines.push('');
  }

  lines.push('REQUEST');
  lines.push(`  ${result.url}`);
  if (result.requestParams && result.requestParams.length > 0) {
    lines.push('  Params:');
    for (const p of result.requestParams) lines.push(`    ${p.key}: ${p.value}`);
  }
  if (result.requestHeaders && result.requestHeaders.length > 0) {
    lines.push('  Headers:');
    for (const h of result.requestHeaders) lines.push(`    ${h.key}: ${h.value}`);
  }
  if (result.requestBody) {
    lines.push('  Body:');
    lines.push(`    ${result.requestBody}`);
  }
  lines.push('');

  if (result.error) {
    lines.push('ERROR');
    lines.push(`  ${result.error}`);
  } else {
    lines.push('RESPONSE');
    lines.push(`  ${result.status} ${result.statusText} · ${result.timeMs}ms`);
    if (result.responseHeaders && result.responseHeaders.length > 0) {
      lines.push('  Headers:');
      for (const h of result.responseHeaders) lines.push(`    ${h.key}: ${h.value}`);
    }
    if (result.responseBody) {
      lines.push('  Body:');
      lines.push(`    ${result.responseBody}`);
    }
  }

  if (result.testResults.length > 0) {
    lines.push('');
    const passed = result.testResults.filter((t) => t.passed).length;
    lines.push(`TESTS (${passed}/${result.testResults.length} passed)`);
    for (const t of result.testResults) {
      lines.push(`  ${t.passed ? '✓' : '✗'} ${t.description}${t.error ? ' — ' + t.error : ''}`);
    }
  }

  if (result.curl) {
    lines.push('');
    lines.push('CURL');
    lines.push(result.curl);
  }

  return lines.join('\n');
}

function newStep(type: AutomationStep['type'], requestId?: number): AutomationStep {
  const id = crypto.randomUUID();
  switch (type) {
    case 'request': return { id, type: 'request', requestId: requestId ?? 0 };
    case 'delay': return { id, type: 'delay', delayMs: 1000 };
    case 'repeat': return { id, type: 'repeat', count: 3, steps: [] };
    case 'branch': return { id, type: 'branch', condition: { type: 'lastRequestPass' }, trueSteps: [], falseSteps: [] };
    case 'fanout': return { id, type: 'fanout', lanes: [[], []] };
    case 'stop': return { id, type: 'stop' };
    case 'log': return { id, type: 'log', scope: 'request', object: 'all' };
    case 'csv_iterator': return { id, type: 'csv_iterator', dataFileId: null, steps: [] };
    case 'set_env': return { id, type: 'set_env', envId: null };
  }
}

// ── Palette ──────────────────────────────────────────────────

const PALETTE_ITEMS: { type: AutomationStep['type']; label: string; color: string; icon: string; hint: string }[] = [
  { type: 'set_env', label: 'Set Env', color: 'var(--accent-get)', icon: '⊙', hint: 'Switch active environment' },
  { type: 'delay', label: 'Delay', color: 'var(--accent-put)', icon: '⏱', hint: 'Wait before next step' },
  { type: 'repeat', label: 'Repeat', color: 'var(--accent-patch)', icon: '↻', hint: 'Loop elements N times' },
  { type: 'csv_iterator', label: 'Iterator', color: 'var(--accent-patch)', icon: '⊞', hint: 'Run steps once per CSV row' },
  { type: 'branch', label: 'Branch', color: 'var(--accent-put)', icon: '⑂', hint: 'If/else fork' },
  { type: 'fanout', label: 'Fanout', color: 'var(--accent-options)', icon: '⑃', hint: 'Run all lanes sequentially with same input' },
  { type: 'log', label: 'Log', color: 'var(--accent-post)', icon: '⊕', hint: 'Log a value to the console' },
  { type: 'stop', label: 'Stop', color: 'var(--accent-delete)', icon: '◼', hint: 'End the run' },
];

// ── Step list editor ─────────────────────────────────────────

interface StepListProps {
  steps: AutomationStep[];
  onChange: (steps: AutomationStep[]) => void;
  requests: { id: number; name: string; method: string; folder_id: number | null }[];
  automationProjectId: number;
  projectEnvs: Environment[];
  depth?: number;
  dragSourceRef: React.MutableRefObject<DragSource | null>;
  dragPath: number[] | null;
  setDragPath: (path: number[] | null) => void;
  path?: number[];
  deleteStepPath: number[] | null;
  setDeleteStepPath: (path: number[] | null) => void;
  onConfirmDelete: (path: number[]) => void;
}

type DragSource =
  | { kind: 'palette'; type: AutomationStep['type'] }
  | { kind: 'step'; fromPath: number[] };

function StepList({ steps, onChange, requests, automationProjectId, projectEnvs, depth = 0, dragSourceRef, dragPath, setDragPath, path = [], deleteStepPath, setDeleteStepPath, onConfirmDelete }: StepListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [insertIdx, setInsertIdx] = useState<number | null>(null);

  const removeAt = useCallback((idx: number) => {
    onChange(steps.filter((_, i) => i !== idx));
  }, [steps, onChange]);

  const updateAt = useCallback((idx: number, step: AutomationStep) => {
    onChange(steps.map((s, i) => (i === idx ? step : s)));
  }, [steps, onChange]);

  const getInsertIdx = useCallback((clientY: number): number => {
    if (!listRef.current) return steps.length;
    const cards = listRef.current.querySelectorAll(':scope > [data-step-card]');
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return cards.length;
  }, [steps.length]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    const isSameProjectRequest = e.dataTransfer.types.includes(`callstack/request-project-${automationProjectId}`);
    const isAnyRequest = e.dataTransfer.types.includes('callstack/request');

    if (dragSourceRef.current) {
      // Internal step / palette drag — always allow
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = dragSourceRef.current.kind === 'palette' ? 'copy' : 'move';
      setInsertIdx(getInsertIdx(e.clientY));
      return;
    }

    if (isSameProjectRequest) {
      // Sidebar request from this project — accept drop, match effectAllowed='move'
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setInsertIdx(getInsertIdx(e.clientY));
      return;
    }

    if (isAnyRequest) {
      // Cross-project request — explicitly reject to show forbidden cursor
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'none';
      setInsertIdx(null);
      return;
    }

    // Unrelated drag — ignore entirely
  }, [getInsertIdx, dragSourceRef, automationProjectId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!listRef.current?.contains(e.relatedTarget as Node)) {
      setInsertIdx(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const idx = insertIdx ?? steps.length;
    setInsertIdx(null);

    // Sidebar request drop
    const requestDataStr = e.dataTransfer.getData('callstack/request');
    if (requestDataStr) {
      try {
        const { id, projectId } = JSON.parse(requestDataStr) as { id: number; projectId: number };
        if (projectId === automationProjectId) {
          const next = [...steps];
          next.splice(idx, 0, newStep('request', id));
          onChange(next);
        }
      } catch { /* ignore malformed data */ }
      dragSourceRef.current = null;
      setDragPath(null);
      return;
    }

    const src = dragSourceRef.current;
    if (!src) return;

    if (src.kind === 'palette') {
      const next = [...steps];
      next.splice(idx, 0, newStep(src.type));
      onChange(next);
    } else if (src.kind === 'step') {
      const fromPath = src.fromPath;
      if (fromPath.length === path.length + 1 && fromPath.slice(0, path.length).every((v, i) => v === path[i])) {
        const fromIdx = fromPath[fromPath.length - 1];
        const next = [...steps];
        const [moved] = next.splice(fromIdx, 1);
        const insertPos = idx > fromIdx ? idx - 1 : idx;
        next.splice(insertPos, 0, moved);
        onChange(next);
      }
    }
    dragSourceRef.current = null;
    setDragPath(null);
  }, [steps, onChange, insertIdx, path, dragSourceRef, setDragPath, automationProjectId]);

  return (
    <div
      ref={listRef}
      className={styles.stepList}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {steps.length === 0 && insertIdx === null && (
        <div className={styles.stepListEmpty}>
          {depth === 0 ? 'Drag a request from the sidebar, or drop elements from the palette' : 'Drop elements here'}
        </div>
      )}
      {insertIdx === 0 && <div className={styles.dropIndicator} />}
      {steps.map((step, idx) => {
        const stepPath = [...path, idx];
        const isBeingDragged = dragPath !== null && dragPath.length === stepPath.length && dragPath.every((v, i) => v === stepPath[i]);
        return (
          <React.Fragment key={step.id}>
            {idx > 0 && <div className={styles.stepConnector} />}
            <div
              data-step-card="true"
              className={`${styles.stepCard}${depth > 0 ? ` ${styles.stepCardNested}` : ''}${styles[`stepCard_${step.type}`] ? ` ${styles[`stepCard_${step.type}`]}` : ''}${isBeingDragged ? ` ${styles.stepCardDragging}` : ''}`}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'step', path: stepPath }));
                e.dataTransfer.effectAllowed = 'move';
                dragSourceRef.current = { kind: 'step', fromPath: stepPath };
                setDragPath(stepPath);
              }}
              onDragEnd={() => {
                dragSourceRef.current = null;
                setDragPath(null);
                setInsertIdx(null);
              }}
            >
              <StepCard
                step={step}
                requests={requests}
                automationProjectId={automationProjectId}
                projectEnvs={projectEnvs}
                onChange={(s) => updateAt(idx, s)}
                onRemove={() => removeAt(idx)}
                dragSourceRef={dragSourceRef}
                dragPath={dragPath}
                setDragPath={setDragPath}
                path={stepPath}
                depth={depth}
                deleteStepPath={deleteStepPath}
                setDeleteStepPath={setDeleteStepPath}
                onConfirmDelete={onConfirmDelete}
              />
            </div>
            {insertIdx === idx + 1 && <div className={styles.dropIndicator} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Custom dropdown components ───────────────────────────────


function ConditionSelector({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const pillRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        pillRef.current && !pillRef.current.contains(e.target as Node) &&
        panelRef.current && !panelRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (!pillRef.current) { setOpen((v) => !v); return; }
    const rect = pillRef.current.getBoundingClientRect();
    const panelHeight = Math.min(options.length * 32 + 8, 280);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    if (spaceBelow >= panelHeight || spaceBelow >= 120) {
      setPanelStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, minWidth: rect.width });
    } else {
      setPanelStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, minWidth: rect.width });
    }
    setOpen((v) => !v);
  };

  const selected = options.find((o) => o.value === value);

  return (
    <div className={styles.condDropWrapper}>
      <button ref={pillRef} className={styles.condDropPill} onMouseDown={(e) => e.stopPropagation()} onClick={handleOpen}>
        <span>{selected?.label ?? value}</span>
        <span className={styles.reqDropChevron}>▾</span>
      </button>
      {open && (
        <div ref={panelRef} className={styles.condDropPanel} style={panelStyle}>
          {options.map((o) => (
            <div
              key={o.value}
              className={`${styles.condDropOption} ${o.value === value ? styles.condDropOptionActive : ''}`}
              onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const LANE_COLORS = [
  'var(--accent-options)',
  'var(--accent-patch)',
  'var(--accent-put)',
  'var(--accent-get)',
  'var(--accent-put)',
  'var(--accent-delete)',
];

// ── Fanout step (needs own useState for activeLane) ──────────

function FanoutStep({ step, onChange, requests, automationProjectId, projectEnvs, depth, dragSourceRef, dragPath, setDragPath, path, deleteStepPath, setDeleteStepPath, onConfirmDelete }: {
  step: Extract<AutomationStep, { type: 'fanout' }>;
  onChange: (step: AutomationStep) => void;
  requests: { id: number; name: string; method: string; folder_id: number | null }[];
  automationProjectId: number;
  projectEnvs: Environment[];
  depth: number;
  dragSourceRef: React.MutableRefObject<DragSource | null>;
  dragPath: number[] | null;
  setDragPath: (path: number[] | null) => void;
  path: number[];
  deleteStepPath: number[] | null;
  setDeleteStepPath: (path: number[] | null) => void;
  onConfirmDelete: (path: number[]) => void;
}) {
  const [activeLane, setActiveLane] = useState(0);
  const [pendingRemoveLane, setPendingRemoveLane] = useState<number | null>(null);

  useEffect(() => {
    if (activeLane >= step.lanes.length) setActiveLane(step.lanes.length - 1);
  }, [step.lanes.length, activeLane]);

  const lane = Math.min(activeLane, step.lanes.length - 1);

  const isConfirmingDelete = deleteStepPath !== null && deleteStepPath.length === path.length && deleteStepPath.every((p, i) => p === path[i]);

  const addLane = () => {
    if (step.lanes.length < 6) onChange({ ...step, lanes: [...step.lanes, []] });
  };

  const removeLane = (idx: number) => {
    if (step.lanes.length > 2) {
      const newLanes = step.lanes.filter((_, i) => i !== idx);
      onChange({ ...step, lanes: newLanes });
      setPendingRemoveLane(null);
      if (activeLane >= newLanes.length) setActiveLane(newLanes.length - 1);
    }
  };

  return (
    <div className={styles.stepContainer}>
      <div className={styles.stepInner}>
        <span className={styles.stepDragHandle}>⠿</span>
        <span className={`${styles.stepTypeChip} ${styles.chipFanout}`}>Fanout</span>
        <span className={styles.stepHint}>{step.lanes.length} lanes — same input, sequential execution</span>
        {isConfirmingDelete ? (
          <span className={styles.stepConfirm}>
            <button className={styles.stepConfirmYes} onClick={(e) => { e.stopPropagation(); onConfirmDelete(path); }} title="Confirm delete">Yes</button>
            <button className={styles.stepConfirmNo} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(null); }} title="Cancel">No</button>
          </span>
        ) : (
          <button className={styles.stepRemove} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(path); }} title="Remove step">×</button>
        )}
      </div>
      <div className={styles.fanoutTabBar}>
        {step.lanes.map((_, i) => {
          const isPending = pendingRemoveLane === i;
          const color = LANE_COLORS[i % LANE_COLORS.length];
          const isActive = i === lane;
          return (
            <button
              key={i}
              className={isActive ? styles.fanoutTabActive : styles.fanoutTab}
              style={isActive ? { color, borderBottomColor: color } : undefined}
              onClick={() => { setActiveLane(i); setPendingRemoveLane(null); }}
            >
              <span className={styles.fanoutTabDot} style={{ background: color }} />
              Lane {i + 1}
              {step.lanes.length > 2 && !isPending && (
                <span className={styles.fanoutTabClose} onClick={(e) => { e.stopPropagation(); setPendingRemoveLane(i); }}>×</span>
              )}
              {step.lanes.length > 2 && isPending && (
                <>
                  <span className={styles.fanoutTabConfirmLabel}>Remove?</span>
                  <span className={styles.fanoutTabConfirmYes} onClick={(e) => { e.stopPropagation(); removeLane(i); }}>✓</span>
                  <span className={styles.fanoutTabConfirmNo} onClick={(e) => { e.stopPropagation(); setPendingRemoveLane(null); }}>✗</span>
                </>
              )}
            </button>
          );
        })}
        {step.lanes.length < 6 && (
          <button className={styles.fanoutTabAdd} onClick={addLane}>+ Lane</button>
        )}
      </div>
      <StepList
        steps={step.lanes[lane]}
        onChange={(s) => {
          const newLanes = [...step.lanes];
          newLanes[lane] = s;
          onChange({ ...step, lanes: newLanes });
        }}
        requests={requests}
        automationProjectId={automationProjectId}
        projectEnvs={projectEnvs}
        depth={depth + 1}
        dragSourceRef={dragSourceRef}
        dragPath={dragPath}
        setDragPath={setDragPath}
        path={[...path, lane]}
        deleteStepPath={deleteStepPath}
        setDeleteStepPath={setDeleteStepPath}
        onConfirmDelete={onConfirmDelete}
      />
      {step.lanes[lane].length === 0 && <div className={styles.nestedEmpty}>Drop elements here</div>}
    </div>
  );
}

// ── CSV Iterator step (needs own useState for dropdown) ──────

function CsvIteratorStep({ step, onChange, requests, automationProjectId, projectEnvs, depth, dragSourceRef, dragPath, setDragPath, path, deleteStepPath, setDeleteStepPath, onConfirmDelete }: {
  step: Extract<AutomationStep, { type: 'csv_iterator' }>;
  onChange: (step: AutomationStep) => void;
  requests: { id: number; name: string; method: string; folder_id: number | null }[];
  automationProjectId: number;
  projectEnvs: Environment[];
  depth: number;
  dragSourceRef: React.MutableRefObject<DragSource | null>;
  dragPath: number[] | null;
  setDragPath: (path: number[] | null) => void;
  path: number[];
  deleteStepPath: number[] | null;
  setDeleteStepPath: (path: number[] | null) => void;
  onConfirmDelete: (path: number[]) => void;
}) {
  const { state } = useApp();
  const projectDataFiles = state.dataFiles.filter((d: DataFile) => d.project_id === automationProjectId);
  const selected = step.dataFileId != null ? state.dataFiles.find((d: DataFile) => d.id === step.dataFileId) : null;
  const headers = selected ? parseCsv(selected.content).headers : [];

  const isConfirmingDelete = deleteStepPath !== null && deleteStepPath.length === path.length && deleteStepPath.every((p, i) => p === path[i]);

  const fileOptions: { value: string; label: string }[] = [
    { value: '', label: 'No file selected' },
    ...projectDataFiles.map((d: DataFile) => ({ value: String(d.id), label: d.name })),
  ];

  return (
    <div className={styles.stepContainer}>
      <div className={styles.stepInner}>
        <span className={styles.stepDragHandle}>⠿</span>
        <span className={`${styles.stepTypeChip} ${styles.chipCsvIterator}`}><span className={styles.chipIcon}>⊞</span>Iterator</span>
        <span className={styles.iteratorDatasetLabel}>Dataset:</span>
        <ConditionSelector
          value={step.dataFileId != null ? String(step.dataFileId) : ''}
          onChange={(v) => onChange({ ...step, dataFileId: v ? parseInt(v, 10) : null })}
          options={fileOptions}
        />
        <span className={styles.iteratorDatasetLabel}>Limit:</span>
        <input
          type="number"
          min={1}
          placeholder="all"
          value={step.limit != null ? step.limit : ''}
          onChange={(e) => {
            const val = e.target.value;
            onChange({ ...step, limit: val === '' ? null : Math.max(1, parseInt(val, 10)) });
          }}
          className={styles.iteratorLimitInput}
          title="Max rows to process (leave blank for all)"
        />
        {isConfirmingDelete ? (
          <span className={styles.stepConfirm}>
            <button className={styles.stepConfirmYes} onClick={(e) => { e.stopPropagation(); onConfirmDelete(path); }} title="Confirm delete">Yes</button>
            <button className={styles.stepConfirmNo} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(null); }} title="Cancel">No</button>
          </span>
        ) : (
          <button className={styles.stepRemove} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(path); }} title="Remove step">×</button>
        )}
      </div>
      {headers.length > 0 && (
        <div className={styles.csvIteratorVars}>
          {headers.map((h) => (
            <span key={h} className={styles.csvIteratorVar}>{`{{${h}}}`}</span>
          ))}
        </div>
      )}
      {selected == null && step.dataFileId != null && (
        <div className={styles.csvIteratorNoFile}>Data file not found</div>
      )}
      <div className={styles.nestedContainer}>
        <StepList
          steps={step.steps}
          onChange={(s) => onChange({ ...step, steps: s })}
          requests={requests}
          automationProjectId={automationProjectId}
          projectEnvs={projectEnvs}
          depth={depth + 1}
          dragSourceRef={dragSourceRef}
          dragPath={dragPath}
          setDragPath={setDragPath}
          path={path}
          deleteStepPath={deleteStepPath}
          setDeleteStepPath={setDeleteStepPath}
          onConfirmDelete={onConfirmDelete}
        />
        {step.steps.length === 0 && (
          <div className={styles.nestedEmpty}>Drop elements here or use the palette</div>
        )}
      </div>
    </div>
  );
}

// ── Individual step cards ────────────────────────────────────

interface StepCardProps {
  step: AutomationStep;
  requests: { id: number; name: string; method: string; folder_id: number | null }[];
  automationProjectId: number;
  projectEnvs: Environment[];
  onChange: (step: AutomationStep) => void;
  onRemove: () => void;
  dragSourceRef: React.MutableRefObject<DragSource | null>;
  dragPath: number[] | null;
  setDragPath: (path: number[] | null) => void;
  path: number[];
  depth: number;
  deleteStepPath: number[] | null;
  setDeleteStepPath: (path: number[] | null) => void;
  onConfirmDelete: (path: number[]) => void;
}

function StepCard({ step, requests, automationProjectId, projectEnvs, onChange, onRemove, dragSourceRef, dragPath, setDragPath, path, depth, deleteStepPath, setDeleteStepPath, onConfirmDelete }: StepCardProps) {
  const isConfirmingDelete = deleteStepPath !== null && deleteStepPath.length === path.length && deleteStepPath.every((p, i) => p === path[i]);
  switch (step.type) {
    case 'request': {
      const req = requests.find((r) => r.id === step.requestId);
      return (
        <div className={styles.stepInner}>
          <span className={styles.stepDragHandle}>⠿</span>
          <span className={`${styles.stepTypeChip} ${styles.chipRequest}`}><span className={styles.chipIcon}>▷</span>Request</span>
          {req ? (
            <span className={styles.reqPill}>
              <span className={styles.reqPillMethod} style={{ color: methodColor(req.method) }}>{req.method}</span>
              <span className={styles.reqPillName}>{req.name}</span>
            </span>
          ) : (
            <span className={styles.reqPillMissing}>unknown request</span>
          )}
          {isConfirmingDelete ? (
            <span className={styles.stepConfirm}>
              <button className={styles.stepConfirmYes} onClick={(e) => { e.stopPropagation(); onConfirmDelete(path); }} title="Confirm delete">Yes</button>
              <button className={styles.stepConfirmNo} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(null); }} title="Cancel">No</button>
            </span>
          ) : (
            <button className={styles.stepRemove} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(path); }} title="Remove step">×</button>
          )}
        </div>
      );
    }

    case 'delay':
      return (
        <div className={styles.stepInner}>
          <span className={styles.stepDragHandle}>⠿</span>
          <span className={`${styles.stepTypeChip} ${styles.chipDelay}`}><span className={styles.chipIcon}>⏱</span>Delay</span>
          <input
            type="number"
            className={styles.stepNumberInput}
            value={step.delayMs}
            min={0}
            onChange={(e) => onChange({ ...step, delayMs: Math.max(0, parseInt(e.target.value, 10) || 0) })}
          />
          <span className={styles.stepUnit}>ms</span>
          {isConfirmingDelete ? (
            <span className={styles.stepConfirm}>
              <button className={styles.stepConfirmYes} onClick={(e) => { e.stopPropagation(); onConfirmDelete(path); }} title="Confirm delete">Yes</button>
              <button className={styles.stepConfirmNo} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(null); }} title="Cancel">No</button>
            </span>
          ) : (
            <button className={styles.stepRemove} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(path); }} title="Remove step">×</button>
          )}
        </div>
      );

    case 'repeat':
      return (
        <div className={styles.stepContainer}>
          <div className={styles.stepInner}>
            <span className={styles.stepDragHandle}>⠿</span>
            <span className={`${styles.stepTypeChip} ${styles.chipRepeat}`}><span className={styles.chipIcon}>↻</span>Repeat</span>
            <input
              type="number"
              className={styles.stepNumberInput}
              value={step.count}
              min={1}
              onChange={(e) => onChange({ ...step, count: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            />
            <span className={styles.stepUnit}>times</span>
            {isConfirmingDelete ? (
              <span className={styles.stepConfirm}>
                <button className={styles.stepConfirmYes} onClick={(e) => { e.stopPropagation(); onConfirmDelete(path); }} title="Confirm delete">Yes</button>
                <button className={styles.stepConfirmNo} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(null); }} title="Cancel">No</button>
              </span>
            ) : (
              <button className={styles.stepRemove} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(path); }} title="Remove step">×</button>
            )}
          </div>
          <div className={styles.nestedContainer}>
            <StepList
              steps={step.steps}
              onChange={(s) => onChange({ ...step, steps: s })}
              requests={requests}
              automationProjectId={automationProjectId}
              projectEnvs={projectEnvs}
              depth={depth + 1}
              dragSourceRef={dragSourceRef}
              dragPath={dragPath}
              setDragPath={setDragPath}
              path={path}
              deleteStepPath={deleteStepPath}
              setDeleteStepPath={setDeleteStepPath}
              onConfirmDelete={onConfirmDelete}
            />
            {step.steps.length === 0 && (
              <div className={styles.nestedEmpty}>Drop elements here or use the palette</div>
            )}
          </div>
        </div>
      );

    case 'branch': {
      const conditionOptions: { value: string; label: string }[] = [
        { value: 'lastRequestPass', label: 'Last request passed' },
        { value: 'lastRequestFail', label: 'Last request failed' },
        { value: 'lastStatusGte', label: 'Last status ≥' },
        { value: 'lastStatusLt', label: 'Last status <' },
        { value: 'emittedEquals', label: 'Emitted equals' },
        { value: 'emittedExists', label: 'Emitted key exists' },
        { value: 'emittedTruthy', label: 'Emitted key is truthy' },
      ];
      const needsStatusValue = step.condition.type === 'lastStatusGte' || step.condition.type === 'lastStatusLt';
      const needsEmitKey = step.condition.type === 'emittedEquals' || step.condition.type === 'emittedExists' || step.condition.type === 'emittedTruthy';
      const needsEmitValue = step.condition.type === 'emittedEquals';
      return (
        <div className={styles.stepContainer}>
          <div className={styles.stepInner}>
            <span className={styles.stepDragHandle}>⠿</span>
            <span className={`${styles.stepTypeChip} ${styles.chipBranch}`}><span className={styles.chipIcon}>⑂</span>Branch</span>
            <ConditionSelector
              value={step.condition.type}
              onChange={(t) => {
                const type = t as BranchCondition['type'];
                let cond: BranchCondition;
                if (type === 'lastStatusGte' || type === 'lastStatusLt') {
                  cond = { type, value: 200 };
                } else if (type === 'emittedEquals') {
                  cond = { type, key: '', value: '' };
                } else if (type === 'emittedExists' || type === 'emittedTruthy') {
                  cond = { type, key: '' };
                } else {
                  cond = { type: type as 'lastRequestPass' | 'lastRequestFail' };
                }
                onChange({ ...step, condition: cond });
              }}
              options={conditionOptions}
            />
            {needsStatusValue && (
              <input
                type="number"
                className={styles.stepNumberInput}
                value={(step.condition as { type: string; value: number }).value}
                min={100}
                max={599}
                onChange={(e) => onChange({
                  ...step,
                  condition: { ...step.condition, value: parseInt(e.target.value, 10) || 200 } as BranchCondition,
                })}
              />
            )}
            {needsEmitKey && (
              <input
                type="text"
                className={styles.stepTextInput}
                placeholder="key"
                value={(step.condition as { type: string; key: string }).key}
                onChange={(e) => onChange({
                  ...step,
                  condition: { ...step.condition, key: e.target.value } as BranchCondition,
                })}
              />
            )}
            {needsEmitValue && (
              <input
                type="text"
                className={styles.stepTextInput}
                placeholder="value"
                value={(step.condition as { type: string; key: string; value: string }).value}
                onChange={(e) => onChange({
                  ...step,
                  condition: { ...step.condition, value: e.target.value } as BranchCondition,
                })}
              />
            )}
            {isConfirmingDelete ? (
              <span className={styles.stepConfirm}>
                <button className={styles.stepConfirmYes} onClick={(e) => { e.stopPropagation(); onConfirmDelete(path); }} title="Confirm delete">Yes</button>
                <button className={styles.stepConfirmNo} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(null); }} title="Cancel">No</button>
              </span>
            ) : (
              <button className={styles.stepRemove} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(path); }} title="Remove step">×</button>
            )}
          </div>
          <div className={styles.branchColumns}>
            <div className={styles.branchColumn}>
              <div className={styles.branchLabel} style={{ color: 'var(--accent-get)' }}>✓ If true</div>
              <StepList
                steps={step.trueSteps}
                onChange={(s) => onChange({ ...step, trueSteps: s })}
                requests={requests}
                automationProjectId={automationProjectId}
                projectEnvs={projectEnvs}
                depth={depth + 1}
                dragSourceRef={dragSourceRef}
                dragPath={dragPath}
                setDragPath={setDragPath}
                path={[...path, 0]}
                deleteStepPath={deleteStepPath}
                setDeleteStepPath={setDeleteStepPath}
                onConfirmDelete={onConfirmDelete}
              />
              {step.trueSteps.length === 0 && <div className={styles.nestedEmpty}>Drop elements here</div>}
            </div>
            <div className={styles.branchColumn}>
              <div className={styles.branchLabel} style={{ color: 'var(--accent-delete)' }}>✗ If false</div>
              <StepList
                steps={step.falseSteps}
                onChange={(s) => onChange({ ...step, falseSteps: s })}
                requests={requests}
                automationProjectId={automationProjectId}
                projectEnvs={projectEnvs}
                depth={depth + 1}
                dragSourceRef={dragSourceRef}
                dragPath={dragPath}
                setDragPath={setDragPath}
                path={[...path, 1]}
                deleteStepPath={deleteStepPath}
                setDeleteStepPath={setDeleteStepPath}
                onConfirmDelete={onConfirmDelete}
              />
              {step.falseSteps.length === 0 && <div className={styles.nestedEmpty}>Drop elements here</div>}
            </div>
          </div>
        </div>
      );
    }

    case 'fanout':
      return (
        <FanoutStep
          step={step}
          onChange={onChange}
          requests={requests}
          automationProjectId={automationProjectId}
          projectEnvs={projectEnvs}
          depth={depth}
          dragSourceRef={dragSourceRef}
          dragPath={dragPath}
          setDragPath={setDragPath}
          path={path}
          deleteStepPath={deleteStepPath}
          setDeleteStepPath={setDeleteStepPath}
          onConfirmDelete={onConfirmDelete}
        />
      );

    case 'csv_iterator':
      return (
        <CsvIteratorStep
          step={step}
          onChange={onChange}
          requests={requests}
          automationProjectId={automationProjectId}
          projectEnvs={projectEnvs}
          depth={depth}
          dragSourceRef={dragSourceRef}
          dragPath={dragPath}
          setDragPath={setDragPath}
          path={path}
          deleteStepPath={deleteStepPath}
          setDeleteStepPath={setDeleteStepPath}
          onConfirmDelete={onConfirmDelete}
        />
      );

    case 'set_env':
      return (
        <div className={styles.stepInner}>
          <span className={styles.stepDragHandle}>⠿</span>
          <span className={`${styles.stepTypeChip} ${styles.chipSetEnv}`}><span className={styles.chipIcon}>⊙</span>Set Env</span>
          <EnvSelector
            environments={projectEnvs}
            activeEnvId={step.envId}
            emptyLabel="No Env"
            onSelect={(env) => onChange({ ...step, envId: env?.id ?? null })}
          />
          {isConfirmingDelete ? (
            <span className={styles.stepConfirm}>
              <button className={styles.stepConfirmYes} onClick={(e) => { e.stopPropagation(); onConfirmDelete(path); }} title="Confirm delete">Yes</button>
              <button className={styles.stepConfirmNo} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(null); }} title="Cancel">No</button>
            </span>
          ) : (
            <button className={styles.stepRemove} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(path); }} title="Remove step">×</button>
          )}
        </div>
      );

    case 'stop':
      return (
        <div className={styles.stepInner}>
          <span className={styles.stepDragHandle}>⠿</span>
          <span className={`${styles.stepTypeChip} ${styles.chipStop}`}><span className={styles.chipIcon}>◼</span>Stop</span>
          <span className={styles.stepHint}>End execution here</span>
          {isConfirmingDelete ? (
            <span className={styles.stepConfirm}>
              <button className={styles.stepConfirmYes} onClick={(e) => { e.stopPropagation(); onConfirmDelete(path); }} title="Confirm delete">Yes</button>
              <button className={styles.stepConfirmNo} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(null); }} title="Cancel">No</button>
            </span>
          ) : (
            <button className={styles.stepRemove} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(path); }} title="Remove step">×</button>
          )}
        </div>
      );

    case 'log': {
      const LOG_OBJECTS: Record<LogScope, { value: string; label: string }[]> = {
        request: [
          { value: 'all', label: 'All' },
          { value: 'url', label: 'URL' },
          { value: 'method', label: 'Method' },
          { value: 'headers', label: 'Headers' },
          { value: 'params', label: 'Params' },
          { value: 'body', label: 'Body' },
        ],
        response: [
          { value: 'all', label: 'All' },
          { value: 'status', label: 'Status' },
          { value: 'headers', label: 'Headers' },
          { value: 'body', label: 'Body' },
        ],
        env: [{ value: 'all', label: 'All variables' }],
        emitter: [{ value: 'all', label: 'All variables' }],
      };
      const scopeOpts: { value: string; label: string }[] = [
        { value: 'request', label: 'Request' },
        { value: 'response', label: 'Response' },
        { value: 'env', label: 'Env' },
        { value: 'emitter', label: 'Emitter' },
      ];
      const objectOpts = LOG_OBJECTS[step.scope];
      return (
        <div className={styles.stepInner}>
          <span className={styles.stepDragHandle}>⠿</span>
          <span className={`${styles.stepTypeChip} ${styles.chipLog}`}>Log</span>
          <ConditionSelector
            value={step.scope}
            onChange={(v) => onChange({ ...step, scope: v as LogScope, object: LOG_OBJECTS[v as LogScope][0].value })}
            options={scopeOpts}
          />
          <ConditionSelector
            value={step.object}
            onChange={(v) => onChange({ ...step, object: v })}
            options={objectOpts}
          />
          {isConfirmingDelete ? (
            <span className={styles.stepConfirm}>
              <button className={styles.stepConfirmYes} onClick={(e) => { e.stopPropagation(); onConfirmDelete(path); }} title="Confirm delete">Yes</button>
              <button className={styles.stepConfirmNo} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(null); }} title="Cancel">No</button>
            </span>
          ) : (
            <button className={styles.stepRemove} onClick={(e) => { e.stopPropagation(); setDeleteStepPath(path); }} title="Remove step">×</button>
          )}
        </div>
      );
    }
  }
}

// ── Main component ───────────────────────────────────────────

export default function AutomationView({ automationId, showExpandBtn, onExpand }: { automationId: number; showExpandBtn?: boolean; onExpand?: () => void }) {
  const { state, dispatch } = useApp();
  const { updateAutomation, saveAutomationRun, listAutomationRuns, clearAutomationRuns, deleteAutomationRun } = useDatabase();
  const { runState, run, stop, reset } = useAutomationRunner();

  const automation = state.automations.find((a) => a.id === automationId) ?? null;
  const projectRequests = state.requests.filter((r) => r.project_id === (automation?.projectId ?? -1));

  const projectEnvs = state.environments.filter((e) => e.project_id === (automation?.projectId ?? -1));

  const [editingName, setEditingName] = useState(automation?.name ?? '');
  const [localSteps, setLocalSteps] = useState<AutomationStep[]>(automation?.steps ?? []);
  const [pastRuns, setPastRuns] = useState<AutomationRun[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(() => {
    const storedMode = localStorage.getItem(`callstack.automation.mode.${automationId}`);
    return storedMode === 'results';
  });
  const [confirmClearRuns, setConfirmClearRuns] = useState(false);
  const [runsCollapsed, setRunsCollapsed] = useState(() => {
    return localStorage.getItem(`callstack.automation.runsCollapsed.${automationId}`) === '1';
  });
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [copiedCurlIdx, setCopiedCurlIdx] = useState<number | null>(null);
  const [copiedResultIdx, setCopiedResultIdx] = useState<number | null>(null);
  const [confirmDeleteRunId, setConfirmDeleteRunId] = useState<number | null>(null);
  const [deleteStepPath, setDeleteStepPath] = useState<number[] | null>(null);
  const [mode, setMode] = useState<'configure' | 'running' | 'results'>(() => {
    const stored = localStorage.getItem(`callstack.automation.mode.${automationId}`);
    return stored === 'results' ? 'results' : 'configure';
  });
  const [selectedResultIdx, setSelectedResultIdx] = useState<number | null>(() => {
    const stored = localStorage.getItem(`callstack.automation.selectedResultIdx.${automationId}`);
    if (!stored) return null;
    const n = parseInt(stored, 10);
    return Number.isFinite(n) ? n : null;
  });
  const [viewingRun, setViewingRun] = useState<AutomationRun | null>(null);
  const activeEnvId = automation?.envId ?? null;

  const [resultFilter, setResultFilter] = useState<'all' | 'pass' | 'partial' | 'error'>('all');
  const [currentPage, setCurrentPage] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [leftPaneWidth, setLeftPaneWidth] = useState(300);
  const [editorZoom, setEditorZoom] = useState(() => {
    const v = localStorage.getItem(`callstack.automationZoom.${automationId}`);
    return v ? parseFloat(v) : 1;
  });
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = leftPaneWidth;
    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = ev.clientX - dragStartXRef.current;
      setLeftPaneWidth(Math.max(180, Math.min(600, dragStartWidthRef.current + delta)));
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [leftPaneWidth]);
  const listContainerRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    setListHeight(el.getBoundingClientRect().height);
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h) setListHeight(h);
    });
    ro.observe(el);
  }, []);
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Drag state for flow editor
  const dragSourceRef = useRef<DragSource | null>(null);
  const [dragPath, setDragPath] = useState<number[] | null>(null);

  useEffect(() => {
    if (!automation) return;
    setEditingName(automation.name);
    setLocalSteps([...automation.steps]);

    const storedMode = localStorage.getItem(`callstack.automation.mode.${automationId}`);
    setMode(storedMode === 'results' ? 'results' : 'configure');

    const storedIdx = localStorage.getItem(`callstack.automation.selectedResultIdx.${automationId}`);
    if (storedIdx) {
      const n = parseInt(storedIdx, 10);
      setSelectedResultIdx(Number.isFinite(n) ? n : null);
    } else {
      setSelectedResultIdx(null);
    }

    setRunsCollapsed(localStorage.getItem(`callstack.automation.runsCollapsed.${automationId}`) === '1');

    // Read storedRunId BEFORE setViewingRun(null) triggers the cleanup effect that removes it
    const storedRunId = localStorage.getItem(`callstack.automation.viewingRunId.${automationId}`);
    setViewingRun(null);
    if (storedMode !== 'results') reset();
    setIsLoadingRuns(true);
    listAutomationRuns(automationId, 10).then((runs) => {
      setPastRuns(runs);
      if (storedRunId) {
        const id = parseInt(storedRunId, 10);
        const found = runs.find((r) => r.id === id);
        if (found) setViewingRun(found);
      }
    }).catch(() => {}).finally(() => setIsLoadingRuns(false));
  }, [automationId, automation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(`callstack.automation.mode.${automationId}`, mode);
  }, [mode, automationId]);

  useEffect(() => {
    if (selectedResultIdx == null) {
      localStorage.removeItem(`callstack.automation.selectedResultIdx.${automationId}`);
    } else {
      localStorage.setItem(`callstack.automation.selectedResultIdx.${automationId}`, String(selectedResultIdx));
    }
  }, [selectedResultIdx, automationId]);

  useEffect(() => {
    localStorage.setItem(`callstack.automation.runsCollapsed.${automationId}`, runsCollapsed ? '1' : '0');
  }, [runsCollapsed, automationId]);

  useEffect(() => {
    if (viewingRun == null) {
      localStorage.removeItem(`callstack.automation.viewingRunId.${automationId}`);
    } else {
      localStorage.setItem(`callstack.automation.viewingRunId.${automationId}`, String(viewingRun.id));
    }
  }, [viewingRun, automationId]);

  useEffect(() => {
    if (selectedResultIdx != null) {
      rowRefs.current.get(selectedResultIdx)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedResultIdx]);


  const saveName = useCallback(async () => {
    if (!automation) return;
    const trimmed = editingName.trim() || automation.name;
    if (trimmed === automation.name) return;
    const updated = await updateAutomation(automationId, trimmed, localSteps);
    dispatch({ type: 'UPDATE_AUTOMATION', payload: updated });
  }, [automation, editingName, automationId, localSteps, updateAutomation, dispatch]);

  const saveSteps = useCallback(async (steps: AutomationStep[]) => {
    if (!automation) return;
    const updated = await updateAutomation(automationId, editingName.trim() || automation.name, steps);
    dispatch({ type: 'UPDATE_AUTOMATION', payload: updated });
  }, [automation, automationId, editingName, updateAutomation, dispatch]);

  const handleStepsChange = useCallback((steps: AutomationStep[]) => {
    setLocalSteps(steps);
    saveSteps(steps);
  }, [saveSteps]);

  const handleRun = useCallback(async () => {
    if (!automation || localSteps.length === 0) return;

    const requestMap = new Map(state.requests.map((r) => [r.id, r]));
    const envVars = activeEnvId
      ? (state.environments.find((e) => e.id === activeEnvId)?.variables ?? [])
      : [];

    setMode('running');
    setViewingRun(null);
    setSelectedResultIdx(null);
    setResultFilter('all');

    const { results, durationMs, overallStatus } = await run(localSteps, requestMap, envVars, activeEnvId, (entry) => {
      dispatch({ type: 'ADD_LOG', payload: { ...entry, id: Date.now() ^ (Math.random() * 0xffffffff | 0) } });
    }, state.dataFiles, projectEnvs);
    const saved = await saveAutomationRun(automationId, overallStatus, results, durationMs);
    setPastRuns((prev) => [saved, ...prev.slice(0, 9)]);
    setMode('results');
    setSelectedResultIdx(null);
  }, [automation, localSteps, state.requests, state.environments, state.dataFiles, activeEnvId, projectEnvs, run, saveAutomationRun, automationId]);

  const handleViewRun = useCallback((runEntry: AutomationRun) => {
    setViewingRun(runEntry);
    setMode('results');
    setSelectedResultIdx(null);
    setResultFilter('all');
  }, []);

  const handleBack = useCallback(() => {
    setMode('configure');
    setViewingRun(null);
    reset();
  }, [reset]);

  const handleConfirmDelete = useCallback((path: number[]) => {
    setDeleteStepPath(null);
    if (path.length === 0) return;

    const newSteps = [...localSteps];
    let current: AutomationStep[] = newSteps;

    // Navigate to the parent step container
    let i = 0;
    while (i < path.length - 1) {
      const idx = path[i];
      const step = current[idx];
      if (step.type === 'repeat') {
        current = step.steps;
        i++;
      } else if (step.type === 'branch') {
        // Path next element is 0 for trueSteps, 1 for falseSteps
        const branchIndicator = path[i + 1];
        if (branchIndicator === 0) {
          current = step.trueSteps;
        } else {
          current = step.falseSteps;
        }
        i += 2; // Skip both the branch step index and the branch indicator
      } else if (step.type === 'fanout') {
        // Path next element is the lane index (0, 1, 2, ...)
        current = step.lanes[path[i + 1]];
        i += 2;
      } else {
        i++;
      }
    }

    // Remove the step
    current.splice(path[path.length - 1], 1);
    handleStepsChange(newSteps);
  }, [localSteps, handleStepsChange]);

  if (!automation) {
    // Distinguish "still loading" from "genuinely missing": if projects haven't loaded yet,
    // we're early in the boot sequence — render nothing rather than flashing "Not found".
    const stillLoading = state.projects.length === 0;
    if (stillLoading) {
      return <div className={styles.root} />;
    }
    return (
      <div className={styles.root}>
        <div className={styles.emptyState}>
          <span className={styles.emptyStateTitle}>Automation not found</span>
        </div>
      </div>
    );
  }

  const displayResults: AutomationRequestResult[] =
    viewingRun ? viewingRun.results : runState.results;


  const isRunning = mode === 'running';
  const isResults = mode === 'results';

  const hasStop = localSteps.some((s) => s.type === 'stop');

  // Count steps that can run (for the run button)
  function countRunnable(steps: AutomationStep[]): number {
    let n = 0;
    for (const s of steps) {
      if (s.type === 'request' && s.requestId != null && s.requestId > 0) n++;
      else if (s.type === 'repeat') n += countRunnable(s.steps);
      else if (s.type === 'branch') n += countRunnable(s.trueSteps) + countRunnable(s.falseSteps);
      else if (s.type === 'csv_iterator') n += countRunnable(s.steps);
      else if (s.type === 'fanout') n += s.lanes.reduce((sum, lane) => sum + countRunnable(lane), 0);
    }
    return n;
  }
  const runnableCount = countRunnable(localSteps);

  // ── Header ────────────────────────────────────────────────

  const header = (
    <div className={styles.header}>
      {showExpandBtn && (
        <button className={styles.expandBtn} onClick={onExpand} title="Show navigator">›</button>
      )}
      {isResults ? (
        <button className={styles.backBtn} onClick={handleBack} title="Back to configure">←</button>
      ) : (
        <button
          className={styles.backBtn}
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'request' })}
          title="Close automation"
        >←</button>
      )}
      <div className={styles.nameWrapper}>
        <input
          className={styles.nameInput}
          value={editingName}
          onChange={(e) => setEditingName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          disabled={isRunning}
          spellCheck={false}
        />
      </div>
      <div className={styles.headerRight}>
        {!isRunning && !isResults && (
          <div className={styles.headerControl}>
            <span className={styles.headerControlLabel}>ZOOM</span>
            <div className={styles.zoomControls}>
              <button
                className={styles.zoomBtn}
                onClick={() => setEditorZoom((z) => { const n = Math.max(0.4, parseFloat((z - 0.1).toFixed(1))); localStorage.setItem(`callstack.automationZoom.${automationId}`, String(n)); return n; })}
                title="Zoom out"
              >−</button>
              <span className={styles.zoomLabel} onClick={() => { setEditorZoom(1); localStorage.removeItem(`callstack.automationZoom.${automationId}`); }} title="Reset zoom">{Math.round(editorZoom * 100)}%</span>
              <button
                className={styles.zoomBtn}
                onClick={() => setEditorZoom((z) => { const n = Math.min(2, parseFloat((z + 0.1).toFixed(1))); localStorage.setItem(`callstack.automationZoom.${automationId}`, String(n)); return n; })}
                title="Zoom in"
              >+</button>
            </div>
          </div>
        )}
        <button
          className={styles.jsonBadgeBtn}
          onClick={() => setShowJsonModal(true)}
          title="View automation JSON"
        >{'{}'}</button>
        {isRunning ? (
          <button className={styles.stopBtn} onClick={stop}>■ Stop</button>
        ) : (
          <button
            className={styles.runBtn}
            onClick={handleRun}
            disabled={runnableCount === 0}
          >
            ▶ {isResults ? 'Re-run' : 'Run'}
          </button>
        )}
      </div>
    </div>
  );

  // ── Running mode ──────────────────────────────────────────

  if (isRunning) {
    const { totalCount, results } = runState;
    const progressPct = totalCount > 0 ? (results.length / totalCount) * 100 : 0;

    return (
      <div className={styles.root}>
        {header}
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
        <div className={styles.runningHeader}>
          <span>{results.length}{totalCount > 0 ? ` / ${totalCount}` : ''} complete</span>
        </div>
        <div className={styles.body}>
          <div className={styles.listPane}>
            {results.map((result, idx) => {
              const pass = resultPassed(result);
              const fail = resultFailed(result);
              return (
                <div key={idx} className={`${styles.reqRow}${pass ? ` ${styles.reqRowPass}` : fail ? ` ${styles.reqRowFail}` : ''}`}>
                  <div className={styles.reqStatus}>
                    {pass && <span className={styles.reqStatusPass}>✓</span>}
                    {fail && <span className={styles.reqStatusFail}>✗</span>}
                  </div>
                  <span className={styles.methodBadge} style={{ background: methodColor(result.method) }}>
                    {result.method}
                  </span>
                  <span className={styles.reqName}>{result.requestName}</span>
                  <span className={`${styles.reqMeta}${result.error ? ` ${styles.reqMetaFail}` : ''}`}>
                    {result.error
                      ? result.error
                      : `${result.status} · ${formatDuration(result.timeMs)}${result.testResults.length > 0 ? ` · ${result.testResults.filter((t) => t.passed).length}/${result.testResults.length}` : ''}`
                    }
                  </span>
                </div>
              );
            })}
            {results.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
                <div className={styles.spinner} />
                Running…
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Results mode ──────────────────────────────────────────

  if (isResults && isLoadingRuns) {
    return (
      <div className={styles.root}>
        {header}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 16px', color: 'var(--text-secondary)', fontSize: 13 }}>
          <div className={styles.spinner} />
          Loading…
        </div>
      </div>
    );
  }

  if (isResults) {
    const overallStatus = viewingRun ? viewingRun.status : (runState.overallStatus ?? 'ERROR');
    const durationMs = viewingRun ? viewingRun.durationMs : (runState.durationMs ?? 0);
    const passCount = displayResults.filter(resultPassed).length;

    const summaryStatusClass =
      overallStatus === 'PASS' ? styles.summaryStatusPass :
      overallStatus === 'FAIL' ? styles.summaryStatusFail :
      overallStatus === 'PARTIAL' ? styles.summaryStatusPartial :
      styles.summaryStatusError;

    const resultCategory = (r: AutomationRequestResult): 'pass' | 'partial' | 'error' => {
      if (resultPassed(r)) return 'pass';
      if (r.testStatus === 'PARTIAL') return 'partial';
      return 'error';
    };

    const filterCounts = {
      all: displayResults.length,
      pass: displayResults.filter((r) => resultCategory(r) === 'pass').length,
      partial: displayResults.filter((r) => resultCategory(r) === 'partial').length,
      error: displayResults.filter((r) => resultCategory(r) === 'error').length,
    };

    const filteredWithIdx = displayResults
      .map((r, i) => ({ result: r, origIdx: i }))
      .filter(({ result }) => resultFilter === 'all' || resultCategory(result) === resultFilter);

    const pageSize = Math.max(1, Math.floor((listHeight - 12) / 40));
    const totalPages = Math.max(1, Math.ceil(filteredWithIdx.length / pageSize));
    const clampedPage = Math.min(currentPage, totalPages - 1);
    const pageItems = filteredWithIdx.slice(clampedPage * pageSize, (clampedPage + 1) * pageSize);

    const selectedResult = selectedResultIdx != null ? displayResults[selectedResultIdx] ?? null : null;

    return (
      <div className={styles.root}>
        {header}
        <div className={styles.summaryBar}>
          <span className={`${styles.summaryStatus} ${summaryStatusClass}`}>{overallStatus}</span>
          <span className={styles.summaryMeta}>
            {passCount}/{displayResults.length} passed · {formatDuration(durationMs)}
          </span>
          <span className={styles.summaryGap} />
          {viewingRun && (
            confirmDeleteRunId === viewingRun.id ? (
              <span className={styles.clearConfirm}>
                <span className={styles.deleteRunLabel}>Delete?</span>
                <button className={styles.clearConfirmYes} onClick={() => {
                  deleteAutomationRun(viewingRun.id).then(() => {
                    setPastRuns((prev) => prev.filter((x) => x.id !== viewingRun.id));
                    setConfirmDeleteRunId(null);
                    setViewingRun(null);
                    handleBack();
                  }).catch(() => setConfirmDeleteRunId(null));
                }}>Delete</button>
                <button className={styles.clearConfirmNo} onClick={() => setConfirmDeleteRunId(null)}>Cancel</button>
              </span>
            ) : (
              <button className={styles.deleteFromDetailBtn} onClick={() => setConfirmDeleteRunId(viewingRun.id)} title="Delete this run">Delete run</button>
            )
          )}
        </div>
        <div className={styles.splitPane}>
          <div className={styles.resultsList} style={{ width: leftPaneWidth }}>
            {/* Filter bar */}
            <div className={styles.filterBar}>
              {(['all', 'pass', 'partial', 'error'] as const).map((f) => (
                <button
                  key={f}
                  className={[
                    styles.filterBtn,
                    resultFilter === f ? styles.filterBtnActive : '',
                    f === 'pass' ? styles.filterBtnPass : '',
                    f === 'partial' ? styles.filterBtnPartial : '',
                    f === 'error' ? styles.filterBtnError : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => { setResultFilter(f); setSelectedResultIdx(null); setCurrentPage(0); }}
                >
                  {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className={styles.filterCount}>{filterCounts[f]}</span>
                </button>
              ))}
            </div>

            {/* Scrollable list */}
            <div className={styles.resultsListScroll} ref={listContainerRef}>
              {filteredWithIdx.length === 0 ? (
                <div className={styles.filterEmpty}>
                  No {resultFilter === 'all' ? 'results' : resultFilter} results
                </div>
              ) : (
                pageItems.map(({ result, origIdx }) => {
                  const pass = resultPassed(result);
                  const fail = resultFailed(result);
                  const isSelected = selectedResultIdx === origIdx;
                  return (
                    <div
                      key={origIdx}
                      ref={(el) => { if (el) rowRefs.current.set(origIdx, el); else rowRefs.current.delete(origIdx); }}
                      className={[
                        styles.reqRow,
                        styles.reqRowSelectable,
                        isSelected ? styles.reqRowSelected : '',
                        !isSelected && pass ? styles.reqRowPass : '',
                        !isSelected && fail ? styles.reqRowFail : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => setSelectedResultIdx(isSelected ? null : origIdx)}
                    >
                      <div className={styles.reqStatus}>
                        {pass && <span className={styles.reqStatusPass}>✓</span>}
                        {fail && <span className={styles.reqStatusFail}>✗</span>}
                      </div>
                      <span className={styles.reqRowNum}>#{origIdx + 1}</span>
                      <span className={styles.methodBadge} style={{ background: methodColor(result.method) }}>
                        {result.method}
                      </span>
                      <span className={styles.reqName}>
                        {result.containerLabel ? `${result.containerLabel}-${result.requestName}` : result.requestName}
                      </span>
                      {!result.error && result.status > 0 && (
                        <span className={styles.reqMeta}>
                          {result.status} · {formatDuration(result.timeMs)}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination bar */}
            {totalPages > 1 && (
              <div className={styles.paginationBar}>
                <button className={styles.pageBtn} disabled={clampedPage === 0} onClick={() => setCurrentPage(0)} title="First">«</button>
                <button className={styles.pageBtn} disabled={clampedPage === 0} onClick={() => setCurrentPage((p) => p - 1)} title="Previous">‹</button>
                <span className={styles.pageInfo}>{clampedPage + 1} / {totalPages}</span>
                <button className={styles.pageBtn} disabled={clampedPage >= totalPages - 1} onClick={() => setCurrentPage((p) => p + 1)} title="Next">›</button>
                <button className={styles.pageBtn} disabled={clampedPage >= totalPages - 1} onClick={() => setCurrentPage(totalPages - 1)} title="Last">»</button>
              </div>
            )}
          </div>

          <div className={styles.resizeHandle} onMouseDown={onResizeMouseDown} />
          <div className={styles.detailPane}>
            {selectedResult == null ? (
              <div className={styles.detailEmpty}>Select a result to view details</div>
            ) : (() => {
              const result = selectedResult;
              const idx = selectedResultIdx!;
              return (
                <div className={`${styles.resultLogBlock} ${styles.resultLogBlockSelected}`}>
                  {/* ── Block header ── */}
                  <div className={styles.resultLogBlockHeader}>
                    <span className={styles.reqRowNum}>#{idx + 1}</span>
                    <span className={styles.methodBadge} style={{ background: methodColor(result.method), color: '#fff' }}>{result.method}</span>
                    <span className={styles.logBlockName}>{result.requestName}</span>
                    <span className={styles.logBlockGap} />
                    {result.error ? (
                      <span className={styles.statusError}>Error</span>
                    ) : (
                      <>
                        <span className={styles.statusCode} style={{ color: statusColor(result.status) }}>
                          {result.status} {result.statusText}
                        </span>
                        <span className={styles.statusTime}>{formatDuration(result.timeMs)}</span>
                      </>
                    )}
                    <button
                      className={`${styles.resultActionBtn} ${styles.resultActionBtnCopy}`}
                      title="Copy result"
                      onClick={(e) => {
                        e.stopPropagation();
                        const text = formatResultAsText(result, idx);
                        invoke('write_clipboard', { text }).then(() => {
                          setCopiedResultIdx(idx);
                          setTimeout(() => setCopiedResultIdx((prev) => (prev === idx ? null : prev)), 1500);
                        });
                      }}
                    >
                      {copiedResultIdx === idx ? '✓' : '⎘'}
                    </button>
                    <button
                      className={`${styles.resultActionBtn} ${styles.resultActionBtnEmail}`}
                      title="Email result"
                      onClick={(e) => {
                        e.stopPropagation();
                        const text = formatResultAsText(result, idx);
                        const subject = encodeURIComponent(`Result #${idx + 1}: ${result.method} ${result.requestName}`);
                        const body = encodeURIComponent(text);
                        invoke('open_system_url', { url: `mailto:?subject=${subject}&body=${body}` });
                      }}
                    >
                      ✉
                    </button>
                  </div>

                  {/* ── Row data ── */}
                  {result.rowData && Object.keys(result.rowData).length > 0 && (
                    <div className={styles.logSection}>
                      <div className={styles.logSectionLabel}>Data Row {result.rowIndex}</div>
                      <div className={styles.rowDataTableWrap}>
                        <table className={styles.rowDataTable}>
                          <thead>
                            <tr>
                              {Object.keys(result.rowData).map((k) => (
                                <th key={k} className={styles.rowDataTh}>{k}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {Object.values(result.rowData).map((v, i) => (
                                <td key={i} className={styles.rowDataTd}>{v}</td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ── Request ── */}
                  <div className={styles.logSection}>
                    <div className={styles.logSectionLabel}>Request</div>
                    <div className={styles.logSectionBody}>
                      <div className={styles.logUrl}>{result.url}</div>

                      {result.requestParams && result.requestParams.length > 0 && (
                        <>
                          <div className={styles.logSubLabel}>Params</div>
                          <div className={styles.headersList}>
                            {result.requestParams.map((p, i) => (
                              <div key={i} className={styles.headerRow}>
                                <span className={styles.headerKey}>{p.key}</span>
                                <span className={styles.headerValue}>{p.value}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {result.requestHeaders && result.requestHeaders.length > 0 && (
                        <>
                          <div className={styles.logSubLabel}>Headers</div>
                          <div className={styles.headersList}>
                            {result.requestHeaders.map((h, i) => (
                              <div key={i} className={styles.headerRow}>
                                <span className={styles.headerKey}>{h.key}</span>
                                <span className={styles.headerValue}>{h.value}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {result.requestBody && (
                        <>
                          <div className={styles.logSubLabel}>Body</div>
                          <div className={styles.detailBody}>{(() => {
                            const ct = result.requestHeaders?.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? '';
                            return formatBody(result.requestBody, ct);
                          })()}</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* ── Response ── */}
                  {result.error ? (
                    <div className={styles.logSection}>
                      <div className={styles.logSectionLabel}>Error</div>
                      <div className={styles.logSectionBody}>
                        <div className={styles.statusError}>{result.error}</div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.logSection}>
                      <div className={styles.logSectionLabel}>Response</div>
                      <div className={styles.logSectionBody}>
                        <div className={styles.detailStatus}>
                          <span className={styles.statusCode} style={{ color: statusColor(result.status) }}>
                            {result.status} {result.statusText}
                          </span>
                          <span className={styles.statusTime}>{formatDuration(result.timeMs)}</span>
                        </div>

                        {result.responseHeaders && result.responseHeaders.length > 0 && (
                          <>
                            <div className={styles.logSubLabel}>Headers</div>
                            <div className={styles.headersList}>
                              {result.responseHeaders.map((h, i) => (
                                <div key={i} className={styles.headerRow}>
                                  <span className={styles.headerKey}>{h.key}</span>
                                  <span className={styles.headerValue}>{h.value}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}

                        {result.responseBody && (
                          <>
                            <div className={styles.logSubLabel}>Body</div>
                            <div className={styles.detailBody}>{(() => {
                              const ct = result.responseHeaders?.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? '';
                              return formatBody(result.responseBody, ct);
                            })()}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Test Results ── */}
                  {result.testResults.length > 0 && (
                    <div className={styles.logSection}>
                      <div className={styles.logSectionLabel}>
                        Tests — {result.testResults.filter((t) => t.passed).length}/{result.testResults.length} passed
                      </div>
                      <div className={styles.logSectionBody}>
                        <div className={styles.testsList}>
                          {result.testResults.map((t, i) => {
                            const warn = t.passed && t.severity === 'warning';
                            const rowCls = t.passed ? (warn ? styles.testRowWarn : styles.testRowPass) : styles.testRowFail;
                            const iconCls = t.passed ? (warn ? styles.testIconWarn : styles.testIconPass) : styles.testIconFail;
                            const icon = t.passed ? (warn ? '⚠' : '✓') : '✗';
                            return (
                              <div key={i} className={`${styles.testRow} ${rowCls}`}>
                                <span className={`${styles.testIcon} ${iconCls}`}>{icon}</span>
                                <div>
                                  <div className={styles.testDesc}>{t.description}</div>
                                  {t.message && <div className={styles.testSuccess}>{t.message}</div>}
                                  {t.error && <div className={styles.testError}>{t.error}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── Curl ── */}
                  {result.curl && (
                    <div className={styles.logSection}>
                      <div className={styles.logSectionLabelRow}>
                        <span className={styles.logSectionLabel}>Curl</span>
                        <button
                          className={styles.curlCopyBtn}
                          onClick={() => {
                            invoke('write_clipboard', { text: result.curl }).then(() => {
                              setCopiedCurlIdx(idx);
                              setTimeout(() => setCopiedCurlIdx((prev) => prev === idx ? null : prev), 1500);
                            });
                          }}
                        >
                          {copiedCurlIdx === idx ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <div className={styles.logSectionBody}>
                        <div className={styles.curlBlock}>{result.curl}</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  // ── Configure mode (flow editor) ─────────────────────────

  return (
    <>
    <div className={styles.root}>
      {header}
      <div className={styles.flowLayout}>

        {/* Palette */}
        <div className={styles.palette}>
          <div className={styles.paletteTitle}>Elements</div>
          {PALETTE_ITEMS.map((item) => (
            <div
              key={item.type}
              className={styles.paletteItem}
              draggable
              title={item.hint}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'palette', type: item.type }));
                e.dataTransfer.effectAllowed = 'copy';
                dragSourceRef.current = { kind: 'palette', type: item.type };
              }}
              onDragEnd={() => {
                dragSourceRef.current = null;
              }}
            >
              <span className={styles.paletteItemIcon} style={{ color: item.color }}>{item.icon}</span>
              <span className={styles.paletteItemLabel}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Flow canvas */}
        <div className={styles.flowCanvas}>
          {pastRuns.length > 0 && runsCollapsed && (
            <button
              className={styles.runsFloatingExpand}
              onClick={() => setRunsCollapsed(false)}
              title="Show past runs"
            >
              ‹
            </button>
          )}
          <div className={styles.flowContent} style={{ zoom: editorZoom }}>
            {/* Start node */}
            <div className={styles.flowStartNode}>
              <span className={styles.flowNodeLabel}>START</span>
            </div>
            <div className={styles.flowConnector} />

            <StepList
              steps={localSteps}
              onChange={handleStepsChange}
              requests={projectRequests}
              automationProjectId={automation?.projectId ?? -1}
              projectEnvs={projectEnvs}
              dragSourceRef={dragSourceRef}
              dragPath={dragPath}
              setDragPath={setDragPath}
              deleteStepPath={deleteStepPath}
              setDeleteStepPath={setDeleteStepPath}
              onConfirmDelete={handleConfirmDelete}
            />

            {/* Implicit end node (only shown if no explicit stop step) */}
            {!hasStop && localSteps.length > 0 && (
              <>
                <div className={styles.flowConnector} />
                <div className={styles.flowEndNode}>
                  <span className={styles.flowNodeLabel}>END</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Past runs sidebar */}
        {pastRuns.length > 0 && !runsCollapsed && (
          <div className={styles.pastRunsPanel}>
            <div className={styles.pastRunsTitleRow}>
              <span className={styles.pastRunsTitle}>Past Runs</span>
              <span className={styles.pastRunsTitleActions}>
                <button className={styles.runsCollapseBtn} onClick={() => setRunsCollapsed(true)} title="Hide panel">›</button>
                {confirmClearRuns ? (
                  <span className={styles.clearConfirm}>
                    <button className={styles.clearConfirmYes} onClick={() => {
                      clearAutomationRuns(automationId).then(() => {
                        setPastRuns([]);
                        setConfirmClearRuns(false);
                      }).catch(() => setConfirmClearRuns(false));
                    }}>Clear</button>
                    <button className={styles.clearConfirmNo} onClick={() => setConfirmClearRuns(false)}>Cancel</button>
                  </span>
                ) : (
                  <button className={styles.clearRunsBtn} onClick={() => setConfirmClearRuns(true)} title="Clear run history">×</button>
                )}
              </span>
            </div>
            {pastRuns.map((r) => (
              <div
                key={r.id}
                className={`${styles.runRow}${confirmDeleteRunId === r.id ? ` ${styles.runRowConfirming}` : ''}`}
                onClick={() => confirmDeleteRunId === r.id ? undefined : handleViewRun(r)}
              >
                {confirmDeleteRunId === r.id ? (
                  <span className={styles.deleteRunConfirm}>
                    <span className={styles.deleteRunLabel}>Delete?</span>
                    <button className={styles.clearConfirmYes} onClick={(e) => {
                      e.stopPropagation();
                      deleteAutomationRun(r.id).then(() => {
                        setPastRuns((prev) => prev.filter((x) => x.id !== r.id));
                        setConfirmDeleteRunId(null);
                      }).catch(() => setConfirmDeleteRunId(null));
                    }}>Delete</button>
                    <button className={styles.clearConfirmNo} onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteRunId(null);
                    }}>Cancel</button>
                  </span>
                ) : (
                  <>
                    <button className={styles.deleteRunBtn} onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteRunId(r.id);
                    }} title="Delete run">×</button>
                    <span className={`${styles.runStatusBadge} ${runStatusClass(r.status, styles)}`}>
                      {r.status}
                    </span>
                    <span className={styles.runMeta}>
                      {r.results.length} req · {formatDuration(r.durationMs)}
                    </span>
                    <span className={styles.runDate}>{formatDate(r.createdAt)}</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    {showJsonModal && automation && (
      <div className={styles.jsonModalOverlay} onClick={() => setShowJsonModal(false)}>
        <div className={styles.jsonModal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.jsonModalHeader}>
            <span className={styles.jsonModalTitle}>Automation JSON</span>
            <button className={styles.jsonModalClose} onClick={() => setShowJsonModal(false)}>×</button>
          </div>
          <pre className={styles.jsonModalBody}>{JSON.stringify({ id: automation.id, name: automation.name, projectId: automation.projectId, steps: localSteps }, null, 2)}</pre>
        </div>
      </div>
    )}
    </>
  );
}
