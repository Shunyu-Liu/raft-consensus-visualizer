import { describe, expect, it } from "vitest";
import { RaftSimulator } from "../simulator/core/RaftSimulator";
import { createInitialClusterState } from "../simulator/createInitialState";
import { isAppendEntriesMessage } from "../simulator/messageTypes";
import { createBasicLeaderElectionSimulator } from "../simulator/scenarios/basicLeaderElection";
import { crashNode, registerFailureHandlers, restartNode } from "../simulator/transitions/failure";
import { DELIVER_APPEND_ENTRIES, registerHeartbeatHandlers } from "../simulator/transitions/heartbeat";
import { submitClientCommand } from "../simulator/transitions/replication";
import type { RaftMessage } from "../simulator/types";

function runAll(simulator: RaftSimulator): void {
  while (simulator.hasPendingActions()) simulator.step();
}

describe("node failure and restart", () => {
  it("crashes a running node without deleting persistent term, vote, or log", () => {
    const state = createInitialClusterState(["A"]);
    state.nodes.A.currentTerm = 3;
    state.nodes.A.votedFor = "A";
    state.nodes.A.log = [{ index: 1, term: 3, command: "SET x=1", committed: false, applied: false }];
    const simulator = new RaftSimulator(state);
    registerFailureHandlers(simulator);

    const result = crashNode(simulator, "A");
    expect(result.accepted).toBe(true);
    simulator.step();

    const node = simulator.getState().nodes.A;
    expect(node.status).toBe("crashed");
    expect(node.currentTerm).toBe(3);
    expect(node.votedFor).toBe("A");
    expect(node.log).toHaveLength(1);
  });

  it("rejects repeated crash and repeated restart", () => {
    const simulator = new RaftSimulator(createInitialClusterState(["A"]));
    registerFailureHandlers(simulator);

    expect(crashNode(simulator, "A").accepted).toBe(true);
    simulator.step();
    expect(crashNode(simulator, "A").accepted).toBe(false);
    expect(restartNode(simulator, "A").accepted).toBe(true);
    simulator.step();
    expect(restartNode(simulator, "A").accepted).toBe(false);
  });

  it("restarts as follower while preserving persistent state and clearing volatile state", () => {
    const state = createInitialClusterState(["A"]);
    state.nodes.A = {
      ...state.nodes.A,
      status: "crashed",
      role: "leader",
      currentTerm: 4,
      votedFor: "A",
      votesReceived: ["A"],
      nextIndex: { A: 2 },
      matchIndex: { A: 1 },
      log: [{ index: 1, term: 4, command: "SET x=1", committed: false, applied: false }],
    };
    const simulator = new RaftSimulator(state);
    registerFailureHandlers(simulator);

    expect(restartNode(simulator, "A").accepted).toBe(true);
    simulator.step();

    const node = simulator.getState().nodes.A;
    expect(node.status).toBe("running");
    expect(node.role).toBe("follower");
    expect(node.currentTerm).toBe(4);
    expect(node.votedFor).toBe("A");
    expect(node.log).toHaveLength(1);
    expect(node.votesReceived).toBeUndefined();
    expect(node.nextIndex).toBeUndefined();
    expect(node.matchIndex).toBeUndefined();
  });

  it("drops messages delivered to crashed targets and creates no response", () => {
    const state = createInitialClusterState(["A", "B"]);
    state.nodes.A.status = "crashed";
    state.messages = [heartbeatMessage()];
    const simulator = new RaftSimulator(state, [
      { id: "action-1", type: DELIVER_APPEND_ENTRIES, scheduledTime: 100, sequence: 1, payload: { messageId: "message-1" } },
    ]);
    registerFailureHandlers(simulator);
    registerHeartbeatHandlers(simulator);

    simulator.step();
    const messages = simulator.getState().messages;
    expect(messages[0].status).toBe("dropped");
    expect(messages[0].droppedAtLogicalTime).toBe(100);
    expect(messages[0].dropReason).toBe("target_crashed");
    expect(messages).toHaveLength(1);
  });

  it("prevents crashed leaders from accepting client commands", () => {
    const simulator = createBasicLeaderElectionSimulator();
    runAll(simulator);
    expect(crashNode(simulator, "B").accepted).toBe(true);
    simulator.step();

    expect(submitClientCommand(simulator, "SET x = 10").accepted).toBe(false);
  });

  it("drops commit or heartbeat messages to crashed nodes in full scenarios", () => {
    const simulator = createBasicLeaderElectionSimulator();
    runAll(simulator);
    crashNode(simulator, "A");
    simulator.step();
    submitClientCommand(simulator, "SET x = 10");
    runAll(simulator);

    expect(
      simulator.getState().messages.some((message) => isAppendEntriesMessage(message) && message.to === "A" && message.status === "dropped"),
    ).toBe(true);
  });
});

function heartbeatMessage(): RaftMessage {
  return {
    id: "message-1",
    type: "append_entries",
    from: "B",
    to: "A",
    term: 1,
    status: "queued",
    payload: {
      term: 1,
      leaderId: "B",
      prevLogIndex: 0,
      prevLogTerm: 0,
      entries: [],
      leaderCommit: 0,
      purpose: "heartbeat",
    },
  };
}
