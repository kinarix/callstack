import { useAccentTheme } from '../../hooks/useAccentTheme';
import type { AccentTheme } from '../../hooks/useAccentTheme';
import styles from './ThemeToggle.module.css';

function ColorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="6"  cy="6"  r="3" fill="var(--accent-post)" />
      <circle cx="12" cy="6"  r="3" fill="var(--accent-put)" />
      <circle cx="9"  cy="12" r="3" fill="var(--accent-get)" />
    </svg>
  );
}

function BrightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.22 3.22l1.41 1.41M13.37 13.37l1.41 1.41M3.22 14.78l1.41-1.41M13.37 4.63l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="9" cy="9" r="3" fill="currentColor" />
    </svg>
  );
}

function MonoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 2a7 7 0 0 1 0 14V2Z" fill="currentColor" />
    </svg>
  );
}

const icons: Record<AccentTheme, React.ReactNode> = {
  color:  <ColorIcon />,
  bright: <BrightIcon />,
  mono:   <MonoIcon />,
};

const labels: Record<AccentTheme, string> = {
  color:  'Accent: color',
  bright: 'Accent: bright',
  mono:   'Accent: mono',
};

export function AccentToggle() {
  const { accent, cycleAccent } = useAccentTheme();

  return (
    <button
      className={styles.button}
      onClick={cycleAccent}
      title={labels[accent]}
    >
      {icons[accent]}
    </button>
  );
}
