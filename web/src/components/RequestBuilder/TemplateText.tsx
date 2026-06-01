import { useMemo, useState } from 'react';
import type { KeyValue } from '../../lib/types';
import { analyzeTemplates } from '../../lib/template';
import { TokenTooltip, tooltipFromRect, type TooltipState } from './templateTooltip';
import styles from './TemplateInput.module.css';

interface TemplateTextProps {
  value: string;
  envVars?: KeyValue[];
  secrets?: KeyValue[];
  className?: string;
}

/** Read-only display of text containing `{{tokens}}`: unresolved tokens render red, and
 *  hovering any token shows its resolved value. Used for pill/value chips where the text
 *  isn't an editable input. */
export function TemplateText({ value, envVars = [], secrets = [], className }: TemplateTextProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const matches = useMemo(() => analyzeTemplates(value, envVars, secrets), [value, envVars, secrets]);

  if (matches.length === 0) {
    return <span className={className} title={value || undefined}>{value}</span>;
  }

  // Stitch plain slices and token spans together in document order.
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, i) => {
    if (m.start > cursor) parts.push(<span key={`t${i}`}>{value.slice(cursor, m.start)}</span>);
    parts.push(
      <span
        key={`m${i}`}
        className={m.resolved ? styles.token : `${styles.token} ${styles.unresolved}`}
        onMouseEnter={(e) =>
          setTooltip(tooltipFromRect(e.currentTarget.getBoundingClientRect(), m.displayValue, !m.resolved))
        }
        onMouseLeave={() => setTooltip(null)}
      >
        {value.slice(m.start, m.end)}
      </span>,
    );
    cursor = m.end;
  });
  if (cursor < value.length) parts.push(<span key="tail">{value.slice(cursor)}</span>);

  return (
    <span className={className}>
      {parts}
      <TokenTooltip tooltip={tooltip} />
    </span>
  );
}
