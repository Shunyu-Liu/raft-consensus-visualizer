import { RaftSimulator } from "../core/RaftSimulator";
import { createInitialClusterState } from "../createInitialState";
import {
  ELECTION_TIMEOUT,
  registerElectionHandlers,
} from "../transitions/election";
import {
  SEND_HEARTBEAT_ROUND,
  registerHeartbeatHandlers,
} from "../transitions/heartbeat";
import { registerReplicationHandlers } from "../transitions/replication";
import { registerFailureHandlers } from "../transitions/failure";
import { registerPartitionHandlers } from "../transitions/partition";
import type { ClusterState, ScheduledAction, ScenarioId } from "../types";

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  description: string;
  initialState: ClusterState;
  initialActions: ScheduledAction[];
}

export const basicLeaderElectionScenario: ScenarioDefinition = {
  id: "basic-leader-election",
  name: "Basic Leader Election",
  description:
    "Node B times out first, becomes leader, then sends two deterministic heartbeat rounds.",
  initialState: createInitialClusterState(["A", "B", "C", "D", "E"]),
  initialActions: [
    {
      id: "action-1",
      type: ELECTION_TIMEOUT,
      scheduledTime: 1500,
      sequence: 1,
      payload: { nodeId: "B" },
    },
    {
      id: "action-2",
      type: SEND_HEARTBEAT_ROUND,
      scheduledTime: 2100,
      sequence: 2,
      payload: { leaderId: "B", round: 1, totalRounds: 2 },
    },
    {
      id: "action-3",
      type: SEND_HEARTBEAT_ROUND,
      scheduledTime: 2700,
      sequence: 3,
      payload: { leaderId: "B", round: 2, totalRounds: 2 },
    },
  ],
};

export function createBasicLeaderElectionSimulator(): RaftSimulator {
  const simulator = new RaftSimulator(
    basicLeaderElectionScenario.initialState,
    basicLeaderElectionScenario.initialActions,
  );
  registerElectionHandlers(simulator);
  registerHeartbeatHandlers(simulator);
  registerReplicationHandlers(simulator);
  registerFailureHandlers(simulator);
  registerPartitionHandlers(simulator);
  return simulator;
}
