import { RaftSimulator } from "../core/RaftSimulator";
import { createInitialClusterState } from "../createInitialState";
import { CRASH_NODE, RESTART_NODE, registerFailureHandlers } from "../transitions/failure";
import { registerElectionHandlers, ELECTION_TIMEOUT } from "../transitions/election";
import { registerHeartbeatHandlers, SEND_HEARTBEAT_ROUND } from "../transitions/heartbeat";
import { registerReplicationHandlers } from "../transitions/replication";
import { registerPartitionHandlers } from "../transitions/partition";
import type { ScenarioDefinition } from "./types";

export const leaderFailureScenario: ScenarioDefinition = {
  id: "leader-failure",
  name: "Leader Failure and Re-election",
  description:
    "Node B becomes leader, crashes, Node C wins Term 2, and the old leader restarts as a follower.",
  learningObjectives: [
    "Crashed leaders stop sending heartbeats",
    "Followers start a new election after timeout",
    "Higher terms force old leaders to step down",
  ],
  capabilities: {
    clientCommands: false,
    manualCrash: true,
    manualRestart: true,
    networkPartition: false,
  },
  createInitialState: () => createInitialClusterState(["A", "B", "C", "D", "E"]),
  createInitialActions: () => [
    { id: "action-1", type: ELECTION_TIMEOUT, scheduledTime: 1500, sequence: 1, payload: { nodeId: "B" } },
    { id: "action-2", type: SEND_HEARTBEAT_ROUND, scheduledTime: 2100, sequence: 2, payload: { leaderId: "B", round: 1, totalRounds: 1 } },
    { id: "action-3", type: CRASH_NODE, scheduledTime: 3000, sequence: 3, payload: { nodeId: "B" } },
    { id: "action-4", type: ELECTION_TIMEOUT, scheduledTime: 4500, sequence: 4, payload: { nodeId: "C" } },
    { id: "action-5", type: SEND_HEARTBEAT_ROUND, scheduledTime: 5200, sequence: 5, payload: { leaderId: "C", round: 1, totalRounds: 2 } },
    { id: "action-6", type: RESTART_NODE, scheduledTime: 6000, sequence: 6, payload: { nodeId: "B" } },
    { id: "action-7", type: SEND_HEARTBEAT_ROUND, scheduledTime: 6200, sequence: 7, payload: { leaderId: "C", round: 2, totalRounds: 2 } },
  ],
  createSimulator: () => createScenarioSimulator(leaderFailureScenario),
};

export function createScenarioSimulator(scenario: ScenarioDefinition): RaftSimulator {
  const simulator = new RaftSimulator(scenario.createInitialState(), scenario.createInitialActions());
  registerElectionHandlers(simulator);
  registerHeartbeatHandlers(simulator);
  registerReplicationHandlers(simulator);
  registerFailureHandlers(simulator);
  registerPartitionHandlers(simulator);
  return simulator;
}
