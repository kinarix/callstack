import { useState, useRef, useEffect } from 'react';
import type { Environment } from '../../lib/types';
import styles from './EnvSelector.module.css';

interface EnvSelectorProps {
  environments: Environment[];
  activeEnvId: number | null;
  onSelect: (env: Environment) => void;
}

export function EnvSelector({ environments, activeEnvId, onSelect }: EnvSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeEnv = environments.find((e) => e.id === activeEnvId) ?? null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (env: Environment) => {
    setOpen(false);
    onSelect(env);
  };

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={`${styles.pill} ${activeEnv ? styles.active : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="Select environment"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
          <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2" />
          <path d="M3 5H7M5 3C4.2 3.5 3.8 4.2 3.8 5S4.2 6.5 5 7C5.8 6.5 6.2 5.8 6.2 5S5.8 3.5 5 3Z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        </svg>
        <span>{activeEnv ? activeEnv.name : 'No Env'}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden className={styles.chevron}>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className={styles.dropdown}>
          {environments.length === 0 ? (
            <div className={styles.empty}>No environments — add one in the sidebar</div>
          ) : (
            environments.map((env) => (
              <button
                key={env.id}
                className={`${styles.option} ${env.id === activeEnvId ? styles.selectedOption : ''}`}
                onClick={() => handleSelect(env)}
              >
                {env.id === activeEnvId && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
                    <path d="M2 5L4.5 7.5L8 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                <span>{env.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
