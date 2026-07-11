import type { RaftSimulator } from "../core/RaftSimulator";
import type { ScenarioDefinition } from "../scenarios/types";
import type { SimulationTrace } from "./types";

export function createSimulationTrace(
  simulator: RaftSimulator,
  scenario: ScenarioDefinition,
  applicationVersion: string,
): SimulationTrace {
  return {
    format: "raft-explorer-trace",
    version: 1,
    createdBy: {
      application: "Raft Explorer",
      applicationVersion,
    },
    scenario: { id: scenario.id, name: scenario.name },
    initialState: simulator.getInitialState(),
    initialActions: simulator.getInitialActions(),
    executedActions: simulator.getActionHistory(),
    finalState: simulator.getState(),
    invariantSummary: simulator.validateInvariants(),
  };
}

export function getTraceFileName(trace: SimulationTrace): string {
  return `raft-explorer-${trace.scenario.id}-trace.json`;
}
