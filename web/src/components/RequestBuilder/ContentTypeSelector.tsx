import { useEffect, useRef, useState } from 'react';
import styles from './ContentTypeSelector.module.css';

const PRESETS = [
  'application/json',
  'application/xml',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'text/html',
];

const CT_LABELS: Record<string, string> = {
  'application/json':                  'JSON',
  'application/xml':                   'XML',
  'application/x-www-form-urlencoded': 'Form URL',
  'multipart/form-data':               'Form Data',
  'text/plain':                        'Plain Text',
  'text/html':                         'HTML',
};

interface Props {
  value: string;
  onChange: (ct: string) => void;
}

export function ContentTypeSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [inCustomMode, setInCustomMode] = useState(() => !PRESETS.includes(value) && value !== '');
  const ref = useRef<HTMLDivElement>(null);

  const isPreset = PRESETS.includes(value);
  const isCustom = !isPreset && value !== '';
  const showCustomInput = inCustomMode || (!isPreset && value !== '');

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const label = isPreset ? CT_LABELS[value] : isCustom ? 'Custom' : 'None';

  return (
    <div ref={ref} className={styles.wrapper}>
      <span className={styles.label}>Content-Type</span>
      <button
        className={`${styles.pill} ${value ? styles.pillActive : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{label}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
          <path d="M1.5 3L4 5.5L6.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
      {showCustomInput && (
        <input
          className={styles.customInput}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. application/json"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
        />
      )}
      {open && (
        <div className={styles.dropdown}>
          <button
            className={`${styles.option} ${value === '' ? styles.optionActive : ''}`}
            onClick={() => { setInCustomMode(false); onChange(''); setOpen(false); }}
          >
            None
          </button>
          {PRESETS.map((p) => (
            <button
              key={p}
              className={`${styles.option} ${value === p ? styles.optionActive : ''}`}
              onClick={() => { setInCustomMode(false); onChange(p); setOpen(false); }}
            >
              <span className={styles.optionLabel}>{CT_LABELS[p]}</span>
              <span className={styles.optionValue}>{p}</span>
            </button>
          ))}
          <button
            className={`${styles.option} ${isCustom ? styles.optionActive : ''}`}
            onClick={() => { setInCustomMode(true); setOpen(false); }}
          >
            Custom…
          </button>
        </div>
      )}
    </div>
  );
}
