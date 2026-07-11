import {
  basicLeaderElectionScenario,
  createBasicLeaderElectionSimulator,
} from "./basicLeaderElection";
import { conflictingLogsScenario } from "./conflictingLogs";
import { leaderFailureScenario } from "./leaderFailure";
import { networkPartitionScenario } from "./networkPartition";
import { splitVoteScenario } from "./splitVote";
import type { ScenarioDefinition } from "./types";
import type { ScenarioId } from "../types";

const basicScenario: ScenarioDefinition = {
  id: basicLeaderElectionScenario.id,
  name: "Basic Leader Election and Log Replication",
  description: basicLeaderElectionScenario.description,
  learningObjectives: [
    "Leader election",
    "Heartbeats",
    "Client command replication",
    "Commit and apply",
  ],
  capabilities: {
    clientCommands: true,
    manualCrash: true,
    manualRestart: true,
    networkPartition: false,
  },
  createInitialState: () => structuredClone(basicLeaderElectionScenario.initialState),
  createInitialActions: () => structuredClone(basicLeaderElectionScenario.initialActions),
  createSimulator: createBasicLeaderElectionSimulator,
};

const scenarios = [
  basicScenario,
  leaderFailureScenario,
  splitVoteScenario,
  networkPartitionScenario,
  conflictingLogsScenario,
];

export function getAvailableScenarios(): ScenarioDefinition[] {
  return scenarios;
}

export function getScenario(id: ScenarioId): ScenarioDefinition {
  const scenario = scenarios.find((candidate) => candidate.id === id);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${id}`);
  }
  return scenario;
}
