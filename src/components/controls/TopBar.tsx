import type {
  ScenarioId,
  SimulatorControlState,
  SimulatorUIState,
} from "../../simulator/types";
import styles from "./TopBar.module.css";

interface TopBarProps {
  controlState: SimulatorControlState;
  uiState: SimulatorUIState;
  scenarioName: string;
  scenarios: Array<{ id: ScenarioId; name: string }>;
  canStep: boolean;
  canStart: boolean;
  canPause: boolean;
  onStart: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  onScenarioChange: (scenarioId: ScenarioId) => void;
  onToggleDisplayMode: () => void;
  onToggleTheme: () => void;
}

export function TopBar({
  controlState,
  uiState,
  scenarioName,
  scenarios,
  canStep,
  canStart,
  canPause,
  onStart,
  onPause,
  onStep,
  onReset,
  onSpeedChange,
  onScenarioChange,
  onToggleDisplayMode,
  onToggleTheme,
}: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <div>
        <div className={styles.title}>Simulator Controls</div>
        <p className={styles.subtitle}>Scenario, playback, display, and speed</p>
      </div>

      <div className={styles.controls} aria-label="Simulator controls">
        <label className={styles.selectLabel}>
          Scenario
          <select
            value={controlState.scenarioId}
            aria-label="Scenario"
            aria-describedby="current-scenario-name"
            onChange={(event) => onScenarioChange(event.currentTarget.value)}
          >
            {scenarios.map((scenario) => (
              <option key={scenario.id} value={scenario.id}>{scenario.name}</option>
            ))}
          </select>
          <span id="current-scenario-name" className={styles.currentScenario}>
            {scenarioName}
          </span>
        </label>

        <button type="button" onClick={onStart} disabled={!canStart}>Start</button>
        <button type="button" onClick={onPause} disabled={!canPause}>Pause</button>
        <button type="button" onClick={onStep} disabled={!canStep}>Next Step</button>
        <button type="button" onClick={onReset}>Reset</button>

        <label className={styles.speedLabel}>
          Speed
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.5"
            value={controlState.speed}
            onChange={(event) => onSpeedChange(Number(event.currentTarget.value))}
          />
        </label>

        <button type="button" onClick={onToggleDisplayMode}>
          {uiState.displayMode === "basic" ? "Basic" : "Advanced"}
        </button>
        <button type="button" onClick={onToggleTheme}>
          {uiState.theme === "light" ? "Light" : "Dark"}
        </button>
      </div>
    </header>
  );
}
