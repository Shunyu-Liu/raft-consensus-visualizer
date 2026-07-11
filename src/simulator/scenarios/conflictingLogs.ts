import { createInitialClusterState } from "../createInitialState";
import { RETRY_APPEND_ENTRIES } from "../transitions/heartbeat";
import { createScenarioSimulator } from "./leaderFailure";
import type { LogEntry, NodeId, RaftNode } from "../types";
import type { ScenarioDefinition } from "./types";

const LEADER_ID: NodeId = "C";
const TARGET_ID: NodeId = "B";

const leaderLog: LogEntry[] = [
  { index: 1, term: 1, command: "SET x = 1", committed: true, applied: true },
  { index: 2, term: 1, command: "SET y = 2", committed: true, applied: true },
  { index: 3, term: 3, command: "SET x = 5", committed: false, applied: false },
  { index: 4, term: 4, command: "SET z = 8", committed: false, applied: false },
];

const conflictingFollowerLog: LogEntry[] = [
  { index: 1, term: 1, command: "SET x = 1", committed: true, applied: true },
  { index: 2, term: 1, command: "SET y = 2", committed: true, applied: true },
  { index: 3, term: 2, command: "SET old = 7", committed: false, applied: false },
  { index: 4, term: 2, command: "SET old = 9", committed: false, applied: false },
];

export const conflictingLogsScenario: ScenarioDefinition = {
  id: "conflicting-logs",
  name: "Conflicting Logs and Log Reconciliation",
  description:
    "Node B contains an old uncommitted suffix that conflicts with the current leader's log. Use Next Step or Start to observe how the leader backs up nextIndex, finds the common prefix, and replaces the conflicting suffix.",
  learningObjectives: [
    "Log Matching",
    "prevLogIndex",
    "prevLogTerm",
    "AppendEntries Rejection",
    "nextIndex Backtracking",
    "Conflict Truncation",
    "Log Convergence",
  ],
  capabilities: {
    clientCommands: false,
    manualCrash: true,
    manualRestart: true,
    networkPartition: true,
  },
  createInitialState,
  createInitialActions: () => [
    {
      id: "action-1",
      type: RETRY_APPEND_ENTRIES,
      scheduledTime: 100,
      sequence: 1,
      payload: { leaderId: LEADER_ID, targetNodeId: TARGET_ID, attempt: 1 },
    },
  ],
  createSimulator: () => createScenarioSimulator(conflictingLogsScenario),
};

function createInitialState() {
  const state = createInitialClusterState(["A", "B", "C", "D", "E"]);
  const nodes = Object.fromEntries(
    Object.values(state.nodes).map((node) => {
      const log = node.id === TARGET_ID ? conflictingFollowerLog : leaderLog;
      return [
        node.id,
        createScenarioNode(node, log, node.id === LEADER_ID ? "leader" : "follower"),
      ];
    }),
  );

  return {
    ...state,
    nodes,
  };
}

function createScenarioNode(
  node: RaftNode,
  log: LogEntry[],
  role: RaftNode["role"],
): RaftNode {
  const peers = ["A", "B", "C", "D", "E"];

  return {
    ...node,
    role,
    currentTerm: 4,
    votedFor: role === "leader" ? "C" : null,
    log: log.map((entry) => ({ ...entry })),
    commitIndex: 2,
    lastApplied: 2,
    nextIndex:
      role === "leader"
        ? Object.fromEntries(peers.map((peer) => [peer, peer === "B" ? 5 : 5]))
        : undefined,
    matchIndex:
      role === "leader"
        ? Object.fromEntries(peers.map((peer) => [peer, peer === "C" ? 4 : 0]))
        : undefined,
  };
}
