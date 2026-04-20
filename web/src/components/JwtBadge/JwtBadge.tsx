import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { decodeJwt } from '../../lib/jwt';
import styles from './JwtBadge.module.css';

function formatTimestamp(val: number): string {
  const d = new Date(val * 1000);
  const str = d.toUTCString().replace(' GMT', ' UTC');
  if (Date.now() > val * 1000) return `${str} (expired)`;
  return str;
}

function renderValue(key: string, val: any): string {
  if ((key === 'exp' || key === 'iat' || key === 'nbf') && typeof val === 'number') {
    return formatTimestamp(val);
  }
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

interface Props {
  token: string;
  popoverAlign?: 'left' | 'right';
}

type PopoverPos = { top: number; left?: number; right?: number } | { bottom: number; left?: number; right?: number };

export function JwtBadge({ token, popoverAlign = 'left' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const decoded = open ? decodeJwt(token) : null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (chipRef.current) {
      const r = chipRef.current.getBoundingClientRect();
      const horiz = popoverAlign === 'right' ? { left: r.left } : { right: window.innerWidth - r.right };
      if (window.innerHeight - r.bottom < 220) {
        setPos({ bottom: window.innerHeight - r.top + 4, ...horiz });
      } else {
        setPos({ top: r.bottom + 4, ...horiz });
      }
    }
    setOpen(v => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (chipRef.current?.contains(t) || popoverRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const popoverContent = open && pos ? (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{ position: 'fixed', ...pos }}
    >
      {decoded ? (
        <>
          <section>
            <div className={styles.sectionLabel}>Header</div>
            {Object.entries(decoded.header).map(([k, v]) => (
              <div key={k} className={styles.row}>
                <span className={styles.key}>{k}</span>
                <span className={styles.val}>{renderValue(k, v)}</span>
              </div>
            ))}
          </section>
          <section>
            <div className={styles.sectionLabel}>Payload</div>
            {Object.entries(decoded.payload).map(([k, v]) => (
              <div key={k} className={styles.row}>
                <span className={styles.key}>{k}</span>
                <span className={`${styles.val} ${(k === 'exp' || k === 'nbf') && typeof v === 'number' && Date.now() > v * 1000 ? styles.expired : ''}`}>
                  {renderValue(k, v)}
                </span>
              </div>
            ))}
          </section>
          <div className={styles.footer}>Signature not verified</div>
        </>
      ) : (
        <div className={styles.footer}>Failed to decode token</div>
      )}
    </div>
  ) : null;

  return (
    <span className={styles.wrap}>
      <button
        ref={chipRef}
        className={styles.chip}
        onClick={handleClick}
        title="Decode JWT"
        type="button"
      >
        JWT
      </button>
      {popoverContent && createPortal(popoverContent, document.body)}
    </span>
  );
}
