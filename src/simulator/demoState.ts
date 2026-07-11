import type {
  ClusterState,
  RaftNode,
  SimulationEvent,
  SimulatorControlState,
  SimulatorUIState,
} from "./types";

const NODE_IDS = ["A", "B", "C", "D", "E"] as const;

function createDemoNode(id: string, role: RaftNode["role"]): RaftNode {
  return {
    id,
    role,
    status: "running",
    currentTerm: 1,
    votedFor: role === "leader" ? id : null,
    log: [],
    commitIndex: 0,
    lastApplied: 0,
    electionElapsed: 0,
    electionTimeout: role === "leader" ? 0 : 1500,
    heartbeatElapsed: 0,
    partitionId: null,
    nextIndex: role === "leader" ? Object.fromEntries(NODE_IDS.map((nodeId) => [nodeId, 1])) : undefined,
    matchIndex: role === "leader" ? Object.fromEntries(NODE_IDS.map((nodeId) => [nodeId, 0])) : undefined,
  };
}

export const demoClusterState: ClusterState = {
  nodes: {
    A: createDemoNode("A", "follower"),
    B: createDemoNode("B", "leader"),
    C: createDemoNode("C", "follower"),
    D: createDemoNode("D", "follower"),
    E: createDemoNode("E", "follower"),
  },
  messages: [],
  events: [
    {
      id: "demo-1",
      step: 1,
      logicalTime: 0,
      type: "demo_snapshot",
      title: "Demo Event: static cluster snapshot",
      description: "Node B is shown as the leader so the Phase 1 UI has meaningful data to display.",
      explanation:
        "This is placeholder teaching data. It was not produced by a running election algorithm.",
      raftRule: "Raft has one leader per term in normal operation.",
      sourceNode: "B",
      term: 1,
      paperSection: "Section 5.2 — Leader Election",
      isDemoEvent: true,
    },
    {
      id: "demo-2",
      step: 2,
      logicalTime: 300,
      type: "demo_append_entries_concept",
      title: "Demo Event: heartbeat concept",
      description: "The UI will later show heartbeat messages as AppendEntries RPCs with no log entries.",
      explanation:
        "In Raft, a heartbeat is not a separate RPC. It is an AppendEntries request whose entries list is empty.",
      raftRule: "Leaders send periodic AppendEntries messages to maintain authority.",
      sourceNode: "B",
      term: 1,
      paperSection: "Section 5.2 — Leader Election",
      isDemoEvent: true,
    },
  ] satisfies SimulationEvent[],
  currentStep: 2,
  logicalTime: 300,
};

export const demoControlState: SimulatorControlState = {
  scenarioId: "phase-1-static-demo",
  playbackStatus: "idle",
  speed: 1,
};

export const demoUIState: SimulatorUIState = {
  selectedNodeId: "B",
  selectedMessageId: null,
  displayMode: "basic",
  theme: "light",
};
