import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

function readZoom(el: HTMLElement): number {
  return parseFloat(getComputedStyle(el).getPropertyValue('--app-zoom')) || 1;
}

function calcPopoverPos(r: DOMRect, zoom: number, popoverAlign: 'left' | 'right', vh: number, vw: number): PopoverPos {
  const top = r.top * zoom;
  const bottom = r.bottom * zoom;
  const left = r.left * zoom;
  const right = r.right * zoom;
  const horiz = popoverAlign === 'right' ? { left } : { right: vw - right };
  if (vh - bottom < 220 * zoom) {
    return { bottom: vh - top + 4, ...horiz };
  }
  return { top: bottom + 4, ...horiz };
}

function posEqual(a: PopoverPos | null, b: PopoverPos): boolean {
  if (!a) return false;
  const ak = a as Record<string, number>;
  const bk = b as Record<string, number>;
  return Object.keys(bk).every(k => ak[k] === bk[k]) && Object.keys(ak).every(k => bk[k] === ak[k]);
}

export function JwtBadge({ token, popoverAlign = 'left' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const [popoverZoom, setPopoverZoom] = useState(1);
  const chipRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const decoded = open ? decodeJwt(token) : null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (chipRef.current) {
      const zoom = readZoom(chipRef.current);
      const r = chipRef.current.getBoundingClientRect();
      setPopoverZoom(zoom);
      setPos(calcPopoverPos(r, zoom, popoverAlign, window.innerHeight, window.innerWidth));
    }
    setOpen(v => !v);
  };

  // Re-read zoom and position every render while open so keyboard-driven zoom changes
  // are reflected immediately (AppContent re-renders every RAF frame during animation).
  // Functional updates with equality checks prevent infinite re-render loops.
  useLayoutEffect(() => {
    if (!open || !chipRef.current) return;
    const z = readZoom(chipRef.current);
    const r = chipRef.current.getBoundingClientRect();
    const newPos = calcPopoverPos(r, z, popoverAlign, window.innerHeight, window.innerWidth);
    setPopoverZoom(prev => (prev === z ? prev : z));
    setPos(prev => (posEqual(prev, newPos) ? prev : newPos));
  });

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

  // transform: scale() scales visually without affecting fixed-position coordinates,
  // avoiding WebKit's non-standard behavior where zoom: X also multiplies top/left values.
  const isFlipped = pos !== null && 'bottom' in pos;
  const transformOrigin = `${isFlipped ? 'bottom' : 'top'} ${popoverAlign === 'right' ? 'left' : 'right'}`;

  const popoverContent = open && pos ? (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{
        position: 'fixed',
        ...pos,
        transform: `scale(${popoverZoom})`,
        transformOrigin,
      }}
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
