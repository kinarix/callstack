import { createPortal } from 'react-dom';
import styles from './TemplateInput.module.css';

export interface TooltipState {
  text: string;
  left: number;
  top: number;
  error: boolean;
  below: boolean;
}

/** Place a tooltip relative to a token rect. Defaults below the token (keeps tooltips for
 *  top-of-window fields like the URL bar on-screen); flips above only when there's no room. */
export function tooltipFromRect(r: DOMRect, text: string, error: boolean): TooltipState {
  const below = r.bottom + 80 < window.innerHeight;
  return {
    text,
    left: Math.round(r.left),
    top: Math.round(below ? r.bottom + 6 : r.top - 6),
    error,
    below,
  };
}

/** Portaled token tooltip — rendered to document.body so it can't be clipped or re-rooted
 *  by an ancestor's transform/overflow. */
export function TokenTooltip({ tooltip }: { tooltip: TooltipState | null }) {
  if (!tooltip) return null;
  return createPortal(
    <div
      className={`${styles.tooltip} ${tooltip.below ? styles.tooltipBelow : styles.tooltipAbove} ${tooltip.error ? styles.tooltipError : ''}`}
      style={{ left: tooltip.left, top: tooltip.top }}
      role="tooltip"
    >
      {tooltip.text}
    </div>,
    document.body,
  );
}
