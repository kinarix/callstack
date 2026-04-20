import { useState, useRef, useEffect, type ReactElement } from 'react';
import type { Environment } from '../../lib/types';
import { getEnvColor } from '../../lib/envUtils';
import styles from './EnvSelector.module.css';

interface EnvSelectorProps {
  environments: Environment[];
  activeEnvId: number | null;
  onSelect: (env: Environment | null) => void;
  emptyLabel?: string;
}

function getEnvMeta(name: string): { color: string; icon: ReactElement } {
  const color = getEnvColor(name);
  const n = name.toLowerCase();
  if (/prod|production/.test(n)) {
    return {
      color,
      icon: (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <rect x="2.5" y="4.5" width="5" height="4" rx="0.6" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M3.5 4.5V3a1.5 1.5 0 0 1 3 0v1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
        </svg>
      ),
    };
  }
  if (/stag|staging/.test(n)) {
    return {
      color,
      icon: (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M5 1.5C5 1.5 7.5 3 7.5 6L6.5 7H3.5L2.5 6C2.5 3 5 1.5 5 1.5Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15"/>
          <path d="M3.5 7l-.6 2M6.5 7l.6 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          <circle cx="5" cy="5" r="0.9" stroke="currentColor" strokeWidth="1"/>
        </svg>
      ),
    };
  }
  if (/dev|local|development/.test(n)) {
    return {
      color,
      icon: (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M3.5 3L1 5L3.5 7M6.5 3L9 5L6.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    };
  }
  if (/test|qa|testing|uat|canary/.test(n)) {
    return {
      color,
      icon: (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M3.5 1.5H6.5M4 1.5V5L2 8.5H8L6 5V1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2.5 7h5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round"/>
        </svg>
      ),
    };
  }
  if (/sandbox|demo/.test(n)) {
    return {
      color,
      icon: (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <rect x="1.5" y="1.5" width="7" height="7" rx="0.8" stroke="currentColor" strokeWidth="1.1"/>
          <path d="M1.5 5H8.5M5 1.5V8.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        </svg>
      ),
    };
  }
  return {
    color,
    icon: (
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
        <path d="M2.5 5H7.5M5 1.5C4 2.2 3.5 3.5 3.5 5s.5 2.8 1.5 3.5C7 7.8 6.5 6.5 6.5 5S7 2.2 5 1.5z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    ),
  };
}

const NO_ENV_COLOR = '#6b7280';
const noEnvIcon = (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
    <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.1"/>
    <path d="M2.5 7.5L7.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);

export function EnvSelector({ environments, activeEnvId, onSelect, emptyLabel = 'No Env' }: EnvSelectorProps) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const pillRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeEnv = environments.find((e) => e.id === activeEnvId) ?? null;
  const activeMeta = activeEnv ? getEnvMeta(activeEnv.name) : { color: NO_ENV_COLOR, icon: noEnvIcon };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        pillRef.current && !pillRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (!pillRef.current) { setOpen((o) => !o); return; }
    const rect = pillRef.current.getBoundingClientRect();
    const itemCount = environments.length + 1; // +1 for "No Env"
    const panelHeight = Math.min(itemCount * 32 + 8, 280);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    if (spaceBelow >= panelHeight || spaceBelow >= 120) {
      setDropdownStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, minWidth: rect.width });
    } else {
      setDropdownStyle({ position: 'fixed', bottom: window.innerHeight - rect.top + 4, left: rect.left, minWidth: rect.width });
    }
    setOpen((o) => !o);
  };

  const handleSelect = (env: Environment) => {
    setOpen(false);
    onSelect(env);
  };

  return (
    <div className={styles.wrapper}>
      <button
        ref={pillRef}
        className={`${styles.pill} ${styles.active}`}
        style={{ color: activeMeta.color, borderColor: activeMeta.color }}
        onClick={handleOpen}
        title="Select environment"
      >
        {activeMeta.icon}
        <span>{activeEnv ? activeEnv.name : emptyLabel}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden className={styles.chevron}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div ref={dropdownRef} className={styles.dropdown} style={dropdownStyle}>
          {environments.length === 0 ? (
            <div className={styles.empty}>No environments — add one in the sidebar</div>
          ) : (
            <>
              <button
                className={`${styles.option} ${activeEnvId === null ? styles.selectedOption : ''}`}
                onClick={() => { setOpen(false); onSelect(null); }}
                style={{ color: NO_ENV_COLOR }}
              >
                {activeEnvId === null ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden style={{ flexShrink: 0 }}>
                    <path d="M2 5L4.5 7.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <span style={{ color: NO_ENV_COLOR, flexShrink: 0, display: 'inline-flex' }}>{noEnvIcon}</span>
                )}
                <span className={styles.noEnvLabel}>No Env</span>
              </button>
              {environments.map((env) => {
                const meta = getEnvMeta(env.name);
                return (
                  <button
                    key={env.id}
                    className={`${styles.option} ${env.id === activeEnvId ? styles.selectedOption : ''}`}
                    onClick={() => handleSelect(env)}
                  >
                    {env.id === activeEnvId ? (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden style={{ color: meta.color, flexShrink: 0 }}>
                        <path d="M2 5L4.5 7.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <span className={styles.envDot} style={{ background: meta.color }} />
                    )}
                    <span style={{ color: meta.color }}>{env.name}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
