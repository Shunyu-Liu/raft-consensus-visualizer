import type { ClusterState, ScenarioId, ScheduledAction } from "../types";
import type { RaftSimulator } from "../core/RaftSimulator";

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  description: string;
  learningObjectives: string[];
  capabilities: {
    clientCommands: boolean;
    manualCrash: boolean;
    manualRestart: boolean;
    networkPartition: boolean;
  };
  createInitialState: () => ClusterState;
  createInitialActions: () => ScheduledAction[];
  createSimulator: () => RaftSimulator;
}
