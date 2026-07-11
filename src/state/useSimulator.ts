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
import type {
  ClusterState,
  NodeId,
  SimulatorControlState,
  SimulatorUIState,
} from "../simulator/types";

export function useSimulator() {
  const initialScenario = getAvailableScenarios()[0];
  const simulatorRef = useRef<RaftSimulator | null>(null);
  const scenarioRef = useRef(initialScenario);

  if (simulatorRef.current === null) {
    simulatorRef.current = initialScenario.createSimulator();
  }

  const [clusterState, setClusterState] = useState<ClusterState>(() =>
    simulatorRef.current!.getState(),
  );
  const [controlState, setControlState] = useState<SimulatorControlState>({
    scenarioId: initialScenario.id,
    playbackStatus: "idle",
    speed: 1,
  });
  const [uiState, setUiState] = useState<SimulatorUIState>({
    ...demoUIState,
    selectedNodeId: "B",
  });
  const scenarios = getAvailableScenarios();

  const refreshState = useCallback(() => {
    setClusterState(simulatorRef.current!.getState());
  }, []);

  const step = useCallback(() => {
    const simulator = simulatorRef.current!;
    const result = simulator.step();
    setClusterState(result.state);
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
    }));
  }, [refreshState]);

  const start = useCallback(() => {
    if (!simulatorRef.current!.hasPendingActions()) {
      setControlState((current) => ({ ...current, playbackStatus: "completed" }));
      return;
    }

    setControlState((current) => ({ ...current, playbackStatus: "running" }));
  }, []);

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
    setClusterState(simulatorRef.current.getState());
    setControlState((current) => ({
      ...current,
      scenarioId,
      playbackStatus: "idle",
    }));
    setUiState((current) => ({
      ...current,
      selectedNodeId: "B",
      selectedMessageId: null,
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
  }, [controlState.playbackStatus, controlState.speed, step]);

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
  };
}
