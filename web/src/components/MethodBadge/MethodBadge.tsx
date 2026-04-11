import type { HTTPMethod } from '../../lib/types';
import { getMethodColor, getMethodIcon } from '../../lib/utils';
import styles from './MethodBadge.module.css';

interface MethodBadgeProps {
  method: HTTPMethod;
}

export function MethodBadge({ method }: MethodBadgeProps) {
  const color = getMethodColor(method);
  const icon = getMethodIcon(method);

  return (
    <div className={styles.badge} style={{ backgroundColor: color }}>
      <span className={styles.icon}>{icon}</span>
      <span className={styles.text}>{method}</span>
    </div>
  );
}
