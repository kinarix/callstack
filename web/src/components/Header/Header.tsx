import { RefreshButton } from './RefreshButton';
import { ThemeToggle } from './ThemeToggle';
import { UserSection } from './UserSection';
import styles from './Header.module.css';

export function Header() {
  return (
    <div className={styles.header}>
      <div className={styles.logo}>CALLSTACK</div>
      <div className={styles.userSection}>
        <RefreshButton />
        <ThemeToggle />
        <UserSection />
      </div>
    </div>
  );
}
