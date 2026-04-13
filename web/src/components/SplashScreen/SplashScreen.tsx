import styles from './SplashScreen.module.css';

interface SplashScreenProps {
  visible: boolean;
}

export function SplashScreen({ visible }: SplashScreenProps) {
  return (
    <div className={`${styles.splash} ${!visible ? styles.splashOut : ''}`}>
      <div className={styles.content}>
        <div className={styles.logo}>CALLSTACK</div>
        <div className={styles.dots}>
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}
