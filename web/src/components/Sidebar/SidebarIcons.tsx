import styles from './Sidebar.module.css';

export function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`${styles.chevron}${expanded ? ` ${styles.chevronOpen}` : ''}`}
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
    >
      <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BinIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M3.5 3.5l.5 7h5l.5-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="4" y="4" width="6.5" height="6.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M3.5 8H2C1.72 8 1.5 7.78 1.5 7.5V2C1.5 1.72 1.72 1.5 2 1.5H7.5C7.78 1.5 8 1.72 8 2V3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ProjectIcon() {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconProject}`} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="1.5" y="3.5" width="10" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 3.5V2.5C4.5 2.22 4.72 2 5 2H8C8.28 2 8.5 2.22 8.5 2.5V3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconFolder}`} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path
        d="M1.5 4.5C1.5 3.95 1.95 3.5 2.5 3.5H5L6 4.5H10.5C11.05 4.5 11.5 4.95 11.5 5.5V9.5C11.5 10.05 11.05 10.5 10.5 10.5H2.5C1.95 10.5 1.5 10.05 1.5 9.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill={open ? 'currentColor' : 'none'}
        fillOpacity={open ? 0.25 : 0}
      />
    </svg>
  );
}

export function EnvIcon() {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconEnv}`} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4.5 6.5H8.5M6 4.5L8.5 6.5L6 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ImportIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1.5v6M3 5.5L6 8.5L9 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ExportIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 8V2M3 5L6 2L9 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function NewEnvIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ color: 'var(--accent-patch)' }}>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7 4.5V9.5M4.5 7H9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function NewFolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M1.5 5C1.5 4.45 1.95 4 2.5 4H5.5L6.5 5H11.5C12.05 5 12.5 5.45 12.5 6V10C12.5 10.55 12.05 11 11.5 11H2.5C1.95 11 1.5 10.55 1.5 10V5Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path d="M9 7.5V9.5M8 8.5H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function AutomationIcon() {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconAutomation}`} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <polygon points="3,2 11,6.5 3,11" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

export function AutomationsFolderIcon() {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconAutomation}`} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M1.5 3.5h10M1.5 6.5h10M1.5 9.5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <polygon points="9,7.5 12,9 9,10.5" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" fill="currentColor" fillOpacity="0.5" />
    </svg>
  );
}

export function NewAutomationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ color: 'var(--accent-get)' }}>
      <polygon points="3,2 11,7 3,12" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M10.5 3.5V7.5M8.5 5.5H12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function ImportedFolderIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      aria-label="Imported"
      style={{ flexShrink: 0, color: 'var(--text-tertiary)', opacity: 0.7, marginLeft: 4 }}
    >
      <title>Imported</title>
      <path d="M5 1v5M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M1.5 8h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
