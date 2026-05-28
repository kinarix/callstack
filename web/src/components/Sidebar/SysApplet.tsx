import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import styles from './SysApplet.module.css';

interface SystemStats {
  cpu_usage: number;
  mem_bytes: number;
  db_size_bytes: number;
  proc_uptime_secs: number;
}

const MAX_HISTORY = 60;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptime(secs: number): string {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const W = 48, H = 16;
  if (data.length < 2) return <span className={styles.sparkPH} />;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - (v / max) * H * 0.85 - H * 0.1,
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className={styles.sparkSvg} preserveAspectRatio="none">
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function PopSparkline({ data, gradId, color }: { data: number[]; gradId: string; color: string }) {
  const W = 220, H = 38;
  if (data.length < 2) return <div className={styles.popSparkPH} />;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * W,
    H - (v / max) * H * 0.85 - H * 0.08,
  ]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area =
    `M${pts[0][0].toFixed(1)},${H} ` +
    pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') +
    ` L${pts[pts.length - 1][0].toFixed(1)},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className={styles.popSparkSvg} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function SysApplet() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [memHistory, setMemHistory] = useState<number[]>([]);
  const [hovered, setHovered] = useState(false);
  const hoverTimer = useRef<number | null>(null);

  const cancelHoverTimer = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  const showAfterDelay = () => {
    cancelHoverTimer();
    hoverTimer.current = window.setTimeout(() => setHovered(true), 1200);
  };
  const hideNow = () => {
    cancelHoverTimer();
    setHovered(false);
  };

  useEffect(() => cancelHoverTimer, []);

  useEffect(() => {
    const poll = async () => {
      try {
        const s = await invoke<SystemStats>('get_system_stats');
        setStats(s);
        setCpuHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), s.cpu_usage]);
        setMemHistory((prev) => [...prev.slice(-(MAX_HISTORY - 1)), s.mem_bytes]);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={styles.applet}
      tabIndex={0}
      onMouseEnter={showAfterDelay}
      onMouseLeave={hideNow}
      onFocus={() => setHovered(true)}
      onBlur={hideNow}
    >
      {hovered && (
        <div className={styles.popover}>
          <div className={styles.popSection}>
            <div className={styles.popHeader}>
              <span className={styles.popLabel}>CPU</span>
              <span className={styles.popVal} style={{ color: 'var(--accent-get)' }}>
                {stats ? `${stats.cpu_usage.toFixed(1)}%` : '—'}
              </span>
            </div>
            <PopSparkline data={cpuHistory} gradId="sa-cpu" color="var(--accent-get)" />
            <span className={styles.popSub}>this app · 60s window · 2s interval</span>
          </div>
          <div className={styles.popSection}>
            <div className={styles.popHeader}>
              <span className={styles.popLabel}>Memory</span>
              <span className={styles.popVal}>
                {stats ? formatBytes(stats.mem_bytes) : '—'}
              </span>
            </div>
            <PopSparkline data={memHistory} gradId="sa-mem" color="var(--accent-post)" />
            <span className={styles.popSub}>RSS · this app</span>
          </div>
          <div className={styles.popSection}>
            <div className={styles.popHeader}>
              <span className={styles.popLabel}>Database</span>
              <span className={styles.popVal}>
                {stats ? formatBytes(stats.db_size_bytes) : '—'}
              </span>
            </div>
            {stats && (
              <div className={styles.dbBar}>
                <div
                  className={styles.dbBarFill}
                  style={{ width: `${Math.min(100, (stats.db_size_bytes / (50 * 1024 * 1024)) * 100).toFixed(1)}%` }}
                />
              </div>
            )}
            <span className={styles.popSub}>SQLite file size · scale 50 MB</span>
          </div>
          {stats && (
            <div className={styles.popFooter}>
              Uptime {formatUptime(stats.proc_uptime_secs)}
            </div>
          )}
        </div>
      )}

      <div className={styles.compact}>
        <span className={styles.metricGroup}>
          <span className={styles.metricLabel}>CPU</span>
          <MiniSparkline data={cpuHistory} color="var(--accent-get)" />
          <span className={styles.metricVal} style={{ color: 'var(--accent-get)' }}>
            {stats ? `${stats.cpu_usage.toFixed(0)}%` : '—'}
          </span>
        </span>
        <span className={styles.metricGroup}>
          <span className={styles.metricLabel}>MEM</span>
          <MiniSparkline data={memHistory} color="var(--accent-post)" />
          <span className={styles.metricVal}>
            {stats ? formatBytes(stats.mem_bytes) : '—'}
          </span>
        </span>
        <span className={styles.metricGroup}>
          <span className={styles.metricLabel}>DB</span>
          <span className={styles.metricVal}>
            {stats ? formatBytes(stats.db_size_bytes) : '—'}
          </span>
        </span>
      </div>
    </div>
  );
}
