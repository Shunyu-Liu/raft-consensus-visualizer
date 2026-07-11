import type { InvariantValidationResult } from "../invariants/types";
import type { ClusterState, ScheduledAction, ScenarioId } from "../types";

export interface TraceActionRecord {
  order: number;
  action: ScheduledAction;
  logicalTimeBefore: number;
  logicalTimeAfter: number;
  stateBefore: ClusterState;
  stateAfter: ClusterState;
  emittedEventIds: string[];
  affectedMessageIds: string[];
}

export interface SimulationTrace {
  format: "raft-explorer-trace";
  version: 1;
  createdBy: {
    application: "Raft Explorer";
    applicationVersion: string;
  };
  scenario: { id: ScenarioId; name: string };
  initialState: ClusterState;
  initialActions: ScheduledAction[];
  executedActions: TraceActionRecord[];
  finalState: ClusterState;
  invariantSummary: InvariantValidationResult;
}
