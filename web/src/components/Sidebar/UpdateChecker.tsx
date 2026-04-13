import { useState, useEffect } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import styles from './UpdateChecker.module.css';

const REPO = 'kinarix/callstack';

function semverIsNewer(latest: string, current: string): boolean {
  const a = latest.replace(/^v/, '').split('.').map(Number);
  const b = current.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

function UpToDateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
        fill="currentColor"
      />
    </svg>
  );
}

function UpdateAvailableIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2.25a.75.75 0 0 1 .75.75v11.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3a.75.75 0 0 1 .75-.75Zm-9 13.5a.75.75 0 0 1 .75.75v2.25a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5V16.5a.75.75 0 0 1 1.5 0v2.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V16.5a.75.75 0 0 1 .75-.75Z"
        fill="currentColor"
      />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className={styles.spinning}>
      <path
        d="M12 4.75a7.25 7.25 0 1 0 7.25 7.25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Status = 'checking' | 'up-to-date' | 'update-available' | 'error';

export function UpdateChecker() {
  const [status, setStatus] = useState<Status>('checking');
  const [latestVersion, setLatestVersion] = useState('');
  const [releaseUrl, setReleaseUrl] = useState('');
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const [appVersion, res] = await Promise.all([
          getVersion(),
          fetch(`https://api.github.com/repos/${REPO}/releases/latest`),
        ]);
        if (cancelled) return;

        const data = await res.json();
        if (cancelled) return;

        const tag = (data.tag_name ?? '').replace(/^v/, '');
        const url = data.html_url ?? `https://github.com/${REPO}/releases`;
        setCurrentVersion(appVersion);
        setLatestVersion(tag);
        setReleaseUrl(url);
        setStatus(semverIsNewer(tag, appVersion) ? 'update-available' : 'up-to-date');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    check();
    return () => { cancelled = true; };
  }, []);

  if (status === 'checking') {
    return (
      <button className={`${styles.btn} ${styles.checking}`} disabled title="Checking for updates…">
        <SpinnerIcon />
      </button>
    );
  }

  if (status === 'update-available') {
    return (
      <button
        className={`${styles.btn} ${styles.updateAvailable}`}
        onClick={() => window.open(releaseUrl, '_blank')}
        title={`v${latestVersion} available — click to download`}
      >
        <UpdateAvailableIcon />
        <span className={styles.badge} />
      </button>
    );
  }

  // up-to-date or error — subtle, non-distracting
  return (
    <button
      className={`${styles.btn} ${styles.upToDate}`}
      onClick={releaseUrl ? () => window.open(releaseUrl, '_blank') : undefined}
      title={currentVersion ? `v${currentVersion} — up to date` : 'Up to date'}
    >
      <UpToDateIcon />
    </button>
  );
}
