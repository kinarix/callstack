import { useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import styles from './Header.module.css';

export function UserSection() {
  const { currentUser, initializeGoogleSignIn, handleSignOut } = useAuth();
  const signInBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentUser && signInBtnRef.current) {
      initializeGoogleSignIn(signInBtnRef.current);
    }
  }, [currentUser, initializeGoogleSignIn]);

  if (currentUser) {
    return (
      <div className={styles.userInfo}>
        <img
          src={currentUser.picture}
          alt={currentUser.name}
          className={styles.avatar}
        />
        <span className={styles.userName}>{currentUser.name}</span>
        <button
          onClick={handleSignOut}
          style={{
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-primary)',
            color: 'var(--text-primary)',
            padding: 'var(--space-half) var(--space-2)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all var(--transition-base)',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)';
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return <div ref={signInBtnRef} id="signInBtn" />;
}
