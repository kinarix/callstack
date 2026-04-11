import { useTheme } from '../../hooks/useTheme';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  const icons: Record<string, string> = {
    dark: '🌙',
    light: '☀️',
    system: '🖥️',
  };

  return (
    <button
      className={styles.button}
      onClick={toggleTheme}
      title={`Theme: ${theme}`}
    >
      {icons[theme]}
    </button>
  );
}
