import { describe, expect, it } from "vitest";
import { RaftSimulator } from "../simulator/core/RaftSimulator";
import { createInitialClusterState } from "../simulator/createInitialState";
import {
  isAppendEntriesMessage,
  isAppendEntriesResponseMessage,
  isHeartbeatMessage,
  isRequestVoteMessage,
  isRequestVoteResponseMessage,
} from "../simulator/messageTypes";
import {
  DELIVER_APPEND_ENTRIES,
  DELIVER_APPEND_ENTRIES_RESPONSE,
  handleAppendEntriesDelivery,
  handleAppendEntriesResponseDelivery,
  handleHeartbeatRound,
  logMatchesAt,
  SEND_HEARTBEAT_ROUND,
} from "../simulator/transitions/heartbeat";
import { createBasicLeaderElectionSimulator } from "../simulator/scenarios/basicLeaderElection";
import type { RaftMessage, RaftNode } from "../simulator/types";

function runAll(simulator: RaftSimulator): void {
  while (simulator.hasPendingActions()) {
    simulator.step();
  }
}

describe("Heartbeat transitions", () => {
  it("creates one heartbeat for each follower and not for the leader", () => {
    const state = stateWithLeader();
    const result = handleHeartbeatRound(
      state,
      {
        id: "action",
        type: SEND_HEARTBEAT_ROUND,
        scheduledTime: 2100,
        sequence: 1,
        payload: { leaderId: "B", round: 1, totalRounds: 2 },
      },
      testContext(),
    );

    expect(result.outgoingMessages).toHaveLength(4);
    expect(result.outgoingMessages?.map((message) => message.to)).toEqual(["A", "C", "D", "E"]);
    expect(result.outgoingMessages?.some((message) => message.to === "B")).toBe(false);
    for (const message of result.outgoingMessages ?? []) {
      expect(message.type).toBe("append_entries");
      expect(isHeartbeatMessage(message)).toBe(true);
      expect(message.payload).toMatchObject({
        term: 1,
        leaderId: "B",
        prevLogIndex: 0,
        prevLogTerm: 0,
        entries: [],
        leaderCommit: 0,
        purpose: "heartbeat",
      });
    }
  });

  it("does not create heartbeat messages from follower or crashed nodes", () => {
    const followerState = createInitialClusterState(["A", "B"]);
    const followerResult = handleHeartbeatRound(
      followerState,
      { id: "action", type: SEND_HEARTBEAT_ROUND, scheduledTime: 1, sequence: 1, payload: { leaderId: "B", round: 1, totalRounds: 2 } },
      testContext(),
    );
    expect(followerResult.outgoingMessages).toBeUndefined();

    const crashedState = stateWithLeader();
    crashedState.nodes.B.status = "crashed";
    const crashedResult = handleHeartbeatRound(
      crashedState,
      { id: "action", type: SEND_HEARTBEAT_ROUND, scheduledTime: 1, sequence: 1, payload: { leaderId: "B", round: 1, totalRounds: 2 } },
      testContext(),
    );
    expect(crashedResult.outgoingMessages).toBeUndefined();
  });

  it("delivers a valid heartbeat, resets election timer, and creates a response", () => {
    const state = createInitialClusterState(["A", "B"]);
    state.nodes.A.currentTerm = 1;
    state.nodes.A.electionElapsed = 850;
    state.nodes.B = leaderNode();
    state.messages = [heartbeatMessage()];

    const result = handleAppendEntriesDelivery(
      state,
      { id: "action", type: DELIVER_APPEND_ENTRIES, scheduledTime: 2200, sequence: 1, payload: { messageId: "message-1" } },
      testContext(),
    );

    expect(result.nextState.nodes.A.electionElapsed).toBe(0);
    expect(result.nextState.nodes.A.lastHeartbeatReceivedAt).toBe(2200);
    expect(result.nextState.nodes.A.log).toEqual([]);
    expect(result.nextState.nodes.A.commitIndex).toBe(0);
    expect(result.nextState.nodes.A.lastApplied).toBe(0);
    expect(result.outgoingMessages?.[0].type).toBe("append_entries_response");
    expect(result.outgoingMessages?.[0].payload).toMatchObject({
      success: true,
      matchIndex: 0,
    });
  });

  it("rejects lower-term heartbeat without resetting the election timer", () => {
    const state = createInitialClusterState(["A", "B"]);
    state.nodes.A.currentTerm = 2;
    state.nodes.A.electionElapsed = 850;
    state.messages = [heartbeatMessage({ term: 1, payload: { term: 1, leaderId: "B", prevLogIndex: 0, prevLogTerm: 0, entries: [], leaderCommit: 0, purpose: "heartbeat" } })];

    const result = handleAppendEntriesDelivery(
      state,
      { id: "action", type: DELIVER_APPEND_ENTRIES, scheduledTime: 2200, sequence: 1, payload: { messageId: "message-1" } },
      testContext(),
    );

    expect(result.nextState.nodes.A.electionElapsed).toBe(850);
    expect(result.outgoingMessages?.[0].payload).toMatchObject({ success: false, term: 2 });
  });

  it("updates higher term receivers and demotes candidates or old leaders to follower", () => {
    for (const role of ["candidate", "leader"] as const) {
      const state = createInitialClusterState(["A", "B"]);
      state.nodes.A = {
        ...state.nodes.A,
        role,
        currentTerm: 1,
        votedFor: "A",
        votesReceived: ["A"],
      };
      state.messages = [heartbeatMessage({ term: 2, payload: { term: 2, leaderId: "B", prevLogIndex: 0, prevLogTerm: 0, entries: [], leaderCommit: 0, purpose: "heartbeat" } })];

      const result = handleAppendEntriesDelivery(
        state,
        { id: "action", type: DELIVER_APPEND_ENTRIES, scheduledTime: 2200, sequence: 1, payload: { messageId: "message-1" } },
        testContext(),
      );

      expect(result.nextState.nodes.A.currentTerm).toBe(2);
      expect(result.nextState.nodes.A.role).toBe("follower");
      expect(result.nextState.nodes.A.votesReceived).toBeUndefined();
    }
  });

  it("demotes a current-term candidate after a valid heartbeat", () => {
    const state = createInitialClusterState(["A", "B"]);
    state.nodes.A = {
      ...state.nodes.A,
      role: "candidate",
      currentTerm: 1,
      votesReceived: ["A"],
    };
    state.messages = [heartbeatMessage()];

    const result = handleAppendEntriesDelivery(
      state,
      { id: "action", type: DELIVER_APPEND_ENTRIES, scheduledTime: 2200, sequence: 1, payload: { messageId: "message-1" } },
      testContext(),
    );

    expect(result.nextState.nodes.A.role).toBe("follower");
    expect(result.nextState.nodes.A.votesReceived).toBeUndefined();
  });

  it("checks log matching for empty and non-empty logs", () => {
    const log = [
      { index: 1, term: 1, command: "SET x=1", committed: false, applied: false },
    ];

    expect(logMatchesAt([], 0, 0)).toBe(true);
    expect(logMatchesAt(log, 2, 1)).toBe(false);
    expect(logMatchesAt(log, 1, 2)).toBe(false);
    expect(logMatchesAt(log, 1, 1)).toBe(true);
  });

  it("delivers append entries responses and handles term rules", () => {
    const lower = runResponse(responseMessage({ term: 0, payload: { term: 0, success: true, followerId: "A", matchIndex: 0 } }));
    expect(lower.nextState.nodes.B.role).toBe("leader");
    expect(lower.nextState.nodes.B.commitIndex).toBe(0);

    const higher = runResponse(responseMessage({ term: 2, payload: { term: 2, success: true, followerId: "A", matchIndex: 0 } }));
    expect(higher.nextState.nodes.B.role).toBe("follower");
    expect(higher.nextState.nodes.B.currentTerm).toBe(2);
  });

  it("runs the full scenario with two finite heartbeat rounds", () => {
    const simulator = createBasicLeaderElectionSimulator();

    runAll(simulator);
    const state = simulator.getState();
    const heartbeats = state.messages.filter(isHeartbeatMessage);

    expect(simulator.hasPendingActions()).toBe(false);
    expect(heartbeats).toHaveLength(8);
    expect(state.nodes.B.role).toBe("leader");
    expect(Object.values(state.nodes).every((node) => node.currentTerm === 1)).toBe(true);
    expect(["A", "C", "D", "E"].every((nodeId) => state.nodes[nodeId].lastHeartbeatReceivedAt !== undefined)).toBe(true);
    expect(Object.values(state.nodes).every((node) => node.log.length === 0)).toBe(true);
    expect(Object.values(state.nodes).every((node) => node.commitIndex === 0)).toBe(true);
    expect(Object.values(state.nodes).every((node) => node.lastApplied === 0)).toBe(true);
  });

  it("is deterministic across reset and rerun", () => {
    const simulator = createBasicLeaderElectionSimulator();

    runAll(simulator);
    const first = summarize(simulator.getState().messages);
    simulator.reset();
    runAll(simulator);
    const second = summarize(simulator.getState().messages);

    expect(second).toEqual(first);
  });

  it("recognizes all message kinds with type guards", () => {
    expect(isRequestVoteMessage(requestVoteMessage())).toBe(true);
    expect(isRequestVoteResponseMessage(voteResponseMessage())).toBe(true);
    expect(isAppendEntriesMessage(heartbeatMessage())).toBe(true);
    expect(isHeartbeatMessage(heartbeatMessage())).toBe(true);
    expect(isAppendEntriesResponseMessage(responseMessage())).toBe(true);
  });
});

function stateWithLeader() {
  const state = createInitialClusterState(["A", "B", "C", "D", "E"]);
  state.nodes.B = leaderNode();
  for (const nodeId of ["A", "C", "D", "E"]) {
    state.nodes[nodeId].currentTerm = 1;
  }
  return state;
}

function leaderNode(overrides: Partial<RaftNode> = {}): RaftNode {
  return {
    id: "B",
    role: "leader",
    status: "running",
    currentTerm: 1,
    votedFor: "B",
    log: [],
    commitIndex: 0,
    lastApplied: 0,
    electionElapsed: 0,
    electionTimeout: 0,
    heartbeatElapsed: 0,
    partitionId: null,
    votesReceived: ["B", "A", "C"],
    nextIndex: { A: 1, B: 1, C: 1, D: 1, E: 1 },
    matchIndex: { A: 0, B: 0, C: 0, D: 0, E: 0 },
    ...overrides,
  };
}

function heartbeatMessage(overrides: Partial<RaftMessage> = {}): RaftMessage {
  return {
    id: "message-1",
    type: "append_entries",
    from: "B",
    to: "A",
    term: 1,
    status: "queued",
    createdAtLogicalTime: 2100,
    payload: {
      term: 1,
      leaderId: "B",
      prevLogIndex: 0,
      prevLogTerm: 0,
      entries: [],
      leaderCommit: 0,
      purpose: "heartbeat",
    },
    ...overrides,
  };
}

function responseMessage(overrides: Partial<RaftMessage> = {}): RaftMessage {
  return {
    id: "message-1",
    type: "append_entries_response",
    from: "A",
    to: "B",
    term: 1,
    status: "queued",
    createdAtLogicalTime: 2140,
    payload: {
      term: 1,
      success: true,
      followerId: "A",
      matchIndex: 0,
    },
    ...overrides,
  };
}

function requestVoteMessage(): RaftMessage {
  return {
    id: "rv",
    type: "request_vote",
    from: "B",
    to: "A",
    term: 1,
    status: "queued",
    payload: { term: 1, candidateId: "B", lastLogIndex: 0, lastLogTerm: 0 },
  };
}

function voteResponseMessage(): RaftMessage {
  return {
    id: "rvr",
    type: "request_vote_response",
    from: "A",
    to: "B",
    term: 1,
    status: "queued",
    payload: { term: 1, voteGranted: true, voterId: "A" },
  };
}

function runResponse(message: RaftMessage) {
  const state = createInitialClusterState(["A", "B"]);
  state.nodes.B = leaderNode();
  state.messages = [message];

  return handleAppendEntriesResponseDelivery(
    state,
    {
      id: "action",
      type: DELIVER_APPEND_ENTRIES_RESPONSE,
      scheduledTime: 2300,
      sequence: 1,
      payload: { messageId: message.id },
    },
    testContext(),
  );
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
