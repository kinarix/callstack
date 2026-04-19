import { useEffect, useState } from 'react';
import styles from './TitleBar.module.css';

async function getTauriWindow() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow();
  } catch {
    return null;
  }
}

function isWindowsPlatform(): boolean {
  return navigator.userAgent.toLowerCase().includes('windows');
}

export function TitleBar() {
  const [isWindows] = useState(isWindowsPlatform);
  const [isMaximized, setIsMaximized] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isWindows) return;
    let cleanup: (() => void) | undefined;

    (async () => {
      const win = await getTauriWindow();
      if (!win) return;

      const maximized = await win.isMaximized();
      setIsMaximized(maximized);

      const unlisten = await win.onResized(() => {
        win.isMaximized().then(setIsMaximized);
      });
      cleanup = unlisten;
    })();

    return () => cleanup?.();
  }, [isWindows]);

  if (!isWindows) return null;

  async function handleMinimize() {
    const win = await getTauriWindow();
    win?.minimize();
  }

  async function handleMaximize() {
    const win = await getTauriWindow();
    if (!win) return;
    if (isMaximized) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
    setIsMaximized(!isMaximized);
  }

  async function handleClose() {
    const win = await getTauriWindow();
    win?.close();
  }

  return (
    <div
      className={`${styles.titlebar} ${visible ? styles.visible : ''}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <div className={styles.dragRegion} data-tauri-drag-region />
      <div className={styles.controls}>
        <button className={styles.btn} onClick={handleMinimize} title="Minimize">
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
        </button>
        <button className={styles.btn} onClick={handleMaximize} title={isMaximized ? 'Restore' : 'Maximize'}>
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="2" y="0" width="8" height="8" stroke="currentColor" strokeWidth="1"/>
              <rect x="0" y="2" width="8" height="8" fill="var(--bg-secondary)" stroke="currentColor" strokeWidth="1"/>
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" strokeWidth="1"/>
            </svg>
          )}
        </button>
        <button className={`${styles.btn} ${styles.closeBtn}`} onClick={handleClose} title="Close">
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2"/>
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
