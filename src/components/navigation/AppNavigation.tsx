import styles from "./AppNavigation.module.css";

export type AppPage = "simulator" | "learn";

interface AppNavigationProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
}

export function AppNavigation({ currentPage, onNavigate }: AppNavigationProps) {
  return (
    <header className={styles.header}>
      <div>
        <div className={styles.brand}>Raft Explorer</div>
        <p>Interactive Raft Consensus Visualizer</p>
      </div>
      <nav className={styles.nav} aria-label="Primary navigation">
        <button
          type="button"
          aria-current={currentPage === "simulator" ? "page" : undefined}
          onClick={() => onNavigate("simulator")}
        >
          Simulator
        </button>
        <button
          type="button"
          aria-current={currentPage === "learn" ? "page" : undefined}
          onClick={() => onNavigate("learn")}
        >
          Learn
        </button>
      </nav>
    </header>
  );
}
