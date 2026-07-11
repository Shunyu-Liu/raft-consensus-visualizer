import { createInitialClusterState } from "../createInitialState";
import { ELECTION_TIMEOUT } from "../transitions/election";
import { SEND_HEARTBEAT_ROUND } from "../transitions/heartbeat";
import {
  CLIENT_COMMAND_RECEIVED,
  EVALUATE_REPLICATION_PROGRESS,
} from "../transitions/replication";
import {
  createHealPartitionAction,
  createPartitionAction,
} from "../transitions/partition";
import { createScenarioSimulator } from "./leaderFailure";
import type { ScenarioDefinition } from "./types";

const MINORITY_MAJORity_GROUPS = [
  { id: "minority", label: "Minority", nodeIds: ["A", "B"] },
  { id: "majority", label: "Majority", nodeIds: ["C", "D", "E"] },
];

export const networkPartitionScenario: ScenarioDefinition = {
  id: "network-partition",
  name: "Network Partition - Minority Leader and Majority Progress",
  description:
    "Node B leads Term 1, the cluster partitions into A/B and C/D/E, Node B cannot commit in the minority, Node C wins Term 2 in the majority, and Node B steps down after healing.",
  learningObjectives: [
    "Network partition",
    "Majority and minority partitions",
    "Minority leaders cannot commit new entries",
    "Different partitions can temporarily have leaders in different terms",
    "Higher-term AppendEntries reconciles roles after healing",
  ],
  capabilities: {
    clientCommands: false,
    manualCrash: true,
    manualRestart: true,
    networkPartition: true,
  },
  createInitialState: () => createInitialClusterState(["A", "B", "C", "D", "E"]),
  createInitialActions: () => [
    { id: "action-1", type: ELECTION_TIMEOUT, scheduledTime: 1500, sequence: 1, payload: { nodeId: "B" } },
    { id: "action-2", type: SEND_HEARTBEAT_ROUND, scheduledTime: 2100, sequence: 2, payload: { leaderId: "B", round: 1, totalRounds: 3 } },
    createPartitionAction("action-3", 2500, 3, MINORITY_MAJORity_GROUPS),
    { id: "action-4", type: SEND_HEARTBEAT_ROUND, scheduledTime: 2700, sequence: 4, payload: { leaderId: "B", round: 2, totalRounds: 3 } },
    { id: "action-5", type: CLIENT_COMMAND_RECEIVED, scheduledTime: 3200, sequence: 5, payload: { command: "SET x = 10" } },
    { id: "action-6", type: EVALUATE_REPLICATION_PROGRESS, scheduledTime: 3820, sequence: 6, payload: { leaderId: "B", entryIndex: 1 } },
    { id: "action-7", type: ELECTION_TIMEOUT, scheduledTime: 4200, sequence: 7, payload: { nodeId: "C" } },
    { id: "action-8", type: SEND_HEARTBEAT_ROUND, scheduledTime: 5000, sequence: 8, payload: { leaderId: "C", round: 1, totalRounds: 2 } },
    createHealPartitionAction("action-9", 5600, 9),
    { id: "action-10", type: SEND_HEARTBEAT_ROUND, scheduledTime: 5800, sequence: 10, payload: { leaderId: "C", round: 2, totalRounds: 2 } },
    { id: "action-11", type: CLIENT_COMMAND_RECEIVED, scheduledTime: 6400, sequence: 11, payload: { command: "SET x = 20" } },
    { id: "action-12", type: EVALUATE_REPLICATION_PROGRESS, scheduledTime: 7600, sequence: 12, payload: { leaderId: "C", entryIndex: 1 } },
  ],
  createSimulator: () => createScenarioSimulator(networkPartitionScenario),
};
