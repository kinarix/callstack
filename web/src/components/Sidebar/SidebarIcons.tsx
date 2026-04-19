import styles from './Sidebar.module.css';
import { getEnvColor } from '../../lib/envUtils';

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

/** Default — globe */
export function EnvIcon({ color }: { color?: string }) {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconEnv}`} style={color ? { color } : undefined} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 6.5H9M6.5 2.5C5.3 3.4 4.6 4.8 4.6 6.5s.7 3.1 1.9 4C7.7 9.6 8.4 8.2 8.4 6.5s-.7-3.1-1.9-4z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  );
}

/** Prod — lock */
export function EnvProdIcon({ color }: { color?: string }) {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconEnv}`} style={color ? { color } : undefined} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="3" y="6" width="7" height="5.5" rx="0.8" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4.5 6V4.5a2 2 0 0 1 4 0V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/** Staging — rocket */
export function EnvStagingIcon({ color }: { color?: string }) {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconEnv}`} style={color ? { color } : undefined} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M6.5 1.5C6.5 1.5 9.5 3 9.5 6.5L8 8H5L3.5 6.5C3.5 3 6.5 1.5 6.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
      <path d="M5 8l-.8 2.5M8 8l.8 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="6.5" cy="5.5" r="1" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Dev / Local — code brackets */
export function EnvDevIcon({ color }: { color?: string }) {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconEnv}`} style={color ? { color } : undefined} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M5 4L2 6.5L5 9M8 4L11 6.5L8 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Test / QA — flask */
export function EnvTestIcon({ color }: { color?: string }) {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconEnv}`} style={color ? { color } : undefined} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <path d="M4.5 2h4M5 2v4L2.5 10a.8.8 0 0 0 .7 1.2h6.6a.8.8 0 0 0 .7-1.2L8 6V2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 8.5h7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

/** Sandbox / Demo — grid */
export function EnvSandboxIcon({ color }: { color?: string }) {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconEnv}`} style={color ? { color } : undefined} width="13" height="13" viewBox="0 0 13 13" fill="none">
      <rect x="2" y="2" width="9" height="9" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 6.5H11M6.5 2V11" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

export function EnvIconFor({ name }: { name: string }) {
  const color = getEnvColor(name);
  const n = name.toLowerCase();
  if (/prod|production/.test(n)) return <EnvProdIcon color={color} />;
  if (/stag|staging/.test(n)) return <EnvStagingIcon color={color} />;
  if (/dev|local|development/.test(n)) return <EnvDevIcon color={color} />;
  if (/test|qa|testing|uat|canary/.test(n)) return <EnvTestIcon color={color} />;
  if (/sandbox|demo/.test(n)) return <EnvSandboxIcon color={color} />;
  return <EnvIcon color={color} />;
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

export function DataFileIcon() {
  return (
    <svg className={`${styles.treeIcon} ${styles.treeIconDataset}`} width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <ellipse cx="6.5" cy="3.5" rx="4.5" ry="1.5" stroke="currentColor" strokeWidth="1.2" fill="currentColor" fillOpacity="0.15"/>
      <path d="M2 3.5v3c0 .83 2.01 1.5 4.5 1.5S11 7.33 11 6.5v-3" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2 6.5v3c0 .83 2.01 1.5 4.5 1.5S11 10.33 11 9.5v-3" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

export function DatasetItemIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden style={{ flexShrink: 0, color: 'var(--accent-delete)', opacity: 0.85 }}>
      <path d="M2.5 1.5h5L9.5 4v6.5a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.1" fill="currentColor" fillOpacity="0.1"/>
      <path d="M7.5 1.5V4H9.5" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
      <path d="M4 6h4M4 8h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

export function NewDataFileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden style={{ flexShrink: 0, color: 'var(--accent-delete)' }}>
      <ellipse cx="6" cy="4" rx="4" ry="1.4" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2 4v3c0 .77 1.79 1.4 4 1.4" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M10.5 8v4M8.5 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
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
