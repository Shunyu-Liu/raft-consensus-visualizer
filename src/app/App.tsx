import { useEffect, useState } from "react";
import { ClusterView } from "../components/cluster/ClusterView";
import { ClientCommandPanel } from "../components/client/ClientCommandPanel";
import { TopBar } from "../components/controls/TopBar";
import { Inspector } from "../components/inspector/Inspector";
import { LearnPage } from "../components/learn/LearnPage";
import { AppNavigation, type AppPage } from "../components/navigation/AppNavigation";
import { NetworkStatusPanel } from "../components/network/NetworkStatusPanel";
import { EventTimeline } from "../components/timeline/EventTimeline";
import { VerificationPanel } from "../components/debug/VerificationPanel";
import { useSimulator } from "../state/useSimulator";
import type { ScenarioId } from "../simulator/types";
import styles from "./App.module.css";

const DISCLAIMER =
  "Raft Explorer is an educational simulator designed to visualize the core ideas of the Raft consensus algorithm. It is not a production-ready Raft implementation.";

export function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>(() => readHashPage());
  const {
    clusterState,
    controlState,
    uiState,
    scenario,
    scenarios,
    changeScenario,
    selectNode,
    selectMessage,
    start,
    pause,
    step,
    reset,
    setSpeed,
    submitCommand,
    crashNode,
    restartNode,
    createPresetPartition,
    healPartition,
    toggleDisplayMode,
    toggleTheme,
    invariantResult,
    createTrace,
    loadTrace,
    replayCurrentTrace,
    viewHistoryStep,
    returnToLive,
    stateComparison,
  } = useSimulator();
  const latestEvent = clusterState.events[clusterState.events.length - 1];

  useEffect(() => {
    function handleHashChange() {
      setCurrentPage(readHashPage());
    }

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    document.title =
      currentPage === "learn" ? "Raft Explorer — Learn" : "Raft Explorer — Simulator";
  }, [currentPage]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (currentPage !== "simulator") {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        if (controlState.playbackStatus === "running") {
          pause();
        } else if (
          controlState.playbackStatus === "idle" ||
          controlState.playbackStatus === "paused"
        ) {
          start();
        }
      }
      if (event.key.toLowerCase() === "n" && controlState.playbackStatus !== "completed") {
        step();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [controlState.playbackStatus, currentPage, pause, start, step]);

  function navigate(page: AppPage) {
    window.location.hash = `#/${page}`;
    setCurrentPage(page);
  }

  function openScenario(scenarioId: ScenarioId) {
    changeScenario(scenarioId);
    window.location.hash = "#/simulator";
    setCurrentPage("simulator");
  }

  return (
    <div className={styles.app} data-theme={uiState.theme}>
      <AppNavigation currentPage={currentPage} onNavigate={navigate} />
      <div className={styles.liveRegion} aria-live="polite" aria-atomic="true">
        {latestEvent?.title ?? "Raft Explorer is ready."}
      </div>

      {currentPage === "learn" ? (
        <LearnPage scenarios={scenarios} onOpenScenario={openScenario} />
      ) : (
        <>
          <TopBar
            controlState={controlState}
            uiState={uiState}
            scenarioName={scenario.name}
            scenarios={scenarios}
            canStep={controlState.playbackStatus !== "completed" && !uiState.isInspectingHistory}
            canStart={
              !uiState.isInspectingHistory && (controlState.playbackStatus === "idle" ||
              controlState.playbackStatus === "paused")
            }
            canPause={controlState.playbackStatus === "running"}
            onStart={start}
            onPause={pause}
            onStep={step}
            onReset={reset}
            onSpeedChange={setSpeed}
            onScenarioChange={changeScenario}
            onToggleDisplayMode={toggleDisplayMode}
            onToggleTheme={toggleTheme}
          />

          <main className={styles.shell}>
            <h1 className={styles.pageTitle}>Simulator</h1>
            <section className={styles.notice}>{DISCLAIMER}</section>

            <VerificationPanel
              invariantResult={invariantResult}
              displayMode={uiState.displayMode}
              isInspectingHistory={uiState.isInspectingHistory}
              selectedHistoryStep={uiState.selectedHistoryStep}
              historyStepCount={uiState.historyStepCount}
              stateComparison={stateComparison}
              onCreateTrace={createTrace}
              onLoadTrace={loadTrace}
              onReplay={replayCurrentTrace}
              onViewStep={viewHistoryStep}
              onReturnToLive={returnToLive}
            />

            <ClientCommandPanel
              canSubmit={
                !uiState.isInspectingHistory && scenario.capabilities.clientCommands &&
                Object.values(clusterState.nodes).filter(
                  (node) => node.role === "leader" && node.status === "running",
                ).length === 1
              }
              playbackStatus={controlState.playbackStatus}
              onSubmitCommand={submitCommand}
            />

            <NetworkStatusPanel
              clusterState={clusterState}
              canControl={!uiState.isInspectingHistory && scenario.capabilities.networkPartition}
              onCreatePartition={createPresetPartition}
              onHealNetwork={healPartition}
            />

            <section className={styles.workspace}>
              <ClusterView
                nodes={clusterState.nodes}
                messages={clusterState.messages}
                selectedNodeId={uiState.selectedNodeId}
                selectedMessageId={uiState.selectedMessageId}
                onSelectNode={selectNode}
                onSelectMessage={selectMessage}
              />
              <Inspector
                clusterState={clusterState}
                selectedNodeId={uiState.selectedNodeId}
                selectedMessageId={uiState.selectedMessageId}
                displayMode={uiState.displayMode}
                scenarioDescription={scenario.description}
                onSelectMessage={selectMessage}
                onCrashNode={crashNode}
                onRestartNode={restartNode}
                mutationsDisabled={uiState.isInspectingHistory}
              />
            </section>

            <EventTimeline events={clusterState.events} />
          </main>
        </>
      )}
    </div>
  );
}

function readHashPage(): AppPage {
  return window.location.hash === "#/learn" ? "learn" : "simulator";
}
