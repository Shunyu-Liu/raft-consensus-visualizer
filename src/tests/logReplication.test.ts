import { describe, expect, it } from "vitest";
import { RaftSimulator } from "../simulator/core/RaftSimulator";
import { createInitialClusterState } from "../simulator/createInitialState";
import {
  isAppendEntriesMessage,
  isAppendEntriesResponseMessage,
} from "../simulator/messageTypes";
import { createBasicLeaderElectionSimulator } from "../simulator/scenarios/basicLeaderElection";
import {
  handleAppendEntriesDelivery,
  logMatchesAt,
  DELIVER_APPEND_ENTRIES,
} from "../simulator/transitions/heartbeat";
import { submitClientCommand } from "../simulator/transitions/replication";
import type { RaftMessage } from "../simulator/types";

function runAll(simulator: RaftSimulator): void {
  while (simulator.hasPendingActions()) {
    simulator.step();
  }
}

function runElectionAndHeartbeats(): RaftSimulator {
  const simulator = createBasicLeaderElectionSimulator();
  runAll(simulator);
  return simulator;
}

describe("Basic log replication and commit", () => {
  it("rejects client commands when no leader is available", () => {
    const simulator = new RaftSimulator(createInitialClusterState(["A", "B", "C"]));

    expect(submitClientCommand(simulator, "SET x = 10")).toMatchObject({
      accepted: false,
    });
  });

  it("rejects empty, whitespace-only, and crashed-leader commands", () => {
    const simulator = runElectionAndHeartbeats();

    expect(submitClientCommand(simulator, "")).toMatchObject({ accepted: false });
    expect(submitClientCommand(simulator, "   ")).toMatchObject({ accepted: false });

    const crashedState = simulator.getState();
    crashedState.nodes.B.status = "crashed";
    const crashedSimulator = new RaftSimulator(crashedState);
    expect(submitClientCommand(crashedSimulator, "SET x = 10")).toMatchObject({
      accepted: false,
    });
  });

  it("accepts a valid command by scheduling an action without directly modifying the log", () => {
    const simulator = runElectionAndHeartbeats();

    const result = submitClientCommand(simulator, "SET x = 10");

    expect(result.accepted).toBe(true);
    expect(simulator.getState().nodes.B.log).toEqual([]);
    expect(simulator.getPendingActions()).toHaveLength(1);
  });

  it("leader appends the first command as an uncommitted current-term entry", () => {
    const simulator = runElectionAndHeartbeats();
    submitClientCommand(simulator, "SET x = 10");

    simulator.step();
    const entry = simulator.getState().nodes.B.log[0];

    expect(entry).toMatchObject({
      index: 1,
      term: 1,
      command: "SET x = 10",
      committed: false,
      applied: false,
    });
    expect(simulator.getState().nodes.B.currentTerm).toBe(1);
  });

  it("creates non-empty AppendEntries messages for followers only", () => {
    const simulator = runElectionAndHeartbeats();
    submitClientCommand(simulator, "SET x = 10");
    simulator.step();
    simulator.step();

    const messages = simulator
      .getState()
      .messages.filter(isAppendEntriesMessage)
      .filter((message) => message.payload.purpose === "log_replication");

    expect(messages).toHaveLength(4);
    expect(messages.map((message) => message.to)).toEqual(["A", "C", "D", "E"]);
    expect(messages.some((message) => message.to === "B")).toBe(false);
    expect(messages[0].payload).toMatchObject({
      prevLogIndex: 0,
      prevLogTerm: 0,
      leaderCommit: 0,
      purpose: "log_replication",
    });
    expect(messages[0].payload.entries).toHaveLength(1);
  });

  it("followers append entries without committing them on first replication", () => {
    const state = createInitialClusterState(["A", "B"]);
    state.nodes.A.currentTerm = 1;
    state.nodes.B.currentTerm = 1;
    state.messages = [logReplicationMessage()];

    const result = handleAppendEntriesDelivery(
      state,
      {
        id: "action",
        type: DELIVER_APPEND_ENTRIES,
        scheduledTime: 100,
        sequence: 1,
        payload: { messageId: "message-1" },
      },
      testContext(),
    );

    expect(result.nextState.nodes.A.log[0]).toMatchObject({
      index: 1,
      term: 1,
      command: "SET x = 10",
      committed: false,
      applied: false,
    });
    expect(result.nextState.nodes.A.commitIndex).toBe(0);
    expect(result.nextState.nodes.A.lastApplied).toBe(0);
    expect(result.outgoingMessages?.[0].payload).toMatchObject({
      success: true,
      matchIndex: 1,
    });
  });

  it("duplicate AppendEntries does not duplicate an existing entry", () => {
    const state = createInitialClusterState(["A", "B"]);
    state.nodes.A.currentTerm = 1;
    state.nodes.A.log = [
      { index: 1, term: 1, command: "SET x = 10", committed: false, applied: false },
    ];
    state.messages = [logReplicationMessage()];

    const result = handleAppendEntriesDelivery(
      state,
      {
        id: "action",
        type: DELIVER_APPEND_ENTRIES,
        scheduledTime: 100,
        sequence: 1,
        payload: { messageId: "message-1" },
      },
      testContext(),
    );

    expect(result.nextState.nodes.A.log).toHaveLength(1);
  });

  it("rejects log replication when prevLog does not match", () => {
    expect(logMatchesAt([], 2, 1)).toBe(false);
    expect(logMatchesAt([{ index: 1, term: 2, command: "x", committed: false, applied: false }], 1, 1)).toBe(false);
  });

  it("updates matchIndex and nextIndex from successful responses", () => {
    const simulator = runElectionAndHeartbeats();
    submitClientCommand(simulator, "SET x = 10");
    simulator.step();
    simulator.step();
    simulator.step();
    simulator.step();

    const leader = simulator.getState().nodes.B;

    expect(leader.matchIndex?.A).toBe(1);
    expect(leader.nextIndex?.A).toBe(2);
    expect(leader.commitIndex).toBe(0);
  });

  it("commits and applies after leader plus two followers store the entry", () => {
    const simulator = runElectionAndHeartbeats();
    submitClientCommand(simulator, "SET x = 10");
    simulator.step();
    simulator.step();
    simulator.step();
    simulator.step();
    simulator.step();
    simulator.step();

    const leader = simulator.getState().nodes.B;

    expect(leader.matchIndex?.A).toBe(1);
    expect(leader.matchIndex?.C).toBe(1);
    expect(leader.commitIndex).toBe(1);
    expect(leader.lastApplied).toBe(1);
    expect(leader.log[0]).toMatchObject({ committed: true, applied: true });
  });

  it("broadcasts commit updates as empty AppendEntries with leaderCommit", () => {
    const simulator = runElectionAndHeartbeats();
    submitClientCommand(simulator, "SET x = 10");
    runAll(simulator);

    const commitUpdates = simulator
      .getState()
      .messages.filter(isAppendEntriesMessage)
      .filter((message) => message.payload.purpose === "commit_update");

    expect(commitUpdates).toHaveLength(4);
    expect(commitUpdates[0].payload.entries).toHaveLength(0);
    expect(commitUpdates[0].payload.leaderCommit).toBe(1);
  });

  it("followers commit and apply after receiving commit updates", () => {
    const simulator = runElectionAndHeartbeats();
    submitClientCommand(simulator, "SET x = 10");
    runAll(simulator);

    for (const node of Object.values(simulator.getState().nodes)) {
      expect(node.commitIndex).toBe(1);
      expect(node.lastApplied).toBe(1);
      expect(node.log[0]).toMatchObject({
        index: 1,
        term: 1,
        command: "SET x = 10",
        committed: true,
        applied: true,
      });
    }
  });

  it("keeps the final command scenario deterministic", () => {
    const first = createBasicLeaderElectionSimulator();
    runAll(first);
    submitClientCommand(first, "SET x = 10");
    runAll(first);

    const second = createBasicLeaderElectionSimulator();
    runAll(second);
    submitClientCommand(second, "SET x = 10");
    runAll(second);

    expect(summarize(second.getState().messages)).toEqual(summarize(first.getState().messages));
    expect(second.getState().nodes).toEqual(first.getState().nodes);
    expect(second.hasPendingActions()).toBe(false);
  });

  it("recognizes append entries response messages after log replication", () => {
    const simulator = runElectionAndHeartbeats();
    submitClientCommand(simulator, "SET x = 10");
    runAll(simulator);

    expect(simulator.getState().messages.some(isAppendEntriesResponseMessage)).toBe(true);
  });
});

function logReplicationMessage(): RaftMessage {
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
      entries: [
        { index: 1, term: 1, command: "SET x = 10", committed: false, applied: false },
      ],
      leaderCommit: 0,
      purpose: "log_replication",
    },
  };
}

function summarize(messages: RaftMessage[]) {
  return messages.map((message) => ({
    id: message.id,
    type: message.type,
    from: message.from,
    to: message.to,
    status: message.status,
    createdAtLogicalTime: message.createdAtLogicalTime,
    deliveredAtLogicalTime: message.deliveredAtLogicalTime,
  }));
}

function testContext() {
  let event = 1;
  let message = 1;
  let action = 1;

  return {
    createEventId: () => `event-${event++}`,
    createMessageId: () => `message-${message++}`,
    createActionId: () => `action-${action++}`,
  };
}
