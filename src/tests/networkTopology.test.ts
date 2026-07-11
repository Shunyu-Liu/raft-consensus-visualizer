import { describe, expect, it } from "vitest";
import { RaftSimulator } from "../simulator/core/RaftSimulator";
import { createInitialClusterState } from "../simulator/createInitialState";
import {
  areNodesConnected,
  isNetworkPartitionActive,
  validatePartitionGroups,
} from "../simulator/network/topology";
import { DELIVER_APPEND_ENTRIES, registerHeartbeatHandlers } from "../simulator/transitions/heartbeat";
import {
  createHealPartitionAction,
  createNetworkPartition,
  createPartitionAction,
  registerPartitionHandlers,
} from "../simulator/transitions/partition";
import type { RaftMessage } from "../simulator/types";

const groups = [
  { id: "minority", label: "Minority", nodeIds: ["A", "B"] },
  { id: "majority", label: "Majority", nodeIds: ["C", "D", "E"] },
];

describe("network topology", () => {
  it("validates complete, non-overlapping partition groups", () => {
    const state = createInitialClusterState(["A", "B", "C", "D", "E"]);

    expect(validatePartitionGroups(state, groups).valid).toBe(true);
    expect(validatePartitionGroups(state, [groups[0]]).valid).toBe(false);
    expect(validatePartitionGroups(state, [
      { id: "one", label: "One", nodeIds: ["A", "B"] },
      { id: "two", label: "Two", nodeIds: ["B", "C", "D", "E"] },
    ]).valid).toBe(false);
    expect(validatePartitionGroups(state, [
      { id: "one", label: "One", nodeIds: ["A", "B"] },
      { id: "two", label: "Two", nodeIds: ["C", "D"] },
    ]).valid).toBe(false);
    expect(validatePartitionGroups(state, [
      { id: "one", label: "One", nodeIds: ["A", "B"] },
      { id: "two", label: "Two", nodeIds: ["C", "D", "E", "Z"] },
    ]).valid).toBe(false);
  });

  it("creates and heals partitions without changing roles, terms, status, or logs", () => {
    const state = createInitialClusterState(["A", "B", "C", "D", "E"]);
    state.nodes.B.role = "leader";
    state.nodes.B.currentTerm = 1;
    state.nodes.B.log = [{ index: 1, term: 1, command: "SET x = 10", committed: false, applied: false }];
    const simulator = new RaftSimulator(state);
    registerPartitionHandlers(simulator);

    expect(createNetworkPartition(simulator, groups).accepted).toBe(true);
    simulator.step();

    const partitioned = simulator.getState();
    expect(partitioned.nodes.A.partitionId).toBe("minority");
    expect(partitioned.nodes.B.partitionId).toBe("minority");
    expect(partitioned.nodes.C.partitionId).toBe("majority");
    expect(partitioned.nodes.B.role).toBe("leader");
    expect(partitioned.nodes.B.currentTerm).toBe(1);
    expect(partitioned.nodes.B.status).toBe("running");
    expect(partitioned.nodes.B.log).toHaveLength(1);
    expect(areNodesConnected(partitioned, "A", "B")).toBe(true);
    expect(areNodesConnected(partitioned, "A", "C")).toBe(false);

    expect(createNetworkPartition(simulator, groups).accepted).toBe(false);
  });

  it("checks network topology at delivery time", () => {
    const state = createInitialClusterState(["A", "B", "C", "D", "E"]);
    state.nodes.B.role = "leader";
    state.nodes.B.currentTerm = 1;
    state.messages = [heartbeatMessage("message-1", "B", "C")];
    const simulator = new RaftSimulator(state, [
      createPartitionAction("action-1", 100, 1, groups),
      { id: "action-2", type: DELIVER_APPEND_ENTRIES, scheduledTime: 200, sequence: 2, payload: { messageId: "message-1" } },
    ]);
    registerPartitionHandlers(simulator);
    registerHeartbeatHandlers(simulator);

    simulator.step();
    simulator.step();

    const message = simulator.getState().messages[0];
    expect(message.status).toBe("dropped");
    expect(message.dropReason).toBe("network_partition");
    expect(message.droppedAtLogicalTime).toBe(200);
  });

  it("lets a queued cross-group message deliver if the network heals before delivery", () => {
    const state = createInitialClusterState(["A", "B", "C", "D", "E"]);
    state.nodes.B.role = "leader";
    state.nodes.B.currentTerm = 1;
    state.nodes.A.partitionId = "minority";
    state.nodes.B.partitionId = "minority";
    state.nodes.C.partitionId = "majority";
    state.nodes.D.partitionId = "majority";
    state.nodes.E.partitionId = "majority";
    state.messages = [heartbeatMessage("message-1", "B", "C")];
    const simulator = new RaftSimulator(state, [
      createHealPartitionAction("action-1", 100, 1),
      { id: "action-2", type: DELIVER_APPEND_ENTRIES, scheduledTime: 200, sequence: 2, payload: { messageId: "message-1" } },
    ]);
    registerPartitionHandlers(simulator);
    registerHeartbeatHandlers(simulator);

    simulator.step();
    expect(isNetworkPartitionActive(simulator.getState())).toBe(false);
    simulator.step();

    expect(simulator.getState().messages[0].status).toBe("delivered");
  });
});

function heartbeatMessage(id: string, from: string, to: string): RaftMessage {
  return {
    id,
    type: "append_entries",
    from,
    to,
    term: 1,
    status: "queued",
    payload: {
      term: 1,
      leaderId: from,
      prevLogIndex: 0,
      prevLogTerm: 0,
      entries: [],
      leaderCommit: 0,
      purpose: "heartbeat",
    },
  };
}
