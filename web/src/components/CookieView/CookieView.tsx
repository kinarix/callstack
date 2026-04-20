import { useEffect, useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { useDatabase } from '../../hooks/useDatabase';
import { CookieDomainIcon } from '../Sidebar/SidebarIcons';
import { ConfirmModal } from '../ConfirmModal/ConfirmModal';
import type { Cookie } from '../../lib/types';
import styles from './CookieView.module.css';

function DomainFavicon({ domain }: { domain: string }) {
  const [failed, setFailed] = useState(false);
  const clean = domain.replace(/^\./, '');
  if (failed) return <CookieDomainIcon />;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${clean}&sz=16`}
      width={14}
      height={14}
      style={{ flexShrink: 0, borderRadius: 2 }}
      onError={() => setFailed(true)}
      alt=""
    />
  );
}

type PendingClear =
  | { type: 'all' }
  | { type: 'domain'; domain: string }
  | { type: 'cookie'; id: number; name: string };

interface Props {
  showExpandBtn?: boolean;
  onExpand?: () => void;
}

export default function CookieView({ showExpandBtn, onExpand }: Props) {
  const { state, dispatch } = useApp();
  const { listCookies, deleteCookie, clearCookies } = useDatabase();
  const [cookies, setCookies] = useState<Cookie[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingClear, setPendingClear] = useState<PendingClear | null>(null);

  const projectId = state.currentProjectId;

  const load = useCallback(async () => {
    if (projectId == null) return;
    setLoading(true);
    try {
      const data = await listCookies(projectId);
      setCookies(data);
    } finally {
      setLoading(false);
    }
  }, [projectId, listCookies]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { load(); }, [state.currentResponse]);
  useEffect(() => { load(); }, [state.cookieJarVersion]);

  const handleConfirm = async () => {
    if (!pendingClear || projectId == null) return;
    setPendingClear(null);
    if (pendingClear.type === 'cookie') {
      await deleteCookie(pendingClear.id);
      setCookies((prev) => prev.filter((c) => c.id !== pendingClear.id));
    } else if (pendingClear.type === 'domain') {
      await clearCookies(projectId, pendingClear.domain);
      setCookies((prev) => prev.filter((c) => c.domain !== pendingClear.domain));
    } else {
      await clearCookies(projectId);
      setCookies([]);
      dispatch({ type: 'SET_ACTIVE_COOKIE_DOMAIN', payload: null });
    }
  };

  const domains = [...new Set(cookies.map((c) => c.domain))].sort();
  const activeDomain = state.activeCookieDomain;

  const visibleDomains = activeDomain ? domains.filter((d) => d === activeDomain) : domains;

  function formatExpires(expires: number | null): string {
    if (expires == null) return 'Session';
    return new Date(expires * 1000).toLocaleString();
  }

  return (
    <div className={styles.view}>
      <div className={styles.toolbar}>
        <div className={styles.title}>
          {showExpandBtn && (
            <button className={styles.expandBtn} onClick={onExpand} title="Expand sidebar">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.3"/>
                <path d="M5.5 3.5V12.5" stroke="var(--accent-post)" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M9.5 6L11.5 8L9.5 10" stroke="var(--accent-post)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          <span>Cookie Jar</span>
          {activeDomain && (
            <button
              className={styles.filterChip}
              onClick={() => dispatch({ type: 'SET_ACTIVE_COOKIE_DOMAIN', payload: null })}
              title="Show all domains"
            >
              {activeDomain} ×
            </button>
          )}
        </div>
        <div className={styles.actions}>
          {cookies.length > 0 && (
            <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => setPendingClear({ type: 'all' })}>
              Clear All
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.empty}>Loading…</div>
      ) : projectId == null ? (
        <div className={styles.empty}>Select a project to view cookies.</div>
      ) : visibleDomains.length === 0 ? (
        <div className={styles.emptyState}>
          <svg className={styles.emptyIcon} width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden>
            <ellipse cx="36" cy="56" rx="22" ry="6" fill="currentColor" opacity="0.12"/>
            <path d="M16 28C16 22 20 18 36 18C52 18 56 22 56 28V50C56 54 48 58 36 58C24 58 16 54 16 50V28Z" stroke="currentColor" strokeWidth="2.5" fill="none"/>
            <path d="M16 28C16 34 24 38 36 38C48 38 56 34 56 28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <circle cx="30" cy="44" r="2.5" fill="currentColor" opacity="0.4"/>
            <circle cx="40" cy="48" r="2" fill="currentColor" opacity="0.3"/>
            <circle cx="35" cy="42" r="1.5" fill="currentColor" opacity="0.25"/>
            <path d="M32 18C32 16 33 14 36 12C39 14 40 16 40 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5"/>
          </svg>
          <p className={styles.emptyTitle}>Cookie jar is empty</p>
          <p className={styles.emptySubtext}>
            {activeDomain
              ? `No cookies stored for ${activeDomain}.`
              : 'Cookies will appear here after you make requests to sites that set them.'}
          </p>
        </div>
      ) : (
        <div className={styles.content}>
          {visibleDomains.map((domain) => {
            const domainCookies = cookies.filter((c) => c.domain === domain);
            return (
              <div key={domain} className={styles.domainGroup}>
                <div className={styles.domainHeader}>
                  <DomainFavicon domain={domain} />
                  <span className={styles.domainName}>{domain}</span>
                  <span className={styles.domainCount}>{domainCookies.length}</span>
                  <button
                    className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                    onClick={() => setPendingClear({ type: 'domain', domain })}
                  >
                    Clear
                  </button>
                </div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Value</th>
                      <th>Path</th>
                      <th>Expires</th>
                      <th>Flags</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {domainCookies.map((cookie) => (
                      <tr key={cookie.id}>
                        <td className={styles.nameCell}>{cookie.name}</td>
                        <td className={styles.valueCell} title={cookie.value}>{cookie.value}</td>
                        <td className={styles.pathCell}>{cookie.path}</td>
                        <td className={styles.expiresCell}>{formatExpires(cookie.expires)}</td>
                        <td className={styles.flagsCell}>
                          {cookie.secure && <span className={styles.flag}>Secure</span>}
                          {cookie.httpOnly && <span className={styles.flag}>HttpOnly</span>}
                          {cookie.sameSite && <span className={styles.flag}>{cookie.sameSite}</span>}
                        </td>
                        <td className={styles.actionsCell}>
                          <button
                            className={styles.deleteBtn}
                            onClick={() => setPendingClear({ type: 'cookie', id: cookie.id, name: cookie.name })}
                            title="Delete cookie"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {pendingClear && (
        <ConfirmModal
          title={
            pendingClear.type === 'all' ? 'Clear all cookies?' :
            pendingClear.type === 'domain' ? `Clear cookies for ${pendingClear.domain}?` :
            `Delete cookie "${pendingClear.name}"?`
          }
          confirmLabel={pendingClear.type === 'cookie' ? 'Delete' : 'Clear'}
          onConfirm={handleConfirm}
          onCancel={() => setPendingClear(null)}
        >
          {pendingClear.type === 'all' && (
            <p>This will permanently delete all stored cookies for this project. This action cannot be undone.</p>
          )}
          {pendingClear.type === 'domain' && (
            <p>This will permanently delete all cookies for <strong>{pendingClear.domain}</strong>. This action cannot be undone.</p>
          )}
          {pendingClear.type === 'cookie' && (
            <p>Permanently delete cookie <strong>{pendingClear.name}</strong>? This action cannot be undone.</p>
          )}
        </ConfirmModal>
      )}
    </div>
  );
}
