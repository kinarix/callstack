import { useState } from 'react';
import styles from './RefreshButton.module.css';

function ArrowPathIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={spinning ? styles.spinning : undefined}
    >
      <path fillRule="evenodd" clipRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" />
    </svg>
  );
}

export function RefreshButton() {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleRefresh = async () => {
    setIsUpdating(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      } else {
        window.location.reload();
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <button
      className={`${styles.button} ${isUpdating ? styles.updating : ''}`}
      onClick={handleRefresh}
      disabled={isUpdating}
      title="Check for updates"
    >
      <ArrowPathIcon spinning={isUpdating} />
    </button>
  );
}
