import type { ClusterState, NodeId, RaftNode } from "./types";

const DEFAULT_NODE_IDS: NodeId[] = ["A", "B", "C", "D", "E"];

export function createInitialClusterState(
  nodeIds: NodeId[] = DEFAULT_NODE_IDS,
): ClusterState {
  return {
    nodes: Object.fromEntries(
      nodeIds.map((nodeId) => [nodeId, createInitialNode(nodeId)]),
    ),
    messages: [],
    events: [],
    currentStep: 0,
    logicalTime: 0,
  };
}

function createInitialNode(id: NodeId): RaftNode {
  return {
    id,
    role: "follower",
    status: "running",
    currentTerm: 0,
    votedFor: null,
    log: [],
    commitIndex: 0,
    lastApplied: 0,
    electionElapsed: 0,
    electionTimeout: 0,
    heartbeatElapsed: 0,
    partitionId: null,
    votesReceived: undefined,
  };
}
