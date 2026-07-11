import { useCallback, useEffect, useRef, useState } from "react";
import { RaftSimulator } from "../simulator/core/RaftSimulator";
import { demoUIState } from "../simulator/demoState";
import { getAvailableScenarios, getScenario } from "../simulator/scenarios/registry";
import { crashNode, restartNode } from "../simulator/transitions/failure";
import {
  createNetworkPartition,
  healNetworkPartition,
} from "../simulator/transitions/partition";
import { submitClientCommand } from "../simulator/transitions/replication";
import { createSimulationTrace } from "../simulator/trace/createSimulationTrace";
import { compareRaftStates } from "../simulator/trace/compareStates";
import { createSimulatorFromTrace, replayTrace } from "../simulator/trace/replayTrace";
import type { SimulationTrace } from "../simulator/trace/types";
import type {
  ClusterState,
  NodeId,
  SimulatorControlState,
  SimulatorUIState,
} from "../simulator/types";
import { buildMessageActivityFrames } from "../components/cluster/messageActivity";

export function useSimulator() {
  const initialScenario = getAvailableScenarios()[0];
  const simulatorRef = useRef<RaftSimulator | null>(null);
  const scenarioRef = useRef(initialScenario);
  const liveStateRef = useRef<ClusterState | null>(null);

  if (simulatorRef.current === null) {
    simulatorRef.current = initialScenario.createSimulator();
  }

  const [clusterState, setClusterState] = useState<ClusterState>(() =>
    simulatorRef.current!.getState(),
  );
  if (liveStateRef.current === null) liveStateRef.current = simulatorRef.current.getState();
  const [controlState, setControlState] = useState<SimulatorControlState>({
    scenarioId: initialScenario.id,
    playbackStatus: "idle",
    speed: 1,
  });
  const [uiState, setUiState] = useState<SimulatorUIState>({
    ...demoUIState,
    selectedNodeId: "B",
    isInspectingHistory: false,
    selectedHistoryStep: 0,
    historyStepCount: 0,
    messageDisplayMode: "focus",
    pinnedMessageId: null,
  });
  const scenarios = getAvailableScenarios();

  const refreshState = useCallback(() => {
    const state = simulatorRef.current!.getState();
    liveStateRef.current = state;
    setClusterState(state);
  }, []);

  const step = useCallback(() => {
    const simulator = simulatorRef.current!;
    const result = simulator.step();
    liveStateRef.current = result.state;
    setClusterState(result.state);
    setUiState((current) => ({
      ...current,
      selectedHistoryStep: simulator.getActionHistory().length,
      historyStepCount: simulator.getActionHistory().length,
    }));
    setControlState((current) => ({
      ...current,
      playbackStatus: simulator.hasPendingActions()
        ? current.playbackStatus
        : "completed",
    }));
  }, []);

  const reset = useCallback(() => {
    simulatorRef.current!.reset();
    refreshState();
    setControlState((current) => ({
      ...current,
      playbackStatus: "idle",
    }));
    setUiState((current) => ({
      ...current,
      selectedNodeId: "B",
      selectedMessageId: null,
      isInspectingHistory: false,
      selectedHistoryStep: 0,
      historyStepCount: 0,
      pinnedMessageId: null,
    }));
  }, [refreshState]);

  const start = useCallback(() => {
    if (uiState.isInspectingHistory) return;
    if (!simulatorRef.current!.hasPendingActions()) {
      setControlState((current) => ({ ...current, playbackStatus: "completed" }));
      return;
    }

    setControlState((current) => ({ ...current, playbackStatus: "running" }));
  }, [uiState.isInspectingHistory]);

  const pause = useCallback(() => {
    setControlState((current) => ({ ...current, playbackStatus: "paused" }));
  }, []);

  const setSpeed = useCallback((speed: number) => {
    setControlState((current) => ({ ...current, speed }));
  }, []);

  const submitCommand = useCallback((command: string) => {
    const result = submitClientCommand(simulatorRef.current!, command);
    if (result.accepted) {
      refreshState();
      setControlState((current) => ({
        ...current,
        playbackStatus: "paused",
      }));
    }
    return result;
  }, [refreshState]);

  const changeScenario = useCallback((scenarioId: string) => {
    const scenario = getScenario(scenarioId);
    scenarioRef.current = scenario;
    simulatorRef.current = scenario.createSimulator();
    liveStateRef.current = simulatorRef.current.getState();
    setClusterState(liveStateRef.current);
    setControlState((current) => ({
      ...current,
      scenarioId,
      playbackStatus: "idle",
    }));
    setUiState((current) => ({
      ...current,
      selectedNodeId: "B",
      selectedMessageId: null,
      isInspectingHistory: false,
      selectedHistoryStep: 0,
      historyStepCount: 0,
      pinnedMessageId: null,
    }));
  }, []);

  const crashSelectedNode = useCallback((nodeId: NodeId) => {
    const result = crashNode(simulatorRef.current!, nodeId);
    if (result.accepted) {
      refreshState();
      setControlState((current) => ({ ...current, playbackStatus: "paused" }));
    }
    return result;
  }, [refreshState]);

  const restartSelectedNode = useCallback((nodeId: NodeId) => {
    const result = restartNode(simulatorRef.current!, nodeId);
    if (result.accepted) {
      refreshState();
      setControlState((current) => ({ ...current, playbackStatus: "paused" }));
    }
    return result;
  }, [refreshState]);

  const createPresetPartition = useCallback(() => {
    const result = createNetworkPartition(simulatorRef.current!, [
      { id: "minority", label: "Minority", nodeIds: ["A", "B"] },
      { id: "majority", label: "Majority", nodeIds: ["C", "D", "E"] },
    ]);
    if (result.accepted) {
      refreshState();
      setControlState((current) => ({ ...current, playbackStatus: "paused" }));
    }
    return result;
  }, [refreshState]);

  const healPartition = useCallback(() => {
    const result = healNetworkPartition(simulatorRef.current!);
    if (result.accepted) {
      refreshState();
      setControlState((current) => ({ ...current, playbackStatus: "paused" }));
    }
    return result;
  }, [refreshState]);

  useEffect(() => {
    if (controlState.playbackStatus !== "running") {
      return undefined;
    }

    const delay = Math.max(180, 700 / controlState.speed);
    const timer = window.setTimeout(() => {
      step();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [clusterState.currentStep, controlState.playbackStatus, controlState.speed, step]);

  function selectNode(nodeId: NodeId) {
    setUiState((current) => ({
      ...current,
      selectedNodeId: nodeId,
      selectedMessageId: null,
    }));
  }

  function selectMessage(messageId: string) {
    setUiState((current) => ({
      ...current,
      selectedMessageId: messageId,
    }));
  }

  const setMessageDisplayMode = useCallback((messageDisplayMode: SimulatorUIState["messageDisplayMode"]) => {
    setUiState((current) => ({ ...current, messageDisplayMode }));
  }, []);

  const pinMessage = useCallback((messageId: string | null) => {
    setUiState((current) => ({ ...current, pinnedMessageId: messageId }));
  }, []);

  function toggleDisplayMode() {
    setUiState((current) => ({
      ...current,
      displayMode: current.displayMode === "basic" ? "advanced" : "basic",
    }));
  }

  function toggleTheme() {
    setUiState((current) => ({
      ...current,
      theme: current.theme === "light" ? "dark" : "light",
    }));
  }

  const createTrace = useCallback(() =>
    createSimulationTrace(simulatorRef.current!, scenarioRef.current, "1.1.0"), []);

  const viewHistoryStep = useCallback((stepIndex: number) => {
    const trace = createTrace();
    const clampedStep = Math.max(0, Math.min(stepIndex, trace.executedActions.length));
    const replay = replayTrace(trace, clampedStep);
    if (!replay.valid) throw new Error(replay.errors.join(" "));
    setControlState((current) => ({ ...current, playbackStatus: "paused" }));
    setClusterState(replay.finalState);
    setUiState((current) => ({
      ...current,
      isInspectingHistory: clampedStep !== trace.executedActions.length,
      selectedHistoryStep: clampedStep,
      historyStepCount: trace.executedActions.length,
      selectedMessageId: null,
      pinnedMessageId: null,
    }));
  }, [createTrace]);

  const returnToLive = useCallback(() => {
    setClusterState(structuredClone(liveStateRef.current!));
    const historyStepCount = simulatorRef.current!.getActionHistory().length;
    setUiState((current) => ({
      ...current,
      isInspectingHistory: false,
      selectedHistoryStep: historyStepCount,
      historyStepCount,
    }));
  }, []);

  const loadTrace = useCallback((trace: SimulationTrace) => {
    const replay = createSimulatorFromTrace(trace);
    if (replay.errors.length > 0) return { accepted: false, reason: replay.errors.join(" ") };
    simulatorRef.current = replay.simulator;
    scenarioRef.current = getScenario(trace.scenario.id);
    liveStateRef.current = replay.simulator.getState();
    setClusterState(liveStateRef.current);
    setControlState((current) => ({ ...current, scenarioId: trace.scenario.id, playbackStatus: "completed" }));
    setUiState((current) => ({
      ...current,
      isInspectingHistory: false,
      selectedHistoryStep: trace.executedActions.length,
      historyStepCount: trace.executedActions.length,
      selectedMessageId: null,
      pinnedMessageId: null,
    }));
    return { accepted: true };
  }, []);

  const replayCurrentTrace = useCallback(() => loadTrace(createTrace()), [createTrace, loadTrace]);

  const comparisonState = uiState.selectedHistoryStep > 0
    ? simulatorRef.current.getHistoryState(Math.min(uiState.selectedHistoryStep - 1, simulatorRef.current.getActionHistory().length))
    : simulatorRef.current.getInitialState();
  const stateComparison = compareRaftStates(comparisonState, clusterState);
  const actionHistory = simulatorRef.current.getActionHistory();
  const activityFrames = buildMessageActivityFrames(simulatorRef.current.getInitialState(), actionHistory);

  return {
    clusterState,
    controlState,
    uiState,
    scenario: scenarioRef.current,
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
    crashNode: crashSelectedNode,
    restartNode: restartSelectedNode,
    createPresetPartition,
    healPartition,
    toggleDisplayMode,
    toggleTheme,
    invariantResult: simulatorRef.current.validateInvariants(),
    createTrace,
    loadTrace,
    replayCurrentTrace,
    viewHistoryStep,
    returnToLive,
    stateComparison,
    actionHistory,
    activityFrames,
    setMessageDisplayMode,
    pinMessage,
  };
}
